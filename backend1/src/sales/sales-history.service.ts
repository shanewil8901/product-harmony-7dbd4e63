import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { SalesHistory, SalesHistoryAction } from './sales-history.entity';
import { SalesOrder } from './sales-order.entity';

const TRACKED_FIELDS: (keyof SalesOrder)[] = [
  'customer_id',
  'order_date',
  'expected_delivery_date',
  'status',
  'currency_id',
  'subtotal',
  'vat_rate',
  'vat_amount',
  'discount_amount',
  'total_amount',
  'amount_paid',
  'invoice_no',
  'notes',
  'cancel_reason',
];

/** Append-only audit trail for sales orders — mirrors the stock history model. */
@Injectable()
export class SalesHistoryService {
  constructor(
    @InjectRepository(SalesHistory) private readonly repo: Repository<SalesHistory>,
  ) {}

  listForOrder(orderId: string) {
    return this.repo.find({
      where: { order_id: orderId },
      order: { changed_at: 'DESC' },
    });
  }

  async logCreate(order: SalesOrder | Record<string, unknown>, actor: string, mgr?: EntityManager) {
    await this.save(
      {
        order_id: String((order as { id: string }).id),
        action: 'create',
        changes: null,
        snapshot: order,
        changed_by: actor,
      },
      mgr,
    );
  }

  async logDelete(order: SalesOrder | Record<string, unknown>, actor: string, mgr?: EntityManager) {
    await this.save(
      {
        order_id: String((order as { id: string }).id),
        action: 'delete',
        changes: null,
        snapshot: order,
        changed_by: actor,
      },
      mgr,
    );
  }

  async logUpdate(
    orderId: string,
    before: Partial<SalesOrder>,
    after: Partial<SalesOrder>,
    actor: string,
    mgr?: EntityManager,
  ) {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of TRACKED_FIELDS) {
      const from = (before as Record<string, unknown>)[key as string];
      const to = (after as Record<string, unknown>)[key as string];
      const fromStr = from instanceof Date ? from.toISOString() : String(from ?? '');
      const toStr = to instanceof Date ? to.toISOString() : String(to ?? '');
      if (fromStr !== toStr) changes[key as string] = { from: from ?? null, to: to ?? null };
    }
    if (Object.keys(changes).length === 0) return;
    const action: SalesHistoryAction =
      Object.keys(changes).length === 1 && changes.status ? 'status_change' : 'update';
    await this.save(
      { order_id: orderId, action, changes, snapshot: after, changed_by: actor },
      mgr,
    );
  }

  async logStatusChange(
    orderId: string,
    from: string,
    to: string,
    actor: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.save({
      order_id: orderId,
      action: 'status_change',
      changes: { status: { from, to }, ...extra },
      snapshot: null,
      changed_by: actor,
    });
  }

  async logDocument(
    orderId: string,
    info: { doc_type: string; doc_number: string },
    actor: string,
  ) {
    await this.save({
      order_id: orderId,
      action: 'document',
      changes: info,
      snapshot: null,
      changed_by: actor,
    });
  }

  async logPayment(
    orderId: string,
    info: {
      method: string;
      amount: string | number;
      status: string;
      reference?: string | null;
      note?: string | null;
    },
    actor: string,
  ) {
    await this.save({
      order_id: orderId,
      action: 'payment',
      changes: info,
      snapshot: null,
      changed_by: actor,
    });
  }

  private async save(partial: Partial<SalesHistory>, mgr?: EntityManager): Promise<void> {
    if (mgr) {
      await mgr.save(mgr.create(SalesHistory, partial));
      return;
    }
    await this.repo.save(this.repo.create(partial));
  }
}
