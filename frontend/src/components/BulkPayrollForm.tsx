import { useEffect, useState, type FormEvent } from 'react';
import { payrollService } from '../services/hr.service';
import { masterDataService } from '../services/masterData.service';
import { toast } from '../lib/toast';
import type { ApiError } from '../services/api';
import type { Department, Role, RoleCode } from '../types/product';
import { HR_CURRENCY, type BulkPayslipResult } from '../types/hr';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Bulk payroll run: pick a role (optionally a department), enter the common
 * values once, and a draft payslip is created for every matching employee.
 * Employees who already have a payslip for the period are skipped, never
 * overwritten.
 */
export function BulkPayrollForm({
  period,
  onDone,
}: {
  period: string;
  onDone: () => Promise<void> | void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [bulkPeriod, setBulkPeriod] = useState(period);
  const [overtimeRate, setOvertimeRate] = useState('');
  const [bonus, setBonus] = useState('');
  const [gosi, setGosi] = useState('');
  const [otherDeduction, setOtherDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkPayslipResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [r, d] = await Promise.all([
          masterDataService.roles(),
          masterDataService.departments(),
        ]);
        setRoles(r);
        setDepartments(d);
      } catch {
        /* master data is optional for this form */
      }
    })();
  }, []);

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!role) return toast('error', 'Select a role to run payroll for');
    if (!PERIOD_RE.test(bulkPeriod)) return toast('error', 'Period must be YYYY-MM');
    for (const [label, v] of [
      ['Overtime rate', overtimeRate],
      ['Bonus', bonus],
      ['GOSI', gosi],
      ['Other deduction', otherDeduction],
    ] as const) {
      const n = num(v);
      if (n !== undefined && (Number.isNaN(n) || n < 0))
        return toast('error', `${label} must be a valid amount`);
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await payrollService.generateBulk({
        role: role as RoleCode,
        department_id: departmentId || undefined,
        period: bulkPeriod,
        overtime_rate: num(overtimeRate),
        bonus: num(bonus),
        gosi_deduction: num(gosi),
        other_deduction: num(otherDeduction),
        notes: notes.trim() || undefined,
      });
      setResult(res);
      toast(
        res.created.length ? 'success' : 'error',
        `${res.created.length} payslip(s) created · ${res.skipped.length} skipped`,
      );
      await onDone();
    } catch (err) {
      toast('error', (err as ApiError).userMessage ?? 'Bulk payroll run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-3" noValidate>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
        Bulk payroll run
      </h2>
      <p className="text-xs text-brown-400">
        Enter the common values once for everyone in a role. All amounts are in {HR_CURRENCY.code}.
        Employees already paid for the period are skipped.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs text-brown-500">Role</span>
          <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Select role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Department (optional)</span>
          <select
            className="input mt-1"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Period</span>
          <input
            className="input mt-1"
            type="month"
            value={bulkPeriod}
            onChange={(e) => setBulkPeriod(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Overtime rate / hr ({HR_CURRENCY.code})</span>
          <input
            className="input mt-1"
            type="number"
            min="0"
            step="0.01"
            value={overtimeRate}
            onChange={(e) => setOvertimeRate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Bonus ({HR_CURRENCY.code})</span>
          <input
            className="input mt-1"
            type="number"
            min="0"
            step="0.01"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">GOSI deduction ({HR_CURRENCY.code})</span>
          <input
            className="input mt-1"
            type="number"
            min="0"
            step="0.01"
            value={gosi}
            onChange={(e) => setGosi(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Other deduction ({HR_CURRENCY.code})</span>
          <input
            className="input mt-1"
            type="number"
            min="0"
            step="0.01"
            value={otherDeduction}
            onChange={(e) => setOtherDeduction(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-brown-500">Notes</span>
          <input className="input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <button className="btn-forest" type="submit" disabled={running}>
        {running ? 'Running…' : 'Run bulk payroll'}
      </button>

      {result && (
        <div className="rounded-lg border border-brown-100 bg-paper-warm p-3 text-xs space-y-2">
          <div className="text-ink">
            {result.considered} employee(s) considered · {result.created.length} created ·{' '}
            {result.skipped.length} skipped
          </div>
          {result.skipped.length > 0 && (
            <ul className="space-y-1 text-brown-600">
              {result.skipped.map((s) => (
                <li key={s.employee_code}>
                  <strong>{s.employee_code}</strong> {s.employee_name} — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
