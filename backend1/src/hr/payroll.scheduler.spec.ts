import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollService } from './payroll.service';
import { PayrollSettingsService } from './payroll-settings.service';
import type { PayrollRunLog, PayrollSettings, WorkCalendar } from './payroll-settings.entity';

/**
 * Scheduler + calendar-fallback behaviour over in-memory stand-ins for the
 * TypeORM repositories — no database required.
 */

type Row = Record<string, any>;

function repo(rows: Row[]) {
  const matches = (r: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    rows,
    create: (v: Row) => ({ ...v }),
    save: async (v: Row) => {
      if (!v.id) {
        v.id = `id-${rows.length + 1}`;
        rows.push(v);
      }
      return v;
    },
    find: async ({ where = {}, order }: any = {}) => {
      let out = rows.filter((r) => matches(r, where));
      const key = order ? Object.keys(order)[0] : null;
      if (key)
        out = [...out].sort((a, b) =>
          String(order[key]).toUpperCase() === 'DESC'
            ? String(b[key]).localeCompare(String(a[key]))
            : String(a[key]).localeCompare(String(b[key])),
        );
      return out;
    },
    findOne: async ({ where = {}, order }: any = {}) => {
      const out = await (repo(rows).find as any)({ where, order });
      return out[0] ?? null;
    },
    remove: async (r: Row) => rows.splice(rows.indexOf(r), 1),
    createQueryBuilder: () => {
      let period = '';
      const qb: any = {
        where: (_s: string, p: any) => {
          period = p.period;
          return qb;
        },
        andWhere: () => qb,
        leftJoinAndSelect: () => qb,
        orderBy: () => qb,
        getOne: async () =>
          [...rows]
            .filter((r) => r.period < period)
            .sort((a, b) => String(b.period).localeCompare(String(a.period)))[0] ?? null,
        getMany: async () => rows,
      };
      return qb;
    },
  } as any;
}

function build(options: { calendars?: Row[]; settings?: Row; employees?: Row[] } = {}) {
  const settingsRow: Row = {
    id: 'default',
    auto_generate: true,
    pay_day: 25,
    period_offset: 1,
    default_overtime_rate: '0.00',
    default_gosi_percent: '9.00',
    default_working_days: 26,
    last_run_period: null,
    last_run_at: null,
    last_run_summary: null,
    ...options.settings,
  };
  const settingsRepo = repo([settingsRow]);
  const calRepo = repo(options.calendars ?? []);
  const logRows: Row[] = [];
  const logRepo = repo(logRows);

  const settings = new PayrollSettingsService(
    settingsRepo as any,
    calRepo as any,
    logRepo as any,
  ) as PayrollSettingsService & Record<string, any>;

  const payslips: Row[] = [];
  const payslipRepo = repo(payslips);
  const employees =
    options.employees ??
    ([
      {
        id: 'e1',
        employee_code: 'EMP-001',
        first_name: 'Sara',
        last_name: 'A',
        employment_status: 'active',
        salary_currency_id: 'c1',
        basic_salary: '10000.00',
        housing_allowance: '0.00',
        transport_allowance: '0.00',
        other_allowance: '0.00',
      },
    ] as Row[]);
  const empRepo = repo(employees);

  const attendance = {
    periodSummary: async () => ({ worked_days: 20, absent_days: 1, overtime_hours: 0 }),
  };
  const leave = {
    periodLeave: async () => ({ paid_leave_days: 0, unpaid_leave_days: 0 }),
  };

  const payroll = new PayrollService(
    payslipRepo as any,
    empRepo as any,
    attendance as any,
    leave as any,
    settings,
  ) as PayrollService & Record<string, any>;

  return { payroll, settings, payslips, logs: logRows, settingsRow, calRepo };
}

describe('working-days resolution', () => {
  it('uses the calendar entered for the month', async () => {
    const { settings } = build({ calendars: [{ period: '2026-07', working_days: 21 }] });
    expect(await settings.resolveWorkingDays('2026-07')).toEqual({
      working_days: 21,
      source: 'calendar',
      source_period: '2026-07',
    });
  });

  it('falls back to the last entered calendar data when the month is missing', async () => {
    const { settings } = build({
      calendars: [
        { period: '2026-05', working_days: 24 },
        { period: '2026-06', working_days: 22 },
      ],
    });
    expect(await settings.resolveWorkingDays('2026-07')).toEqual({
      working_days: 22,
      source: 'previous-calendar',
      source_period: '2026-06',
    });
  });

  it('falls back to the configured default only when no calendar exists', async () => {
    const { settings } = build({ calendars: [] });
    expect(await settings.resolveWorkingDays('2026-07')).toEqual({
      working_days: 26,
      source: 'default',
      source_period: null,
    });
  });
});

describe('automatic payroll generation', () => {
  it('generates using the last entered calendar data and records the source', async () => {
    const { payroll, payslips, logs } = build({
      calendars: [{ period: '2026-06', working_days: 22 }],
    });

    const res = await payroll.runScheduled('2026-07', 'payroll-scheduler', 'scheduled');

    expect(res.calendar).toEqual({
      working_days: 22,
      source: 'previous-calendar',
      source_period: '2026-06',
    });
    expect(payslips).toHaveLength(1);
    expect(payslips[0].working_days).toBe(22);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      period: '2026-07',
      trigger_type: 'scheduled',
      calendar_source: 'previous-calendar',
      source_period: '2026-06',
      working_days: 22,
      created_count: 1,
      dry_run: false,
    });
    expect(logs[0].request_id).toEqual(res.request_id);
  });

  it('test generation writes no payslips but reports the fallback source', async () => {
    const { payroll, payslips, logs } = build({
      calendars: [{ period: '2026-06', working_days: 22 }],
    });

    const res = await payroll.previewRun('2026-07', 'tester');

    expect(payslips).toHaveLength(0);
    expect(res).toMatchObject({ dry_run: true, would_create: 1, period: '2026-07' });
    expect(res.calendar.source).toBe('previous-calendar');
    expect(logs[0]).toMatchObject({ trigger_type: 'test', dry_run: true });
  });
});

describe('scheduler downtime around the pay day', () => {
  afterEach(() => vi.useRealTimers());

  it('generates the missed month on the first run after the pay day', async () => {
    const { payroll, payslips, settingsRow } = build({
      calendars: [{ period: '2026-06', working_days: 22 }],
      settings: { pay_day: 25, period_offset: 1 },
    });

    // The server was down on the 25th; it comes back on the 28th.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T06:00:00Z'));

    await (payroll as any).tick();

    expect(payslips).toHaveLength(1);
    expect(payslips[0].period).toBe('2026-06');
    expect(settingsRow.last_run_period).toBe('2026-06');
  });

  it('does not run twice for the same period', async () => {
    const { payroll, payslips } = build({
      calendars: [{ period: '2026-06', working_days: 22 }],
      settings: { pay_day: 25, period_offset: 1 },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T06:00:00Z'));

    await (payroll as any).tick();
    await (payroll as any).tick();

    expect(payslips).toHaveLength(1);
  });

  it('stays idle before the pay day and when auto generation is off', async () => {
    const early = build({ settings: { pay_day: 25 } });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T06:00:00Z'));
    await (early.payroll as any).tick();
    expect(early.payslips).toHaveLength(0);

    const off = build({ settings: { pay_day: 25, auto_generate: false } });
    vi.setSystemTime(new Date('2026-07-27T06:00:00Z'));
    await (off.payroll as any).tick();
    expect(off.payslips).toHaveLength(0);
  });
});

// Keeps the unused type imports meaningful for readers of this file.
export type { PayrollRunLog, PayrollSettings, WorkCalendar };

beforeEach(() => vi.restoreAllMocks());
