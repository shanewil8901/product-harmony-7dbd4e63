import { useEffect, useMemo, useState, type FormEvent } from "react";
import { leaveService } from "../services/leave.service";
import { toast } from "../lib/toast";
import { ConfirmDialog } from "../components/Dialog";
import { notifyApiError, type ApiError } from "../services/api";
import { UserName } from "../components/UserName";
import {
  LEAVE_STATUSES,
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_TONE,
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  type LeaveBalance,
  type LeaveRequestRow,
  type LeaveType,
} from "../types/leave";

const today = () => new Date().toISOString().slice(0, 10);

/** My workspace → Leave. Personal requests only; approvals live under People. */
export function LeavePage() {
  const [rows, setRows] = useState<LeaveRequestRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<LeaveRequestRow | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, bal] = await Promise.all([
        leaveService.list({ status: statusFilter || undefined, mine: true }),
        leaveService.balances().catch(() => [] as LeaveBalance[]),
      ]);
      setRows(list);
      setBalances(bal);
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? "Could not load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast("error", "Give a short reason for the leave");
      return;
    }
    if (toDate < fromDate) {
      toast("error", "The end date cannot be before the start date");
      return;
    }
    setSaving(true);
    try {
      const created = await leaveService.apply({
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
      });
      toast(
        "success",
        created.status === "approved"
          ? "Leave recorded — no approval was required"
          : "Leave request submitted for approval",
      );
      setReason("");
      await load();
    } catch (e) {
      notifyApiError(e, "Could not submit the leave request");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (row: LeaveRequestRow) => {
    try {
      await leaveService.cancel(row.id);
      toast("success", "Request withdrawn");
      await load();
    } catch (e) {
      notifyApiError(e, "Could not withdraw the request");
    } finally {
      setWithdrawing(null);
    }
  };

  const pending = useMemo(() => rows.filter((r) => r.status.startsWith("pending")).length, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Leave</h1>
        <p className="text-sm text-brown-500">
          {rows.length} request{rows.length === 1 ? "" : "s"} · {pending} awaiting a decision
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {balances.map((b) => (
          <div key={b.leave_type} className="card p-4">
            <div className="text-xs text-brown-500">{LEAVE_TYPE_LABEL[b.leave_type]}</div>
            <div className="mt-1 text-xl font-semibold text-ink">{b.remaining}</div>
            <div className="text-xs text-brown-500">
              of {b.entitlement} per {b.period_unit} · {b.used} used
            </div>
          </div>
        ))}
      </div>

      <form className="card space-y-4 p-4" onSubmit={submit}>
        <h2 className="font-serif text-lg text-ink">Apply for leave</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Leave type</label>
            <select
              className="input"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input"
              value={fromDate}
              onChange={(e) => {
                const v = e.target.value;
                setFromDate(v);
                if (leaveType === "short" || toDate < v) setToDate(v);
              }}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input"
              value={toDate}
              min={fromDate}
              disabled={leaveType === "short"}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Reason</label>
            <input
              className="input"
              value={reason}
              placeholder="Family matter, medical appointment…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-brown-500">
            Requests are reviewed by a supervisor or above. Days beyond your balance are recorded as
            unpaid.
          </p>
          <button className="btn-gold" disabled={saving}>
            {saving ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAVE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loadError && <div className="card border-red-200 p-4 text-sm text-red-600">{loadError}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper-warm text-ink">
            <tr className="text-left">
              {["Type", "Dates", "Days", "Status", "Decision", ""].map((h, i) => (
                <th
                  key={h || i}
                  className={`px-4 py-3 whitespace-nowrap ${h === "Days" ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brown-50">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brown-500 whitespace-nowrap">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-brown-500 whitespace-nowrap">
                  No leave requests yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-paper-soft">
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {LEAVE_TYPE_LABEL[r.leave_type]}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-muted">
                  {r.from_date} → {r.to_date}
                  {r.reason && (
                    <div className="font-sans text-xs text-brown-500 mt-0.5">{r.reason}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-medium text-ink">
                  {r.days}
                  {Number(r.unpaid_days) > 0 && (
                    <span className="block font-sans text-xs text-brown-600 font-normal">
                      {r.unpaid_days} unpaid
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-medium ${LEAVE_STATUS_TONE[r.status]}`}
                  >
                    {LEAVE_STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-brown-500 whitespace-nowrap">
                  {r.decided_by ? (
                    <>
                      <div className="text-ink-muted">
                        <UserName value={r.decided_by} />
                      </div>
                      <div className="uppercase tracking-wide">{r.decided_by_role}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex justify-end">
                    {r.status.startsWith("pending") && (
                      <button
                        className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                        onClick={() => setWithdrawing(r)}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw leave request"
          message={`Withdraw your ${LEAVE_TYPE_LABEL[withdrawing.leave_type].toLowerCase()} from ${withdrawing.from_date} to ${withdrawing.to_date}?`}
          confirmLabel="Withdraw"
          tone="danger"
          onCancel={() => setWithdrawing(null)}
          onConfirm={() => void cancel(withdrawing)}
        />
      )}
    </div>
  );
}
