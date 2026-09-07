import { useEffect, useState, type FormEvent } from 'react';
import { attendanceService, employeesService } from '../services/hr.service';
import { Combobox } from '../components/Combobox';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from '../lib/toast';
import { notifyApiError, type ApiError } from '../services/api';
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STATUSES,
  type AttendanceRow,
  type AttendanceStatus,
  type AttendanceSummary,
  type Employee,
} from '../types/hr';

const NON_WORKING: AttendanceStatus[] = ['absent', 'leave', 'sick_leave', 'holiday'];
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + '01';

export function AttendancePage() {
  const { canManageUsers, isAdmin, isManager } = usePermissions();
  const canEdit = isAdmin || isManager;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterEmployee, setFilterEmployee] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const [formEmployee, setFormEmployee] = useState('');
  const [workDate, setWorkDate] = useState(today());
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [checkIn, setCheckIn] = useState('08:00');
  const [checkOut, setCheckOut] = useState('17:00');
  const [overtime, setOvertime] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await attendanceService.list({
        employee_id: filterEmployee || undefined,
        from,
        to,
      });
      setRows(data.items);
      setSummary(data.summary);
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        setEmployees(await employeesService.list());
      } catch (e) {
        notifyApiError(e, 'Could not load employees');
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  if (!canManageUsers) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-brown-500">
          You need an admin or manager role to view attendance.
        </p>
      </div>
    );
  }

  const options = employees.map((e) => ({
    value: e.id,
    label: e.full_name,
    hint: `${e.employee_code} · ${e.job_title}`,
    keywords: `${e.employee_code} ${e.email ?? ''}`,
  }));

  const working = !NON_WORKING.includes(status);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formEmployee) e.employee_id = 'Select an employee';
    if (!workDate) e.work_date = 'Required';
    else if (workDate > today()) e.work_date = 'Cannot record a future date';
    if (working) {
      if (!checkIn) e.check_in = 'Required for a worked day';
      if (!checkOut) e.check_out = 'Required for a worked day';
      if (checkIn && checkOut && checkOut <= checkIn)
        e.check_out = 'Check-out must be later than check-in';
    }
    if (overtime && (Number.isNaN(Number(overtime)) || Number(overtime) < 0 || Number(overtime) > 24))
      e.overtime_hours = 'Enter 0–24 hours';
    setErrors(e);
    if (Object.keys(e).length)
      toast(
        'error',
        `Please correct ${Object.keys(e).length} field${Object.keys(e).length > 1 ? 's' : ''}:`,
        Object.entries(e).map(([field, message]) => ({ field, message })),
      );
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await attendanceService.upsert({
        employee_id: formEmployee,
        work_date: workDate,
        status,
        check_in: working ? checkIn : undefined,
        check_out: working ? checkOut : undefined,
        overtime_hours: overtime ? Number(overtime) : undefined,
        notes: notes.trim() || undefined,
      });
      toast('success', 'Attendance saved');
      setNotes('');
      setOvertime('');
      setErrors({});
      await load();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fieldErrors ?? {});
      notifyApiError(apiErr, 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await attendanceService.remove(id);
      toast('success', 'Attendance record removed');
      await load();
    } catch (err) {
      notifyApiError(err, 'Could not delete record');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-ink">Attendance</h1>

      {canEdit && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-3" noValidate>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
            Record attendance
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Employee *</label>
              <Combobox
                options={options}
                value={formEmployee}
                onChange={setFormEmployee}
                placeholder="Search employee…"
              />
              {errors.employee_id && (
                <p className="mt-1 text-xs text-brown-600">{errors.employee_id}</p>
              )}
            </div>
            <div>
              <label className="label">Date *</label>
              <input
                className="input"
                type="date"
                max={today()}
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
              {errors.work_date && <p className="mt-1 text-xs text-brown-600">{errors.work_date}</p>}
            </div>
            <div>
              <label className="label">Status *</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ATTENDANCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Overtime hours</label>
              <input
                className="input"
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={overtime}
                onChange={(e) => setOvertime(e.target.value)}
              />
              {errors.overtime_hours && (
                <p className="mt-1 text-xs text-brown-600">{errors.overtime_hours}</p>
              )}
            </div>
            <div>
              <label className="label">Check-in {working && '*'}</label>
              <input
                className="input"
                type="time"
                disabled={!working}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
              {errors.check_in && <p className="mt-1 text-xs text-brown-600">{errors.check_in}</p>}
            </div>
            <div>
              <label className="label">Check-out {working && '*'}</label>
              <input
                className="input"
                type="time"
                disabled={!working}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
              {errors.check_out && <p className="mt-1 text-xs text-brown-600">{errors.check_out}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </form>
      )}

      <div className="card p-4 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
        <Combobox
          options={options}
          value={filterEmployee}
          onChange={setFilterEmployee}
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
          Apply
        </button>
      </div>

      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            ['Records', summary.total_records],
            ['Present days', summary.present_days],
            ['Absent days', summary.absent_days],
            ['Leave days', summary.leave_days],
            ['Hours (OT)', `${summary.total_hours} (${summary.total_overtime})`],
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <div className="text-xs uppercase tracking-wider text-brown-500">{label}</div>
              <div className="mt-1 font-serif text-xl text-ink">{value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-sm text-brown-500">Loading…</div>
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
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Overtime</th>
                  <th className="px-4 py-3">Notes</th>
                  {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-brown-100">
                    <td className="px-4 py-3 whitespace-nowrap text-ink">{r.work_date}</td>
                    <td className="px-4 py-3 text-ink">
                      {r.employee_name ?? '—'}
                      <span className="ml-2 text-xs text-brown-500">{r.employee_code}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{ATTENDANCE_LABEL[r.status]}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.check_in ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.check_out ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.worked_hours}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.overtime_hours}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.notes ?? '—'}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          className="btn-danger !py-1 !px-2 text-xs"
                          onClick={() => void remove(r.id)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="px-4 py-8 text-center text-brown-500">
                      No attendance records for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
