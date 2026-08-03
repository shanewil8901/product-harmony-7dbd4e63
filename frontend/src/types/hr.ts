import type { Role, RoleCode } from './product';

export const EMPLOYMENT_STATUSES = [
  'active',
  'probation',
  'on_leave',
  'suspended',
  'terminated',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On leave',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

export const CONTRACT_TYPES = ['full_time', 'part_time', 'contract', 'temporary'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];
export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  temporary: 'Temporary',
};

export const EMPLOYEE_DOC_TYPES = [
  'iqama',
  'passport',
  'contract',
  'certificate',
  'other',
] as const;
export type EmployeeDocType = (typeof EMPLOYEE_DOC_TYPES)[number];
export const EMPLOYEE_DOC_LABEL: Record<EmployeeDocType, string> = {
  iqama: 'Iqama / National ID copy',
  passport: 'Passport copy',
  contract: 'Employment contract',
  certificate: 'Certificate',
  other: 'Other',
};

export interface Employee {
  id: string;
  user_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  role: Role | null;
  iqama_number: string;
  iqama_expiry: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  mobile: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address_line1: string;
  address_city: string;
  address_postal_code: string | null;
  bank_name: string;
  bank_account_name: string | null;
  iban: string;
  job_title: string;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  join_date: string;
  contract_type: ContractType;
  employment_status: EmploymentStatus;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowance: string;
  gross_salary: string;
  salary_currency_id: string | null;
  salary_currency_code: string | null;
  salary_currency_symbol: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeePayload {
  email: string;
  password: string;
  role: RoleCode;
  first_name: string;
  last_name: string;
  iqama_number: string;
  iqama_expiry?: string;
  nationality?: string;
  date_of_birth?: string;
  mobile: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address_line1: string;
  address_city: string;
  address_postal_code?: string;
  bank_name: string;
  bank_account_name?: string;
  iban: string;
  job_title: string;
  department_id?: string;
  join_date: string;
  contract_type?: ContractType;
  employment_status?: EmploymentStatus;
  basic_salary: number;
  housing_allowance?: number;
  transport_allowance?: number;
  other_allowance?: number;
  salary_currency_id: string;
  notes?: string;
}

export type UpdateEmployeePayload = Partial<
  Omit<CreateEmployeePayload, 'email' | 'password' | 'role'>
> & { password?: string; role?: RoleCode };

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: EmployeeDocType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'half_day',
  'leave',
  'sick_leave',
  'holiday',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half day',
  leave: 'Leave',
  sick_leave: 'Sick leave',
  holiday: 'Holiday',
};

export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  work_date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  worked_hours: string;
  overtime_hours: string;
  notes: string | null;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  total_records: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  total_hours: string;
  total_overtime: string;
}

export interface UpsertAttendancePayload {
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  check_in?: string;
  check_out?: string;
  overtime_hours?: number;
  notes?: string;
}

export const PAYSLIP_STATUSES = ['draft', 'approved', 'paid', 'cancelled'] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];
export const PAYSLIP_STATUS_LABEL: Record<PayslipStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export interface Payslip {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  job_title: string | null;
  period: string;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowance: string;
  overtime_amount: string;
  bonus: string;
  gosi_deduction: string;
  unpaid_leave_deduction: string;
  other_deduction: string;
  net_pay: string;
  gross_pay: string;
  total_deductions: string;
  currency_code: string | null;
  currency_symbol: string | null;
  worked_days: number;
  absent_days: number;
  overtime_hours: string;
  status: PayslipStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayrollSummaryRow {
  currency_code: string;
  net_total: string;
  payslips: number;
}

export interface GeneratePayslipPayload {
  employee_id: string;
  period: string;
  overtime_rate?: number;
  bonus?: number;
  gosi_deduction?: number;
  other_deduction?: number;
  notes?: string;
}
