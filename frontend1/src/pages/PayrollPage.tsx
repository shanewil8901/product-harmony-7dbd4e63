import { useEffect, useState, type FormEvent } from 'react';
import { employeesService, payrollService } from '../services/hr.service';
import { Combobox } from '../components/Combobox';
import { BulkPayrollForm } from '../components/BulkPayrollForm';
import { PromptDialog } from '../components/Dialog';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from '../lib/toast';
import { notifyApiError, type ApiError } from '../services/api';
import {
  PAYSLIP_STATUSES,
  PAYSLIP_STATUS_LABEL,
  type Employee,
  type PayrollSummaryRow,
  type Payslip,
  type PayslipStatus,
} from '../types/hr';

const thisPeriod = () => new Date().toISOString().slice(0, 7);
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Allowed forward-only status moves, mirroring the backend flow. */
const NEXT_STATUS: Record<PayslipStatus, PayslipStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

export function PayrollPage() {
  const { canManageUsers, isAdmin, isManager } = usePermissions();
  const canEdit = isAdmin || isManager;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Payslip[]>([]);
  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterPeriod, setFilterPeriod] = useState(thisPeriod());
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(thisPeriod());
  const [overtimeRate, setOvertimeRate] = useState('');
  const [bonus, setBonus] = useState('');
  const [gosi, setGosi] = useState('');
  const [otherDeduction, setOtherDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await payrollService.list({
        period: filterPeriod || undefined,
        employee_id: filterEmployee || undefined,
        status: filterStatus || undefined,
      });
      setRows(data.items);
      setSummary(data.summary);
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Failed to load payslips');
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
        setEmployees(await employeesService.list({ status: 'active' }));
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
          You need an admin or manager role to view payroll.
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

  const numField = (v: string, key: string, e: Record<string, string>) => {
    if (v.trim() === '') return undefined;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) e[key] = 'Enter a valid amount';
    return n;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!employeeId) e.employee_id = 'Select an employee';
    if (!PERIOD_RE.test(period)) e.period = 'Period must be YYYY-MM';
    const payload = {
      employee_id: employeeId,
      period,
      overtime_rate: numField(overtimeRate, 'overtime_rate', e),
      bonus: numField(bonus, 'bonus', e),
      gosi_deduction: numField(gosi, 'gosi_deduction', e),
      other_deduction: numField(otherDeduction, 'other_deduction', e),
      notes: notes.trim() || undefined,
    };
    setErrors(e);
    if (Object.keys(e).length) {
      toast(
        'error',
        `Please correct ${Object.keys(e).length} field${Object.keys(e).length > 1 ? 's' : ''}:`,
        Object.entries(e).map(([field, message]) => ({ field, message: String(message) })),
      );
      return;
    }
    setSaving(true);
    try {
      await payrollService.generate(payload);
      toast('success', 'Payslip generated');
      setNotes('');
      await load();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.fieldErrors ?? {});
      notifyApiError(apiErr, 'Could not generate payslip');
    } finally {
      setSaving(false);
    }
  };

  const [cancelling, setCancelling] = useState<Payslip | null>(null);

  const changeStatus = async (p: Payslip, status: PayslipStatus, reason?: string) => {
    try {
      await payrollService.setStatus(p.id, status, reason);
      toast('success', `Payslip ${PAYSLIP_STATUS_LABEL[status].toLowerCase()}`);
      await load();
    } catch (err) {
      notifyApiError(err, 'Could not update payslip');
    }
  };

  const remove = async (p: Payslip) => {
    try {
      await payrollService.remove(p.id);
      toast('success', 'Payslip deleted');
      await load();
    } catch (err) {
      notifyApiError(err, 'Could not delete payslip');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-ink">Payroll</h1>

      {canEdit && <BulkPayrollForm period={filterPeriod} onDone={load} />}

      {canEdit && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-3" noValidate>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
            Generate payslip
          </h2>
          <p className="text-xs text-brown-400">
            Salary, allowances and currency are taken from the employee profile; overtime and unpaid
            absence come from recorded attendance for that month.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">Employee *</label>
              <Combobox
                options={options}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Search employee…"
              />
              {errors.employee_id && (
                <p className="mt-1 text-xs text-brown-600">{errors.employee_id}</p>
              )}
            </div>
            <div>
              <label className="label">Period *</label>
              <input
                className="input"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
              {errors.period && <p className="mt-1 text-xs text-brown-600">{errors.period}</p>}
            </div>
            <div>
              <label className="label">Overtime rate / hour</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(e.target.value)}
              />
              {errors.overtime_rate && (
                <p className="mt-1 text-xs text-brown-600">{errors.overtime_rate}</p>
              )}
            </div>
            <div>
              <label className="label">Bonus</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
              />
              {errors.bonus && <p className="mt-1 text-xs text-brown-600">{errors.bonus}</p>}
            </div>
            <div>
              <label className="label">GOSI deduction</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={gosi}
                onChange={(e) => setGosi(e.target.value)}
              />
              {errors.gosi_deduction && (
                <p className="mt-1 text-xs text-brown-600">{errors.gosi_deduction}</p>
              )}
            </div>
            <div>
              <label className="label">Other deduction</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={otherDeduction}
                onChange={(e) => setOtherDeduction(e.target.value)}
              />
              {errors.other_deduction && (
                <p className="mt-1 text-xs text-brown-600">{errors.other_deduction}</p>
              )}
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Generating…' : 'Generate payslip'}
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
          type="month"
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
        />
        <select
          className="input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {PAYSLIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYSLIP_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={() => void load()}>
          Apply
        </button>
      </div>

      {summary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => (
            <div key={s.currency_code} className="card p-4">
              <div className="text-xs uppercase tracking-wider text-brown-500">
                Net total · {s.currency_code}
              </div>
              <div className="mt-1 font-serif text-xl text-ink">{s.net_total}</div>
              <div className="text-xs text-brown-500">{s.payslips} payslips</div>
            </div>
          ))}
        </div>
      )}

      {cancelling && (
        <PromptDialog
          title={`Cancel payslip · ${cancelling.period}`}
          label="Cancellation reason *"
          placeholder="Why is this payslip being cancelled?"
          confirmLabel="Cancel payslip"
          onCancel={() => setCancelling(null)}
          onSubmit={(reason) => {
            const target = cancelling;
            setCancelling(null);
            void changeStatus(target, 'cancelled', reason);
          }}
        />
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
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Days (worked / absent)</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net pay</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-brown-100">
                    <td className="px-4 py-3 whitespace-nowrap text-ink">{p.period}</td>
                    <td className="px-4 py-3 text-ink">
                      {p.employee_name ?? '—'}
                      <div className="text-xs text-brown-500">
                        {p.employee_code} · {p.job_title ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {p.worked_days} / {p.absent_days}
                    </td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {p.currency_code} {p.gross_pay}
                    </td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                      {p.currency_code} {p.total_deductions}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                      {p.currency_code} {p.net_pay}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-medium text-forest-500">
                        {PAYSLIP_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit &&
                        NEXT_STATUS[p.status].map((s) => (
                          <button
                            key={s}
                            className="btn-ghost !py-1 !px-2 text-xs mr-1"
                            onClick={() =>
                              s === 'cancelled' ? setCancelling(p) : void changeStatus(p, s)
                            }
                          >
                            {PAYSLIP_STATUS_LABEL[s]}
                          </button>
                        ))}
                      {isAdmin && p.status !== 'paid' && p.status !== 'approved' && (
                        <button
                          className="btn-danger !py-1 !px-2 text-xs"
                          onClick={() => void remove(p)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-brown-500">
                      No payslips for these filters.
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
