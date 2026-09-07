import { useEffect, useMemo, useState } from 'react';
import { Combobox } from './Combobox';
import { productsService } from '../services/products.service';
import { vendorsService } from '../services/vendors.service';
import { inventoryService } from '../services/inventory.service';
import { toast } from '../lib/toast';
import {
  ADJUSTMENT_SIGN,
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_LABEL,
  type AdjustmentType,
} from '../types/inventory';

interface Props {
  /** Pre-selected product (e.g. opened from an alert row). */
  productId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Records a manual correction to on-hand stock (returns, damage, counts).
 * Availability stays derived — this only appends a signed movement.
 */
export function StockAdjustmentModal({ productId, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [vendors, setVendors] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    product_id: productId ?? '',
    vendor_id: '',
    type: 'customer_return' as AdjustmentType,
    qty: '',
    reference_no: '',
    reason: '',
    adjusted_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    let cancelled = false;
    productsService
      .list({ search: productQuery || undefined, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setProducts(
          res.items.map((p) => ({
            value: p.id,
            label: p.description,
            hint: p.productCode,
            keywords: p.productCode,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productQuery]);

  useEffect(() => {
    vendorsService
      .list({ status: 'active', limit: 100 })
      .then((res) =>
        setVendors(res.items.map((v) => ({ value: v.id, label: v.legal_name, hint: v.code }))),
      )
      .catch(() => undefined);
  }, []);

  const sign = ADJUSTMENT_SIGN[form.type];
  const needsVendor = form.type === 'vendor_return';
  const preview = useMemo(() => {
    const n = Number(form.qty);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `${sign > 0 ? '+' : '−'}${n.toLocaleString('en-US', { maximumFractionDigits: 3 })}`;
  }, [form.qty, sign]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.product_id) return setError('Select the product being adjusted');
    const qty = Number(form.qty);
    if (!Number.isFinite(qty) || qty <= 0) return setError('Quantity must be greater than zero');
    if (needsVendor && !form.vendor_id) return setError('Select the vendor goods are returned to');

    setSaving(true);
    try {
      await inventoryService.createAdjustment({
        product_id: form.product_id,
        vendor_id: form.vendor_id || undefined,
        type: form.type,
        qty,
        reference_no: form.reference_no || undefined,
        reason: form.reason || undefined,
        adjusted_at: form.adjusted_at || undefined,
      });
      toast('success', 'Stock adjustment recorded');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record the adjustment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl text-ink">Record stock adjustment</h3>
            <p className="text-sm text-brown-500">
              Returns, damage, shrinkage and count corrections. On-hand stock updates immediately.
            </p>
          </div>
          <button
            type="button"
            className="text-brown-500 hover:text-ink text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-brick-200 bg-brick-50 px-4 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        <div>
          <label className="label">Product *</label>
          <Combobox
            options={products}
            value={form.product_id}
            onChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
            onQueryChange={setProductQuery}
            placeholder="Search product code or description…"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Adjustment type *</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AdjustmentType }))}
            >
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ADJUSTMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantity *</label>
            <input
              className="input"
              type="number"
              step="0.001"
              min="0.001"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
            <p className={`mt-1 text-xs ${sign > 0 ? 'text-forest-600' : 'text-brick-600'}`}>
              Effect on available stock: {preview}
            </p>
          </div>
        </div>

        {needsVendor && (
          <div>
            <label className="label">Return to vendor *</label>
            <Combobox
              options={vendors}
              value={form.vendor_id}
              onChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}
              placeholder="Select vendor…"
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Reference no.</label>
            <input
              className="input"
              value={form.reference_no}
              onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
              placeholder="RMA / credit note / batch"
            />
          </div>
          <div>
            <label className="label">Adjustment date</label>
            <input
              className="input"
              type="date"
              value={form.adjusted_at}
              onChange={(e) => setForm((f) => ({ ...f, adjusted_at: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Reason / notes</label>
          <textarea
            className="input"
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Why is this correction needed?"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Record adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
