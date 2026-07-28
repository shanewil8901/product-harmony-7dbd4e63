import axios, { AxiosError } from 'axios';
import { toast } from '../lib/toast';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
});

const TOKEN_KEY = 'pm_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Structured server error: { success:false, error: { code, message, details? } }
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}

export interface ApiError extends AxiosError {
  userMessage: string;
  apiError?: ApiErrorPayload;
  fieldErrors: Record<string, string>;
}

function parseError(err: AxiosError): {
  message: string;
  apiError?: ApiErrorPayload;
  fieldErrors: Record<string, string>;
} {
  const data = err.response?.data as
    | { error?: ApiErrorPayload | string; message?: string | string[] }
    | undefined;
  const fieldErrors: Record<string, string> = {};
  let message = err.message || 'Something went wrong';
  let apiError: ApiErrorPayload | undefined;

  if (data && typeof data === 'object') {
    if (data.error && typeof data.error === 'object') {
      apiError = data.error;
      message = apiError.message;
      apiError.details?.forEach((d) => {
        if (d.field) fieldErrors[d.field] = d.message;
      });
    } else if (typeof data.error === 'string') {
      message = data.error;
    } else if (Array.isArray(data.message)) {
      message = data.message.join(', ');
    } else if (typeof data.message === 'string') {
      message = data.message;
    }
  }

  if (!err.response) message = 'Cannot reach server. Check your connection.';
  return { message, apiError, fieldErrors };
}

// Unwrap envelope: { success, data, ... } -> data
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
      res.data = (res.data as { data: unknown }).data;
    }
    return res;
  },
  (err: AxiosError) => {
    const { message, apiError, fieldErrors } = parseError(err);
    const enriched = err as ApiError;
    enriched.userMessage = message;
    enriched.apiError = apiError;
    enriched.fieldErrors = fieldErrors;

    const status = err.response?.status;
    const url = (err.config?.url ?? '') as string;

    if (status === 401) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        // Skip toast for background /auth/me probes; show for user-initiated flows.
        if (!url.endsWith('/auth/me')) toast('error', 'Session expired. Please sign in again.');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      toast('error', message || 'You do not have permission to perform this action.');
    } else if (status === 422) {
      toast('error', 'Please fix the highlighted fields.');
    } else if (status && status >= 400 && status !== 400) {
      // 400 is often shown inline; still notify for 404/409/500 etc.
      toast('error', message);
    } else if (!err.response) {
      toast('error', message);
    }

    return Promise.reject(enriched);
  },
);
