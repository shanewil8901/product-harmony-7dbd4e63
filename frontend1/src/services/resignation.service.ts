import { api } from './api';
import type {
  BenefitPreview,
  CreateResignationPayload,
  ResignationRow,
} from '../types/resignation';

export const resignationService = {
  async list(params: { status?: string; employee_id?: string; mine?: boolean } = {}) {
    const { data } = await api.get<ResignationRow[]>('/resignations', {
      params: { ...params, mine: params.mine ? 'true' : undefined },
    });
    return data;
  },
  async preview(last_working_date: string, employee_id?: string) {
    const { data } = await api.get<BenefitPreview>('/resignations/benefit-preview', {
      params: { last_working_date, employee_id },
    });
    return data;
  },
  async create(payload: CreateResignationPayload) {
    const { data } = await api.post<ResignationRow>('/resignations', payload);
    return data;
  },
  async decide(id: string, action: 'approve' | 'reject', note?: string) {
    const { data } = await api.patch<ResignationRow>(`/resignations/${id}/decision`, {
      action,
      note,
    });
    return data;
  },
  async withdraw(id: string) {
    await api.delete(`/resignations/${id}`);
  },
};
