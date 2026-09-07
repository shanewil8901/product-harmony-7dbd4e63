import { api } from './api';
import type { Stock, StockInput, StockPage, StockStatus, StockDocument } from '../types/stock';

export const stockService = {
  async list(params: {
    product_id?: string;
    status?: StockStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { data } = await api.get<StockPage>('/stock', { params });
    return data;
  },
  async create(input: StockInput) {
    // Backend returns { stock, po_document } so the UI can auto-open the PO.
    const { data } = await api.post<{ stock: Stock; po_document: StockDocument }>('/stock', input);
    return data;
  },
  async update(id: string, input: Partial<StockInput>) {
    const { data } = await api.patch<Stock>(`/stock/${id}`, input);
    return data;
  },
  async remove(id: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/stock/${id}`);
    return data;
  },
};
