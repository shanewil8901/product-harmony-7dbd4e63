import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { stockService } from '../services/stock.service';
import { stockDocumentsService } from '../services/stockDocuments.service';
import { productsService } from '../services/products.service';
import { useMasterData } from '../hooks/useMasterData';
import { useAuth } from '../hooks/useAuth';
import type { Stock, StockInput, StockStatus } from '../types/stock';
import { STOCK_STATUSES, STOCK_STATUS_LABEL } from '../types/stock';
import type { Product } from '../types/product';
import { StockLifecyclePanel, StatusBadge } from '../components/StockLifecyclePanel';

const CREATE_ROLES = ['admin', 'manager', 'employee'];
const DELETE_ROLES = ['admin', 'manager'];

export function StockPage() {
  const { uoms, currencies } = useMasterData();
  const { user } = useAuth();
  const roleCode = user?.role?.code ?? '';
  const canCreate = CREATE_ROLES.includes(roleCode);
  const canDelete = DELETE_ROLES.includes(roleCode);
  const [items, setItems] = useState<Stock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | StockStatus>('');
  const [productFilter, setProductFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [lifecycleFor, setLifecycleFor] = useState<Stock | null>(null);

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

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockService.list({
        status: statusFilter || undefined,
        product_id: productFilter || undefined,
        limit: 100,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productsService.list({ limit: 100 }).then((r) => setProducts(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, productFilter]);

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

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="label">Filter by product</label>
          <select
            className="input"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productCode} — {p.description.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Status</label>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StockStatus | '')}
          >
            <option value="">All statuses</option>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STOCK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
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
                <Th align="right">Sell @ order</Th>
                <Th>Mfg</Th>
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
                const uom = s.qty_uom_id ? uomMap[s.qty_uom_id] : '';
                const buyCur = s.buying_currency_id_snapshot
                  ? curMap[s.buying_currency_id_snapshot]
                  : '';
                const sellCur = s.selling_currency_id_snapshot
                  ? curMap[s.selling_currency_id_snapshot]
                  : '';
                return (
                  <tr key={s.id} className="hover:bg-paper-soft">
                    <Td>
                      <div className="font-mono text-ink font-medium">
                        {p?.productCode ?? s.product_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-brown-500 truncate max-w-[220px]">
                        {p?.description}
                      </div>
                    </Td>
                    <Td>
                      <div>{s.vendor_name ?? 'Vendor TBD'}</div>
                    </Td>
                    <Td className="font-mono text-xs">{s.batch_no ?? '—'}</Td>
                    <Td align="right">
                      {Number(s.qty).toFixed(3)}
                      {uom && <span className="text-brown-500 ml-1">{uom}</span>}
                    </Td>
                    <Td align="right" className="text-brown-500">
                      {Number(s.buying_price_snapshot).toFixed(2)}
                      {buyCur && <span className="ml-1">{buyCur}</span>}
                    </Td>
                    <Td align="right" className="text-forest-500 font-medium">
                      {Number(s.selling_price_snapshot).toFixed(2)}
                      {sellCur && <span className="ml-1">{sellCur}</span>}
                    </Td>
                    <Td>{s.manufacture_date ?? '—'}</Td>
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
            // Immediately open the auto-generated PO for print/download.
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
    </div>
  );
}

interface ModalProps {
  products: Product[];
  onClose: () => void;
  onSubmit: (input: StockInput) => Promise<void>;
}

function StockModal({ products, onClose, onSubmit }: ModalProps) {
  const { uoms } = useMasterData();
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1.000');
  const [qtyUom, setQtyUom] = useState('');
  const [vendorName, setVendorName] = useState('Vendor TBD');
  const [vendorId, setVendorId] = useState('TBD');
  const [batchNo, setBatchNo] = useState('');
  const [mfg, setMfg] = useState('');
  const [exp, setExp] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct?.base_uom_id) setQtyUom(selectedProduct.base_uom_id);
  }, [selectedProduct]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setErr('Product is required');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        product_id: productId,
        qty: Number(qty),
        qty_uom_id: qtyUom || undefined,
        vendor_id: vendorId || undefined,
        vendor_name: vendorName || undefined,
        batch_no: batchNo || undefined,
        manufacture_date: mfg || undefined,
        expiry_date: exp || undefined,
        notes: notes || undefined,
      });
    } catch (e2: unknown) {
      const msg =
        (e2 as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e2 instanceof Error ? e2.message : 'Failed');
      setErr(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4"
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
          Creating this order will default status to <b>Ordered</b> and auto-generate a Purchase
          Order document ready to print. Vendor module is coming — placeholder values are fine.
        </div>

        <div>
          <label className="label">Product *</label>
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productCode} — {p.description.slice(0, 50)}
              </option>
            ))}
          </select>
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
            <select className="input" value={qtyUom} onChange={(e) => setQtyUom(e.target.value)}>
              <option value="">—</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vendor id (placeholder)</label>
            <input className="input font-mono" value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
          </div>
          <div>
            <label className="label">Vendor name (placeholder)</label>
            <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </div>
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
            <label className="label">Expiry date</label>
            <input className="input" type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <div className="rounded-lg border border-brown-100 bg-paper-warm px-3 py-2 text-sm text-brown-500">
            Ordered <span className="text-xs">(set automatically — advances only via generated documents)</span>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-gold" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create order & generate PO'}
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
