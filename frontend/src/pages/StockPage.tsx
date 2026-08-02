import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { stockService } from '../services/stock.service';
import { stockDocumentsService } from '../services/stockDocuments.service';
import { productsService } from '../services/products.service';
import { vendorsService } from '../services/vendors.service';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../hooks/useAuth';
import type { Stock, StockCurrencyTotal, StockInput, StockStatus } from '../types/stock';
import { STOCK_STATUSES, STOCK_STATUS_LABEL, formatMoney } from '../types/stock';
import type { Product } from '../types/product';
import type { Vendor } from '../types/vendor';
import { StockLifecyclePanel, StatusBadge } from '../components/StockLifecyclePanel';
import { StockHistoryPanel } from '../components/StockHistoryPanel';
import { Combobox, type ComboOption } from '../components/Combobox';

const CREATE_ROLES = ['admin', 'manager', 'employee'];
const DELETE_ROLES = ['admin', 'manager'];

export function StockPage() {
  const { uoms, currencies } = useMasterData();
  const { user } = useAuth();
  const roleCode = user?.role?.code ?? '';
  const canCreate = CREATE_ROLES.includes(roleCode);
  const canDelete = DELETE_ROLES.includes(roleCode);
  const [items, setItems] = useState<Stock[]>([]);
  const [summary, setSummary] = useState<StockCurrencyTotal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | StockStatus>('');
  const [productFilter, setProductFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [lifecycleFor, setLifecycleFor] = useState<Stock | null>(null);
  const [historyFor, setHistoryFor] = useState<Stock | null>(null);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  );
  const uomMap = useMemo(
    () => Object.fromEntries(uoms.map((u) => [u.id, u.code])),
    [uoms],
  );
  const curMap = useMemo(
    () => Object.fromEntries(currencies.map((c) => [c.id, c.code])),
    [currencies],
  );

  const productOptions: ComboOption[] = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.productCode,
        hint: p.description,
        keywords: p.product_barcode ?? '',
      })),
    [products],
  );

  const statusOptions: ComboOption[] = useMemo(
    () => STOCK_STATUSES.map((s) => ({ value: s, label: STOCK_STATUS_LABEL[s] })),
    [],
  );

  /** Suggestions for the free-text search box, drawn from the loaded rows. */
  const searchOptions: ComboOption[] = useMemo(() => {
    const terms = new Set<string>();
    for (const s of items) {
      if (s.vendor_name) terms.add(s.vendor_name);
      if (s.batch_no) terms.add(s.batch_no);
      if (s.product_code) terms.add(s.product_code);
    }
    return [...terms].map((t) => ({ value: t, label: t }));
  }, [items]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockService.list({
        status: statusFilter || undefined,
        product_id: productFilter || undefined,
        search: search || undefined,
        limit: 100,
      });
      setItems(res.items);
      setSummary(res.summary ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productsService.list({ limit: 100 }).then((r) => setProducts(r.items)).catch(() => {});
  }, []);

  // Debounce the typed search so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, productFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink">Stock</h1>
          <p className="text-sm text-brown-500 mt-1">
            {items.length} stock {items.length === 1 ? 'order' : 'orders'} · status is driven by
            document generation
          </p>
        </div>
        {canCreate && (
          <button className="btn-gold" onClick={() => setModalOpen(true)}>
            + New stock order
          </button>
        )}
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Search</label>
          <Combobox
            options={searchOptions}
            value={search}
            onChange={(v) => {
              setSearch(v);
              setSearchInput(v);
            }}
            onQueryChange={setSearchInput}
            allowClear
            clearLabel="Clear search"
            placeholder="Product, vendor, batch, notes…"
            emptyLabel="Press Enter to search this text"
          />
        </div>
        <div>
          <label className="label">Filter by product</label>
          <Combobox
            options={productOptions}
            value={productFilter}
            onChange={setProductFilter}
            allowClear
            clearLabel="All products"
            placeholder="Type a product code…"
          />
        </div>
        <div>
          <label className="label">Status</label>
          <Combobox
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StockStatus | '')}
            allowClear
            clearLabel="All statuses"
            placeholder="Type a status…"
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
                <Th>Product</Th>
                <Th>Vendor</Th>
                <Th>Batch</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Buy @ order</Th>
                <Th align="right">Total buying value</Th>
                <Th align="right">Sell @ order</Th>
                <Th>Expiry</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-50">
              {loading && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-brown-500">Loading…</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-brown-500">
                    No stock orders yet.
                  </td>
                </tr>
              )}
              {!loading && items.map((s) => {
                const p = productMap[s.product_id];
                // Prefer backend-enriched values; fall back to client-side maps.
                const productCode = s.product_code ?? p?.productCode ?? s.product_id.slice(0, 8);
                const productDesc = s.product_description ?? p?.description ?? '';
                const uom =
                  s.qty_uom_code ?? (s.qty_uom_id ? uomMap[s.qty_uom_id] : '');
                const buyCur =
                  s.buying_currency_code ??
                  (s.buying_currency_id_snapshot
                    ? curMap[s.buying_currency_id_snapshot]
                    : '');
                const sellCur =
                  s.selling_currency_code ??
                  (s.selling_currency_id_snapshot
                    ? curMap[s.selling_currency_id_snapshot]
                    : '');
                // Inventory value is always cost-based (qty × buying price).
                const totalBuying =
                  s.total_buying_value ??
                  (Number(s.qty) * Number(s.buying_price_snapshot)).toFixed(2);
                return (
                  <tr key={s.id} className="hover:bg-paper-soft">
                    <Td>
                      <div className="font-mono text-ink font-medium">
                        {productCode}
                      </div>
                      <div className="text-xs text-brown-500 truncate max-w-[220px]">
                        {productDesc}
                      </div>
                    </Td>
                    <Td>
                      <div>{s.vendor_name}</div>
                    </Td>
                    <Td className="font-mono text-xs">{s.batch_no ?? '—'}</Td>
                    <Td align="right">
                      {Number(s.qty).toFixed(3)}
                      {uom && <span className="text-brown-500 ml-1">{uom}</span>}
                    </Td>
                    <Td align="right" className="text-brown-500">
                      {formatMoney(s.buying_price_snapshot, buyCur)}
                    </Td>
                    <Td align="right" className="text-ink font-semibold">
                      {formatMoney(totalBuying, buyCur)}
                    </Td>
                    <Td align="right" className="text-forest-500 font-medium">
                      {formatMoney(s.selling_price_snapshot, sellCur)}
                    </Td>
                    <Td>{s.expiry_date ?? '—'}</Td>
                    <Td>
                      {/* Read-only badge — status advances only via document generation. */}
                      <StatusBadge value={s.status} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => setLifecycleFor(s)}
                        >
                          Lifecycle
                        </button>
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => setHistoryFor(s)}
                        >
                          History
                        </button>
                        {canDelete && (
                          <button
                            className="btn-danger !py-1 !px-2 text-xs"
                            onClick={async () => {
                              if (!confirm('Delete this stock order?')) return;
                              await stockService.remove(s.id);
                              refresh();
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            {summary.length > 0 && (
              <tfoot className="bg-paper-warm text-ink">
                {summary.map((t) => (
                  <tr key={t.currency_code} className="border-t border-brown-100">
                    <td className="px-4 py-3 text-xs uppercase tracking-wider" colSpan={3}>
                      Total buying value · {t.currency_code} ({t.lines}{' '}
                      {t.lines === 1 ? 'line' : 'lines'})
                    </td>
                    <td className="px-4 py-3 text-right">{Number(t.total_qty).toFixed(3)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(t.total_buying_value, t.currency_code)}
                    </td>
                    <td className="px-4 py-3" colSpan={4} />
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modalOpen && (
        <StockModal
          products={products}
          onClose={() => setModalOpen(false)}
          onSubmit={async (input) => {
            const { po_document } = await stockService.create(input);
            setModalOpen(false);
            // Immediately open the auto-generated first document for print/download.
            stockDocumentsService.openPrint(po_document.id);
            refresh();
          }}
        />
      )}

      {lifecycleFor && (
        <StockLifecyclePanel
          stock={lifecycleFor}
          onClose={() => {
            setLifecycleFor(null);
            refresh();
          }}
          onChanged={(updated) => {
            setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
            setLifecycleFor(updated);
          }}
        />
      )}

      {historyFor && (
        <StockHistoryPanel stock={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

interface ModalProps {
  products: Product[];
  onClose: () => void;
  onSubmit: (input: StockInput) => Promise<void>;
}

function StockModal({ products, onClose, onSubmit }: ModalProps) {
  const { uoms, currencies } = useMasterData();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1.000');
  const [qtyUom, setQtyUom] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorLoading, setVendorLoading] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [mfg, setMfg] = useState('');
  const [exp, setExp] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedVendor = vendors.find((v) => v.id === vendorId);

  useEffect(() => {
    if (selectedProduct?.base_uom_id) setQtyUom(selectedProduct.base_uom_id);
  }, [selectedProduct]);

  // Vendors are fetched from the database — only existing vendors can be picked.
  useEffect(() => {
    let cancelled = false;
    setVendorLoading(true);
    const t = setTimeout(() => {
      vendorsService
        .list({ search: vendorQuery || undefined, status: 'active', limit: 50 })
        .then((r) => {
          if (!cancelled) setVendors(r.items);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setVendorLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [vendorQuery]);

  const productOptions: ComboOption[] = products.map((p) => ({
    value: p.id,
    label: p.productCode,
    hint: p.description,
    keywords: p.product_barcode ?? '',
  }));

  const vendorOptions: ComboOption[] = vendors.map((v) => ({
    value: v.id,
    label: v.legal_name,
    hint: `${v.code}${v.cr_number ? ` · CR ${v.cr_number}` : ''}`,
    keywords: v.code,
  }));

  const uomOptions: ComboOption[] = uoms.map((u) => ({
    value: u.id,
    label: u.code,
    hint: u.name,
  }));

  const buyCurrency = currencies.find((c) => c.id === selectedProduct?.buying_currency_id)?.code;
  const estimatedValue =
    selectedProduct && qty
      ? (Number(qty) * Number(selectedProduct.buyingPrice)).toFixed(2)
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setErr('Product is required');
      return;
    }
    if (!vendorId) {
      setErr('Vendor is required — pick one from the list');
      return;
    }
    if (!exp) {
      setErr('Expiry date is required');
      return;
    }
    if (mfg && new Date(exp) <= new Date(mfg)) {
      setErr('Expiry date must be after the manufacture date');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        product_id: productId,
        qty: Number(qty),
        qty_uom_id: qtyUom || undefined,
        vendor_id: vendorId,
        batch_no: batchNo || undefined,
        manufacture_date: mfg || undefined,
        expiry_date: exp,
        notes: notes || undefined,
      });
    } catch (e2: unknown) {
      const msg =
        (e2 as { userMessage?: string }).userMessage ??
        (e2 as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e2 instanceof Error ? e2.message : 'Failed');
      setErr(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card w-full max-w-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl text-ink">New stock order</h3>
          <button
            type="button"
            className="text-brown-500 hover:text-ink text-xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
            {err}
          </div>
        )}

        <div className="rounded-lg border border-gold-200 bg-gold-50/50 px-3 py-2 text-xs text-ink">
          Creating this order starts the procurement lifecycle at <b>Inquiry sent</b> and
          auto-generates the Inquiry document ready to print.
        </div>

        <div>
          <label className="label">Product *</label>
          <Combobox
            options={productOptions}
            value={productId}
            onChange={setProductId}
            placeholder="Type a product code or description…"
          />
        </div>

        <div>
          <label className="label">Vendor *</label>
          <Combobox
            options={vendorOptions}
            value={vendorId}
            onChange={setVendorId}
            onQueryChange={setVendorQuery}
            loading={vendorLoading}
            placeholder="Type to search active vendors…"
            emptyLabel="No matching vendor — create it in the Vendors screen first"
          />
          <p className="text-xs text-brown-500 mt-1">
            Only vendors registered in the system can be selected.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Quantity *</label>
            <input
              className="input"
              type="number"
              step="0.001"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Qty UOM</label>
            <Combobox
              options={uomOptions}
              value={qtyUom}
              onChange={setQtyUom}
              allowClear
              clearLabel="—"
              placeholder="Type a UOM…"
            />
          </div>
        </div>

        <div className="rounded-lg border border-brown-100 bg-paper-warm px-3 py-2 text-sm">
          <span className="text-brown-500">Total buying value (qty × cost): </span>
          <span className="text-ink font-semibold">
            {formatMoney(estimatedValue, buyCurrency)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Batch no.</label>
            <input className="input font-mono" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          </div>
          <div>
            <label className="label">Manufacture date</label>
            <input className="input" type="date" value={mfg} onChange={(e) => setMfg(e.target.value)} />
          </div>
          <div>
            <label className="label">Expiry date *</label>
            <input className="input" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create order & generate Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>
  );
}
