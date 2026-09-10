import { useEffect, useState } from 'react';
import { attendanceService } from '../services/hr.service';
import { toast } from '../lib/toast';
import { notifyApiError, type ApiError } from '../services/api';
import type { AttendanceRequestRow } from '../types/hr';

const prettyDate = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const prettyTime = (t: string | null) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}${suffix}`;
};

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-gold-50 text-gold-600',
  approved: 'bg-forest-50 text-forest-500',
  rejected: 'bg-red-50 text-red-600',
};

/**
 * People → Attendance approvals. A second entry for a day that already holds a
 * time never overwrites anything; it waits here for an admin, manager or
 * supervisor to accept or decline it.
 */
export function AttendanceApprovalsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rows, setRows] = useState<AttendanceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await attendanceService.listRequests(status));
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Could not load attendance requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const decide = async (row: AttendanceRequestRow, action: 'approve' | 'reject') => {
    setBusyId(row.id);
    try {
      await attendanceService.decideRequest(row.id, action, notes[row.id]);
      toast(
        'success',
        action === 'approve' ? 'Attendance updated' : 'Request declined — attendance unchanged',
      );
      setNotes((n) => ({ ...n, [row.id]: '' }));
      await load();
    } catch (e) {
      notifyApiError(e, 'Could not record that decision');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Attendance approvals</h1>
          <p className="mt-1 text-sm text-brown-500">
            When someone records a time for a day that already has one, it waits here. The
            attendance record only changes once you approve it.
          </p>
        </div>
        <div>
          <label className="label">Show</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="pending">Waiting for approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Declined</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-brown-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-brown-500">Nothing to review here.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-serif text-lg text-ink">
                    {r.employee_name ?? 'Employee'}{' '}
                    {r.employee_code && (
                      <span className="text-sm text-brown-500">({r.employee_code})</span>
                    )}
                  </div>
                  <div className="text-sm text-ink-muted">
                    {prettyDate(r.work_date)} · {r.kind === 'in' ? 'Check in' : 'Check out'}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_TONE[r.status] ?? 'bg-paper-warm text-ink-muted'
                  }`}
                >
                  {r.status === 'pending'
                    ? 'Waiting'
                    : r.status === 'approved'
                      ? 'Approved'
                      : 'Declined'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-brown-500">Currently recorded</div>
                  <div className="mt-0.5 font-serif text-lg text-ink">
                    {prettyTime(r.current_time_value)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-brown-500">New time entered</div>
                  <div className="mt-0.5 font-serif text-lg text-ink">
                    {prettyTime(r.requested_time)}
                  </div>
                </div>
              </div>

              {r.status === 'pending' ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <label className="label">Note (optional)</label>
                    <input
                      className="input"
                      value={notes[r.id] ?? ''}
                      placeholder="Reason for your decision"
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                  </div>
                  <button
                    className="btn-primary"
                    disabled={busyId === r.id}
                    onClick={() => void decide(r, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-ghost text-red-600"
                    disabled={busyId === r.id}
                    onClick={() => void decide(r, 'reject')}
                  >
                    Decline
                  </button>
                </div>
              ) : (
                r.decision_note && (
                  <p className="mt-3 text-sm text-brown-500">Note: {r.decision_note}</p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
