import { useMemo } from 'react';
import type { Product } from '../types/product';
import { useMasterData } from '../hooks/useMasterData';
import { ProductBarcode } from './ProductBarcode';
import { useConfirm } from './Dialog';


interface Props {
  products: Product[];
  loading: boolean;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ProductTable({
  products,
  loading,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  const { uoms, currencies } = useMasterData();
  // In-app confirmation — never a native browser dialog.
  const { confirm, dialog } = useConfirm();

  const uomMap = useMemo(
    () => Object.fromEntries(uoms.map((u) => [u.id, u.code])),
    [uoms],
  );
  const curMap = useMemo(
    () => Object.fromEntries(currencies.map((c) => [c.id, c.code])),
    [currencies],
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-paper-warm text-ink">
            <tr className="text-left">
              <Th>Product code</Th>
              <Th>Barcode</Th>
              <Th>Description</Th>
              <Th>Department</Th>
              <Th align="right">Base qty</Th>
              <Th align="right">Weight</Th>
              <Th align="right">Buying</Th>
              <Th align="right">Selling</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brown-50">
            {loading && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-brown-500 whitespace-nowrap">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-brown-500 whitespace-nowrap">
                  No products yet.
                </td>
              </tr>
            )}
            {!loading &&
              products.map((p) => {
                // Prefer backend-enriched codes; fall back to master-data lookup.
                const baseUom = p.base_uom_code ?? (p.base_uom_id ? uomMap[p.base_uom_id] : '');
                const weightUom =
                  p.weight_uom_code ?? (p.weight_uom_id ? uomMap[p.weight_uom_id] : '');
                const buyCur =
                  p.buying_currency_code ??
                  (p.buying_currency_id ? curMap[p.buying_currency_id] : '');
                const sellCur =
                  p.selling_currency_code ??
                  (p.selling_currency_id ? curMap[p.selling_currency_id] : '');
                const deptLabel =
                  p.department_name ?? p.department_code ?? '—';
                return (
                  <tr key={p.id} className="hover:bg-paper-soft">
                    <Td>
                      <span className="font-mono text-ink whitespace-nowrap font-medium">{p.productCode}</span>
                    </Td>
                    <Td>
                      {p.product_barcode ? (
                        <div className="group relative inline-block">
                          <span className="font-mono text-brown-500 whitespace-nowrap cursor-help border-b border-dotted border-brown-300">
                            {p.product_barcode}
                          </span>
                          <div className="pointer-events-none absolute whitespace-nowrap left-0 top-full z-20 mt-2 hidden group-hover:block rounded-lg border border-brown-100 bg-white p-2 shadow-lg">
                            <ProductBarcode value={p.product_barcode} height={50} width={1.5} fontSize={12} />
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-brown-500 whitespace-nowrap">—</span>
                      )}
                    </Td>
                    <Td className="max-w-xs truncate whitespace-nowrap" title={p.description}>
                      {p.description}
                    </Td>
                    <Td>
                      <span className="text-brown-600 whitespace-nowrap">{deptLabel}</span>
                    </Td>
                    <Td align="right">
                      {Number(p.baseQty).toFixed(3)}
                      {baseUom && <span className="text-brown-500 ml-1 whitespace-nowrap">{baseUom}</span>}
                    </Td>
                    <Td align="right">
                      {Number(p.weight).toFixed(3)}
                      {weightUom && <span className="text-brown-500 ml-1 whitespace-nowrap">{weightUom}</span>}
                    </Td>
                    <Td align="right" className="text-brown-500">
                      {Number(p.buyingPrice).toFixed(2)}
                      {buyCur && <span className="ml-1 whitespace-nowrap">{buyCur}</span>}
                    </Td>
                    <Td align="right" className="text-forest-500 font-medium">
                      {Number(p.sellingPrice).toFixed(2)}
                      {sellCur && <span className="ml-1 whitespace-nowrap">{sellCur}</span>}
                    </Td>
                    <Td align="right">
                      <div className="inline-flex gap-2">
                        {canEdit ? (
                          <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => onEdit(p)}>
                            Edit
                          </button>
                        ) : (
                          <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => onEdit(p)}>
                            View
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn-danger !py-1 !px-2 text-xs"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Delete product',
                                message: `Delete ${p.productCode}? This cannot be undone.`,
                                confirmLabel: 'Delete',
                                tone: 'danger',
                              });
                              if (ok) onDelete(p.id);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-4 py-3 text-xs whitespace-nowrap font-semibold uppercase tracking-wider ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`}
      title={title}
    >
      {children}
    </td>
  );
}
