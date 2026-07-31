import { useEffect, useMemo, useState } from 'react';
import { productsService } from '../services/products.service';
import { useMasterData } from '../hooks/useMasterData';
import { Combobox, type ComboOption } from '../components/Combobox';
import type { Product } from '../types/product';
import type { ProductHistoryEntry } from '../types/stock';


const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  baseQty: 'Base qty',
  weight: 'Weight',
  buyingPrice: 'Buying price',
  sellingPrice: 'Selling price',
  productCode: 'Product code',
  product_barcode: 'Barcode',
  department_id: 'Department',
  base_uom_id: 'Base UOM',
  weight_uom_id: 'Weight UOM',
  buying_currency_id: 'Buying currency',
  selling_currency_id: 'Selling currency',
};

const ID_FIELDS = new Set([
  'department_id',
  'base_uom_id',
  'weight_uom_id',
  'buying_currency_id',
  'selling_currency_id',
]);

export function HistoryPage() {
  const { departments, uoms, currencies } = useMasterData();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [entries, setEntries] = useState<ProductHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const labelForId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departments) map[d.id] = `${d.code} — ${d.name}`;
    for (const u of uoms) map[u.id] = u.code;
    for (const c of currencies) map[c.id] = c.code;
    return map;
  }, [departments, uoms, currencies]);

  const formatValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '∅';
    if (ID_FIELDS.has(field)) return labelForId[String(value)] ?? String(value);
    return String(value);
  };

  // Typeable autocomplete — products are queried from the database as the user types.
  useEffect(() => {
    let cancelled = false;
    setProductLoading(true);
    const t = setTimeout(() => {
      productsService
        .list({ search: productQuery || undefined, limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setProducts(r.items);
          setSelected((cur) => cur || (r.items.length > 0 ? r.items[0].id : ''));
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setProductLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productQuery]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    productsService
      .history(selected)
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [selected]);

  const product = useMemo(() => products.find((p) => p.id === selected), [products, selected]);

  const productOptions: ComboOption[] = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.productCode,
        hint: p.description,
        keywords: p.product_barcode ?? '',
      })),
    [products],
  );

  const actionOptions: ComboOption[] = useMemo(
    () =>
      [...new Set(entries.map((e) => e.action))].map((a) => ({
        value: a,
        label: a === 'create' ? 'Created' : a === 'delete' ? 'Deleted' : 'Updated',
      })),
    [entries],
  );

  const userOptions: ComboOption[] = useMemo(
    () =>
      [...new Set(entries.map((e) => e.changed_by).filter(Boolean) as string[])].map((u) => ({
        value: u,
        label: u,
      })),
    [entries],
  );

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!actionFilter || e.action === actionFilter) &&
          (!userFilter || e.changed_by === userFilter),
      ),
    [entries, actionFilter, userFilter],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-ink">Product history</h1>
        <p className="text-sm text-brown-500 mt-1">
          Every change made to a product, with who and when.
        </p>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Product</label>
          <Combobox
            options={productOptions}
            value={selected}
            onChange={setSelected}
            onQueryChange={setProductQuery}
            loading={productLoading}
            placeholder="Type a product code or description…"
            emptyLabel="No matching product"
          />
        </div>
        <div>
          <label className="label">Filter by action</label>
          <Combobox
            options={actionOptions}
            value={actionFilter}
            onChange={setActionFilter}
            allowClear
            clearLabel="All actions"
            placeholder="Type to search actions…"
          />
        </div>
        <div>
          <label className="label">Filter by user</label>
          <Combobox
            options={userOptions}
            value={userFilter}
            onChange={setUserFilter}
            allowClear
            clearLabel="All users"
            placeholder="Type to search users…"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-600">
          {error}
        </div>
      )}

      {product && (
        <div className="card p-4">
          <div className="text-sm text-brown-500">Current product</div>
          <div className="font-mono text-ink font-medium">{product.productCode}</div>
          <div className="text-sm text-ink">{product.description}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-warm text-ink">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">When</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">By</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-50">
              {loading && (
                <tr><td colSpan={4} className="py-8 text-center text-brown-500">Loading…</td></tr>
              )}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-brown-500">No history entries match these filters.</td></tr>
              )}
              {!loading && visible.map((e) => (
                <tr key={e.id} className="align-top hover:bg-paper-soft">
                  <td className="px-4 py-3 whitespace-nowrap text-brown-500">
                    {new Date(e.changed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={e.action} />
                  </td>
                  <td className="px-4 py-3 text-brown-500">{e.changed_by ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.action === 'update' && e.changes ? (
                      <ul className="space-y-1">
                        {Object.entries(e.changes).map(([field, diff]) => (
                          <li key={field} className="text-xs">
                            <span className="font-medium text-ink">
                              {FIELD_LABELS[field] ?? field}:
                            </span>{' '}
                            <span className="text-brown-500 line-through">
                              {formatValue(field, diff.from)}
                            </span>{' '}
                            → <span className="text-forest-500">
                              {formatValue(field, diff.to)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-brown-500">
                        {e.action === 'create' ? 'Product created' : 'Product deleted'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: ProductHistoryEntry['action'] }) {
  const tone =
    action === 'create'
      ? 'bg-forest-50 text-forest-500 border-forest-100'
      : action === 'delete'
      ? 'bg-brown-50 text-brown-600 border-brown-200'
      : 'bg-gold-50 text-ink border-gold-200';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {action}
    </span>
  );
}
