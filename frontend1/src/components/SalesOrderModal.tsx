import { useEffect, useMemo, useState } from 'react';
import { Combobox } from './Combobox';
import { productsService } from '../services/products.service';
import { customersService } from '../services/customers.service';
import { salesService } from '../services/sales.service';
import { useMasterData } from '../hooks/useMasterData';
import { formatMoney } from '../types/stock';
import { toast } from '../lib/toast';
import type { Product } from '../types/product';
import type { Customer } from '../types/customer';
import type { SalesOrder, SalesOrderItemInput } from '../types/sales';
import type { UserRow } from '../types/product';
import { usersService } from '../services/users.service';

interface Line extends SalesOrderItemInput {
  key: string;
}

const newLine = (): Line => ({ key: crypto.randomUUID(), product_id: '', qty: 1, unit_price: 0 });

/**
 * Create / edit a sales order. Prices default to the product's selling price
 * but stay editable — the backend snapshots whatever is submitted so later
 * product price changes never rewrite history.
 */
export function SalesOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: SalesOrder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { currencies } = useMasterData();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState(order?.customer_id ?? '');
  const [orderDate, setOrderDate] = useState(order?.order_date ?? new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(order?.expected_delivery_date ?? '');
  const [currencyCode, setCurrencyCode] = useState(order?.currency_code ?? 'SAR');
  const [vatRate, setVatRate] = useState(order ? Number(order.vat_rate) : 15);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [salespersonId, setSalespersonId] = useState(order?.salesperson_id ?? '');
  const [commissionPercent, setCommissionPercent] = useState(
    order ? Number(order.commission_percent) : 10,
  );
  const [people, setPeople] = useState<UserRow[]>([]);
  const [lines, setLines] = useState<Line[]>(
    order?.items?.length
      ? order.items.map((i) => ({
          key: i.id,
          product_id: i.product_id,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
          discount_amount: Number(i.discount_amount),
        }))
      : [newLine()],
  );

  useEffect(() => {
    void (async () => {
      const [p, c] = await Promise.all([
        productsService.list({ limit: 50 }),
        customersService.list({ limit: 50, status: 'active' }),
      ]);
      setProducts(p.items);
      setCustomers(c.items);
      try {
        setPeople(await usersService.list());
      } catch {
        setPeople([]);
      }
    })();
  }, []);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickProduct = (key: string, productId: string) => {
    const p = productMap.get(productId);
    setLine(key, {
      product_id: productId,
      unit_price: p ? Number(p.sellingPrice ?? 0) : 0,
    });
  };

  const subtotal = lines.reduce(
    (s, l) => s + Math.max(Number(l.qty || 0) * Number(l.unit_price || 0) - Number(l.discount_amount || 0), 0),
    0,
  );
  const vatAmount = (subtotal * Number(vatRate || 0)) / 100;
  const total = subtotal + vatAmount;

  const submit = async () => {
    const items = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({
        product_id: l.product_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price ?? 0),
        discount_amount: Number(l.discount_amount ?? 0),
      }));
    if (!customerId) return toast('error', 'Pick a customer first');
    if (!items.length) return toast('error', 'Add at least one product line');

    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        order_date: orderDate || undefined,
        expected_delivery_date: deliveryDate || undefined,
        currency_code: currencyCode || undefined,
        vat_rate: Number(vatRate),
        notes: notes.trim() || undefined,
        salesperson_id: salespersonId || undefined,
        commission_percent: Number(commissionPercent),
        items,
      };
      if (order) await salesService.update(order.id, payload);
      else await salesService.create(payload);
      toast('success', order ? `Sales order ${order.order_no} updated` : 'Sales order created');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-4xl my-4">
        <div className="flex items-center justify-between border-b border-brown-100 px-5 py-4">
          <div>
            <h2 className="font-serif text-xl text-ink">
              {order ? `Edit ${order.order_no}` : 'New sales order'}
            </h2>
            <p className="text-xs text-brown-500">
              Prices are snapshotted on save — later product price edits never change this order.
            </p>
          </div>
          <button className="btn-ghost !py-1.5" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Customer *</label>
              <Combobox
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.legal_name,
                  hint: c.code ?? undefined,
                  keywords: `${c.code ?? ''} ${c.phone ?? ''}`,
                }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Search customers…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Order date</label>
                <input
                  type="date"
                  className="input"
                  value={orderDate}
                  max={deliveryDate || undefined}
                  onChange={(e) => {
                    setOrderDate(e.target.value);
                    if (deliveryDate && e.target.value && deliveryDate < e.target.value)
                      setDeliveryDate(e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="label">Expected delivery</label>
                <input
                  type="date"
                  className="input"
                  value={deliveryDate}
                  min={orderDate || undefined}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Sales person</label>
              <Combobox
                options={people.map((u) => ({
                  value: u.id,
                  label: u.name || u.email,
                  hint: u.email,
                  keywords: u.email,
                }))}
                value={salespersonId}
                onChange={setSalespersonId}
                placeholder="Defaults to you…"
              />
              <p className="mt-1 text-[11px] text-brown-500">
                Commission is paid to this person once the customer's cash is received.
              </p>
            </div>
            <div>
              <label className="label">Commission % of profit</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="input"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-brown-500">
                Percentage of the order profit (not the sales value). Default 10%.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">VAT %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="input"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Order lines</h3>
              <button className="btn-ghost !py-1 text-sm" onClick={() => setLines((l) => [...l, newLine()])}>
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l) => {
                const lineTotal = Math.max(
                  Number(l.qty || 0) * Number(l.unit_price || 0) - Number(l.discount_amount || 0),
                  0,
                );
                return (
                  <div
                    key={l.key}
                    className="grid items-end gap-2 rounded-lg border border-brown-100 p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-5">
                      <label className="label">Product</label>
                      <Combobox
                        options={products.map((pr) => ({
                          value: pr.id,
                          label: pr.description ?? pr.productCode ?? pr.id,
                          hint: pr.productCode ?? undefined,
                          keywords: `${pr.productCode ?? ''} ${pr.product_barcode ?? ''}`,
                        }))}
                        value={l.product_id}
                        onChange={(v) => pickProduct(l.key, v)}
                        placeholder="Search products…"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Qty</label>
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        className="input"
                        value={l.qty}
                        onChange={(e) => setLine(l.key, { qty: Number(e.target.value) })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Unit price</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input"
                        value={l.unit_price}
                        onChange={(e) => setLine(l.key, { unit_price: Number(e.target.value) })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Discount</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input"
                        value={l.discount_amount ?? 0}
                        onChange={(e) => setLine(l.key, { discount_amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center justify-between sm:col-span-1">
                      <span className="text-sm font-medium text-ink sm:hidden">
                        {formatMoney(lineTotal, currencyCode)}
                      </span>
                      <button
                        className="btn-ghost !px-2 !py-1 text-sm text-brown-600"
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="hidden text-right text-xs text-brown-500 sm:col-span-12 sm:block">
                      Line total: <span className="font-medium text-ink">{formatMoney(lineTotal, currencyCode)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(subtotal, currencyCode)} />
            <Row label={`VAT (${vatRate}%)`} value={formatMoney(vatAmount, currencyCode)} />
            <div className="flex justify-between border-t border-brown-100 pt-1 text-base font-semibold text-ink">
              <span>Total</span>
              <span>{formatMoney(total, currencyCode)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-brown-100 px-5 py-4">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-gold" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : order ? 'Save changes' : 'Create order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-brown-600">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
