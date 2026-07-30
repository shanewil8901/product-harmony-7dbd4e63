import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  Stock,
  StockAttachment,
  StockAttachmentStage,
  StockDocType,
  StockDocument,
  StockStatus,
} from '../types/stock';
import {
  DOC_ALLOWED_FROM,
  STOCK_ATTACHMENT_STAGES,
  STOCK_ATTACHMENT_STAGE_LABEL,
  STOCK_DOC_LABEL,
  STOCK_STATUS_LABEL,
  canRunStage,
  formatMoney,
} from '../types/stock';
import { stockDocumentsService } from '../services/stockDocuments.service';
import { stockAttachmentsService } from '../services/stockAttachments.service';
import { useAuth } from '../hooks/useAuth';
import { useMasterData } from '../hooks/useMasterData';
import { toast } from '../lib/toast';

/** Ordered lifecycle stages shown as a stepper. */
const STAGE_ORDER: StockDocType[] = [
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
const TERMINAL: StockDocType[] = ['write_off', 'cancellation'];

/** Stages that capture a monetary total (amount + mandatory currency). */
const MONEY_STAGES = new Set<StockDocType>([
  'quotation',
  'po',
  'vendor_invoice',
  'payment',
  'customs_clearance',
  'grn',
  'sales_invoice',
  'payment_receipt',
]);

const FALLBACK_CURRENCIES = ['SAR', 'USD', 'EUR'];

interface Props {
  stock: Stock;
  onClose: () => void;
  onChanged: (updated: Stock) => void;
}

export function StockLifecyclePanel({ stock, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const role = user?.role?.code ?? null;
  const [docs, setDocs] = useState<StockDocument[]>([]);
  const [attachments, setAttachments] = useState<StockAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<StockDocType | null>(null);
  const [current, setCurrent] = useState<Stock>(stock);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      stockDocumentsService.list(stock.id),
      stockAttachmentsService.list(stock.id),
    ])
      .then(([d, a]) => {
        setDocs(d);
        setAttachments(a);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [stock.id]);

  const generatedTypes = new Set(docs.map((d) => d.doc_type));

  const submitStage = async (
    docType: StockDocType,
    payload: Record<string, unknown>,
    money: { total_amount?: number; currency_code?: string },
    file: File | null,
  ) => {
    setErr(null);
    try {
      const { document, stock: updated } = await stockDocumentsService.create(
        stock.id,
        docType,
        payload,
        money,
      );
      setDocs((d) => [...d, document]);
      setCurrent(updated);
      onChanged(updated);

      // Optional supporting file for this stage.
      if (file) {
        const att = await stockAttachmentsService.upload(stock.id, file, { stage: docType });
        setAttachments((a) => [att, ...a]);
      }

      setActiveStage(null);
      stockDocumentsService.openPrint(document.id);
    } catch (e: unknown) {
      const msg =
        (e as { userMessage?: string }).userMessage ??
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Failed to generate document');
      setErr(String(msg));
    }
  };

  const canGenerate = (docType: StockDocType) =>
    DOC_ALLOWED_FROM[docType].includes(current.status) && canRunStage(role, docType);

  const buyCur = current.buying_currency_code ?? null;
  const totalBuyingValue =
    current.total_buying_value ??
    (Number(current.qty) * Number(current.buying_price_snapshot)).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-3xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl text-ink">Stock lifecycle</h3>
            <p className="text-xs text-brown-500 mt-1">
              {current.product_code ?? current.product_id.slice(0, 8)}
              {current.batch_no ? ` · batch ${current.batch_no}` : ''} ·{' '}
              <span className="text-ink">
                Total buying value {formatMoney(totalBuyingValue, buyCur)}
              </span>
            </p>
          </div>
          <button className="text-brown-500 hover:text-ink text-xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="label !mb-0">Current status</span>
          <StatusBadge value={current.status} />
        </div>

        {err && (
          <div className="rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
            {err}
          </div>
        )}

        <div>
          <div className="label">Procurement pipeline</div>
          <div className="flex flex-wrap items-center gap-2">
            {STAGE_ORDER.map((stage, i) => {
              const done = generatedTypes.has(stage);
              const allowed = canGenerate(stage);
              return (
                <div key={stage} className="flex items-center gap-2">
                  <button
                    disabled={!allowed && !done}
                    onClick={() => allowed && setActiveStage(stage)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      done
                        ? 'bg-forest-50 text-forest-500 border-forest-100'
                        : allowed
                          ? 'bg-gold-50 text-ink border-gold-200 hover:bg-gold-100'
                          : 'bg-paper-warm text-brown-400 border-brown-100 cursor-not-allowed'
                    }`}
                  >
                    {done ? '✓ ' : ''}
                    {STOCK_DOC_LABEL[stage]}
                  </button>
                  {i < STAGE_ORDER.length - 1 && <span className="text-brown-300">→</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TERMINAL.map((stage) => {
              const done = generatedTypes.has(stage);
              const allowed = canGenerate(stage);
              return (
                <button
                  key={stage}
                  disabled={!allowed && !done}
                  onClick={() => allowed && setActiveStage(stage)}
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    done
                      ? 'bg-brown-100 text-brown-600 border-brown-200'
                      : allowed
                        ? 'bg-paper-warm text-brown-600 border-brown-200 hover:bg-brown-50'
                        : 'bg-paper-warm text-brown-300 border-brown-100 cursor-not-allowed'
                  }`}
                >
                  {done ? '✓ ' : ''}
                  {STOCK_DOC_LABEL[stage]}
                </button>
              );
            })}
          </div>
        </div>

        {activeStage && (
          <StageForm
            docType={activeStage}
            defaultCurrency={buyCur}
            onCancel={() => setActiveStage(null)}
            onSubmit={(payload, money, file) => submitStage(activeStage, payload, money, file)}
          />
        )}

        <div>
          <div className="label">Generated documents</div>
          <div className="rounded-lg border border-brown-100 divide-y divide-brown-50">
            {loading && <div className="p-3 text-sm text-brown-500">Loading…</div>}
            {!loading && docs.length === 0 && (
              <div className="p-3 text-sm text-brown-500">No documents yet.</div>
            )}
            {docs.map((d) => (
              <div
                key={d.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-mono text-sm text-ink">{d.doc_number}</div>
                  <div className="text-xs text-brown-500">
                    {STOCK_DOC_LABEL[d.doc_type]} · {new Date(d.generated_at).toLocaleString()} ·{' '}
                    {d.generated_by ?? '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.total_amount && (
                    <span className="text-sm font-medium text-ink whitespace-nowrap">
                      {formatMoney(d.total_amount, d.currency_code)}
                    </span>
                  )}
                  <button
                    className="btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => stockDocumentsService.openPrint(d.id)}
                  >
                    Open / Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <StageAttachments
          stockId={stock.id}
          attachments={attachments}
          defaultStage={activeStage ?? 'general'}
          canDelete={role === 'admin' || role === 'manager'}
          onAdded={(a) => setAttachments((prev) => [a, ...prev])}
          onRemoved={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
        />
      </div>
    </div>
  );
}

/** Optional file attachments — available at every stage of the lifecycle. */
function StageAttachments({
  stockId,
  attachments,
  defaultStage,
  canDelete,
  onAdded,
  onRemoved,
}: {
  stockId: string;
  attachments: StockAttachment[];
  defaultStage: StockAttachmentStage;
  canDelete: boolean;
  onAdded: (a: StockAttachment) => void;
  onRemoved: (id: string) => void;
}) {
  const [stage, setStage] = useState<StockAttachmentStage>(defaultStage);
  const [referenceNo, setReferenceNo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setStage(defaultStage), [defaultStage]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const att = await stockAttachmentsService.upload(stockId, file, {
        stage,
        reference_no: referenceNo || undefined,
      });
      onAdded(att);
      setReferenceNo('');
      e.target.value = '';
      toast('success', 'Attachment uploaded');
    } catch (err: unknown) {
      setError(
        (err as { userMessage?: string }).userMessage ??
          (err instanceof Error ? err.message : 'Upload failed'),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="label">Attachments (optional, any stage)</div>
      <div className="rounded-xl border border-brown-100 bg-paper-soft p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Stage</label>
            <select
              className="input"
              value={stage}
              onChange={(e) => setStage(e.target.value as StockAttachmentStage)}
            >
              {STOCK_ATTACHMENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STOCK_ATTACHMENT_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reference no.</label>
            <input
              className="input"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label">File (PDF, JPG, PNG — max 10 MB)</label>
            <input
              className="input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={handleFile}
              disabled={uploading}
            />
          </div>
        </div>
        {error && <div className="text-xs text-brown-600">{error}</div>}
      </div>

      <div className="mt-3 rounded-lg border border-brown-100 divide-y divide-brown-50">
        {attachments.length === 0 && (
          <div className="p-3 text-sm text-brown-500">No files attached yet.</div>
        )}
        {attachments.map((a) => (
          <div
            key={a.id}
            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-sm text-ink truncate max-w-[320px]" title={a.file_name}>
                {a.file_name}
              </div>
              <div className="text-xs text-brown-500">
                {STOCK_ATTACHMENT_STAGE_LABEL[a.stage] ?? a.stage} ·{' '}
                {(a.size / 1024).toFixed(1)} KB · {new Date(a.uploaded_at).toLocaleString()}
                {a.uploaded_by ? ` · ${a.uploaded_by}` : ''}
                {a.reference_no ? ` · ref ${a.reference_no}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-ghost !py-1 !px-2 text-xs"
                onClick={() => void stockAttachmentsService.download(a.stock_id, a)}
              >
                Download
              </button>
              {canDelete && (
                <button
                  className="btn-danger !py-1 !px-2 text-xs"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${a.file_name}"?`)) return;
                    await stockAttachmentsService.remove(a.stock_id, a.id);
                    onRemoved(a.id);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageForm({
  docType,
  defaultCurrency,
  onCancel,
  onSubmit,
}: {
  docType: StockDocType;
  defaultCurrency: string | null;
  onCancel: () => void;
  onSubmit: (
    payload: Record<string, unknown>,
    money: { total_amount?: number; currency_code?: string },
    file: File | null,
  ) => void | Promise<void>;
}) {
  const { currencies } = useMasterData();
  const currencyCodes = currencies.length
    ? currencies.map((c) => c.code)
    : FALLBACK_CURRENCIES;
  const [fields, setFields] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency ?? currencyCodes[0] ?? 'SAR');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const config = STAGE_FIELDS[docType];
  const needsMoney = MONEY_STAGES.has(docType);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of config) {
      const v = fields[f.name]?.trim();
      if (v) payload[f.name] = v;
    }
    const money: { total_amount?: number; currency_code?: string } = {};
    if (needsMoney && amount.trim()) {
      if (!currency) {
        setFormError('Currency is required for the total amount.');
        return;
      }
      money.total_amount = Number(amount);
      money.currency_code = currency;
    }
    setFormError(null);
    void onSubmit(payload, money, file);
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-gold-200 bg-gold-50/40 p-4 space-y-3"
    >
      <div className="text-sm font-medium text-ink">Generate {STOCK_DOC_LABEL[docType]}</div>

      {config.length === 0 && !needsMoney ? (
        <div className="text-xs text-brown-500">
          No extra fields required — submitting will generate the document and advance the stock
          status.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config.map((f) => (
            <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
              <label className="label">{f.label}</label>
              {f.options ? (
                <select
                  className="input"
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={f.type ?? 'text'}
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}

          {needsMoney && (
            <>
              <div>
                <label className="label">Total amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-brown-500 mt-1">
                  Stored with its currency and shown on the printed document.
                </p>
              </div>
              <div>
                <label className="label">Currency {amount.trim() ? '*' : ''}</label>
                <select
                  className="input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {currencyCodes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className="label">Attach supporting file (optional)</label>
            <input
              className="input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      )}

      {formError && <div className="text-xs text-brown-600">{formError}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-gold">
          Generate &amp; advance
        </button>
      </div>
    </form>
  );
}

interface FieldConfig {
  name: string;
  label: string;
  type?: string;
  full?: boolean;
  options?: { value: string; label: string }[];
}

const PAYMENT_METHODS = [
  { value: 'LC', label: 'Letter of Credit (LC)' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CASH', label: 'Cash' },
];

const INCOTERMS = [
  { value: 'CIF', label: 'CIF — Cost, Insurance & Freight' },
  { value: 'FOB', label: 'FOB — Free On Board' },
  { value: 'EXW', label: 'EXW — Ex Works' },
  { value: 'DDP', label: 'DDP — Delivered Duty Paid' },
  { value: 'CFR', label: 'CFR — Cost & Freight' },
  { value: 'CIP', label: 'CIP — Carriage & Insurance Paid' },
  { value: 'FCA', label: 'FCA — Free Carrier' },
];

/** Amounts are captured by the shared money block, not per-stage text fields. */
const STAGE_FIELDS: Record<StockDocType, FieldConfig[]> = {
  inquiry: [
    { name: 'inquiry_no', label: 'Inquiry no.' },
    { name: 'sent_at', label: 'Sent at', type: 'datetime-local' },
    { name: 'notes', label: 'Notes', full: true },
  ],
  quotation: [
    { name: 'quote_no', label: 'Vendor quotation no.' },
    { name: 'quote_date', label: 'Quotation date', type: 'date' },
    { name: 'valid_until', label: 'Valid until', type: 'date' },
  ],
  po: [
    { name: 'po_no', label: 'PO reference (optional)' },
    { name: 'approved_at', label: 'Approved at', type: 'datetime-local' },
  ],
  vendor_invoice: [
    { name: 'invoice_no', label: 'Vendor invoice no.' },
    { name: 'invoice_date', label: 'Invoice date', type: 'date' },
  ],
  payment: [
    { name: 'payment_method', label: 'Payment method', options: PAYMENT_METHODS },
    { name: 'reference_no', label: 'Reference / LC / Cheque no.' },
    { name: 'paid_at', label: 'Paid at', type: 'datetime-local' },
  ],
  shipping: [
    { name: 'incoterm', label: 'Incoterm', options: INCOTERMS },
    { name: 'carrier', label: 'Carrier / Shipping line' },
    { name: 'awb_no', label: 'AWB / BL no.' },
    { name: 'eta', label: 'ETA', type: 'date' },
  ],
  customs_clearance: [
    { name: 'clearance_ref', label: 'Customs clearance reference' },
    { name: 'port', label: 'Port of entry' },
    { name: 'cleared_at', label: 'Cleared at', type: 'datetime-local' },
  ],
  dispatch: [
    { name: 'carrier', label: 'Carrier' },
    { name: 'tracking_no', label: 'Tracking no.' },
    { name: 'dispatched_at', label: 'Dispatched at', type: 'datetime-local' },
  ],
  grn: [
    { name: 'received_qty', label: 'Received qty', type: 'number' },
    { name: 'received_at', label: 'Received at', type: 'datetime-local' },
    { name: 'notes', label: 'Notes', full: true },
  ],
  putaway: [
    { name: 'invoice_no', label: 'Supplier invoice no.' },
    { name: 'location', label: 'Warehouse location' },
  ],
  sales_invoice: [
    { name: 'invoice_no', label: 'Sales invoice no.' },
    { name: 'customer', label: 'Customer' },
    { name: 'sold_qty', label: 'Sold qty', type: 'number' },
  ],
  payment_receipt: [
    { name: 'receipt_no', label: 'Receipt no.' },
    { name: 'received_at', label: 'Received at', type: 'datetime-local' },
  ],
  write_off: [{ name: 'reason', label: 'Reason', full: true }],
  cancellation: [{ name: 'reason', label: 'Reason', full: true }],
};

export function StatusBadge({ value }: { value: StockStatus }) {
  const tone: Record<StockStatus, string> = {
    inquiry_sent: 'bg-gold-50 text-ink border-gold-200',
    quotation_received: 'bg-gold-50 text-ink border-gold-200',
    quotation_approved: 'bg-gold-50 text-ink border-gold-200',
    invoice_received: 'bg-gold-50 text-ink border-gold-200',
    payment_processed: 'bg-gold-50 text-ink border-gold-200',
    shipped: 'bg-paper-warm text-ink border-brown-200',
    customs_cleared: 'bg-paper-warm text-ink border-brown-200',
    ordered: 'bg-gold-50 text-ink border-gold-200',
    in_transit: 'bg-paper-warm text-ink border-brown-200',
    received: 'bg-forest-50 text-forest-500 border-forest-100',
    in_warehouse: 'bg-forest-50 text-forest-500 border-forest-100',
    sold_out: 'bg-brown-50 text-brown-600 border-brown-200',
    settled: 'bg-forest-50 text-forest-500 border-forest-100',
    expired: 'bg-brown-50 text-brown-600 border-brown-200',
    cancelled: 'bg-brown-50 text-brown-600 border-brown-200',
  };
  return (
    <span className={`inline-block text-xs rounded-full border px-2 py-1 ${tone[value]}`}>
      {STOCK_STATUS_LABEL[value]}
    </span>
  );
}
