import { useEffect, useMemo, useState } from "react";
import { leaveService } from "../services/leave.service";
import { usePermissions } from "../hooks/usePermissions";
import { toast } from "../lib/toast";
import { notifyApiError, type ApiError } from "../services/api";
import { UserName } from "../components/UserName";
import {
  LEAVE_STATUSES,
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_TONE,
  LEAVE_TYPE_LABEL,
  type LeaveRequestRow,
} from "../types/leave";

const today = () => new Date().toISOString().slice(0, 10);

type Tab = "requests" | "on-leave";

/** People → Leave approvals. Supervisors and above review the whole company. */
export function LeaveApprovalsPage() {
  const { isAdmin, canApproveLeave, canFinalApproveLeave } = usePermissions();

  const [tab, setTab] = useState<Tab>("requests");
  const [rows, setRows] = useState<LeaveRequestRow[]>([]);
  const [onLeave, setOnLeave] = useState<LeaveRequestRow[]>([]);
  const [date, setDate] = useState(today());
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (tab === "requests") {
        setRows(await leaveService.list({ status: statusFilter || undefined }));
      } else {
        setOnLeave(await leaveService.onLeave(date));
      }
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? "Could not load leave data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, date]);

  const decide = async (row: LeaveRequestRow, action: "approve" | "reject") => {
    setBusyId(row.id);
    try {
      await leaveService.decide(row.id, action);
      toast("success", `Request ${action === "approve" ? "approved" : "rejected"}`);
      await load();
    } catch (e) {
      notifyApiError(e, "Could not record that decision");
    } finally {
      setBusyId(null);
    }
  };

  /** A manager's own leave needs an admin; anything else a supervisor can clear. */
  const canDecide = (row: LeaveRequestRow) =>
    row.status === "pending_admin"
      ? isAdmin
      : row.status === "pending_manager"
        ? canFinalApproveLeave
        : row.status === "pending_supervisor" && canApproveLeave;

  const pending = useMemo(() => rows.filter((r) => r.status.startsWith("pending")).length, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Leave approvals</h1>
        <p className="text-sm text-brown-500">
          {tab === "requests"
            ? `${rows.length} request${rows.length === 1 ? "" : "s"} · ${pending} awaiting a decision`
            : `${onLeave.length} employee${onLeave.length === 1 ? "" : "s"} on leave on ${date}`}
        </p>
      </div>

      <div className="flex gap-1 border-b border-brown-100">
        {(
          [
            ["requests", "Requests"],
            ["on-leave", "Currently on leave"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key
                ? "border-gold-400 font-medium text-ink"
                : "border-transparent text-brown-500 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        {tab === "requests" ? (
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
        ) : (
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loadError && <div className="card border-red-200 p-4 text-sm text-red-600">{loadError}</div>}

      {tab === "requests" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-warm text-ink">
              <tr className="text-left">
                {["Employee", "Type", "Dates", "Days", "Status", "Decided by", ""].map((h, i) => (
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
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-brown-500 whitespace-nowrap"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && !rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-brown-500 whitespace-nowrap"
                  >
                    No leave requests
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-paper-soft">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-ink">{r.employee_name ?? "—"}</div>
                    <div className="text-xs text-brown-500">
                      {r.employee_code && <span className="font-mono">{r.employee_code}</span>}
                      {r.employee_code && r.job_title ? " · " : ""}
                      {r.job_title ?? ""}
                    </div>
                  </td>
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
                        {r.decided_at && (
                          <div className="font-mono text-[11px] text-brown-500">
                            {r.decided_at.slice(0, 10)}
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1">
                      {canDecide(r) && (
                        <>
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs"
                            disabled={busyId === r.id}
                            onClick={() => void decide(r, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                            disabled={busyId === r.id}
                            onClick={() => void decide(r, "reject")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-warm text-ink">
              <tr className="text-left">
                {["Employee", "Department", "Type", "Dates", "Days"].map((h, i) => (
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
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-brown-500 whitespace-nowrap"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && !onLeave.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-brown-500 whitespace-nowrap"
                  >
                    Nobody is on leave on this date
                  </td>
                </tr>
              )}
              {onLeave.map((r) => (
                <tr key={r.id} className="hover:bg-paper-soft">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-ink">{r.employee_name ?? "—"}</div>
                    {r.employee_code && (
                      <div className="font-mono text-xs text-brown-500">{r.employee_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                    {r.department_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                    {LEAVE_TYPE_LABEL[r.leave_type]}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-muted">
                    {r.from_date} → {r.to_date}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-medium text-ink">
                    {r.days}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
