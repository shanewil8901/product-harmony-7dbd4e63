import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { StockAttachment, StockAttachmentStage } from './stock-attachment.entity';
import { Stock } from './stock.entity';
import { STOCK_DOC_TYPES } from './stock-document.entity';
import { StockHistoryService } from './stock-history.service';

export const STOCK_ATTACHMENT_STAGES: StockAttachmentStage[] = [
  'general',
  ...STOCK_DOC_TYPES,
];

@Injectable()
export class StockAttachmentsService {
  constructor(
    @InjectRepository(StockAttachment) private readonly repo: Repository<StockAttachment>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    private readonly history: StockHistoryService,
  ) {}

  private async assertStock(stockId: string) {
    const stock = await this.stockRepo.findOne({ where: { id: stockId } });
    if (!stock) throw new NotFoundException('Stock not found');
    return stock;
  }

  listForStock(stockId: string) {
    return this.repo.find({ where: { stock_id: stockId }, order: { uploaded_at: 'DESC' } });
  }

  async add(
    stockId: string,
    file: Express.Multer.File | undefined,
    body: { stage?: StockAttachmentStage; reference_no?: string; notes?: string },
    userEmail: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    await this.assertStock(stockId);

    const stage = body.stage ?? 'general';
    if (!STOCK_ATTACHMENT_STAGES.includes(stage)) {
      // Remove the already-written temp file so orphans don't pile up on disk.
      await fs.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(`Invalid stage "${stage}"`);
    }

    const saved = await this.repo.save(
      this.repo.create({
        stock_id: stockId,
        stage,
        file_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        storage_path: file.path,
        reference_no: body.reference_no ?? null,
        notes: body.notes ?? null,
        uploaded_by: userEmail,
      }),
    );

    await this.history.logAttachment(
      stockId,
      { stage, file_name: saved.file_name, attachment_id: saved.id, action: 'uploaded' },
      userEmail,
    );

    return saved;
  }

  async getOne(stockId: string, attachmentId: string) {
    const doc = await this.repo.findOne({ where: { id: attachmentId, stock_id: stockId } });
    if (!doc) throw new NotFoundException('Attachment not found');
    return doc;
  }

  async remove(stockId: string, attachmentId: string, userEmail: string) {
    const doc = await this.getOne(stockId, attachmentId);
    await fs.unlink(doc.storage_path).catch(() => undefined);
    await this.repo.remove(doc);
    await this.history.logAttachment(
      stockId,
      {
        stage: doc.stage,
        file_name: doc.file_name,
        attachment_id: attachmentId,
        action: 'deleted',
      },
      userEmail,
    );
    return { id: attachmentId, deleted: true };
  }
}
