import { useEffect, useState } from 'react';
import { backupService } from '../services/backup.service';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../components/Dialog';
import { notifyApiError } from '../services/api';
import { toast } from '../lib/toast';
import type { BackupStatusInfo, DbBackup } from '../types/backup';

const bytes = (n: number | string) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const badge = (kind: 'ok' | 'warn' | 'bad' | 'muted') =>
  ({
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-700 ring-amber-200',
    bad: 'bg-rose-50 text-rose-700 ring-rose-200',
    muted: 'bg-slate-100 text-slate-600 ring-slate-200',
  })[kind];

export function BackupPage() {
  const { canManageUsers } = usePermissions();
  const { confirm, dialog } = useConfirm();

  const [status, setStatus] = useState<BackupStatusInfo | null>(null);
  const [rows, setRows] = useState<DbBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([backupService.status(), backupService.list()]);
      setStatus(s);
      setRows(list);
    } catch (e) {
      notifyApiError(e, 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) void load();
    else setLoading(false);
  }, [canManageUsers]);

  if (!canManageUsers)
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
        Only an admin or manager can manage database backups.
      </div>
    );

  const runNow = async () => {
    if (!(await confirm({ title: 'Run backup now', message: 'Create a database backup now? The file is named with the current timestamp and your name.', confirmLabel: 'Run backup' })))
      return;
    setBusy('run');
    try {
      const created = await backupService.run();
      toast('success', `Backup created: ${created.filename}`);
      await load();
    } catch (e) {
      notifyApiError(e, 'Backup failed');
    } finally {
      setBusy(null);
    }
  };

  const uploadOne = async (row: DbBackup) => {
    setBusy(row.id);
    try {
      await backupService.upload(row.id);
      toast('success', 'Backup uploaded to Google Drive');
      await load();
    } catch (e) {
      notifyApiError(e, 'Google Drive upload failed');
    } finally {
      setBusy(null);
    }
  };

  const purge = async () => {
    if (
      !(await confirm({
        title: 'Delete expired backups',
        message: `Delete local backup files older than ${status?.retention_days ?? 30} days? Files already copied to Google Drive stay there.`,
        confirmLabel: 'Delete old files',
        tone: 'danger',
      }))
    )
      return;
    setBusy('purge');
    try {
      const res = await backupService.purge();
      toast('success', res.removed.length ? `Removed ${res.removed.length} old backup file(s)` : 'No expired backups found');
      await load();
    } catch (e) {
      notifyApiError(e, 'Cleanup failed');
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    { label: 'Local schedule', value: `Every ${status?.local_every_minutes ?? 15} min`, hint: status?.local_dir ?? '' },
    { label: 'Local files kept', value: String(status?.local_files ?? 0), hint: bytes(status?.local_bytes ?? 0) },
    { label: 'Retention', value: `${status?.retention_days ?? 30} days`, hint: 'Older files removed nightly' },
    {
      label: 'Google Drive',
      value: status?.drive_configured ? 'Connected' : 'Not configured',
      hint: status?.drive_configured ? 'Uploads once a day' : 'Set the Drive credentials in the environment',
    },
  ];

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Database backups</h1>
          <p className="text-sm text-slate-500">
            Automatic local snapshots every 15 minutes, a daily copy to Google Drive, and automatic
            cleanup of files older than a month.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={purge}
            disabled={busy !== null}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'purge' ? 'Cleaning…' : 'Clean up old files'}
          </button>
          <button
            onClick={runNow}
            disabled={busy !== null}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'run' ? 'Backing up…' : 'Back up now'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{c.value}</p>
            <p className="mt-1 truncate text-xs text-slate-400" title={c.hint}>
              {c.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Google Drive</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Loading backups…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No backups yet — the first automatic snapshot runs within 15 minutes.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {r.filename}
                  {r.local_deleted && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] ring-1 bg-slate-100 text-slate-500 ring-slate-200">
                      local file removed
                    </span>
                  )}
                  {r.error && <p className="mt-1 text-xs text-rose-600">{r.error}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{when(r.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.trigger === 'manual' ? `Manual · ${r.created_by_name ?? 'user'}` : 'Automatic'}
                </td>
                <td className="px-4 py-3 text-slate-600">{bytes(r.size_bytes)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${badge(r.status === 'success' ? 'ok' : 'bad')}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${badge(
                      r.drive_status === 'uploaded' ? 'ok' : r.drive_status === 'failed' ? 'bad' : r.drive_status === 'pending' ? 'warn' : 'muted',
                    )}`}
                  >
                    {r.drive_status}
                  </span>
                  {r.drive_uploaded_at && (
                    <p className="mt-1 text-xs text-slate-400">{when(r.drive_uploaded_at)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'success' && !r.local_deleted && r.drive_status !== 'uploaded' && (
                    <button
                      onClick={() => uploadOne(r)}
                      disabled={busy !== null || !status?.drive_configured}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
                      title={status?.drive_configured ? 'Upload to Google Drive' : 'Google Drive is not configured'}
                    >
                      {busy === r.id ? 'Uploading…' : 'Upload to Drive'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
