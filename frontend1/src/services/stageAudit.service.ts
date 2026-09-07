import { api } from './api';

export interface StageAuditEntry {
  id: string;
  stock_id: string;
  document_id: string | null;
  doc_type: string;
  doc_number: string | null;
  stage_label: string;
  status_from: string | null;
  status_to: string | null;
  result: 'success' | 'denied' | 'failed';
  reason: string | null;
  payload: Record<string, unknown> | null;
  total_amount: string | null;
  currency_code: string | null;
  actor_email: string | null;
  actor_role: string | null;
  created_at: string;
}

export const stageAuditService = {
  async list(stockId: string) {
    const { data } = await api.get<StageAuditEntry[]>(`/stock/${stockId}/stage-audit`);
    return data;
  },
  async recent(limit = 100) {
    const { data } = await api.get<StageAuditEntry[]>('/stock/stage-audit/recent', {
      params: { limit },
    });
    return data;
  },
};
