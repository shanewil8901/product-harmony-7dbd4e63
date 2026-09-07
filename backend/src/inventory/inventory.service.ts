import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { Stock, type StockStatus } from '../stock/stock.entity';
import { SalesOrderItem } from '../sales/sales-order-item.entity';
import { SalesOrder, type SalesOrderStatus } from '../sales/sales-order.entity';
import { ADJUSTMENT_SIGN, StockAdjustment } from './stock-adjustment.entity';

/**
 * Inventory is a *derived* view — nothing is ever written here.
 *
 *  on hand   = goods that physically reached the warehouse (stock lifecycle)
 *              minus quantities committed on non-draft, non-cancelled sales orders
 *  incoming  = procurement pipeline that has not been received yet
 *  written off = expired / written-off batches
 */

/** Stock rows whose goods have physically arrived at the warehouse. */
export const RECEIVED_STATUSES: StockStatus[] = [
  'received',
  'in_warehouse',
  'sold_out',
  'settled',
];

/** Procurement in progress — ordered but not yet in the warehouse. */
export const INCOMING_STATUSES: StockStatus[] = [
  'inquiry_sent',
  'quotation_received',
  'quotation_approved',
  'invoice_received',
  'payment_processed',
  'shipped',
  'customs_cleared',
  'ordered',
  'in_transit',
];

export const WRITTEN_OFF_STATUSES: StockStatus[] = ['expired'];

/** Sales order states that consume stock. Drafts and cancellations do not. */
export const CONSUMING_SALES_STATUSES: SalesOrderStatus[] = [
  'confirmed',
  'delivered',
  'invoiced',
  'paid',
];

/** Committed but not yet handed over. */
export const RESERVED_SALES_STATUSES: SalesOrderStatus[] = ['confirmed'];

export interface InventoryRow {
  product_id: string;
  product_code: string;
  description: string;
  product_barcode: string | null;
  department_name: string | null;
  vendor_name: string | null;
  uom_code: string | null;
  received_qty: string;
  incoming_qty: string;
  written_off_qty: string;
  sold_qty: string;
  adjusted_qty: string;
  returned_qty: string;
  reserved_qty: string;
  available_qty: string;
  avg_unit_cost: string;
  cost_currency: string | null;
  available_value: string;
  batches: number;
  last_movement_at: string | null;
  status: 'out_of_stock' | 'low_stock' | 'in_stock';
}

const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(SalesOrderItem) private readonly itemRepo: Repository<SalesOrderItem>,
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepo: Repository<StockAdjustment>,
  ) {}

  private num(v: unknown) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  async overview(q: { search?: string; status?: string } = {}) {
    const products = await this.productRepo.find({
      where: { deleted_at: IsNull() },
      relations: ['department', 'base_uom', 'vendor'],
      order: { created_at: 'DESC' },
    });

    const stocks = await this.stockRepo.find({
      where: { deleted_at: IsNull() },
      relations: ['qty_uom', 'buying_currency_snapshot'],
    });

    const adjustments = await this.adjustmentRepo.find({ where: { deleted_at: IsNull() } });

    const items = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.order', 'o')
      .where('o.deleted_at IS NULL')
      .getMany();

    const rows: InventoryRow[] = products.map((p) => {
      const batches = stocks.filter((s) => s.product_id === p.id);
      const received = batches.filter((s) => RECEIVED_STATUSES.includes(s.status));
      const incoming = batches.filter((s) => INCOMING_STATUSES.includes(s.status));
      const writtenOff = batches.filter((s) => WRITTEN_OFF_STATUSES.includes(s.status));

      const receivedQty = received.reduce((a, s) => a + this.num(s.qty), 0);
      const receivedValue = received.reduce(
        (a, s) => a + this.num(s.qty) * this.num(s.buying_price_snapshot),
        0,
      );
      const incomingQty = incoming.reduce((a, s) => a + this.num(s.qty), 0);
      const writtenOffQty = writtenOff.reduce((a, s) => a + this.num(s.qty), 0);

      const lines = items.filter((i) => i.product_id === p.id);
      const soldQty = lines
        .filter((i) => CONSUMING_SALES_STATUSES.includes(i.order.status))
        .reduce((a, i) => a + this.num(i.qty), 0);
      const reservedQty = lines
        .filter((i) => RESERVED_SALES_STATUSES.includes(i.order.status))
        .reduce((a, i) => a + this.num(i.qty), 0);

      const productAdj = adjustments.filter((a) => a.product_id === p.id);
      const adjustedQty = productAdj.reduce(
        (a, x) => a + ADJUSTMENT_SIGN[x.type] * this.num(x.qty),
        0,
      );
      const returnedQty = productAdj
        .filter((x) => x.type === 'customer_return')
        .reduce((a, x) => a + this.num(x.qty), 0);

      const availableQty = receivedQty - soldQty + adjustedQty;
      const avgCost = receivedQty > 0 ? receivedValue / receivedQty : 0;
      const currency =
        received.find((s) => s.buying_currency_snapshot?.code)?.buying_currency_snapshot?.code ??
        null;

      const lastMovement = batches
        .map((s) => s.updated_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      const status: InventoryRow['status'] =
        availableQty <= 0 ? 'out_of_stock' : availableQty <= LOW_STOCK_THRESHOLD ? 'low_stock' : 'in_stock';

      return {
        product_id: p.id,
        product_code: p.productCode,
        description: p.description,
        product_barcode: p.product_barcode,
        department_name: p.department?.name ?? null,
        vendor_name: p.vendor?.legal_name ?? null,
        uom_code: p.base_uom?.code ?? received[0]?.qty_uom?.code ?? null,
        received_qty: receivedQty.toFixed(3),
        incoming_qty: incomingQty.toFixed(3),
        written_off_qty: writtenOffQty.toFixed(3),
        sold_qty: soldQty.toFixed(3),
        reserved_qty: reservedQty.toFixed(3),
        adjusted_qty: adjustedQty.toFixed(3),
        returned_qty: returnedQty.toFixed(3),
        available_qty: availableQty.toFixed(3),
        avg_unit_cost: avgCost.toFixed(2),
        cost_currency: currency,
        available_value: (Math.max(availableQty, 0) * avgCost).toFixed(2),
        batches: batches.length,
        last_movement_at: lastMovement ? new Date(lastMovement).toISOString() : null,
        status,
      };
    });

    let filtered = rows;
    const term = q.search?.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(
        (r) =>
          r.product_code.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          (r.product_barcode ?? '').toLowerCase().includes(term),
      );
    }
    if (q.status && q.status !== 'all') {
      filtered = filtered.filter((r) => r.status === q.status);
    }

    const valueByCurrency = new Map<string, number>();
    for (const r of filtered) {
      const code = r.cost_currency ?? '—';
      valueByCurrency.set(code, (valueByCurrency.get(code) ?? 0) + Number(r.available_value));
    }

    return {
      items: filtered,
      summary: {
        products: filtered.length,
        in_stock: filtered.filter((r) => r.status === 'in_stock').length,
        low_stock: filtered.filter((r) => r.status === 'low_stock').length,
        out_of_stock: filtered.filter((r) => r.status === 'out_of_stock').length,
        total_available_qty: filtered
          .reduce((a, r) => a + Number(r.available_qty), 0)
          .toFixed(3),
        total_incoming_qty: filtered.reduce((a, r) => a + Number(r.incoming_qty), 0).toFixed(3),
        value_by_currency: [...valueByCurrency.entries()].map(([currency_code, value]) => ({
          currency_code,
          total_value: value.toFixed(2),
        })),
      },
      low_stock_threshold: LOW_STOCK_THRESHOLD,
    };
  }

  /** Per-product ledger: every inbound batch and every outbound sales line. */
  async movements(productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['base_uom'],
    });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const batches = await this.stockRepo.find({
      where: { product_id: productId, deleted_at: IsNull() },
      relations: ['vendor', 'qty_uom', 'buying_currency_snapshot'],
      order: { created_at: 'DESC' },
    });

    const lines = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.order', 'o')
      .where('o.deleted_at IS NULL')
      .andWhere('i.product_id = :pid', { pid: productId })
      .orderBy('o.order_date', 'DESC')
      .getMany();

    const adjustments = await this.adjustmentRepo.find({
      where: { product_id: productId, deleted_at: IsNull() },
      relations: ['vendor', 'stock'],
      order: { adjusted_at: 'DESC' },
    });

    return {
      product: {
        id: product.id,
        product_code: product.productCode,
        description: product.description,
        uom_code: product.base_uom?.code ?? null,
      },
      inbound: batches.map((s) => ({
        id: s.id,
        kind: 'in' as const,
        date: (s.ordered_at ?? s.created_at)?.toString() ?? null,
        reference: s.batch_no ?? s.id.slice(0, 8),
        party: s.vendor?.legal_name ?? null,
        status: s.status,
        counts: RECEIVED_STATUSES.includes(s.status),
        qty: Number(s.qty).toFixed(3),
        unit_value: Number(s.buying_price_snapshot).toFixed(2),
        currency_code: s.buying_currency_snapshot?.code ?? null,
      })),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        type: a.type,
        sign: ADJUSTMENT_SIGN[a.type],
        date: a.adjusted_at ? new Date(a.adjusted_at).toISOString() : null,
        reference: a.reference_no ?? a.stock?.batch_no ?? a.id.slice(0, 8),
        party: a.vendor?.legal_name ?? null,
        reason: a.reason,
        qty: Number(a.qty).toFixed(3),
        created_by: a.created_by,
      })),
      outbound: lines.map((i) => ({
        id: i.id,
        kind: 'out' as const,
        date: i.order.order_date,
        reference: i.order.order_no,
        party: i.order.customer?.legal_name ?? null,
        status: i.order.status,
        counts: CONSUMING_SALES_STATUSES.includes(i.order.status),
        qty: Number(i.qty).toFixed(3),
        unit_value: Number(i.unit_price).toFixed(2),
        currency_code: i.order.currency?.code ?? null,
      })),
    };
  }

  /** Supplier-centric view: what each vendor supplied, its value and current issues. */
  async vendorBreakdown(q: { search?: string } = {}) {
    const overview = await this.overview();
    const byProduct = new Map(overview.items.map((r) => [r.product_id, r]));

    const stocks = await this.stockRepo.find({
      where: { deleted_at: IsNull() },
      relations: ['vendor', 'product', 'buying_currency_snapshot'],
    });
    const adjustments = await this.adjustmentRepo.find({
      where: { deleted_at: IsNull() },
      relations: ['vendor'],
    });

    interface Agg {
      vendor_id: string | null;
      vendor_name: string;
      vendor_code: string | null;
      products: Set<string>;
      batches: number;
      received_qty: number;
      incoming_qty: number;
      returned_qty: number;
      value_by_currency: Map<string, number>;
      low_stock_products: number;
      out_of_stock_products: number;
      last_movement_at: string | null;
    }
    const map = new Map<string, Agg>();
    const keyOf = (id: string | null, name: string) => `${id ?? 'none'}|${name}`;

    for (const s of stocks) {
      const name = s.vendor?.legal_name ?? 'Unassigned vendor';
      const key = keyOf(s.vendor_id, name);
      const agg =
        map.get(key) ??
        {
          vendor_id: s.vendor_id,
          vendor_name: name,
          vendor_code: s.vendor?.code ?? null,
          products: new Set<string>(),
          batches: 0,
          received_qty: 0,
          incoming_qty: 0,
          returned_qty: 0,
          value_by_currency: new Map<string, number>(),
          low_stock_products: 0,
          out_of_stock_products: 0,
          last_movement_at: null,
        };
      agg.products.add(s.product_id);
      agg.batches += 1;
      const qty = this.num(s.qty);
      if (RECEIVED_STATUSES.includes(s.status)) {
        agg.received_qty += qty;
        const code = s.buying_currency_snapshot?.code ?? '—';
        agg.value_by_currency.set(
          code,
          (agg.value_by_currency.get(code) ?? 0) + qty * this.num(s.buying_price_snapshot),
        );
      }
      if (INCOMING_STATUSES.includes(s.status)) agg.incoming_qty += qty;
      const moved = s.updated_at ? new Date(s.updated_at).toISOString() : null;
      if (moved && (!agg.last_movement_at || moved > agg.last_movement_at))
        agg.last_movement_at = moved;
      map.set(key, agg);
    }

    for (const a of adjustments) {
      if (a.type !== 'vendor_return' || !a.vendor_id) continue;
      const name = a.vendor?.legal_name ?? 'Unassigned vendor';
      const key = keyOf(a.vendor_id, name);
      const agg = map.get(key);
      if (agg) agg.returned_qty += this.num(a.qty);
    }

    for (const agg of map.values()) {
      for (const pid of agg.products) {
        const row = byProduct.get(pid);
        if (row?.status === 'low_stock') agg.low_stock_products += 1;
        if (row?.status === 'out_of_stock') agg.out_of_stock_products += 1;
      }
    }

    let vendors = [...map.values()].map((v) => ({
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      vendor_code: v.vendor_code,
      products: v.products.size,
      batches: v.batches,
      received_qty: v.received_qty.toFixed(3),
      incoming_qty: v.incoming_qty.toFixed(3),
      returned_qty: v.returned_qty.toFixed(3),
      low_stock_products: v.low_stock_products,
      out_of_stock_products: v.out_of_stock_products,
      last_movement_at: v.last_movement_at,
      value_by_currency: [...v.value_by_currency.entries()].map(([currency_code, value]) => ({
        currency_code,
        total_value: value.toFixed(2),
      })),
    }));

    const term = q.search?.trim().toLowerCase();
    if (term)
      vendors = vendors.filter(
        (v) =>
          v.vendor_name.toLowerCase().includes(term) ||
          (v.vendor_code ?? '').toLowerCase().includes(term),
      );

    vendors.sort((a, b) => Number(b.received_qty) - Number(a.received_qty));
    return { items: vendors };
  }

  /** Products at or below the low-stock threshold, worst first. */
  async alerts(threshold?: number) {
    const limit = threshold && threshold > 0 ? threshold : LOW_STOCK_THRESHOLD;
    const overview = await this.overview();
    const items = overview.items
      .filter((r) => Number(r.available_qty) <= limit)
      .map((r) => ({
        ...r,
        severity: (Number(r.available_qty) <= 0 ? 'critical' : 'warning') as
          | 'critical'
          | 'warning',
        suggested_reorder_qty: Math.max(limit * 2 - Number(r.available_qty), 0).toFixed(3),
      }))
      .sort((a, b) => Number(a.available_qty) - Number(b.available_qty));

    return {
      items,
      threshold: limit,
      critical: items.filter((i) => i.severity === 'critical').length,
      warning: items.filter((i) => i.severity === 'warning').length,
      incoming_cover: items.filter((i) => Number(i.incoming_qty) > 0).length,
    };
  }
}
