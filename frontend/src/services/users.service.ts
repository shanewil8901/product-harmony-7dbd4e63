import { api } from './api';
import type { RoleCode, UserRow } from '../types/product';

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role: RoleCode;
}

export const usersService = {
  async list() {
    const { data } = await api.get<UserRow[]>('/users');
    return data;
  },
  async create(payload: CreateUserPayload) {
    const { data } = await api.post<UserRow>('/users', payload);
    return data;
  },
};
