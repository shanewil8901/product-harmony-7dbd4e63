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
    const docs = await this.repo.find({ where: { stock_id: stockId } });
    // Latest lifecycle stage first (cancellation/write-off, then payment_receipt → inquiry).
    const rank: Record<StockDocType, number> = {
      inquiry: 1,
      quotation: 2,
      po: 3,
      vendor_invoice: 4,
      payment: 5,
      shipping: 6,
      customs_clearance: 7,
      dispatch: 8,
      grn: 9,
      putaway: 10,
      sales_invoice: 11,
      payment_receipt: 12,
      write_off: 13,
      cancellation: 14,
    };
    return docs.sort((a, b) => {
      const diff = (rank[b.doc_type] ?? 0) - (rank[a.doc_type] ?? 0);
      if (diff !== 0) return diff;
      return new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
    });
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
    opts: {
      skipTransitionCheck?: boolean;
      total_amount?: number;
      currency_code?: string;
    } = {},
  ): Promise<{ document: StockDocument; stock: Stock }> {
    return this.dataSource.transaction(async (mgr) => {
      const stock = await mgr.findOne(Stock, { where: { id: stockId } });
      if (!stock) throw new NotFoundException('Stock not found');

      // Prevent duplicates: each doc_type may only be generated once per stock row.
      const existing = await mgr.findOne(StockDocument, {
        where: { stock_id: stockId, doc_type: docType },
      });
      if (existing) {
        throw new BadRequestException(
          `A ${docType} document (${existing.doc_number}) has already been generated for this stock.`,
        );
      }

      if (!opts.skipTransitionCheck) {
        const allowed = ALLOWED_FROM[docType];
        if (!allowed.includes(stock.status)) {
          throw new BadRequestException(
            `Cannot generate ${docType} while stock is "${stock.status}". Allowed from: ${allowed.join(', ')}.`,
          );
        }
      }

      // Currency is mandatory as soon as a monetary total is recorded.
      if (opts.total_amount !== undefined && !opts.currency_code) {
        throw new BadRequestException('currency_code is required when a total amount is provided');
      }

      const doc_number = await this.nextDocNumber(docType);
      const doc = mgr.create(StockDocument, {
        stock_id: stockId,
        doc_type: docType,
        doc_number,
        payload: payload ?? null,
        total_amount: opts.total_amount !== undefined ? opts.total_amount.toFixed(2) : null,
        currency_code: opts.total_amount !== undefined ? (opts.currency_code ?? null) : null,
        generated_by: userEmail,
      });
      const saved = await mgr.save(doc);


      const statusFrom = stock.status;
      const statusTo = DOC_TYPE_TO_STATUS[docType];
      stock.status = statusTo;
      stock.updated_by = userEmail;
      await mgr.save(stock);

      await this.history.logDocument(
        stockId,
        {
          doc_type: docType,
          doc_number,
          status_from: statusFrom,
          status_to: statusTo,
          total_amount: saved.total_amount,
          currency_code: saved.currency_code,
        },
        userEmail,
        mgr,
      );


      return { document: saved, stock };
    });
  }
}
