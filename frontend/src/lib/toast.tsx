import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastDetail {
  field?: string;
  message: string;
}
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  details?: ToastDetail[];
}

interface Ctx {
  push: (kind: ToastKind, message: string, details?: ToastDetail[]) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<Ctx | undefined>(undefined);
let queued: Array<{ kind: ToastKind; message: string; details?: ToastDetail[] }> = [];
let dispatch: ((kind: ToastKind, message: string, details?: ToastDetail[]) => void) | null = null;

/** Fire a toast from anywhere (including outside React, e.g. axios interceptors). */
export function toast(kind: ToastKind, message: string, details?: ToastDetail[]) {
  if (dispatch) dispatch(kind, message, details);
  else queued.push({ kind, message, details });
}

/** Turn `first_name` / `basic_salary` into "First name" for human-readable alerts. */
export function humanField(field?: string) {
  if (!field) return '';
  return field
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

const DISMISS_MS = 8000;
const DEDUPE_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  // Remembers recently shown messages so the same alert never stacks twice
  // (e.g. the axios interceptor and the page catch block both reporting it).
  const recent = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) window.clearTimeout(handle);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, details?: ToastDetail[]) => {
      const key = `${kind}|${message}|${(details ?? []).map((d) => `${d.field}:${d.message}`).join('|')}`;
      const now = Date.now();
      const last = recent.current.get(key);
      if (last && now - last < DEDUPE_MS) return;
      recent.current.set(key, now);
      recent.current.forEach((at, k) => {
        if (now - at > DEDUPE_MS) recent.current.delete(k);
      });

      const id = now + Math.random();
      setItems((prev) => [...prev.slice(-3), { id, kind, message, details }]);
      const handle = window.setTimeout(() => dismiss(id), DISMISS_MS);
      timers.current.set(id, handle);
    },
    [dismiss],
  );

  useEffect(() => {
    dispatch = push;
    if (queued.length) {
      queued.forEach((q) => push(q.kind, q.message, q.details));
      queued = [];
    }
    return () => {
      dispatch = null;
    };
  }, [push]);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed z-[100] top-4 right-4 left-4 sm:left-auto sm:max-w-sm flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-top-2 ${
              t.kind === 'error'
                ? 'bg-brown-50 border-brown-300 text-brown-700'
                : t.kind === 'success'
                  ? 'bg-forest-50 border-forest-200 text-forest-600'
                  : 'bg-paper border-brown-100 text-ink'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{t.message}</p>
              {t.details && t.details.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-auto space-y-0.5 text-xs opacity-90">
                  {t.details.slice(0, 6).map((d, i) => (
                    <li key={`${d.field ?? ''}-${i}`} className="break-words">
                      • {d.field ? <span className="font-medium">{humanField(d.field)}: </span> : null}
                      {d.message}
                    </li>
                  ))}
                  {t.details.length > 6 && (
                    <li className="opacity-70">…and {t.details.length - 6} more</li>
                  )}
                </ul>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-1 text-base leading-none opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
