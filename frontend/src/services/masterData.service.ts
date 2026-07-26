import { api } from './api';
import type { Currency, Department, Role, Uom } from '../types/product';

export const masterDataService = {
  async departments() {
    const { data } = await api.get<Department[]>('/master-data/departments');
    return data;
  },
  async uoms() {
    const { data } = await api.get<Uom[]>('/master-data/uoms');
    return data;
  },
  async currencies() {
    const { data } = await api.get<Currency[]>('/master-data/currencies');
    return data;
  },
  async roles() {
    const { data } = await api.get<Role[]>('/master-data/roles');
    return data;
  },
};
