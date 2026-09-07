import { api, getToken } from './api';
import type {
  Customer,
  CustomerDocType,
  CustomerDocument,
  CustomerInput,
  CustomerPage,
} from '../types/customer';

export const customersService = {
  async list(params: {
    search?: string;
    search_field?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    status?: string;
    customer_type?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { data } = await api.get<CustomerPage>('/customers', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<Customer>(`/customers/${id}`);
    return data;
  },
  async create(input: CustomerInput) {
    const { data } = await api.post<Customer>('/customers', input);
    return data;
  },
  async update(id: string, input: Partial<CustomerInput>) {
    const { data } = await api.patch<Customer>(`/customers/${id}`, input);
    return data;
  },
  async remove(id: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/customers/${id}`);
    return data;
  },

  async listDocs(id: string) {
    const { data } = await api.get<CustomerDocument[]>(`/customers/${id}/documents`);
    return data;
  },
  async uploadDoc(
    customerId: string,
    file: File,
    meta: { doc_type: CustomerDocType; reference_no?: string; issue_date?: string; expiry_date?: string },
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', meta.doc_type);
    if (meta.reference_no) form.append('reference_no', meta.reference_no);
    if (meta.issue_date) form.append('issue_date', meta.issue_date);
    if (meta.expiry_date) form.append('expiry_date', meta.expiry_date);
    const { data } = await api.post<CustomerDocument>(
      `/customers/${customerId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },
  downloadUrl(customerId: string, docId: string) {
    const token = getToken();
    const base = api.defaults.baseURL;
    return { url: `${base}/customers/${customerId}/documents/${docId}/download`, token };
  },
  async removeDoc(customerId: string, docId: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(
      `/customers/${customerId}/documents/${docId}`,
    );
    return data;
  },
};
