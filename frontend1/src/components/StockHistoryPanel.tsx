import { useEffect, useMemo, useState } from 'react';
import type { Stock, StockAttachment } from '../types/stock';
import { STOCK_ATTACHMENT_STAGE_LABEL, formatMoney } from '../types/stock';
import { stockHistoryService, type StockHistoryEntry } from '../services/stockHistory.service';
import { stockAttachmentsService } from '../services/stockAttachments.service';
import { Combobox } from './Combobox';
import { UserName } from './UserName';

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
  attachment: 'Attachment',
};

const ACTION_TONE: Record<StockHistoryEntry['action'], string> = {
  create: 'bg-forest-50 text-forest-500 border-forest-100',
  update: 'bg-gold-50 text-ink border-gold-200',
  delete: 'bg-brown-50 text-brown-600 border-brown-200',
  status_change: 'bg-forest-50 text-forest-500 border-forest-100',
  document: 'bg-paper-warm text-ink border-brown-200',
  attachment: 'bg-gold-50 text-ink border-gold-200',
};

export function StockHistoryPanel({ stock, onClose }: Props) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<StockAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    Promise.all([stockHistoryService.list(stock.id), stockAttachmentsService.list(stock.id)])
      .then(([h, a]) => {
        setEntries(h);
        setAttachments(a);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [stock.id]);

  const actionOptions = useMemo(
    () =>
      [...new Set(entries.map((e) => e.action))].map((a) => ({
        value: a,
        label: ACTION_LABEL[a],
      })),
    [entries],
  );

  const userOptions = useMemo(
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

  const buyCur = stock.buying_currency_code ?? null;
  const totalBuyingValue =
    stock.total_buying_value ??
    (Number(stock.qty) * Number(stock.buying_price_snapshot)).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
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
              {stock.batch_no ? ` · batch ${stock.batch_no}` : ''} ·{' '}
              <span className="text-ink">
                Total buying value {formatMoney(totalBuyingValue, buyCur)}
              </span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {loading && <div className="text-sm text-brown-500">Loading…</div>}

        {!loading && visible.length === 0 && (
          <div className="text-sm text-brown-500">No history entries match these filters.</div>
        )}

        <ol className="relative border-l border-brown-100 ml-2 space-y-4">
          {visible.map((e) => (
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
                <span className="text-xs text-brown-500">· <UserName value={e.changed_by} /></span>
              </div>
              {e.changes && (
                <ChangeDetails action={e.action} changes={e.changes} />
              )}
            </li>
          ))}
        </ol>

        <div>
          <div className="label">Attached documents</div>
          <div className="rounded-lg border border-brown-100 divide-y divide-brown-50">
            {attachments.length === 0 && (
              <div className="p-3 text-sm text-brown-500">No files attached.</div>
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
                  </div>
                </div>
                <button
                  className="btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => void stockAttachmentsService.download(a.stock_id, a)}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
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
      total_amount?: string | null;
      currency_code?: string | null;
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
        {info.total_amount && (
          <span className="ml-2 text-xs font-medium text-ink">
            {formatMoney(info.total_amount, info.currency_code)}
          </span>
        )}
      </div>
    );
  }

  if (action === 'attachment') {
    const info = changes as { stage?: string; file_name?: string; action?: string };
    return (
      <div className="mt-1 text-sm text-ink">
        {info.action === 'deleted' ? 'Removed' : 'Uploaded'}{' '}
        <span className="font-medium">{info.file_name}</span>
        {info.stage && <span className="ml-2 text-xs text-brown-500">({info.stage})</span>}
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
