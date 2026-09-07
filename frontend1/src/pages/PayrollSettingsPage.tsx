import { useEffect, useState, type FormEvent } from 'react';
import { useConfirm } from '../components/Dialog';
import { payrollSettingsService } from '../services/leave.service';
import { toast } from '../lib/toast';
import { notifyApiError, type ApiError } from '../services/api';
import type {
  CalendarSource,
  PayrollRunLog,
  PayrollSettings,
  PayrollTestRun,
  WorkCalendar,
} from '../types/leave';

/** Plain-language explanation of where the working days came from. */
const SOURCE_LABEL: Record<CalendarSource, string> = {
  calendar: 'Calendar entered for this month',
  'previous-calendar': 'Last entered calendar data',
  default: 'Default working days from the schedule',
};

const thisPeriod = () => new Date().toISOString().slice(0, 7);
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function PayrollSettingsPage() {
  const { confirm, dialog } = useConfirm();
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [calendars, setCalendars] = useState<WorkCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PayrollTestRun | null>(null);
  const [logs, setLogs] = useState<PayrollRunLog[]>([]);

  const [year, setYear] = useState(thisPeriod().slice(0, 4));
  const [month, setMonth] = useState(thisPeriod().slice(5, 7));
  const [workingDays, setWorkingDays] = useState('26');
  const [publicHolidays, setPublicHolidays] = useState('0');
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, c, l] = await Promise.all([
        payrollSettingsService.get(),
        payrollSettingsService.calendars(),
        payrollSettingsService.logs().catch(() => [] as PayrollRunLog[]),
      ]);
      setSettings(s);
      setCalendars(c);
      setLogs(l);
      setWorkingDays(String(s.default_working_days));
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Could not load payroll settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Keep the working-days field in step with an existing calendar entry.
  useEffect(() => {
    const found = calendars.find((c) => c.period === `${year}-${month}`);
    if (found) {
      setWorkingDays(String(found.working_days));
      setPublicHolidays(String(found.public_holidays));
      setNotes(found.notes ?? '');
    }
  }, [year, month, calendars]);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    try {
      const saved = await payrollSettingsService.update({
        auto_generate: settings.auto_generate,
        pay_day: Number(settings.pay_day),
        period_offset: Number(settings.period_offset),
        default_overtime_rate: Number(settings.default_overtime_rate),
        default_gosi_percent: Number(settings.default_gosi_percent),
        default_working_days: Number(settings.default_working_days),
      });
      setSettings(saved);
      toast('success', 'Payroll schedule saved');
    } catch (e) {
      notifyApiError(e, 'Could not save the payroll schedule');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCalendar = async (e: FormEvent) => {
    e.preventDefault();
    const period = `${year}-${month}`;
    if (!PERIOD_RE.test(period)) {
      toast('error', 'Pick a valid month and year');
      return;
    }
    const days = Number(workingDays);
    if (!(days >= 1 && days <= 31)) {
      toast('error', 'Working days must be between 1 and 31');
      return;
    }
    setSavingCalendar(true);
    try {
      await payrollSettingsService.upsertCalendar({
        period,
        working_days: days,
        public_holidays: Number(publicHolidays) || 0,
        notes: notes.trim() || undefined,
      });
      toast('success', `Working days set for ${period}`);
      setCalendars(await payrollSettingsService.calendars());
    } catch (e) {
      notifyApiError(e, 'Could not save the working days');
    } finally {
      setSavingCalendar(false);
    }
  };

  const removeCalendar = async (row: WorkCalendar) => {
    const ok = await confirm({
      title: 'Remove calendar',
      message: `Remove the calendar for ${row.period}?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await payrollSettingsService.removeCalendar(row.id);
      setCalendars(await payrollSettingsService.calendars());
    } catch (e) {
      notifyApiError(e, 'Could not remove that calendar entry');
    }
  };

  const runNow = async () => {
    const ok = await confirm({
      title: 'Run payroll',
      message: 'Generate draft payslips for the scheduled period now?',
      confirmLabel: 'Run now',
    });
    if (!ok) return;
    setRunning(true);
    try {
      await payrollSettingsService.run();
      toast('success', 'Payroll run finished — check the Payroll screen');
      await load();
    } catch (e) {
      notifyApiError(e, 'The payroll run failed');
    } finally {
      setRunning(false);
    }
  };

  /** Dry run for the month selected in the calendar form. */
  const testRun = async () => {
    const period = `${year}-${month}`;
    if (!PERIOD_RE.test(period)) {
      toast('error', 'Pick a valid month and year');
      return;
    }
    setTesting(true);
    try {
      const res = await payrollSettingsService.testRun(period);
      setTestResult(res);
      toast('success', `Test generation for ${res.period} — ${res.summary}`);
      setLogs(await payrollSettingsService.logs());
    } catch (e) {
      notifyApiError(e, 'The test generation failed');
    } finally {
      setTesting(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => String(Number(thisPeriod().slice(0, 4)) - 2 + i));

  if (loading) return <div className="card p-8 text-center text-brown-500">Loading…</div>;
  if (loadError) return <div className="card border-red-200 p-4 text-sm text-red-600">{loadError}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Payroll settings</h1>
          <p className="text-sm text-brown-500">
            {settings?.last_run_at
              ? `Last run ${new Date(settings.last_run_at).toLocaleString()} · ${settings.last_run_summary ?? ''}`
              : 'The scheduler has not run yet'}
          </p>
        </div>
        <button className="btn-ghost" disabled={running} onClick={() => void runNow()}>
          {running ? 'Running…' : 'Run payroll now'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card space-y-4 p-5" onSubmit={saveSettings}>
          <h2 className="font-serif text-lg text-ink">Automatic generation</h2>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={settings?.auto_generate ?? false}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, auto_generate: e.target.checked } : s))
              }
            />
            Generate draft payslips automatically on the pay day
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Pay day (1–28)</label>
              <input
                type="number"
                min={1}
                max={28}
                className="input"
                value={settings?.pay_day ?? 25}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, pay_day: Number(e.target.value) } : s))
                }
              />
            </div>
            <div>
              <label className="label">Period paid</label>
              <select
                className="input"
                value={settings?.period_offset ?? 0}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, period_offset: Number(e.target.value) } : s))
                }
              >
                <option value={0}>Current month</option>
                <option value={1}>Previous month</option>
              </select>
            </div>
            <div>
              <label className="label">Default overtime rate (SAR / hour)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={settings?.default_overtime_rate ?? '0'}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, default_overtime_rate: e.target.value } : s))
                }
              />
            </div>
            <div>
              <label className="label">GOSI (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                className="input"
                value={settings?.default_gosi_percent ?? '9'}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, default_gosi_percent: e.target.value } : s))
                }
              />
            </div>
            <div>
              <label className="label">Default working days</label>
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={settings?.default_working_days ?? 26}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, default_working_days: Number(e.target.value) } : s,
                  )
                }
              />
            </div>
          </div>
          <p className="text-xs text-brown-500">
            Payslips divide the gross salary by the working days of the month, then deduct absences
            and unpaid leave days recorded in the system.
          </p>
          <button className="btn-gold" disabled={savingSettings}>
            {savingSettings ? 'Saving…' : 'Save schedule'}
          </button>
        </form>

        <form className="card space-y-4 p-5" onSubmit={saveCalendar}>
          <h2 className="font-serif text-lg text-ink">Working days per month</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Month</label>
              <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Working days</label>
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Public holidays</label>
              <input
                type="number"
                min={0}
                max={31}
                className="input"
                value={publicHolidays}
                onChange={(e) => setPublicHolidays(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              placeholder="Eid holidays, National Day…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button className="btn-gold" disabled={savingCalendar}>
            {savingCalendar ? 'Saving…' : `Set ${year}-${month}`}
          </button>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wide text-brown-500">
                  {['Period', 'Working days', 'Holidays', 'Notes', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!calendars.length && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-brown-500">
                      No month configured — the default is used
                    </td>
                  </tr>
                )}
                {calendars.map((c) => (
                  <tr key={c.id} className="border-b border-brown-50">
                    <td className="px-2 py-2 font-medium text-ink">{c.period}</td>
                    <td className="px-2 py-2 text-ink-muted">{c.working_days}</td>
                    <td className="px-2 py-2 text-ink-muted">{c.public_holidays}</td>
                    <td className="px-2 py-2 text-brown-500">{c.notes ?? '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                        onClick={() => void removeCalendar(c)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg text-ink">Test generation</h2>
            <p className="text-sm text-brown-500">
              Checks {year}-{month} without creating payslips, and shows whether the amounts would
              use that month's calendar, the last entered calendar data, or the default.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            disabled={testing}
            onClick={() => void testRun()}
          >
            {testing ? 'Testing…' : `Test ${year}-${month}`}
          </button>
        </div>

        {testResult && (
          <div className="rounded-lg border border-brown-100 bg-paper-warm p-3 text-sm">
            <div className="font-medium text-ink">
              {testResult.period} · {testResult.calendar.working_days} working days ·{' '}
              {SOURCE_LABEL[testResult.calendar.source]}
              {testResult.calendar.source_period ? ` (${testResult.calendar.source_period})` : ''}
            </div>
            <div className="text-brown-500">
              {testResult.summary} · request {testResult.request_id}
            </div>
            {testResult.would_skip.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-brown-600">
                {testResult.would_skip.map((sk) => (
                  <li key={sk.employee_code}>
                    <strong>{sk.employee_code}</strong> — {sk.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
          Generation audit log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wide text-brown-500">
                {['When', 'Period', 'Trigger', 'Calendar source', 'Days', 'Result', 'Request id'].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {!logs.length && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-brown-500">
                    No payroll has been generated yet
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-brown-50">
                  <td className="whitespace-nowrap px-2 py-2 text-ink-muted">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-medium text-ink">{l.period}</td>
                  <td className="px-2 py-2 text-ink-muted">
                    {l.trigger_type}
                    {l.dry_run ? ' (test)' : ''}
                  </td>
                  <td className="px-2 py-2 text-brown-500">
                    {SOURCE_LABEL[l.calendar_source]}
                    {l.source_period ? ` · ${l.source_period}` : ''}
                  </td>
                  <td className="px-2 py-2 text-ink-muted">{l.working_days}</td>
                  <td className="px-2 py-2 text-ink-muted">
                    {l.created_count} created · {l.skipped_count} skipped
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-brown-500">{l.request_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialog}
    </div>
  );
}
