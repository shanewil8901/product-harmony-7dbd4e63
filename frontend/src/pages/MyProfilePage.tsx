import { useEffect, useState } from 'react';
import { employeesService } from '../services/hr.service';
import type { ApiError } from '../services/api';
import {
  ATTENDANCE_LABEL,
  HR_CURRENCY,
  PAYSLIP_STATUS_LABEL,
  EMPLOYMENT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  EMPLOYEE_DOC_LABEL,
  type EmployeeSelfOverview,
} from '../types/hr';

const money = (v: string | number) =>
  `${HR_CURRENCY.symbol} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const monthLabel = (period: string) => {
  const [y, m] = period.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-brown-500">{label}</div>
      <div className="mt-1 font-serif text-2xl text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brown-100 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-brown-500">{label}</span>
      <span className="text-sm text-ink text-right">{value || '—'}</span>
    </div>
  );
}

export function MyProfilePage() {
  const [data, setData] = useState<EmployeeSelfOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await employeesService.myOverview());
    } catch (e) {
      setError((e as ApiError).userMessage ?? 'Could not load your profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div className="card p-8 text-sm text-brown-500">Loading your profile…</div>;

  if (error || !data)
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">My profile</h1>
        <p className="mt-2 text-sm text-brown-600">
          {error ?? 'No employee profile is linked to your account.'}
        </p>
        <button className="btn-ghost mt-4" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );

  const { employee: e, attendance, payroll, documents } = data;
  const maxHours = Math.max(1, ...attendance.trend.map((t) => Number(t.hours)));

  return (
    <div className="space-y-6">
      <header className="card p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">{e.full_name}</h1>
          <p className="text-sm text-ink-muted">
            {e.job_title}
            {e.department_name ? ` · ${e.department_name}` : ''} · {e.employee_code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-forest-50 px-3 py-1 text-xs font-medium text-forest-500">
            {EMPLOYMENT_STATUS_LABEL[e.employment_status]}
          </span>
          <span className="inline-flex items-center rounded-full bg-paper-warm px-3 py-1 text-xs text-brown-600">
            {CONTRACT_TYPE_LABEL[e.contract_type]}
          </span>
          {e.role && (
            <span className="inline-flex items-center rounded-full bg-gold-100 px-3 py-1 text-xs text-ink">
              {e.role.name}
            </span>
          )}
        </div>
      </header>

      {e.iqama_days_left !== null && e.iqama_days_left <= 60 && (
        <div role="alert" className="card border border-brown-200 bg-paper-warm p-4 text-sm text-brown-600">
          {e.iqama_days_left < 0
            ? `Your Iqama expired on ${day(e.iqama_expiry)}. Contact HR immediately.`
            : `Your Iqama expires in ${e.iqama_days_left} day(s) on ${day(e.iqama_expiry)}.`}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gross monthly" value={money(e.gross_salary)} hint={`Paid in ${HR_CURRENCY.code}`} />
        <Stat label="Net paid YTD" value={money(payroll.ytd_net_paid)} hint={payroll.last_paid_period ? `Last paid ${monthLabel(payroll.last_paid_period)}` : 'No payment yet'} />
        <Stat
          label="Present this month"
          value={`${attendance.this_month.present_days} days`}
          hint={`${attendance.this_month.total_hours} h worked`}
        />
        <Stat
          label="Tenure"
          value={`${Math.floor(e.tenure_months / 12)}y ${e.tenure_months % 12}m`}
          hint={`Joined ${day(e.join_date)}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2 space-y-4">
          <h2 className="font-serif text-lg text-ink">Attendance — last 6 months</h2>
          <div className="flex items-end gap-3 h-40">
            {attendance.trend.map((t) => (
              <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-brown-500">{t.hours}h</span>
                <div
                  className="w-full rounded-t bg-forest-300"
                  style={{ height: `${(Number(t.hours) / maxHours) * 100}%`, minHeight: '2px' }}
                  title={`${t.present_days} present · ${t.absent_days} absent`}
                />
                <span className="text-[10px] text-ink-muted">{monthLabel(t.period)}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4 text-center text-xs">
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.present_days}</div>
              <div className="text-brown-500">Present YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.absent_days}</div>
              <div className="text-brown-500">Absent YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.leave_days}</div>
              <div className="text-brown-500">Leave YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.total_overtime}</div>
              <div className="text-brown-500">Overtime hrs</div>
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-1">
          <h2 className="font-serif text-lg text-ink mb-2">Salary breakdown</h2>
          <Row label="Basic" value={money(e.basic_salary)} />
          <Row label="Housing" value={money(e.housing_allowance)} />
          <Row label="Transport" value={money(e.transport_allowance)} />
          <Row label="Other" value={money(e.other_allowance)} />
          <Row label="Gross" value={money(e.gross_salary)} />
          <Row label="Bank" value={e.bank_name} />
          <Row label="IBAN" value={`•••• ${e.iban.slice(-4)}`} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="font-serif text-lg text-ink p-5 pb-3">Recent payslips</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Net pay</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Paid on</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payslips.map((p) => (
                  <tr key={p.id} className="border-t border-brown-100">
                    <td className="px-4 py-2 text-ink">{monthLabel(p.period)}</td>
                    <td className="px-4 py-2 text-ink">{money(p.net_pay)}</td>
                    <td className="px-4 py-2 text-ink-muted">{PAYSLIP_STATUS_LABEL[p.status]}</td>
                    <td className="px-4 py-2 text-ink-muted">{day(p.paid_at)}</td>
                  </tr>
                ))}
                {payroll.payslips.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-brown-500">
                      No payslips yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="font-serif text-lg text-ink p-5 pb-3">Recent attendance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">In / Out</th>
                  <th className="px-4 py-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {attendance.recent.map((a) => (
                  <tr key={a.id} className="border-t border-brown-100">
                    <td className="px-4 py-2 text-ink whitespace-nowrap">{day(a.work_date)}</td>
                    <td className="px-4 py-2 text-ink-muted">{ATTENDANCE_LABEL[a.status]}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {(a.check_in ?? '—') + ' / ' + (a.check_out ?? '—')}
                    </td>
                    <td className="px-4 py-2 text-ink">{a.worked_hours}</td>
                  </tr>
                ))}
                {attendance.recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-brown-500">
                      No attendance records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 space-y-1">
          <h2 className="font-serif text-lg text-ink mb-2">Personal details</h2>
          <Row label="Email" value={e.email ?? '—'} />
          <Row label="Mobile" value={e.mobile} />
          <Row label="Nationality" value={e.nationality ?? '—'} />
          <Row label="Iqama / ID" value={e.iqama_number} />
          <Row label="Iqama expiry" value={day(e.iqama_expiry)} />
          <Row label="Address" value={`${e.address_line1}, ${e.address_city}`} />
          <Row
            label="Emergency contact"
            value={
              e.emergency_contact_name
                ? `${e.emergency_contact_name} · ${e.emergency_contact_phone ?? ''}`
                : '—'
            }
          />
        </section>

        <section className="card p-5">
          <h2 className="font-serif text-lg text-ink mb-2">My documents</h2>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-brown-100 pb-2 last:border-0"
              >
                <div>
                  <div className="text-sm text-ink">{EMPLOYEE_DOC_LABEL[d.doc_type]}</div>
                  <div className="text-xs text-ink-muted">{d.file_name}</div>
                </div>
                <span className="text-xs text-brown-500 whitespace-nowrap">{day(d.uploaded_at)}</span>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="text-sm text-brown-500">No documents on file. Contact HR to upload.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
