import axios, { AxiosError } from 'axios';
import { toast, type ToastDetail } from '../lib/toast';

const env = import.meta.env as Record<string, string | undefined>;

/**
 * API base URL is fully environment driven:
 *   VITE_API_URL      full base, e.g. https://erp.example.com/api/v1  (wins)
 *   VITE_API_DOMAIN   domain only, e.g. https://erp.example.com
 *   VITE_API_PREFIX   path prefix, default /api/v1
 * When nothing is set we fall back to the current origin (nginx proxies /api).
 */
function resolveBaseUrl(): string {
  const prefix = `/${(env.VITE_API_PREFIX ?? 'api/v1').replace(/^\/|\/$/g, '')}`;
  if (env.VITE_API_URL) return env.VITE_API_URL.replace(/\/$/, '');
  const domain = (env.VITE_API_DOMAIN ?? '').replace(/\/$/, '');
  if (domain) return `${domain}${prefix}`;
  return prefix;
}

export const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
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
  /** True when the response interceptor already alerted the user. */
  handled?: boolean;
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
    enriched.handled = false;

    const status = err.response?.status;
    const url = (err.config?.url ?? '') as string;
    const details = apiError?.details?.map((d) => ({
      field: d.field,
      message: humaniseDetail(d),
    }));

    const notify = (msg: string, list?: ToastDetail[]) => {
      enriched.handled = true;
      toast('error', msg, list);
    };

    if (status === 401) {
      setToken(null);
      // Session handling (refresh / redirect) is owned by the auth layer;
      // background probes stay silent so the user never sees a stray alert.
      const isProbe = url.endsWith('/auth/me') || url.endsWith('/auth/refresh');
      if (!isProbe && !window.location.pathname.startsWith('/login')) {
        notify('Your session has ended. Please sign in again.');
        window.location.href = '/login';
      } else {
        enriched.handled = true;
      }
    } else if (status === 403) {
      notify(
        message && message !== 'Insufficient role'
          ? message
          : 'You do not have permission to do this. Ask an admin or manager for access.',
      );
    } else if (status === 422) {
      notify(
        details?.length
          ? `Please correct ${details.length} field${details.length > 1 ? 's' : ''} below:`
          : message || 'Some of the entered values are not valid.',
        details,
      );
    } else if (status === 409) {
      notify(message || 'That record already exists.');
    } else if (status === 404) {
      notify(message || 'That record no longer exists. Refresh the page and try again.');
    } else if (status && status >= 500) {
      notify(message || 'The server could not complete the request. Please try again.');
    } else if (status === 400) {
      notify(message || 'The request could not be completed. Check the entered values.');
    } else if (!err.response) {
      notify('Cannot reach the server. Check your connection and try again.');
    }

    return Promise.reject(enriched);
  },
);

/** Rewrite class-validator text into a plain sentence, e.g. "Mobile: must be …". */
function humaniseDetail(d: { field?: string; message: string }): string {
  if (!d.field) return d.message;
  const stripped = d.message.replace(new RegExp(`^${d.field}\\s+`), '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * Report an API failure exactly once. The response interceptor already alerts
 * the user for every recognised status, so this only fires for anything it
 * could not classify — no more double toasts for a single failure.
 */
export function notifyApiError(err: unknown, fallback: string) {
  const e = err as Partial<ApiError> | undefined;
  if (e && e.handled) return;
  toast('error', e?.userMessage || fallback);
}

