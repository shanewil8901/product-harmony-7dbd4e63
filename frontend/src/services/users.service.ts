import { api } from './api';
import type { UserRow } from '../types/product';

/**
 * Login accounts are read-only here — they are created together with the HR
 * profile from the Employees screen so the two can never diverge.
 */
export const usersService = {
  async list() {
    const { data } = await api.get<UserRow[]>('/users');
    return data;
  },
};
