import { useEffect, useMemo, useState } from 'react';
import { productsService } from '../services/products.service';
import { stockService } from '../services/stock.service';
import { salesService } from '../services/sales.service';
import { stockHistoryService, type StockHistoryEntry } from '../services/stockHistory.service';
import { salesHistoryService, type SalesHistoryEntry } from '../services/salesHistory.service';
import { useMasterData } from '../hooks/useMasterData';
import { Combobox, type ComboOption } from '../components/Combobox';
import type { Product } from '../types/product';
import type { Stock } from '../types/stock';
import type { SalesOrder } from '../types/sales';
import type { ProductHistoryEntry } from '../types/stock';
import { UserName } from '../components/UserName';

type TabKey = 'product' | 'stock' | 'sales';

const TAB_LABEL: Record<TabKey, string> = {
  product: 'Product',
  stock: 'Stock',
  sales: 'Sales',
};

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  baseQty: 'Base qty',
  weight: 'Weight',
  buyingPrice: 'Buying price',
  sellingPrice: 'Selling price',
  productCode: 'Product code',
  product_barcode: 'Barcode',
  department_id: 'Department',
  base_uom_id: 'Base UOM',
  weight_uom_id: 'Weight UOM',
  buying_currency_id: 'Buying currency',
  selling_currency_id: 'Selling currency',
  // Stock
  product_id: 'Product',
  vendor_id: 'Vendor',
  batch_no: 'Batch no',
  qty: 'Quantity',
  qty_uom_id: 'Quantity UOM',
  buying_price_snapshot: 'Buying price',
  buying_currency_id_snapshot: 'Buying currency',
  selling_price_snapshot: 'Selling price',
  selling_currency_id_snapshot: 'Selling currency',
  manufacture_date: 'Manufacture date',
  expiry_date: 'Expiry date',
  ordered_at: 'Ordered at',
  status: 'Status',
  notes: 'Notes',
  // Sales
  customer_id: 'Customer',
  order_date: 'Order date',
  expected_delivery_date: 'Expected delivery',
  currency_id: 'Currency',
  subtotal: 'Subtotal',
  vat_rate: 'VAT rate',
  vat_amount: 'VAT amount',
  discount_amount: 'Discount',
  total_amount: 'Total',
  amount_paid: 'Amount paid',
  invoice_no: 'Invoice no',
  cancel_reason: 'Cancel reason',
  doc_type: 'Document',
  doc_number: 'Document no',
  status_from: 'Status from',
  status_to: 'Status to',
  stage: 'Stage',
  file_name: 'File',
  attachment_id: 'Attachment',
  method: 'Method',
  amount: 'Amount',
  reference: 'Reference',
  note: 'Note',
  reason: 'Reason',
  action: 'Action',
};

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status change',
  document: 'Document',
  attachment: 'Attachment',
  payment: 'Payment',
};

const ID_FIELDS = new Set([
  'department_id',
  'base_uom_id',
  'weight_uom_id',
  'buying_currency_id',
  'selling_currency_id',
  'qty_uom_id',
  'buying_currency_id_snapshot',
  'selling_currency_id_snapshot',
  'currency_id',
]);

/** Shape shared by the product, stock and sales audit trails. */
type AnyEntry = {
  id: string;
  action: string;
  changes: unknown;
  changed_at: string;
  changed_by: string | null;
};

const isDiff = (v: unknown): v is { from: unknown; to: unknown } =>
  !!v && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object);

export function HistoryPage() {
  const [tab, setTab] = useState<TabKey>('product');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-ink">History</h1>
        <p className="text-sm text-brown-500 mt-1">
          Every change made across products, stock and sales — with who and when.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-paper-warm p-1.5">
        {(Object.keys(TAB_LABEL) as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`rounded-lg px-5 py-2.5 text-base transition-colors ${
              tab === t
                ? 'bg-brown-600 font-bold text-paper shadow-card'
                : 'font-medium text-brown-500 hover:bg-brown-50 hover:text-brown-600'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'product' && <ProductHistoryTab />}
      {tab === 'stock' && <StockHistoryTab />}
      {tab === 'sales' && <SalesHistoryTab />}
    </div>
  );
}

/** Filters + table shared by all three tabs. */
function HistoryBody({
  entries,
  loading,
  error,
  labelForId,
  emptyLabel,
}: {
  entries: AnyEntry[];
  loading: boolean;
  error: string | null;
  labelForId: Record<string, string>;
  emptyLabel: string;
}) {
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const formatValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '∅';
    if (ID_FIELDS.has(field)) return labelForId[String(value)] ?? String(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const actionOptions: ComboOption[] = useMemo(
    () =>
      [...new Set(entries.map((e) => e.action))].map((a) => ({
        value: a,
        label: ACTION_LABEL[a] ?? a,
      })),
    [entries],
  );

  const userOptions: ComboOption[] = useMemo(
    () =>
      [...new Set(entries.map((e) => e.changed_by).filter(Boolean) as string[])].map((u) => ({
        value: u,
        label: u,
      })),
    [entries],
  );

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!actionFilter || e.action === actionFilter) &&
          (!userFilter || e.changed_by === userFilter),
      ),
    [entries, actionFilter, userFilter],
  );

  return (
    <>
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Filter by action</label>
          <Combobox
            options={actionOptions}
            value={actionFilter}
            onChange={setActionFilter}
            allowClear
            clearLabel="All actions"
            placeholder="Type to search actions…"
          />
        </div>
        <div>
          <label className="label">Filter by user</label>
          <Combobox
            options={userOptions}
            value={userFilter}
            onChange={setUserFilter}
            allowClear
            clearLabel="All users"
            placeholder="Type to search users…"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-600">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-warm text-ink">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">When</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">By</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-50">
              {loading && (
                <tr><td colSpan={4} className="py-8 text-center text-brown-500">Loading…</td></tr>
              )}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-brown-500">{emptyLabel}</td></tr>
              )}
              {!loading && visible.map((e) => {
                const changes = (e.changes ?? null) as Record<string, unknown> | null;
                return (
                  <tr key={e.id} className="align-top hover:bg-paper-soft">
                    <td className="px-4 py-3 whitespace-nowrap text-brown-500">
                      {new Date(e.changed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={e.action} />
                    </td>
                    <td className="px-4 py-3 text-brown-500"><UserName value={e.changed_by} /></td>
                    <td className="px-4 py-3">
                      {changes && Object.keys(changes).length > 0 ? (
                        <ul className="space-y-1">
                          {Object.entries(changes).map(([field, value]) => (
                            <li key={field} className="text-xs">
                              <span className="font-medium text-ink">
                                {FIELD_LABELS[field] ?? field}:
                              </span>{' '}
                              {isDiff(value) ? (
                                <>
                                  <span className="text-brown-500 line-through">
                                    {formatValue(field, value.from)}
                                  </span>{' '}
                                  → <span className="text-forest-500">
                                    {formatValue(field, value.to)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-ink-muted">{formatValue(field, value)}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-brown-500">
                          {e.action === 'create'
                            ? 'Record created'
                            : e.action === 'delete'
                            ? 'Record deleted'
                            : ACTION_LABEL[e.action] ?? e.action}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ProductHistoryTab() {
  const { departments, uoms, currencies } = useMasterData();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<ProductHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const labelForId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departments) map[d.id] = `${d.code} — ${d.name}`;
    for (const u of uoms) map[u.id] = u.code;
    for (const c of currencies) map[c.id] = c.code;
    return map;
  }, [departments, uoms, currencies]);

  // Typeable autocomplete — products are queried from the database as the user types.
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      productsService
        .list({ search: query || undefined, limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setProducts(r.items);
          setSelected((cur) => cur || (r.items.length > 0 ? r.items[0].id : ''));
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    productsService
      .history(selected)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [selected]);

  const product = products.find((p) => p.id === selected);

  const options: ComboOption[] = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.productCode,
        hint: p.description,
        keywords: p.product_barcode ?? '',
      })),
    [products],
  );

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <label className="label">Product</label>
        <Combobox
          options={options}
          value={selected}
          onChange={setSelected}
          onQueryChange={setQuery}
          loading={searching}
          placeholder="Type a product code or description…"
          emptyLabel="No matching product"
        />
      </div>

      {product && (
        <div className="card p-4">
          <div className="text-sm text-brown-500">Current product</div>
          <div className="font-mono text-ink font-medium">{product.productCode}</div>
          <div className="text-sm text-ink">{product.description}</div>
        </div>
      )}

      <HistoryBody
        entries={entries as unknown as AnyEntry[]}
        loading={loading}
        error={error}
        labelForId={labelForId}
        emptyLabel="No history entries match these filters."
      />
    </div>
  );
}

function StockHistoryTab() {
  const { uoms, currencies } = useMasterData();
  const [items, setItems] = useState<Stock[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const labelForId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of uoms) map[u.id] = u.code;
    for (const c of currencies) map[c.id] = c.code;
    return map;
  }, [uoms, currencies]);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      stockService
        .list({ search: query || undefined, limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setItems(r.items);
          setSelected((cur) => cur || (r.items.length > 0 ? r.items[0].id : ''));
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    stockHistoryService
      .list(selected)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [selected]);

  const options: ComboOption[] = useMemo(
    () =>
      items.map((s) => ({
        value: s.id,
        label: `${s.product_code ?? 'Stock'}${s.batch_no ? ` · ${s.batch_no}` : ''}`,
        hint: `${s.product_description ?? ''} · ${s.status}`,
        keywords: `${s.batch_no ?? ''} ${s.vendor_name ?? ''}`,
      })),
    [items],
  );

  const current = items.find((s) => s.id === selected);

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <label className="label">Stock item</label>
        <Combobox
          options={options}
          value={selected}
          onChange={setSelected}
          onQueryChange={setQuery}
          loading={searching}
          placeholder="Type a product code, batch or vendor…"
          emptyLabel="No matching stock item"
        />
      </div>

      {current && (
        <div className="card p-4">
          <div className="text-sm text-brown-500">Current stock item</div>
          <div className="font-mono text-ink font-medium">
            {current.product_code ?? '—'}
            {current.batch_no ? ` · ${current.batch_no}` : ''}
          </div>
          <div className="text-sm text-ink">{current.product_description ?? ''}</div>
        </div>
      )}

      <HistoryBody
        entries={entries as unknown as AnyEntry[]}
        loading={loading}
        error={error}
        labelForId={labelForId}
        emptyLabel="No history entries match these filters."
      />
    </div>
  );
}

function SalesHistoryTab() {
  const { currencies } = useMasterData();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<SalesHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const labelForId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of currencies) map[c.id] = c.code;
    return map;
  }, [currencies]);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      salesService
        .list({ search: query || undefined })
        .then((rows) => {
          if (cancelled) return;
          setOrders(rows);
          setSelected((cur) => cur || (rows.length > 0 ? rows[0].id : ''));
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    salesHistoryService
      .list(selected)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [selected]);

  const options: ComboOption[] = useMemo(
    () =>
      orders.map((o) => ({
        value: o.id,
        label: o.order_no,
        hint: `${o.customer_name ?? ''} · ${o.status}`,
        keywords: `${o.invoice_no ?? ''} ${o.customer_code ?? ''}`,
      })),
    [orders],
  );

  const current = orders.find((o) => o.id === selected);

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <label className="label">Sales order</label>
        <Combobox
          options={options}
          value={selected}
          onChange={setSelected}
          onQueryChange={setQuery}
          loading={searching}
          placeholder="Type an order number, invoice or customer…"
          emptyLabel="No matching sales order"
        />
      </div>

      {current && (
        <div className="card p-4">
          <div className="text-sm text-brown-500">Current sales order</div>
          <div className="font-mono text-ink font-medium">{current.order_no}</div>
          <div className="text-sm text-ink">{current.customer_name ?? '—'}</div>
        </div>
      )}

      <HistoryBody
        entries={entries as unknown as AnyEntry[]}
        loading={loading}
        error={error}
        labelForId={labelForId}
        emptyLabel="No history entries match these filters."
      />
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone =
    action === 'create'
      ? 'bg-forest-50 text-forest-500 border-forest-100'
      : action === 'delete'
      ? 'bg-brown-50 text-brown-600 border-brown-200'
      : action === 'payment'
      ? 'bg-forest-50 text-forest-600 border-forest-100'
      : action === 'document' || action === 'attachment'
      ? 'bg-paper-warm text-brown-600 border-brown-100'
      : 'bg-gold-50 text-ink border-gold-200';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {ACTION_LABEL[action] ?? action}
    </span>
  );
}
