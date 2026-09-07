import type { RoleCode } from '../master-data/role.entity';
import type { LeaveStatus } from './leave.entity';

/** Roles that may act on a normal (supervisor-step) request. */
export const SUPERVISOR_ROLES: RoleCode[] = ['supervisor', 'manager', 'admin'];
/** Roles that may act on behalf of others / cancel anyone's request. */
export const MANAGER_ROLES: RoleCode[] = ['manager', 'admin'];

/**
 * Where a new request lands:
 *  - admin    -> auto approved, no sign-off needed
 *  - manager  -> an admin must approve
 *  - everyone -> a single supervisor-or-above sign-off
 */
export function routeStatus(applicantRole: RoleCode | null | undefined): LeaveStatus {
  if (applicantRole === 'admin') return 'approved';
  if (applicantRole === 'manager') return 'pending_admin';
  return 'pending_supervisor';
}

export type DecisionCheck =
  | { ok: true; step: 'admin' | 'supervisor' }
  | { ok: false; kind: 'forbidden' | 'closed'; reason: string };

/**
 * Whether `actorRole` may decide a request in `status`. `isOwnRequest` blocks
 * self-approval regardless of role.
 */
export function canDecide(
  status: LeaveStatus,
  actorRole: RoleCode | null | undefined,
  isOwnRequest = false,
): DecisionCheck {
  const role = actorRole ?? 'employee';
  if (isOwnRequest)
    return { ok: false, kind: 'forbidden', reason: 'You cannot decide your own leave request' };

  if (status === 'pending_admin') {
    return role === 'admin'
      ? { ok: true, step: 'admin' }
      : { ok: false, kind: 'forbidden', reason: "Only an admin can decide a manager's leave request" };
  }
  if (status === 'pending_supervisor' || status === 'pending_manager') {
    return SUPERVISOR_ROLES.includes(role)
      ? { ok: true, step: 'supervisor' }
      : {
          ok: false,
          kind: 'forbidden',
          reason: 'Only a supervisor or above can review leave requests',
        };
  }
  return { ok: false, kind: 'closed', reason: `A ${status} request can no longer be reviewed` };
}
