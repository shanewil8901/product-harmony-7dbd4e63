import { useEffect, useMemo, useState } from 'react';
import { leaveService } from '../services/leave.service';
import { masterDataService } from '../services/masterData.service';
import type { LeavePolicy, LeavePolicyUsage, LeaveType } from '../types/leave';
import { LEAVE_TYPES, LEAVE_TYPE_LABEL } from '../types/leave';
import type { Role } from '../types/product';
import { toast } from '../lib/toast';
import { ConfirmDialog } from '../components/Dialog';

type Draft = Record<string, { entitlement: string; period_unit: 'month' | 'year' }>;

const key = (roleId: string, type: LeaveType) => `${roleId}:${type}`;

/**
 * Leave entitlement master data — edited per ROLE, never per employee.
 * Lowering an entitlement below what somebody already consumed is allowed, but
 * only after an explicit confirmation: the surplus days are re-marked unpaid by
 * the backend instead of the taken leave being revoked.
 */
export function LeaveSettingsPage() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [usage, setUsage] = useState<LeavePolicyUsage[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    roleId: string;
    type: LeaveType;
    entitlement: number;
    unit: 'month' | 'year';
    maxUsed: number;
    affected: number;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, u, r] = await Promise.all([
        leaveService.policies(),
        leaveService.policyUsage(),
        masterDataService.roles(),
      ]);
      setPolicies(p);
      setUsage(u);
      setRoles(r);
      const d: Draft = {};
      for (const row of p)
        d[key(row.role_id, row.leave_type)] = {
          entitlement: Number(row.entitlement).toString(),
          period_unit: row.period_unit,
        };
      setDraft(d);
    } catch {
      toast('error', 'Could not load leave policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const usageFor = useMemo(() => {
    const m = new Map<string, LeavePolicyUsage>();
    for (const u of usage) m.set(key(u.role_id, u.leave_type), u);
    return m;
  }, [usage]);

  const rolesWithPolicies = useMemo(() => {
    const ids = new Set(policies.map((p) => p.role_id));
    return roles.filter((r) => ids.has(r.id));
  }, [roles, policies]);

  const save = async (
    roleId: string,
    type: LeaveType,
    entitlement: number,
    unit: 'month' | 'year',
  ) => {
    setSaving(key(roleId, type));
    try {
      const res = await leaveService.updatePolicy({
        role_id: roleId,
        leave_type: type,
        entitlement,
        period_unit: unit,
      });
      const adjusted = (res as { adjusted_requests?: number }).adjusted_requests ?? 0;
      toast(
        'success',
        adjusted
          ? `Policy updated — ${adjusted} existing request${adjusted === 1 ? '' : 's'} rebalanced`
          : 'Policy updated',
      );
      await load();
    } catch {
      toast('error', 'Could not update that policy');
    } finally {
      setSaving(null);
    }
  };

  const attemptSave = (roleId: string, type: LeaveType) => {
    const d = draft[key(roleId, type)];
    if (!d) return;
    const value = Number(d.entitlement);
    if (Number.isNaN(value) || value < 0) {
      toast('error', 'Entitlement must be zero or more');
      return;
    }
    const u = usageFor.get(key(roleId, type));
    if (u && u.max_used > value) {
      setConfirm({
        roleId,
        type,
        entitlement: value,
        unit: d.period_unit,
        maxUsed: u.max_used,
        affected: u.employees_affected_at,
      });
      return;
    }
    void save(roleId, type, value, d.period_unit);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Leave settings</h1>
        <p className="text-sm text-brown-500">
          Entitlements apply to every employee holding the role. Balances stay individual.
        </p>
      </div>

      {loading ? (
        <div className="card p-6 text-sm text-brown-500">Loading policies…</div>
      ) : (
        <div className="space-y-5">
          {rolesWithPolicies.map((role) => (
            <div key={role.id} className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-brown-100 px-5 py-3">
                <div>
                  <h2 className="font-serif text-lg text-ink">{role.name ?? role.code}</h2>
                  <p className="text-xs text-brown-500">Role code: {role.code}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                    <tr>
                      <th className="px-5 py-2">Leave type</th>
                      <th className="px-5 py-2">Entitlement</th>
                      <th className="px-5 py-2">Period</th>
                      <th className="px-5 py-2">Highest already taken</th>
                      <th className="px-5 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEAVE_TYPES.map((type) => {
                      const k = key(role.id, type);
                      const d = draft[k];
                      if (!d) return null;
                      const u = usageFor.get(k);
                      const conflict = !!u && u.max_used > Number(d.entitlement || 0);
                      return (
                        <tr key={type} className="border-t border-brown-100 align-middle">
                          <td className="px-5 py-2 text-ink">{LEAVE_TYPE_LABEL[type]}</td>
                          <td className="px-5 py-2">
                            <input
                              className="input w-28"
                              type="number"
                              min={0}
                              step="0.5"
                              value={d.entitlement}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [k]: { ...prev[k], entitlement: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td className="px-5 py-2">
                            <select
                              className="input w-32"
                              value={d.period_unit}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [k]: {
                                    ...prev[k],
                                    period_unit: e.target.value as 'month' | 'year',
                                  },
                                }))
                              }
                            >
                              <option value="month">Per month</option>
                              <option value="year">Per year</option>
                            </select>
                          </td>
                          <td className="px-5 py-2">
                            <span className={conflict ? 'text-brown-600' : 'text-brown-500'}>
                              {u?.max_used ?? 0} day{(u?.max_used ?? 0) === 1 ? '' : 's'}
                            </span>
                            {u && u.employees.length > 0 && (
                              <div className="text-xs text-brown-500">
                                {u.employees
                                  .slice(0, 3)
                                  .map((e) => `${e.employee_name} (${e.used})`)
                                  .join(', ')}
                                {u.employees.length > 3 ? '…' : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <button
                              className="btn-gold !py-1.5 text-sm"
                              disabled={saving === k}
                              onClick={() => attemptSave(role.id, type)}
                            >
                              {saving === k ? 'Saving…' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Lower this entitlement?"
          message={`${confirm.affected} employee${confirm.affected === 1 ? ' has' : 's have'} already taken up to ${confirm.maxUsed} day(s) of ${LEAVE_TYPE_LABEL[confirm.type]}, which is more than the new limit of ${confirm.entitlement}. Approved leave is never revoked — the surplus days are re-marked as unpaid on the next payslip instead.`}
          confirmLabel="Apply new limit"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            void save(c.roleId, c.type, c.entitlement, c.unit);
          }}
        />
      )}
    </div>
  );
}
