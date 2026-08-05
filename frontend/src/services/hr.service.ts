import { api, getToken } from './api';
import type {
  AttendanceDayState,
  AttendanceRow,
  AttendanceSummary,
  BulkPayslipPayload,
  BulkPayslipResult,
  CreateEmployeePayload,
  EmailCheckResult,
  Employee,
  EmployeeDirectoryEntry,
  EmployeeDocType,
  EmployeeDocument,
  EmployeeSelfOverview,
  GeneratePayslipPayload,
  PayrollSummaryRow,
  Payslip,
  PayslipStatus,
  PunchPayload,
  UpdateEmployeePayload,
  UpsertAttendancePayload,
} from '../types/hr';

export const employeesService = {
  async list(params: { search?: string; status?: string } = {}) {
    const { data } = await api.get<Employee[]>('/employees', { params });
    return data;
  },
  async findOne(id: string) {
    const { data } = await api.get<Employee>(`/employees/${id}`);
    return data;
  },
  /** Read-only check: does a login account already exist for this email? */
  async checkEmail(email: string) {
    const { data } = await api.get<EmailCheckResult>('/employees/email-check', {
      params: { email },
    });
    return data;
  },
  async myOverview() {
    const { data } = await api.get<EmployeeSelfOverview>('/employees/me/overview');
    return data;
  },
  async create(payload: CreateEmployeePayload) {
    const { data } = await api.post<Employee>('/employees', payload);
    return data;
  },
  async update(id: string, payload: UpdateEmployeePayload) {
    const { data } = await api.patch<Employee>(`/employees/${id}`, payload);
    return data;
  },

  async documents(id: string) {
    const { data } = await api.get<EmployeeDocument[]>(`/employees/${id}/documents`);
    return data;
  },
  async uploadDocument(id: string, file: File, docType: EmployeeDocType) {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', docType);
    const { data } = await api.post<EmployeeDocument>(`/employees/${id}/documents`, form);
    return data;
  },
  async deleteDocument(id: string, docId: string) {
    await api.delete(`/employees/${id}/documents/${docId}`);
  },
  /** Streams the file through an authenticated fetch, then opens it locally. */
  async openDocument(id: string, doc: EmployeeDocument) {
    const res = await fetch(
      `${api.defaults.baseURL}/employees/${id}/documents/${doc.id}/file`,
      { headers: { Authorization: `Bearer ${getToken() ?? ''}` } },
    );
    if (!res.ok) throw new Error('Could not download that document');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export const attendanceService = {
  async list(params: { employee_id?: string; from?: string; to?: string } = {}) {
    const { data } = await api.get<{ items: AttendanceRow[]; summary: AttendanceSummary }>(
      '/attendance',
      { params },
    );
    return data;
  },
  async upsert(payload: UpsertAttendancePayload) {
    const { data } = await api.post<AttendanceRow>('/attendance', payload);
    return data;
  },
  async remove(id: string) {
    await api.delete(`/attendance/${id}`);
  },
};

export const payrollService = {
  async list(params: { period?: string; employee_id?: string; status?: string } = {}) {
    const { data } = await api.get<{ items: Payslip[]; summary: PayrollSummaryRow[] }>(
      '/payroll/payslips',
      { params },
    );
    return data;
  },
  async generate(payload: GeneratePayslipPayload) {
    const { data } = await api.post<Payslip>('/payroll/payslips', payload);
    return data;
  },
  async setStatus(id: string, status: PayslipStatus) {
    const { data } = await api.patch<Payslip>(`/payroll/payslips/${id}/status`, { status });
    return data;
  },
  async remove(id: string) {
    await api.delete(`/payroll/payslips/${id}`);
  },
};

/** Self-service check-in / check-out — available to every authenticated role. */
export const selfAttendanceService = {
  async directory() {
    const { data } = await api.get<EmployeeDirectoryEntry[]>('/attendance/directory');
    return data;
  },
  async dayState(employee_id: string, work_date: string) {
    const { data } = await api.get<AttendanceDayState | null>('/attendance/day-state', {
      params: { employee_id, work_date },
    });
    return data;
  },
  async punch(payload: PunchPayload) {
    const { data } = await api.post<AttendanceDayState>('/attendance/punch', payload);
    return data;
  },
};
