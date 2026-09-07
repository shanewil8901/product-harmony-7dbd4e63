import { api, getToken } from './api';
import type {
  Vendor,
  VendorDocType,
  VendorDocument,
  VendorInput,
  VendorPage,
} from '../types/vendor';

export const vendorsService = {
  async list(
    params: {
      search?: string;
      search_field?: string;
      status?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { data } = await api.get<VendorPage>('/vendors', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<Vendor>(`/vendors/${id}`);
    return data;
  },
  async create(input: VendorInput) {
    const { data } = await api.post<Vendor>('/vendors', input);
    return data;
  },
  async update(id: string, input: Partial<VendorInput>) {
    const { data } = await api.patch<Vendor>(`/vendors/${id}`, input);
    return data;
  },
  async remove(id: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/vendors/${id}`);
    return data;
  },

  // Documents
  async listDocs(id: string) {
    const { data } = await api.get<VendorDocument[]>(`/vendors/${id}/documents`);
    return data;
  },
  async uploadDoc(
    vendorId: string,
    file: File,
    meta: { doc_type: VendorDocType; reference_no?: string; issue_date?: string; expiry_date?: string },
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', meta.doc_type);
    if (meta.reference_no) form.append('reference_no', meta.reference_no);
    if (meta.issue_date) form.append('issue_date', meta.issue_date);
    if (meta.expiry_date) form.append('expiry_date', meta.expiry_date);
    const { data } = await api.post<VendorDocument>(
      `/vendors/${vendorId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },
  downloadUrl(vendorId: string, docId: string) {
    const token = getToken();
    const base = api.defaults.baseURL;
    return { url: `${base}/vendors/${vendorId}/documents/${docId}/download`, token };
  },
  async removeDoc(vendorId: string, docId: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(
      `/vendors/${vendorId}/documents/${docId}`,
    );
    return data;
  },
};
