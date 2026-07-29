import { useEffect, useState, type FormEvent } from 'react';
import type { Stock, StockDocType, StockDocument, StockStatus } from '../types/stock';
import {
  DOC_ALLOWED_FROM,
  STOCK_DOC_LABEL,
  STOCK_STATUS_LABEL,
  canRunStage,
} from '../types/stock';
import { stockDocumentsService } from '../services/stockDocuments.service';
import { useAuth } from '../hooks/useAuth';

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

interface Props {
  stock: Stock;
  onClose: () => void;
  onChanged: (updated: Stock) => void;
}

export function StockLifecyclePanel({ stock, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const role = user?.role?.code ?? null;
  const [docs, setDocs] = useState<StockDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<StockDocType | null>(null);
  const [current, setCurrent] = useState<Stock>(stock);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    stockDocumentsService
      .list(stock.id)
      .then(setDocs)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [stock.id]);

  const generatedTypes = new Set(docs.map((d) => d.doc_type));

  const submitStage = async (docType: StockDocType, payload: Record<string, unknown>) => {
    setErr(null);
    try {
      const { document, stock: updated } = await stockDocumentsService.create(
        stock.id,
        docType,
        payload,
      );
      setDocs((d) => [...d, document]);
      setCurrent(updated);
      onChanged(updated);
      setActiveStage(null);
      stockDocumentsService.openPrint(document.id);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Failed to generate document');
      setErr(String(msg));
    }
  };

  const canGenerate = (docType: StockDocType) =>
    DOC_ALLOWED_FROM[docType].includes(current.status) && canRunStage(role, docType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl text-ink">Stock lifecycle</h3>
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
            onCancel={() => setActiveStage(null)}
            onSubmit={(payload) => submitStage(activeStage, payload)}
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
              <div key={d.id} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm text-ink">{d.doc_number}</div>
                  <div className="text-xs text-brown-500">
                    {STOCK_DOC_LABEL[d.doc_type]} · {new Date(d.generated_at).toLocaleString()} ·{' '}
                    {d.generated_by ?? '—'}
                  </div>
                </div>
                <button
                  className="btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => stockDocumentsService.openPrint(d.id)}
                >
                  Open / Print
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageForm({
  docType,
  onCancel,
  onSubmit,
}: {
  docType: StockDocType;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});

  const config = STAGE_FIELDS[docType];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of config) {
      const v = fields[f.name]?.trim();
      if (v) payload[f.name] = v;
    }
    void onSubmit(payload);
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-gold-200 bg-gold-50/40 p-4 space-y-3"
    >
      <div className="text-sm font-medium text-ink">
        Generate {STOCK_DOC_LABEL[docType]}
      </div>
      {config.length === 0 ? (
        <div className="text-xs text-brown-500">
          No extra fields required — submitting will generate the document and advance the stock
          status.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {config.map((f) => (
            <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                type={f.type ?? 'text'}
                value={fields[f.name] ?? ''}
                onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-gold">
          Generate & advance
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
}

const STAGE_FIELDS: Record<StockDocType, FieldConfig[]> = {
  po: [],
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
  write_off: [{ name: 'reason', label: 'Reason', full: true }],
  cancellation: [{ name: 'reason', label: 'Reason', full: true }],
};

export function StatusBadge({ value }: { value: StockStatus }) {
  const tone: Record<StockStatus, string> = {
    ordered: 'bg-gold-50 text-ink border-gold-200',
    in_transit: 'bg-paper-warm text-ink border-brown-200',
    received: 'bg-forest-50 text-forest-500 border-forest-100',
    in_warehouse: 'bg-forest-50 text-forest-500 border-forest-100',
    sold_out: 'bg-brown-50 text-brown-600 border-brown-200',
    expired: 'bg-brown-50 text-brown-600 border-brown-200',
    cancelled: 'bg-brown-50 text-brown-600 border-brown-200',
  };
  return (
    <span className={`inline-block text-xs rounded-full border px-2 py-1 ${tone[value]}`}>
      {STOCK_STATUS_LABEL[value]}
    </span>
  );
}
