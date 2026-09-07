import { api } from './api';
import type {
  ApplyLeavePayload,
  LeaveBalance,
  LeavePolicy,
  LeavePolicyUsage,
  LeaveRequestRow,
  LeaveType,
  PayrollRunLog,
  PayrollSettings,
  PayrollTestRun,
  UpdatePayrollSettingsPayload,
  UpsertWorkCalendarPayload,
  WorkCalendar,
} from '../types/leave';

export const leaveService = {
  async list(params: { status?: string; employee_id?: string; mine?: boolean } = {}) {
    const { data } = await api.get<LeaveRequestRow[]>('/leaves', {
      params: { ...params, mine: params.mine ? 'true' : undefined },
    });
    return data;
  },
  /** Everyone on approved leave for a given day (defaults to today). */
  async onLeave(date?: string) {
    const { data } = await api.get<LeaveRequestRow[]>('/leaves/on-leave', { params: { date } });
    return data;
  },
  async balances(employee_id?: string) {
    const { data } = await api.get<LeaveBalance[]>('/leaves/balances', {
      params: { employee_id },
    });
    return data;
  },
  async policies() {
    const { data } = await api.get<LeavePolicy[]>('/leaves/policies');
    return data;
  },
  async policyUsage() {
    const { data } = await api.get<LeavePolicyUsage[]>('/leaves/policies/usage');
    return data;
  },
  async updatePolicy(payload: {
    role_id: string;
    leave_type: LeaveType;
    entitlement: number;
    period_unit?: 'month' | 'year';
  }) {
    const { data } = await api.patch<LeavePolicy & { adjusted_requests: number }>(
      '/leaves/policies',
      payload,
    );
    return data;
  },
  async apply(payload: ApplyLeavePayload) {
    const { data } = await api.post<LeaveRequestRow>('/leaves', payload);
    return data;
  },
  async decide(id: string, action: 'approve' | 'reject', note?: string) {
    const { data } = await api.patch<LeaveRequestRow>(`/leaves/${id}/decision`, { action, note });
    return data;
  },
  async cancel(id: string) {
    await api.delete(`/leaves/${id}`);
  },
};

export const payrollSettingsService = {
  async get() {
    const { data } = await api.get<PayrollSettings>('/payroll/settings');
    return data;
  },
  async update(payload: UpdatePayrollSettingsPayload) {
    const { data } = await api.patch<PayrollSettings>('/payroll/settings', payload);
    return data;
  },
  async calendars() {
    const { data } = await api.get<WorkCalendar[]>('/payroll/settings/calendars');
    return data;
  },
  async upsertCalendar(payload: UpsertWorkCalendarPayload) {
    const { data } = await api.post<WorkCalendar>('/payroll/settings/calendars', payload);
    return data;
  },
  async removeCalendar(id: string) {
    await api.delete(`/payroll/settings/calendars/${id}`);
  },
  /** Dry run: reports the calendar source without writing payslips. */
  async testRun(period?: string) {
    const { data } = await api.post<PayrollTestRun>('/payroll/settings/test-run', { period });
    return data;
  },
  /** Audit trail of every payroll generation attempt. */
  async logs() {
    const { data } = await api.get<PayrollRunLog[]>('/payroll/settings/logs');
    return data;
  },
  /** Manual trigger of the scheduled payroll run. */
  async run(period?: string) {
    const { data } = await api.post<Record<string, unknown>>('/payroll/settings/run', { period });
    return data;
  },
};
