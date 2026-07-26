import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StockDocument, StockDocType } from './stock-document.entity';
import { Stock } from './stock.entity';
import { ALLOWED_FROM, DOC_TYPE_PREFIX, DOC_TYPE_TO_STATUS } from './lifecycle';
import { StockHistoryService } from './stock-history.service';

@Injectable()
export class StockDocumentsService {
  constructor(
    @InjectRepository(StockDocument) private readonly repo: Repository<StockDocument>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    private readonly dataSource: DataSource,
    private readonly history: StockHistoryService,
  ) {}

  private async nextDocNumber(docType: StockDocType): Promise<string> {
    const prefix = DOC_TYPE_PREFIX[docType];
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const like = `${prefix}-${datePart}-%`;
    const last = await this.repo
      .createQueryBuilder('d')
      .withDeleted()
      .where('d.doc_number LIKE :like', { like })
      .orderBy('d.doc_number', 'DESC')
      .getOne();
    let seq = 1;
    if (last) {
      const tail = last.doc_number.split('-').pop() ?? '0';
      seq = Number(tail) + 1;
    }
    return `${prefix}-${datePart}-${String(seq).padStart(4, '0')}`;
  }

  async listForStock(stockId: string) {
    return this.repo.find({ where: { stock_id: stockId }, order: { generated_at: 'ASC' } });
  }

  async findOne(id: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /**
   * Create a document for a stock row and advance the stock status.
   * Used both by the auto-PO on stock creation and by manual next-stage submissions.
   */
  async createForStock(
    stockId: string,
    docType: StockDocType,
    payload: Record<string, unknown> | undefined,
    userEmail: string,
    opts: { skipTransitionCheck?: boolean } = {},
  ): Promise<{ document: StockDocument; stock: Stock }> {
    return this.dataSource.transaction(async (mgr) => {
      const stock = await mgr.findOne(Stock, { where: { id: stockId } });
      if (!stock) throw new NotFoundException('Stock not found');

      if (!opts.skipTransitionCheck) {
        const allowed = ALLOWED_FROM[docType];
        if (!allowed.includes(stock.status)) {
          throw new BadRequestException(
            `Cannot generate ${docType} while stock is "${stock.status}". Allowed from: ${allowed.join(', ')}.`,
          );
        }
      }

      const doc_number = await this.nextDocNumber(docType);
      const doc = mgr.create(StockDocument, {
        stock_id: stockId,
        doc_type: docType,
        doc_number,
        payload: payload ?? null,
        generated_by: userEmail,
      });
      const saved = await mgr.save(doc);

      stock.status = DOC_TYPE_TO_STATUS[docType];
      stock.updated_by = userEmail;
      await mgr.save(stock);

      return { document: saved, stock };
    });
  }
}
