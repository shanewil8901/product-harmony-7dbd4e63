import { api } from './api';

export interface SalesHistoryEntry {
  id: string;
  order_id: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'document' | 'payment';
  changes: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
  changed_at: string;
  changed_by: string | null;
}

export const salesHistoryService = {
  async list(orderId: string) {
    const { data } = await api.get<SalesHistoryEntry[]>(`/sales/${orderId}/history`);
    return data;
  },
};
