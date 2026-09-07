import { api } from './api';
import type { DashboardOverview } from '../types/dashboard';

export const dashboardService = {
  async overview(days = 30) {
    const { data } = await api.get<DashboardOverview>('/dashboard/overview', { params: { days } });
    return data;
  },
};
