export const RESIGNATION_REASONS = [
  'better_opportunity',
  'personal',
  'health',
  'relocation',
  'retirement',
  'end_of_contract',
  'other',
] as const;
export type ResignationReason = (typeof RESIGNATION_REASONS)[number];
export const RESIGNATION_REASON_LABEL: Record<ResignationReason, string> = {
  better_opportunity: 'Better opportunity',
  personal: 'Personal reasons',
  health: 'Health reasons',
  relocation: 'Relocation',
  retirement: 'Retirement',
  end_of_contract: 'End of contract',
  other: 'Other',
};

export const RESIGNATION_STATUSES = [
  'pending_supervisor',
  'pending_manager',
  'pending_admin',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export type ResignationStatus = (typeof RESIGNATION_STATUSES)[number];
export const RESIGNATION_STATUS_LABEL: Record<ResignationStatus, string> = {
  pending_supervisor: 'Awaiting supervisor',
  pending_manager: 'Awaiting manager',
  pending_admin: 'Awaiting admin',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
export const RESIGNATION_STATUS_TONE: Record<ResignationStatus, string> = {
  pending_supervisor: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_manager: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_admin: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-600',
  withdrawn: 'border-brown-200 bg-paper-soft text-brown-600',
};

export interface ResignationRow {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  job_title: string | null;
  join_date: string | null;
  resignation_date: string;
  last_working_date: string;
  notice_period_days: number;
  reason_type: ResignationReason;
  reason: string;
  handover_notes: string | null;
  handover_to: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  status: ResignationStatus;
  benefit_basic_salary: string;
  service_months: number;
  service_years: string;
  benefit_amount: string;
  supervisor_by: string | null;
  supervisor_at: string | null;
  manager_by: string | null;
  manager_at: string | null;
  admin_by: string | null;
  admin_at: string | null;
  decided_by: string | null;
  decided_by_role: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface BenefitPreview {
  employee_id: string;
  join_date: string;
  last_working_date: string;
  basic_salary: number;
  service_months: number;
  service_years: number;
  benefit_amount: number;
}

export interface CreateResignationPayload {
  employee_id?: string;
  resignation_date: string;
  last_working_date: string;
  notice_period_days?: number;
  reason_type: ResignationReason;
  reason: string;
  handover_notes?: string;
  handover_to?: string;
  contact_email?: string;
  contact_mobile?: string;
}
