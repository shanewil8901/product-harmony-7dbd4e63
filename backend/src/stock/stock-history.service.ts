import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StockHistory, StockHistoryAction } from './stock-history.entity';
import { Stock } from './stock.entity';

const TRACKED_FIELDS: (keyof Stock)[] = [
  'product_id',
  'vendor_id',
  'vendor_name',
  'batch_no',
  'qty',
  'qty_uom_id',
  'buying_price_snapshot',
  'buying_currency_id_snapshot',
  'selling_price_snapshot',
  'selling_currency_id_snapshot',
  'manufacture_date',
  'expiry_date',
  'ordered_at',
  'status',
  'notes',
];

@Injectable()
export class StockHistoryService {
  constructor(
    @InjectRepository(StockHistory) private readonly repo: Repository<StockHistory>,
  ) {}

  listForStock(stockId: string) {
    return this.repo.find({
      where: { stock_id: stockId },
      order: { changed_at: 'DESC' },
    });
  }

  async logCreate(stock: Stock, userEmail: string, mgr?: EntityManager) {
    await this.save(
      {
        stock_id: stock.id,
        action: 'create',
        changes: null,
        snapshot: stock,
        changed_by: userEmail,
      },
      mgr,
    );
  }

  async logDelete(stock: Stock, userEmail: string, mgr?: EntityManager) {
    await this.save(
      {
        stock_id: stock.id,
        action: 'delete',
        changes: null,
        snapshot: stock,
        changed_by: userEmail,
      },
      mgr,
    );
  }

  async logUpdate(
    stockId: string,
    before: Partial<Stock>,
    after: Partial<Stock>,
    userEmail: string,
    mgr?: EntityManager,
  ) {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of TRACKED_FIELDS) {
      const from = (before as Record<string, unknown>)[key as string];
      const to = (after as Record<string, unknown>)[key as string];
      const fromStr = from instanceof Date ? from.toISOString() : String(from ?? '');
      const toStr = to instanceof Date ? to.toISOString() : String(to ?? '');
      if (fromStr !== toStr) {
        changes[key as string] = { from: from ?? null, to: to ?? null };
      }
    }
    if (Object.keys(changes).length === 0) return;
    await this.save(
      {
        stock_id: stockId,
        action: 'update',
        changes,
        snapshot: after,
        changed_by: userEmail,
      },
      mgr,
    );
  }

  async logDocument(
    stockId: string,
    info: {
      doc_type: string;
      doc_number: string;
      status_from: string;
      status_to: string;
      total_amount?: string | null;
      currency_code?: string | null;
    },
    userEmail: string,
    mgr?: EntityManager,
  ) {
    const action: StockHistoryAction =
      info.status_from === info.status_to ? 'document' : 'status_change';
    await this.save(
      {
        stock_id: stockId,
        action,
        changes: info,
        snapshot: null,
        changed_by: userEmail,
      },
      mgr,
    );
  }

  /** Files attached at any lifecycle stage are part of the audit trail. */
  async logAttachment(
    stockId: string,
    info: {
      stage: string;
      file_name: string;
      attachment_id: string;
      action: 'uploaded' | 'deleted';
    },
    userEmail: string,
    mgr?: EntityManager,
  ) {
    await this.save(
      {
        stock_id: stockId,
        action: 'attachment',
        changes: info,
        snapshot: null,
        changed_by: userEmail,
      },
      mgr,
    );
  }

  private async save(
    partial: Partial<StockHistory>,
    mgr?: EntityManager,
  ): Promise<void> {
    if (mgr) {
      const rec = mgr.create(StockHistory, partial);
      await mgr.save(rec);
      return;
    }
    const rec = this.repo.create(partial);
    await this.repo.save(rec);
  }
}
