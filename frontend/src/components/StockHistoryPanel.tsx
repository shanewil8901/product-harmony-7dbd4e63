import { useEffect, useState } from 'react';
import type { Stock } from '../types/stock';
import { stockHistoryService, type StockHistoryEntry } from '../services/stockHistory.service';

interface Props {
  stock: Stock;
  onClose: () => void;
}

const ACTION_LABEL: Record<StockHistoryEntry['action'], string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status changed',
  document: 'Document generated',
};

const ACTION_TONE: Record<StockHistoryEntry['action'], string> = {
  create: 'bg-forest-50 text-forest-500 border-forest-100',
  update: 'bg-gold-50 text-ink border-gold-200',
  delete: 'bg-brown-50 text-brown-600 border-brown-200',
  status_change: 'bg-forest-50 text-forest-500 border-forest-100',
  document: 'bg-paper-warm text-ink border-brown-200',
};

export function StockHistoryPanel({ stock, onClose }: Props) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    stockHistoryService
      .list(stock.id)
      .then(setEntries)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [stock.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl text-ink">Stock history</h3>
            <p className="text-xs text-brown-500 mt-1">
              {stock.product_code ?? stock.product_id.slice(0, 8)}
              {stock.batch_no ? ` · batch ${stock.batch_no}` : ''}
            </p>
          </div>
          <button className="text-brown-500 hover:text-ink text-xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
            {err}
          </div>
        )}

        {loading && <div className="text-sm text-brown-500">Loading…</div>}

        {!loading && entries.length === 0 && (
          <div className="text-sm text-brown-500">No history yet.</div>
        )}

        <ol className="relative border-l border-brown-100 ml-2 space-y-4">
          {entries.map((e) => (
            <li key={e.id} className="pl-4 relative">
              <span className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-gold-400 border-2 border-paper" />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs rounded-full border px-2 py-0.5 ${ACTION_TONE[e.action]}`}
                >
                  {ACTION_LABEL[e.action]}
                </span>
                <span className="text-xs text-brown-500">
                  {new Date(e.changed_at).toLocaleString()}
                </span>
                <span className="text-xs text-brown-500">· {e.changed_by ?? '—'}</span>
              </div>
              {e.changes && (
                <ChangeDetails action={e.action} changes={e.changes} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ChangeDetails({
  action,
  changes,
}: {
  action: StockHistoryEntry['action'];
  changes: Record<string, unknown>;
}) {
  if (action === 'document' || action === 'status_change') {
    const info = changes as {
      doc_type?: string;
      doc_number?: string;
      status_from?: string;
      status_to?: string;
    };
    return (
      <div className="mt-1 text-sm text-ink">
        <span className="font-mono text-xs mr-2">{info.doc_number}</span>
        <span className="text-brown-500">{info.doc_type}</span>
        {info.status_from && info.status_to && info.status_from !== info.status_to && (
          <span className="ml-2 text-xs text-brown-500">
            ({info.status_from} → {info.status_to})
          </span>
        )}
      </div>
    );
  }

  if (action === 'update') {
    const diffs = changes as Record<string, { from: unknown; to: unknown }>;
    return (
      <ul className="mt-1 text-xs text-brown-600 space-y-0.5">
        {Object.entries(diffs).map(([field, v]) => (
          <li key={field}>
            <span className="font-medium text-ink">{field}:</span>{' '}
            <span className="line-through text-brown-400">{String(v.from ?? '—')}</span>{' '}
            → <span>{String(v.to ?? '—')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}
