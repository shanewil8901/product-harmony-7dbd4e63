import { api, getToken } from './api';
import type {
  SalesDocument,
  SalesOrder,
  SalesOrderInput,
  SalesOrderStatus,
  SalesPayment,
  SalesPaymentInput,
} from '../types/sales';

export const salesService = {
  async list(params: { search?: string; status?: string; customer_id?: string } = {}) {
    const { data } = await api.get<SalesOrder[]>('/sales', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<SalesOrder>(`/sales/${id}`);
    return data;
  },
  async create(input: SalesOrderInput) {
    const { data } = await api.post<SalesOrder>('/sales', input);
    return data;
  },
  async update(id: string, input: Partial<SalesOrderInput>) {
    const { data } = await api.patch<SalesOrder>(`/sales/${id}`, input);
    return data;
  },
  async changeStatus(
    id: string,
    body: { status: SalesOrderStatus; invoice_no?: string; amount_paid?: number; reason?: string },
  ) {
    const { data } = await api.post<SalesOrder>(`/sales/${id}/status`, body);
    return data;
  },
  async recordPayment(id: string, input: SalesPaymentInput) {
    const { data } = await api.post<{ payment: SalesPayment; order: SalesOrder }>(
      `/sales/${id}/payments`,
      input,
    );
    return data;
  },
  async payments(id: string) {
    const { data } = await api.get<SalesPayment[]>(`/sales/${id}/payments`);
    return data;
  },
  /** Supervisor decision on a credit line. */
  async decideCredit(
    id: string,
    paymentId: string,
    decision: 'confirm' | 'not-received' | 'cancel',
    note?: string,
  ) {
    const { data } = await api.post<SalesOrder>(
      `/sales/${id}/payments/${paymentId}/${decision}`,
      { note },
    );
    return data;
  },
  /** System-issued delivery orders / invoices for an order. */
  async documents(id: string) {
    const { data } = await api.get<SalesDocument[]>(`/sales/${id}/documents`);
    return data;
  },
  /**
   * Fetches the printable HTML so it can be shown in the in-app preview modal —
   * never a new browser tab (pop-up blockers swallow those).
   */
  async documentHtml(id: string, docId: string) {
    const res = await fetch(`${api.defaults.baseURL}/sales/${id}/documents/${docId}/print`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) throw new Error('Could not open that document');
    return res.text();
  },

  async remove(id: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/sales/${id}`);
    return data;
  },
};
