import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface Ctx {
  push: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<Ctx | undefined>(undefined);
let queued: Array<{ kind: ToastKind; message: string }> = [];
let dispatch: ((kind: ToastKind, message: string) => void) | null = null;

/** Fire a toast from anywhere (including outside React, e.g. axios interceptors). */
export function toast(kind: ToastKind, message: string) {
  if (dispatch) dispatch(kind, message);
  else queued.push({ kind, message });
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  useEffect(() => {
    dispatch = push;
    if (queued.length) {
      queued.forEach((q) => push(q.kind, q.message));
      queued = [];
    }
    return () => {
      dispatch = null;
    };
  }, [push]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed z-[100] top-4 right-4 left-4 sm:left-auto sm:max-w-sm flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-top-2 ${
              t.kind === 'error'
                ? 'bg-brown-50 border-brown-300 text-brown-700'
                : t.kind === 'success'
                  ? 'bg-forest-50 border-forest-200 text-forest-600'
                  : 'bg-paper border-brown-100 text-ink'
            }`}
          >
            {t.message}
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
