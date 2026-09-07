import type { Role, RoleCode } from './product';

export const LEAVE_TYPES = ['casual', 'annual', 'medical', 'short', 'emergency'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: 'Casual leave',
  annual: 'Annual leave',
  medical: 'Medical leave',
  short: 'Short leave',
  emergency: 'Emergency leave',
};

export const LEAVE_STATUSES = [
  'pending_supervisor',
  'pending_manager',
  'pending_admin',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending_supervisor: 'Awaiting supervisor',
  pending_manager: 'Awaiting manager',
  pending_admin: 'Awaiting admin',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const LEAVE_STATUS_TONE: Record<LeaveStatus, string> = {
  pending_supervisor: 'bg-gold-50 text-ink border-gold-200',
  pending_manager: 'bg-gold-50 text-ink border-gold-200',
  pending_admin: 'bg-gold-50 text-ink border-gold-200',
  approved: 'bg-forest-50 text-forest-500 border-forest-100',
  rejected: 'bg-brown-50 text-brown-600 border-brown-200',
  cancelled: 'bg-paper-warm text-brown-600 border-brown-200',
};

export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  job_title: string | null;
  department_name: string | null;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  days: string;
  units: string;
  unpaid_days: string;
  reason: string;
  status: LeaveStatus;
  supervisor_by: string | null;
  supervisor_at: string | null;
  supervisor_note: string | null;
  manager_by: string | null;
  manager_at: string | null;
  manager_note: string | null;
  decided_by: string | null;
  decided_by_role: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  period_unit: 'month' | 'year';
  entitlement: string;
  used: string;
  remaining: string;
}

export interface LeavePolicy {
  id: string;
  role_id: string;
  role: Role | null;
  leave_type: LeaveType;
  entitlement: string;
  period_unit: 'month' | 'year';
}

/** Live consumption per role policy — drives the "cannot collide" warnings. */
export interface LeavePolicyUsage {
  role_id: string;
  leave_type: LeaveType;
  max_used: number;
  employees_affected_at: number;
  employees: { employee_id: string; employee_name: string; used: number }[];
}

export interface ApplyLeavePayload {
  employee_id?: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  reason: string;
}

/** Roles allowed on the first approval step. */
export const SUPERVISOR_ROLES: RoleCode[] = ['supervisor', 'manager', 'admin'];

// -------------------------------------------------------------- payroll setup

export interface PayrollSettings {
  id: string;
  auto_generate: boolean;
  pay_day: number;
  period_offset: number;
  default_overtime_rate: string;
  default_gosi_percent: string;
  default_working_days: number;
  last_run_period: string | null;
  last_run_at: string | null;
  last_run_summary: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface UpdatePayrollSettingsPayload {
  auto_generate?: boolean;
  pay_day?: number;
  period_offset?: number;
  default_overtime_rate?: number;
  default_gosi_percent?: number;
  default_working_days?: number;
}

export interface WorkCalendar {
  id: string;
  period: string;
  working_days: number;
  public_holidays: number;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface UpsertWorkCalendarPayload {
  period: string;
  working_days: number;
  public_holidays?: number;
  notes?: string;
}

/** Where a payroll run took its working-days figure from. */
export type CalendarSource = 'calendar' | 'previous-calendar' | 'default';

export interface WorkingDaysResolution {
  working_days: number;
  source: CalendarSource;
  source_period: string | null;
}

export interface PayrollTestRun {
  request_id: string;
  period: string;
  dry_run: boolean;
  calendar: WorkingDaysResolution;
  would_create: number;
  would_skip: { employee_code: string; reason: string }[];
  summary: string;
}

export interface PayrollRunLog {
  id: string;
  request_id: string;
  period: string;
  trigger_type: 'scheduled' | 'manual' | 'test';
  calendar_source: CalendarSource;
  source_period: string | null;
  working_days: number;
  created_count: number;
  skipped_count: number;
  dry_run: boolean;
  summary: string | null;
  actor: string | null;
  created_at: string;
}
