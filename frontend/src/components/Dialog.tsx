import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-viewport dim layer. Rendered straight into <body> through a portal so no
 * ancestor (sticky headers, transformed panels) can clip it — that is what used
 * to leave an undimmed strip across the top of the page.
 */
export function Overlay({
  children,
  align = 'start',
  className = '',
}: {
  children: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 left-0 top-0 z-[100] h-[100dvh] w-screen overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm ${
        align === 'center' ? 'flex items-center justify-center' : 'flex items-start justify-center'
      } ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Application-wide modal shell. Replaces browser pop-ups (window.open /
 * prompt / confirm) so nothing is ever blocked by the browser.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Overlay>
      <div
        className={`card my-6 w-full ${wide ? 'max-w-5xl' : 'max-w-lg'} p-0 shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-brown-100 px-5 py-3">
          <div>
            <h2 className="font-serif text-lg text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-brown-500">{subtitle}</p>}
          </div>
          <button className="btn-ghost !px-2 !py-1 text-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-brown-100 px-5 py-3">{footer}</div>
        )}
      </div>
    </Overlay>
  );
}

/** In-app replacement for window.confirm. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'gold',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'gold' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={tone === 'danger' ? 'btn-ghost text-red-600' : 'btn-gold'}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Modal>
  );
}

/** In-app replacement for window.prompt. */
export function PromptDialog({
  title,
  label,
  placeholder,
  defaultValue = '',
  type = 'text',
  required = true,
  confirmLabel = 'Save',
  onCancel,
  onSubmit,
}: {
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'number';
  required?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const invalid = required && !value.trim();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-gold" disabled={invalid} onClick={() => onSubmit(value.trim())}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <label className="label">{label}</label>
      <input
        autoFocus
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !invalid) onSubmit(value.trim());
        }}
      />
    </Modal>
  );
}

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'gold' | 'danger';
};

/**
 * Promise-based replacement for window.confirm. Render `dialog` inside the
 * component and `await confirm({...})` wherever a browser popup used to be.
 */
export function useConfirm() {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setState({ ...options, resolve }));

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      tone={state.tone}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}
