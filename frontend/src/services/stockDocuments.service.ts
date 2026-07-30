import { api } from './api';
import type { StockDocType, StockDocument, Stock } from '../types/stock';

/** Build a public URL to open the printable document view in a new tab. */
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
  ) {
    const { data } = await api.post<{ document: StockDocument; stock: Stock }>(
      `/stock/${stockId}/documents`,
      { doc_type: docType, payload, ...money },
    );
    return data;
  },

  openPrint(docId: string) {
    window.open(documentPrintUrl(docId), '_blank', 'noopener,noreferrer');
  },
};
