import { api, setToken } from './api';
import type { AuthUser } from '../types/product';

interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    setToken(data.access_token);
    return data.user;
  },
  async me() {
    const { data } = await api.get<AuthUser>('/auth/me');
    return data;
  },
  /** Slides the session forward while the user is active. */
  async refresh() {
    const { data } = await api.post<AuthResponse>('/auth/refresh');
    setToken(data.access_token);
    return data.user;
  },
  logout() {
    setToken(null);
  },
};
