import { api } from './api';
import type { Paginated, Product, ProductInput } from '../types/product';
import type { ProductHistoryEntry } from '../types/stock';

export const productsService = {
  async list(params: { search?: string; page?: number; limit?: number } = {}) {
    const { data } = await api.get<Paginated<Product>>('/products', { params });
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
  async create(input: ProductInput) {
    const { data } = await api.post<Product>('/products', input);
    return data;
  },
  async update(id: string, input: Partial<ProductInput>) {
    const { data } = await api.patch<Product>(`/products/${id}`, input);
    return data;
  },
  async remove(id: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(`/products/${id}`);
    return data;
  },
  async history(id: string) {
    const { data } = await api.get<ProductHistoryEntry[]>(`/products/${id}/history`);
    return data;
  },
};
