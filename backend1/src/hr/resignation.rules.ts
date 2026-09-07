import type { RoleCode } from '../master-data/role.entity';
import type { ResignationStatus } from './resignation.entity';

/** Roles allowed to review resignations at all. */
export const REVIEW_ROLES: RoleCode[] = ['supervisor', 'manager', 'admin'];

/**
 * Where a new resignation lands. The chain is supervisor → manager → admin, so
 * an applicant only enters the chain below their own level.
 */
export function routeStatus(applicantRole: RoleCode | null | undefined): ResignationStatus {
  if (applicantRole === 'admin') return 'approved';
  if (applicantRole === 'manager') return 'pending_admin';
  if (applicantRole === 'supervisor') return 'pending_manager';
  return 'pending_supervisor';
}

export type DecisionStep = 'supervisor' | 'manager' | 'admin';

export type DecisionCheck =
  | { ok: true; step: DecisionStep; next: ResignationStatus }
  | { ok: false; kind: 'forbidden' | 'closed'; reason: string };

/**
 * Who may act on the current step, and what the request becomes on approval.
 * A higher role may act on a lower step and the request still walks the rest of
 * the chain, except an admin whose approval is always final.
 */
export function canDecide(
  status: ResignationStatus,
  actorRole: RoleCode | null | undefined,
  isOwnRequest = false,
): DecisionCheck {
  const role = actorRole ?? 'employee';
  if (isOwnRequest)
    return { ok: false, kind: 'forbidden', reason: 'You cannot decide your own resignation' };
  if (!REVIEW_ROLES.includes(role))
    return {
      ok: false,
      kind: 'forbidden',
      reason: 'Only a supervisor, manager or admin can review resignations',
    };

  if (status === 'pending_supervisor') {
    if (role === 'admin') return { ok: true, step: 'admin', next: 'approved' };
    if (role === 'manager') return { ok: true, step: 'manager', next: 'pending_admin' };
    return { ok: true, step: 'supervisor', next: 'pending_manager' };
  }
  if (status === 'pending_manager') {
    if (role === 'admin') return { ok: true, step: 'admin', next: 'approved' };
    if (role === 'manager') return { ok: true, step: 'manager', next: 'pending_admin' };
    return {
      ok: false,
      kind: 'forbidden',
      reason: 'This resignation is awaiting the manager',
    };
  }
  if (status === 'pending_admin') {
    return role === 'admin'
      ? { ok: true, step: 'admin', next: 'approved' }
      : { ok: false, kind: 'forbidden', reason: 'This resignation is awaiting an admin' };
  }
  return { ok: false, kind: 'closed', reason: `A ${status} resignation can no longer be reviewed` };
}

export interface BenefitBreakdown {
  basic_salary: number;
  /** Whole months of service, counted from the joining month. */
  service_months: number;
  /** Months expressed in years (May → next May = 1.00). */
  service_years: number;
  /** 50% of one basic salary for every completed year, pro-rated per month. */
  benefit_amount: number;
}

/**
 * End-of-service benefit: 50% of the current basic salary per year of service.
 * A year runs from the joining month, so joining in May completes one year the
 * following May. Part years are pro-rated by completed months.
 */
export function calculateBenefit(
  joinDate: string,
  lastWorkingDate: string,
  basicSalary: number,
): BenefitBreakdown {
  const [jy, jm, jd] = joinDate.slice(0, 10).split('-').map(Number);
  const [ly, lm, ld] = lastWorkingDate.slice(0, 10).split('-').map(Number);
  let months = (ly - jy) * 12 + (lm - jm);
  // The month only counts once the joining day-of-month has come round again.
  if (ld < jd) months -= 1;
  if (!Number.isFinite(months) || months < 0) months = 0;
  const years = months / 12;
  const salary = Number.isFinite(basicSalary) ? basicSalary : 0;
  const amount = Math.round(salary * 0.5 * years * 100) / 100;
  return {
    basic_salary: salary,
    service_months: months,
    service_years: Math.round(years * 100) / 100,
    benefit_amount: amount,
  };
}
