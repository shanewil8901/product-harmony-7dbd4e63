import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Stock } from '../stock/stock.entity';
import { StockDocument } from '../stock/stock-document.entity';
import { StockHistory } from '../stock/stock-history.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User } from '../users/user.entity';

/** Stages where the goods are still owned / in the pipeline (not closed out). */
const OPEN_STATUSES = new Set([
  'inquiry_sent',
  'quotation_received',
  'quotation_approved',
  'invoice_received',
  'payment_processed',
  'shipped',
  'customs_cleared',
  'ordered',
  'in_transit',
  'received',
  'in_warehouse',
]);

const ON_HAND_STATUSES = new Set(['received', 'in_warehouse']);

const MS_DAY = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}
function monthLabel(key: string) {
  const [y, m] = key.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1]} ${y}`;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(StockDocument) private readonly docRepo: Repository<StockDocument>,
    @InjectRepository(StockHistory) private readonly historyRepo: Repository<StockHistory>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async overview(days = 30) {
    const now = new Date();
    const since = new Date(now.getTime() - days * MS_DAY);

    const [stocks, docs, history, products, vendors, users] = await Promise.all([
      this.stockRepo.find({
        where: { deleted_at: IsNull() },
        relations: ['product', 'buying_currency_snapshot', 'qty_uom'],
      }),
      this.docRepo.find({ where: { deleted_at: IsNull() } }),
      this.historyRepo.find(),
      this.productRepo.find({ where: { deleted_at: IsNull() }, relations: ['department'] }),
      this.vendorRepo.find(),
      this.userRepo.find(),
    ]);

    const cur = (s: Stock) => s.buying_currency_snapshot?.code ?? '—';
    const cost = (s: Stock) => Number(s.qty) * Number(s.buying_price_snapshot);
    const margin = (s: Stock) =>
      Number(s.qty) * (Number(s.selling_price_snapshot) - Number(s.buying_price_snapshot));

    // ---- first document timestamps per stock, per doc type (lead-time maths) ----
    const docByStock = new Map<string, Map<string, Date>>();
    for (const d of docs) {
      const m = docByStock.get(d.stock_id) ?? new Map<string, Date>();
      const prev = m.get(d.doc_type);
      const at = new Date(d.generated_at);
      if (!prev || at < prev) m.set(d.doc_type, at);
      docByStock.set(d.stock_id, m);
    }
    const docAt = (stockId: string, type: string) => docByStock.get(stockId)?.get(type) ?? null;

    // ---------------- KPIs ----------------
    const openStocks = stocks.filter((s) => OPEN_STATUSES.has(s.status));
    const onHand = stocks.filter((s) => ON_HAND_STATUSES.has(s.status));

    const valueByCurrency = new Map<string, { on_hand: number; pipeline: number; lines: number }>();
    for (const s of stocks) {
      if (!OPEN_STATUSES.has(s.status)) continue;
      const e = valueByCurrency.get(cur(s)) ?? { on_hand: 0, pipeline: 0, lines: 0 };
      e.pipeline += cost(s);
      if (ON_HAND_STATUSES.has(s.status)) e.on_hand += cost(s);
      e.lines += 1;
      valueByCurrency.set(cur(s), e);
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryDays = (s: Stock) =>
      s.expiry_date ? Math.round((new Date(s.expiry_date).getTime() - today.getTime()) / MS_DAY) : null;

    const expiryRisk = openStocks
      .map((s) => ({ s, d: expiryDays(s) }))
      .filter((x) => x.d !== null && (x.d as number) <= 90);

    const kpis = {
      products: products.length,
      stock_lines_open: openStocks.length,
      stock_lines_on_hand: onHand.length,
      vendors_active: vendors.filter((v) => v.status === 'active').length,
      vendors_total: vendors.length,
      users: users.length,
      documents_period: docs.filter((d) => new Date(d.generated_at) >= since).length,
      new_stock_lines_period: stocks.filter((s) => new Date(s.created_at) >= since).length,
      expiry_risk_lines: expiryRisk.length,
      cancelled_lines: stocks.filter((s) => s.status === 'cancelled').length,
      inventory_value: [...valueByCurrency.entries()].map(([currency_code, v]) => ({
        currency_code,
        on_hand_value: round2(v.on_hand),
        pipeline_value: round2(v.pipeline),
        lines: v.lines,
      })),
    };

    // ---------------- Procurement pipeline (stage funnel) ----------------
    const statusCounts = new Map<string, number>();
    for (const s of stocks) statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
    const pipeline = [...statusCounts.entries()].map(([status, count]) => ({ status, count }));

    // ---------------- Monthly procurement value (last 12 months, per currency) ----------------
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }
    const monthlyMap = new Map<string, { lines: number; qty: number; by_currency: Record<string, number> }>();
    for (const k of months) monthlyMap.set(k, { lines: 0, qty: 0, by_currency: {} });
    for (const s of stocks) {
      const k = monthKey(new Date(s.ordered_at ?? s.created_at));
      const e = monthlyMap.get(k);
      if (!e) continue;
      e.lines += 1;
      e.qty += Number(s.qty);
      e.by_currency[cur(s)] = round2((e.by_currency[cur(s)] ?? 0) + cost(s));
    }
    const monthly_procurement = months.map((k) => ({
      month: k,
      label: monthLabel(k),
      ...monthlyMap.get(k)!,
      qty: round2(monthlyMap.get(k)!.qty),
    }));

    // ---------------- Daily activity (last `days`) ----------------
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) dayKeys.push(dayKey(new Date(now.getTime() - i * MS_DAY)));
    const dailyMap = new Map<string, { created: number; documents: number; sold: number }>();
    for (const k of dayKeys) dailyMap.set(k, { created: 0, documents: 0, sold: 0 });
    for (const s of stocks) {
      const e = dailyMap.get(dayKey(new Date(s.created_at)));
      if (e) e.created += 1;
    }
    for (const d of docs) {
      const e = dailyMap.get(dayKey(new Date(d.generated_at)));
      if (!e) continue;
      e.documents += 1;
      if (d.doc_type === 'sales_invoice') e.sold += 1;
    }
    const daily_activity = dayKeys.map((k) => ({
      date: k,
      label: k.slice(5),
      ...dailyMap.get(k)!,
    }));

    // ---------------- Fastest-selling stock (creation -> sales invoice) ----------------
    const fastest_moving = stocks
      .map((s) => {
        const sold = docAt(s.id, 'sales_invoice');
        if (!sold) return null;
        const daysToSell = (sold.getTime() - new Date(s.created_at).getTime()) / MS_DAY;
        return {
          stock_id: s.id,
          product_code: s.product?.productCode ?? null,
          product_description: s.product?.description ?? null,
          batch_no: s.batch_no,
          vendor_name: s.vendor_name,
          qty: Number(s.qty),
          uom: s.qty_uom?.code ?? null,
          sold_at: sold.toISOString(),
          days_to_sell: round2(Math.max(daysToSell, 0)),
          value: round2(cost(s)),
          currency_code: cur(s),
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.days_to_sell - b.days_to_sell)
      .slice(0, 10);

    // ---------------- Top / most important products ----------------
    const prodMap = new Map<
      string,
      {
        product_id: string;
        product_code: string | null;
        description: string | null;
        department: string | null;
        lines: number;
        qty: number;
        value: number;
        currency_code: string;
        sold_lines: number;
        margin: number;
      }
    >();
    for (const s of stocks) {
      const key = s.product_id;
      const e =
        prodMap.get(key) ?? {
          product_id: key,
          product_code: s.product?.productCode ?? null,
          description: s.product?.description ?? null,
          department: null,
          lines: 0,
          qty: 0,
          value: 0,
          currency_code: cur(s),
          sold_lines: 0,
          margin: 0,
        };
      e.lines += 1;
      e.qty += Number(s.qty);
      e.value += cost(s);
      e.margin += margin(s);
      if (docAt(s.id, 'sales_invoice')) e.sold_lines += 1;
      prodMap.set(key, e);
    }
    const deptById = new Map(products.map((p) => [p.id, p.department?.name ?? null]));
    const top_products = [...prodMap.values()]
      .map((e) => ({
        ...e,
        department: deptById.get(e.product_id) ?? null,
        qty: round2(e.qty),
        value: round2(e.value),
        margin: round2(e.margin),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // ---------------- Vendor effectiveness ----------------
    const vendorMap = new Map<
      string,
      {
        vendor_id: string | null;
        vendor_name: string;
        lines: number;
        value: number;
        currency_code: string;
        delivered: number;
        cancelled: number;
        lead_days_total: number;
        lead_samples: number;
      }
    >();
    for (const s of stocks) {
      const name = s.vendor_name ?? 'Unassigned';
      const e =
        vendorMap.get(name) ?? {
          vendor_id: s.vendor_id,
          vendor_name: name,
          lines: 0,
          value: 0,
          currency_code: cur(s),
          delivered: 0,
          cancelled: 0,
          lead_days_total: 0,
          lead_samples: 0,
        };
      e.lines += 1;
      e.value += cost(s);
      if (s.status === 'cancelled') e.cancelled += 1;
      const po = docAt(s.id, 'po');
      const grn = docAt(s.id, 'grn');
      if (grn) {
        e.delivered += 1;
        const from = po ?? new Date(s.created_at);
        e.lead_days_total += Math.max((grn.getTime() - from.getTime()) / MS_DAY, 0);
        e.lead_samples += 1;
      }
      vendorMap.set(name, e);
    }
    const top_vendors = [...vendorMap.values()]
      .map((e) => ({
        vendor_id: e.vendor_id,
        vendor_name: e.vendor_name,
        lines: e.lines,
        value: round2(e.value),
        currency_code: e.currency_code,
        delivered: e.delivered,
        cancelled: e.cancelled,
        fulfilment_rate: e.lines ? Math.round((e.delivered / e.lines) * 100) : 0,
        avg_lead_days: e.lead_samples ? round2(e.lead_days_total / e.lead_samples) : null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // ---------------- Most active users (audit trail, last `days`) ----------------
    const userMap = new Map<string, { user: string; total: number; creates: number; updates: number; documents: number; attachments: number; last_at: string }>();
    for (const h of history) {
      const at = new Date(h.changed_at);
      if (at < since) continue;
      const key = h.changed_by ?? 'system';
      const e =
        userMap.get(key) ?? {
          user: key,
          total: 0,
          creates: 0,
          updates: 0,
          documents: 0,
          attachments: 0,
          last_at: at.toISOString(),
        };
      e.total += 1;
      if (h.action === 'create') e.creates += 1;
      else if (h.action === 'update' || h.action === 'status_change') e.updates += 1;
      else if (h.action === 'document') e.documents += 1;
      else if (h.action === 'attachment') e.attachments += 1;
      if (at.toISOString() > e.last_at) e.last_at = at.toISOString();
      userMap.set(key, e);
    }
    const nameByEmail = new Map(users.map((u) => [u.email, u.name]));
    const roleByEmail = new Map(users.map((u) => [u.email, u.role?.name ?? u.role?.code ?? null]));
    const active_users = [...userMap.values()]
      .map((e) => ({
        ...e,
        name: nameByEmail.get(e.user) ?? e.user,
        role: roleByEmail.get(e.user) ?? null,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ---------------- Expiry risk ----------------
    const buckets = { expired: 0, d30: 0, d60: 0, d90: 0 };
    for (const { d } of expiryRisk) {
      const n = d as number;
      if (n < 0) buckets.expired += 1;
      else if (n <= 30) buckets.d30 += 1;
      else if (n <= 60) buckets.d60 += 1;
      else buckets.d90 += 1;
    }
    const near_expiry = expiryRisk
      .sort((a, b) => (a.d as number) - (b.d as number))
      .slice(0, 12)
      .map(({ s, d }) => ({
        stock_id: s.id,
        product_code: s.product?.productCode ?? null,
        product_description: s.product?.description ?? null,
        batch_no: s.batch_no,
        vendor_name: s.vendor_name,
        qty: Number(s.qty),
        uom: s.qty_uom?.code ?? null,
        expiry_date: s.expiry_date,
        days_left: d as number,
        status: s.status,
        value_at_risk: round2(cost(s)),
        currency_code: cur(s),
      }));

    // ---------------- Stock ageing (open lines) ----------------
    const ageBuckets = [
      { label: '0–30 d', min: 0, max: 30, lines: 0, value: 0 },
      { label: '31–60 d', min: 31, max: 60, lines: 0, value: 0 },
      { label: '61–90 d', min: 61, max: 90, lines: 0, value: 0 },
      { label: '91–180 d', min: 91, max: 180, lines: 0, value: 0 },
      { label: '180+ d', min: 181, max: Infinity, lines: 0, value: 0 },
    ];
    for (const s of openStocks) {
      const age = (now.getTime() - new Date(s.created_at).getTime()) / MS_DAY;
      const b = ageBuckets.find((x) => age >= x.min && age <= x.max);
      if (b) {
        b.lines += 1;
        b.value += cost(s);
      }
    }
    const stock_ageing = ageBuckets.map((b) => ({ label: b.label, lines: b.lines, value: round2(b.value) }));

    // ---------------- Products per department ----------------
    const deptMap = new Map<string, number>();
    for (const p of products) {
      const k = p.department?.name ?? 'Unassigned';
      deptMap.set(k, (deptMap.get(k) ?? 0) + 1);
    }
    const products_by_department = [...deptMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // ---------------- Average stage duration (bottleneck detection) ----------------
    const stageOrder = [
      'inquiry',
      'quotation',
      'po',
      'vendor_invoice',
      'payment',
      'shipping',
      'customs_clearance',
      'grn',
      'putaway',
      'sales_invoice',
      'payment_receipt',
    ];
    const stageStats = new Map<string, { total: number; samples: number }>();
    for (const [, m] of docByStock) {
      for (let i = 1; i < stageOrder.length; i++) {
        const from = m.get(stageOrder[i - 1]);
        const to = m.get(stageOrder[i]);
        if (!from || !to) continue;
        const key = `${stageOrder[i - 1]}→${stageOrder[i]}`;
        const e = stageStats.get(key) ?? { total: 0, samples: 0 };
        e.total += Math.max((to.getTime() - from.getTime()) / MS_DAY, 0);
        e.samples += 1;
        stageStats.set(key, e);
      }
    }
    const stage_durations = [...stageStats.entries()]
      .map(([transition, e]) => ({
        transition,
        avg_days: round2(e.total / e.samples),
        samples: e.samples,
      }))
      .sort((a, b) => b.avg_days - a.avg_days);

    return {
      generated_at: now.toISOString(),
      period_days: days,
      kpis,
      pipeline,
      monthly_procurement,
      daily_activity,
      fastest_moving,
      top_products,
      top_vendors,
      active_users,
      expiry_buckets: buckets,
      near_expiry,
      stock_ageing,
      products_by_department,
      stage_durations,
    };
  }
}
