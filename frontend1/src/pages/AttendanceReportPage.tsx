import { useEffect, useMemo, useState } from 'react';
import { attendanceService } from '../services/hr.service';
import { Combobox } from '../components/Combobox';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { usePermissions } from '../hooks/usePermissions';
import type { ApiError } from '../services/api';
import type {
  AttendanceReportRow,
  AttendanceReportSummary,
} from '../types/hr';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';

/** Columns shared by the on-screen table and the printable report document. */
const COLUMNS: { key: keyof AttendanceReportRow; label: string; numeric?: boolean }[] = [
  { key: 'employee_code', label: 'Employee ID' },
  { key: 'employee_name', label: 'Employee name' },
  { key: 'department_name', label: 'Department' },
  { key: 'job_title', label: 'Designation' },
  { key: 'scheduled_days', label: 'Scheduled days', numeric: true },
  { key: 'days_worked', label: 'Days worked', numeric: true },
  { key: 'late_days', label: 'Late', numeric: true },
  { key: 'half_days', label: 'Half days', numeric: true },
  { key: 'absent_days', label: 'Absent', numeric: true },
  { key: 'leave_days', label: 'Total leaves', numeric: true },
  { key: 'holiday_days', label: 'Holidays', numeric: true },
  { key: 'total_hours', label: 'Total hours', numeric: true },
  { key: 'overtime_hours', label: 'Overtime hrs', numeric: true },
  { key: 'avg_hours_per_day', label: 'Avg hours / day', numeric: true },
  { key: 'attendance_rate', label: 'Attendance %', numeric: true },
  { key: 'punctuality_rate', label: 'Punctuality %', numeric: true },
];

export function AttendanceReportPage() {
  const { canViewAttendanceReport } = usePermissions();

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [employeeId, setEmployeeId] = useState('');
  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [summary, setSummary] = useState<AttendanceReportSummary | null>(null);
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = async (nextFrom = from, nextTo = to, employee = employeeId) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await attendanceService.report({
        from: nextFrom,
        to: nextTo,
        employee_id: employee || undefined,
      });
      setRows(data.items);
      setSummary(data.summary);
      setRange({ from: data.from, to: data.to });
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Failed to generate the report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewAttendanceReport) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAttendanceReport]);

  // Employee filter is built from the report itself — no extra directory call.
  const [allEmployees, setAllEmployees] = useState<AttendanceReportRow[]>([]);
  useEffect(() => {
    if (!employeeId && rows.length) setAllEmployees(rows);
  }, [rows, employeeId]);

  const options = useMemo(
    () =>
      allEmployees.map((r) => ({
        value: r.employee_id,
        label: r.employee_name,
        hint: `${r.employee_code}${r.department_name ? ` · ${r.department_name}` : ''}`,
        keywords: `${r.employee_code} ${r.job_title}`,
      })),
    [allEmployees],
  );

  if (!canViewAttendanceReport) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-brown-500">
          You need an admin, manager or supervisor role to view attendance reports.
        </p>
      </div>
    );
  }

  const cell = (r: AttendanceReportRow, key: keyof AttendanceReportRow) => {
    const v = r[key];
    if (v === null || v === '') return '—';
    if (key === 'attendance_rate' || key === 'punctuality_rate') return `${v}%`;
    return String(v);
  };

  /** Printable document, using the same voucher styling as other reports. */
  const buildHtml = () => {
    const head = COLUMNS.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${c.label}</th>`).join('');
    const body = rows
      .map(
        (r) =>
          `<tr>${COLUMNS.map(
            (c) => `<td${c.numeric ? ' class="num"' : ''}>${cell(r, c.key)}</td>`,
          ).join('')}</tr>`,
      )
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8" />
<title>Attendance report ${range.from} to ${range.to}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #241b13; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #8a7a68; font-size: 12px; margin: 0 0 18px; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
  th, td { border: 1px solid #e4dbcf; padding: 6px 8px; text-align: left; }
  th { background: #faf6f0; text-transform: uppercase; letter-spacing: .04em; font-size: 10px; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 16px; font-size: 12px; }
</style></head><body>
<h1>Attendance Report</h1>
<p class="muted">Period ${range.from} to ${range.to} · ${rows.length} employees · generated ${today()}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<p class="totals">Total days worked: ${summary?.days_worked ?? 0} · Total hours: ${
      summary?.total_hours ?? '0.00'
    } · Overtime: ${summary?.overtime_hours ?? '0.00'} · Average hours per day: ${
      summary?.avg_hours_per_day ?? '0.00'
    } · Average attendance: ${summary?.attendance_rate ?? 0}%</p>
</body></html>`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-ink">Attendance report</h1>
        <button
          className="btn-gold"
          disabled={loading || rows.length === 0}
          onClick={() => setPreview(buildHtml())}
        >
          View / download report
        </button>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
        <Combobox
          options={options}
          value={employeeId}
          onChange={setEmployeeId}
          allowClear
          clearLabel="All employees"
          placeholder="Filter by employee…"
        />
        <input
          className="input"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => {
            setFrom(e.target.value);
            if (to && e.target.value && to < e.target.value) setTo(e.target.value);
          }}
        />
        <input
          className="input"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
        <button className="btn-ghost" onClick={() => void load()}>
          Generate
        </button>
      </div>

      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
          {[
            ['Employees', summary.employees],
            ['Days worked', summary.days_worked],
            ['Absent days', summary.absent_days],
            ['Leave days', summary.leave_days],
            ['Hours (OT)', `${summary.total_hours} (${summary.overtime_hours})`],
            ['Avg hrs / day', summary.avg_hours_per_day],
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <div className="text-xs uppercase tracking-wider text-brown-500">{label}</div>
              <div className="mt-1 font-serif text-xl text-ink">{value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-sm text-brown-500">Generating report…</div>
      ) : loadError ? (
        <div className="card p-6 text-sm text-brown-600">
          {loadError}{' '}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-3 ${c.numeric ? 'text-right' : ''}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee_id} className="border-t border-brown-100">
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          c.numeric ? 'text-right text-ink-muted' : 'text-ink'
                        }`}
                      >
                        {cell(r, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="px-4 py-8 text-center text-brown-500"
                    >
                      No attendance data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview && (
        <DocumentPreviewModal
          title="Attendance report"
          subtitle={`${range.from} to ${range.to}`}
          html={preview}
          fileName={`attendance-report-${range.from}-to-${range.to}`}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
