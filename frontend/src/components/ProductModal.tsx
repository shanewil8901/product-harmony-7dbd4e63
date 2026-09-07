import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Product, ProductInput } from '../types/product';
import { useMasterData } from '../hooks/useMasterData';
import { vendorsService } from '../services/vendors.service';
import type { Vendor } from '../types/vendor';
import { ProductBarcode } from './ProductBarcode';

interface Props {
  product: Product | null;
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
}

interface FormState {
  description: string;
  baseQty: string;
  weight: string;
  buyingPrice: string;
  sellingPrice: string;
  department_id: string;
  base_uom_id: string;
  weight_uom_id: string;
  buying_currency_id: string;
  selling_currency_id: string;
  vendor_id: string;
}

const empty: FormState = {
  description: '',
  baseQty: '1.000',
  weight: '0.000',
  buyingPrice: '0.00',
  sellingPrice: '0.00',
  department_id: '',
  base_uom_id: '',
  weight_uom_id: '',
  buying_currency_id: '',
  selling_currency_id: '',
  vendor_id: '',
};

const dec = (places: number) => new RegExp(`^\\d+(\\.\\d{1,${places}})?$`);

export function ProductModal({ product, onClose, onSubmit }: Props) {
  const { departments, baseUoms, weightUoms, currencies, loading: mdLoading } = useMasterData();
  const [form, setForm] = useState<FormState>(empty);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    vendorsService
      .list({ limit: 200 })
      .then((res) => setVendors(res.items))
      .catch(() => setVendors([]));
  }, []);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setForm({
        description: product.description,
        baseQty: Number(product.baseQty).toFixed(3),
        weight: Number(product.weight).toFixed(3),
        buyingPrice: Number(product.buyingPrice).toFixed(2),
        sellingPrice: Number(product.sellingPrice).toFixed(2),
        department_id: product.department_id ?? '',
        base_uom_id: product.base_uom_id ?? '',
        weight_uom_id: product.weight_uom_id ?? '',
        buying_currency_id: product.buying_currency_id ?? '',
        selling_currency_id: product.selling_currency_id ?? '',
        vendor_id: product.vendor_id ?? '',
      });
    } else {
      setForm(empty);
    }
    setErrors({});
    setApiError(null);
  }, [product]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) e.description = 'Required';
    if (!form.department_id) e.department_id = 'Required';
    if (!form.base_uom_id) e.base_uom_id = 'Required';
    if (!form.weight_uom_id) e.weight_uom_id = 'Required';
    if (!form.buying_currency_id) e.buying_currency_id = 'Required';
    if (!form.selling_currency_id) e.selling_currency_id = 'Required';
    if (!form.vendor_id) e.vendor_id = 'Required';
    if (!dec(3).test(form.baseQty)) e.baseQty = 'Up to 3 decimals';
    if (!dec(3).test(form.weight)) e.weight = 'Up to 3 decimals';
    if (!dec(2).test(form.buyingPrice)) e.buyingPrice = 'Up to 2 decimals';
    if (!dec(2).test(form.sellingPrice)) e.sellingPrice = 'Up to 2 decimals';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        description: form.description.trim(),
        department_id: form.department_id,
        base_uom_id: form.base_uom_id,
        weight_uom_id: form.weight_uom_id,
        buying_currency_id: form.buying_currency_id,
        selling_currency_id: form.selling_currency_id,
        vendor_id: form.vendor_id,
        baseQty: Number(form.baseQty),
        weight: Number(form.weight),
        buyingPrice: Number(form.buyingPrice),
        sellingPrice: Number(form.sellingPrice),
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save');
      setApiError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl text-ink">{product ? 'Edit product' : 'Register product'}</h3>
          <button
            type="button"
            className="text-brown-500 hover:text-ink text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {apiError && (
          <div className="mb-4 rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
            {apiError}
          </div>
        )}

        {product && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product code (auto)">
              <input className="input font-mono bg-paper-warm" value={product.productCode} readOnly />
            </Field>
            <Field label="Barcode (EAN-13, auto)">
              <input
                className="input font-mono bg-paper-warm"
                value={product.product_barcode ?? ''}
                readOnly
              />
            </Field>
            {product.product_barcode && (
              <div className="sm:col-span-2">
                <BarcodePanel value={product.product_barcode} code={product.productCode} />
              </div>
            )}
          </div>
        )}

        {!product && (
          <p className="mb-4 text-xs text-brown-500">
            Product code and EAN-13 barcode are generated automatically on save.
          </p>
        )}

        <div className="space-y-5">
          {/* Description — full width */}
          <Field label="Product description *" error={errors.description}>
            <textarea
              className="input min-h-[72px]"
              placeholder="e.g. White Sesame seeds"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          {/* Department — full width */}
          <Field label="Department *" error={errors.department_id}>
            <select
              className="input"
              value={form.department_id}
              onChange={(e) => set('department_id', e.target.value)}
              disabled={mdLoading}
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Vendor / supplier — full width */}
          <Field label="Vendor (supplier) *" error={errors.vendor_id}>
            <select
              className="input"
              value={form.vendor_id}
              onChange={(e) => set('vendor_id', e.target.value)}
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.legal_name}
                </option>
              ))}
            </select>
          </Field>

          {/* Base qty + Base UOM */}
          <PairRow>
            <Field label="Base quantity *" error={errors.baseQty}>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0"
                value={form.baseQty}
                onChange={(e) => set('baseQty', e.target.value)}
              />
            </Field>
            <Field label="Base UOM *" error={errors.base_uom_id}>
              <select
                className="input"
                value={form.base_uom_id}
                onChange={(e) => set('base_uom_id', e.target.value)}
                disabled={mdLoading}
              >
                <option value="">Select UOM</option>
                {baseUoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </PairRow>

          {/* Weight + Weight UOM */}
          <PairRow>
            <Field label="Weight *" error={errors.weight}>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </Field>
            <Field label="Weight UOM *" error={errors.weight_uom_id}>
              <select
                className="input"
                value={form.weight_uom_id}
                onChange={(e) => set('weight_uom_id', e.target.value)}
                disabled={mdLoading}
              >
                <option value="">Select Weight UOM</option>
                {weightUoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </PairRow>

          {/* Buying price + Buying currency */}
          <PairRow>
            <Field label="Buying price (2dp) *" error={errors.buyingPrice}>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.buyingPrice}
                onChange={(e) => set('buyingPrice', e.target.value)}
              />
            </Field>
            <Field label="Buying currency *" error={errors.buying_currency_id}>
              <select
                className="input"
                value={form.buying_currency_id}
                onChange={(e) => set('buying_currency_id', e.target.value)}
                disabled={mdLoading}
              >
                <option value="">Select Currency</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </PairRow>

          {/* Selling price + Selling currency */}
          <PairRow>
            <Field label="Selling price (2dp) *" error={errors.sellingPrice}>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.sellingPrice}
                onChange={(e) => set('sellingPrice', e.target.value)}
              />
            </Field>
            <Field label="Selling currency *" error={errors.selling_currency_id}>
              <select
                className="input"
                value={form.selling_currency_id}
                onChange={(e) => set('selling_currency_id', e.target.value)}
                disabled={mdLoading}
              >
                <option value="">Select Currency</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </PairRow>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-gold" disabled={submitting || mdLoading}>
            {submitting ? 'Saving…' : product ? 'Save changes' : '+ Register product'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PairRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-brown-500">{error}</p>}
    </div>
  );
}

function BarcodePanel({ value, code: _code }: { value: string; code: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const getSvg = (): SVGSVGElement | null =>
    wrapRef.current?.querySelector('svg') ?? null;

  const handleDownloadSvg = () => {
    const svg = getSvg();
    if (!svg) return;
    const markup = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), `${value}.svg`);
  };

  const handleDownloadPng = () => {
    const svg = getSvg();
    if (!svg) return;
    const markup = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) triggerDownload(URL.createObjectURL(b), `${value}.png`);
      }, 'image/png');
    };
    img.src = url;
  };

  return (
    <div className="rounded-xl border border-brown-100 bg-paper-soft p-4">
      <div className="mb-3 text-xs uppercase tracking-wider text-brown-500">Scannable barcode</div>
      <div ref={wrapRef} className="flex justify-center">
        <ProductBarcode value={value} height={100} width={2.4} fontSize={16} />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-ghost !py-1 !px-3 text-xs" onClick={handleDownloadSvg}>
          Download SVG
        </button>
        <button type="button" className="btn-gold !py-1 !px-3 text-xs" onClick={handleDownloadPng}>
          Download PNG
        </button>
      </div>
    </div>
  );
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
