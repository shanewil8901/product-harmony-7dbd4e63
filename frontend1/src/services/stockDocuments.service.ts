import { api } from './api';
import type { StockDocType, StockDocument, Stock } from '../types/stock';

/** Public URL of the printable document view — rendered in an in-app preview. */
export function documentPrintUrl(docId: string): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/stock/documents/${docId}/pdf`;
}

export const stockDocumentsService = {
  async list(stockId: string) {
    const { data } = await api.get<StockDocument[]>(`/stock/${stockId}/documents`);
    return data;
  },
  async create(
    stockId: string,
    docType: StockDocType,
    payload?: Record<string, unknown>,
    money?: { total_amount?: number; currency_code?: string },
    skipReason?: string,
  ) {
    const { data } = await api.post<{ document: StockDocument; stock: Stock }>(
      `/stock/${stockId}/documents`,
      { doc_type: docType, payload, ...money, ...(skipReason ? { skip_reason: skipReason } : {}) },
    );
    return data;
  },
};
