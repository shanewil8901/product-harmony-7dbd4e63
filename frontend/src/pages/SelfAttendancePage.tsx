import { useEffect, useMemo, useState } from 'react';
import { Combobox } from '../components/Combobox';
import { selfAttendanceService } from '../services/hr.service';
import { toast } from '../lib/toast';
import { notifyApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { AttendanceDayState, EmployeeDirectoryEntry } from '../types/hr';
import { ATTENDANCE_LABEL } from '../types/hr';

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const prettyDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
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

export function SelfAttendancePage() {
  const [directory, setDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState(todayStr());
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [time, setTime] = useState(nowTime());
  const [state, setState] = useState<AttendanceDayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    void (async () => {
      try {
        const list = await selfAttendanceService.directory();
        setDirectory(list);
        const mine = user ? list.find((d) => d.user_id === user.id) : undefined;
        if (mine) {
          setEmployeeId(mine.id);
          setLocked(true);
        }
      } catch (e) {
        notifyApiError(e, 'Could not load the employee list');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const selected = useMemo(
    () => directory.find((d) => d.id === employeeId) ?? null,
    [directory, employeeId],
  );

  const loadState = async (id: string, date: string) => {
    try {
      const s = await selfAttendanceService.dayState(id, date);
      setState(s);
      setKind(s?.check_in && !s?.check_out ? 'out' : 'in');
    } catch {
      setState(null);
    }
  };

  useEffect(() => {
    if (!employeeId) {
      setState(null);
      return;
    }
    void loadState(employeeId, workDate);
  }, [employeeId, workDate]);

  const options = directory.map((e) => ({
    value: e.id,
    label: `${e.employee_code} — ${e.full_name}`,
    hint: e.job_title,
    keywords: `${e.employee_code} ${e.full_name} ${e.job_title}`,
  }));

  const submit = async () => {
    if (!employeeId) {
      toast('error', 'Choose your employee ID first');
      return;
    }
    if (!time) {
      toast('error', 'Enter the time');
      return;
    }
    setSaving(true);
    try {
      const saved = await selfAttendanceService.punch({
        employee_id: employeeId,
        kind,
        time,
        work_date: workDate,
      });
      setState(saved);
      setKind(saved.check_in && !saved.check_out ? 'out' : 'in');
      // A second entry for a day that already has that time is never applied
      // straight away — it waits for a manager's decision.
      if (saved.pending_approval)
        toast(
          'success',
          'Sent for approval — your recorded time stays as it is until a manager approves it',
        );
      else toast('success', kind === 'in' ? 'Checked in' : 'Checked out');
    } catch (e) {
      notifyApiError(e, 'Could not record attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Check in / out</h1>
        <p className="mt-1 text-sm text-brown-500">
          Pick your employee ID, confirm the time and record your attendance.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Employee ID</label>
          {locked ? (
            <input
              className="input bg-paper-warm"
              value={selected ? `${selected.employee_code} — ${selected.full_name}` : ''}
              readOnly
              disabled
            />
          ) : (
            <Combobox
              options={options}
              value={employeeId}
              onChange={setEmployeeId}
              allowClear
              clearLabel="Clear"
              placeholder={loading ? 'Loading…' : 'Type your employee ID or name…'}
            />
          )}
        </div>

        {selected && (
          <div className="rounded-xl bg-paper-warm p-4">
            <div className="font-serif text-lg text-ink">{selected.full_name}</div>
            <div className="text-sm text-ink-muted">{selected.job_title}</div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-brown-500">
              <span>ID: {selected.employee_code}</span>
              {selected.department_name && <span>Department: {selected.department_name}</span>}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              max={todayStr()}
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Time</label>
            <div className="flex gap-2">
              <input
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <button type="button" className="btn-ghost shrink-0" onClick={() => setTime(nowTime())}>
                Now
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="label">Action</label>
          <div className="grid grid-cols-2 gap-2">
            {(['in', 'out'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  kind === k
                    ? 'border-forest-400 bg-forest-50 text-forest-500'
                    : 'border-brown-100 text-ink-muted hover:bg-paper-warm'
                }`}
              >
                {k === 'in' ? 'Check in' : 'Check out'}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary w-full" disabled={saving || !employeeId} onClick={() => void submit()}>
          {saving ? 'Saving…' : kind === 'in' ? 'Record check-in' : 'Record check-out'}
        </button>
      </div>

      {selected && (
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-brown-500">
            {prettyDate(workDate)}
          </div>
          {state ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Status', ATTENDANCE_LABEL[state.status]],
                ['Checked in', prettyTime(state.check_in)],
                ['Checked out', prettyTime(state.check_out)],
                ['Hours', state.worked_hours],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-brown-500">{label}</div>
                  <div className="mt-0.5 font-serif text-lg text-ink">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-brown-500">No attendance recorded for this day yet.</p>
          )}
          {state?.pending_approval && (
            <div className="mt-3 rounded-xl bg-gold-50 p-3 text-sm text-gold-700">
              A changed time for this day is waiting for approval
              {state.pending_requests?.length
                ? `: ${state.pending_requests
                    .map((p) => `${p.kind === 'in' ? 'check in' : 'check out'} ${prettyTime(p.time)}`)
                    .join(', ')}`
                : ''}
              . The times above stay as they are until a manager approves it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
