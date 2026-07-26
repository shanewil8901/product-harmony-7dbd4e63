import { api } from './api';

export interface StockHistoryEntry {
  id: string;
  stock_id: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'document';
  changes: Record<string, unknown> | null;
  snapshot: Record<string, unknown> | null;
  changed_at: string;
  changed_by: string | null;
}

export const stockHistoryService = {
  async list(stockId: string) {
    const { data } = await api.get<StockHistoryEntry[]>(`/stock/${stockId}/history`);
    return data;
  },
};
