import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComboOption {
  value: string;
  label: string;
  /** Optional secondary line shown under the label. */
  hint?: string;
  /** Extra text matched while typing (codes, aliases…). */
  keywords?: string;
}

interface Props {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Adds a "clear" entry at the top (used for "All products" style filters). */
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Called with the raw typed text — use for server-side searching. */
  onQueryChange?: (query: string) => void;
  id?: string;
}

/**
 * Typeable autocomplete dropdown. Filters locally as the user types and, when
 * `onQueryChange` is supplied, also lets the parent query the API.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  emptyLabel = 'No matches found',
  allowClear = false,
  clearLabel = 'All',
  disabled = false,
  loading = false,
  onQueryChange,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) =>
        `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
    onQueryChange?.('');
  };

  const rows = allowClear
    ? [{ value: '', label: clearLabel } as ComboOption, ...filtered]
    : filtered;

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
          onQueryChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && open) {
            e.preventDefault();
            const row = rows[highlight];
            if (row) commit(row.value);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
      />

      {value && allowClear && !open && (
        <button
          type="button"
          aria-label="Clear selection"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-brown-400 hover:text-ink text-sm"
          onClick={() => commit('')}
        >
          ×
        </button>
      )}

      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-brown-100 bg-paper shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-brown-500">Searching…</li>}
          {!loading && rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-brown-500">{emptyLabel}</li>
          )}
          {!loading &&
            rows.map((o, i) => (
              <li key={`${o.value}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(o.value)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === highlight ? 'bg-gold-50 text-ink' : 'text-ink hover:bg-paper-warm'
                  } ${o.value === value ? 'font-medium' : ''}`}
                >
                  <div className="truncate">{o.label}</div>
                  {o.hint && <div className="truncate text-xs text-brown-500">{o.hint}</div>}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
