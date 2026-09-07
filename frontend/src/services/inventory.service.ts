import { api } from './api';
import type {
  InventoryAlerts,
  InventoryMovements,
  InventoryOverview,
  StockAdjustment,
  StockAdjustmentInput,
  VendorBreakdown,
} from '../types/inventory';

/** Inventory levels are read-only — only adjustments can be written. */
export const inventoryService = {
  async overview(params: { search?: string; status?: string } = {}) {
    const { data } = await api.get<InventoryOverview>('/inventory', { params });
    return data;
  },
  async movements(productId: string) {
    const { data } = await api.get<InventoryMovements>(`/inventory/${productId}/movements`);
    return data;
  },
  async vendors(params: { search?: string } = {}) {
    const { data } = await api.get<VendorBreakdown>('/inventory/vendors', { params });
    return data;
  },
  async alerts(params: { threshold?: number } = {}) {
    const { data } = await api.get<InventoryAlerts>('/inventory/alerts', { params });
    return data;
  },
  async adjustments(params: { product_id?: string; type?: string; search?: string } = {}) {
    const { data } = await api.get<{ items: StockAdjustment[] }>('/inventory/adjustments', {
      params,
    });
    return data;
  },
  async createAdjustment(input: StockAdjustmentInput) {
    const { data } = await api.post<StockAdjustment>('/inventory/adjustments', input);
    return data;
  },
  async voidAdjustment(id: string) {
    const { data } = await api.delete<{ id: string; voided: boolean }>(
      `/inventory/adjustments/${id}`,
    );
    return data;
  },
};
