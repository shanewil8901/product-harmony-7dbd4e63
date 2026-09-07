import { DOC_TYPE_LABEL } from './lifecycle';
import type { StockDocument } from './stock-document.entity';
import type { Stock } from './stock.entity';

function esc(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function row(k: string, v: unknown) {
  return `<tr><th style="text-align:left;padding:6px 12px;background:#f7f2e7;color:#5a4632;width:220px">${esc(k)}</th><td style="padding:6px 12px">${esc(v)}</td></tr>`;
}

/**
 * `stock` may be the enriched shape returned by StockService (with flattened
 * `product_code`, `qty_uom_code`, currency codes, and nested relations).
 * Fall back to raw IDs only when relations weren't loaded.
 */
type EnrichedStock = Stock & {
  product_code?: string | null;
  product_description?: string | null;
  qty_uom_code?: string | null;
  vendor_name?: string | null;
  buying_currency_code?: string | null;
  buying_currency_symbol?: string | null;
  selling_currency_code?: string | null;
  selling_currency_symbol?: string | null;
  total_buying_value?: string | null;
};

/** "10,000.00 SAR" — every monetary value in a document carries its currency. */
function money(amount: unknown, currency?: string | null): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function renderDocumentHtml(doc: StockDocument, stock: EnrichedStock): string {
  const title = DOC_TYPE_LABEL[doc.doc_type];
  const payload = doc.payload ?? {};
  const MONEY_KEYS = new Set(['amount', 'duty_amount', 'total_amount', 'unit_price']);
  const docCurrency = doc.currency?.code ?? null;
  const payloadRows = Object.entries(payload)
    .map(([k, v]) => row(k.replace(/_/g, ' '), MONEY_KEYS.has(k) ? money(v, docCurrency) : v))
    .join('');

  const productLabel = stock.product_code
    ? `${stock.product_code}${stock.product_description ? ` — ${stock.product_description}` : ''}`
    : (stock.product?.productCode ?? stock.product_id);

  const qtyUom = stock.qty_uom_code ?? stock.qty_uom?.code ?? '';
  const buyCur =
    stock.buying_currency_code ?? stock.buying_currency_snapshot?.code ?? '';
  const sellCur =
    stock.selling_currency_code ?? stock.selling_currency_snapshot?.code ?? '';

  // Inventory valuation always uses the buying (cost) price, never the selling price.
  const totalBuyingValue =
    stock.total_buying_value ??
    (Number(stock.qty) * Number(stock.buying_price_snapshot)).toFixed(2);

  const vendorLabel = stock.vendor_name ?? stock.vendor?.legal_name ?? '—';

  // Human-friendly stock reference: product code + batch (fallbacks preserved).
  const stockReference = stock.product_code
    ? `${stock.product_code}${stock.batch_no ? ` · Batch ${stock.batch_no}` : ''}`
    : (stock.product?.productCode ?? '—');

  // Format: "01 Jan 2026 at 01:00pm Arabian Standard Time"
  const formatGeneratedAt = (d: Date): string => {
    const tz = 'Asia/Riyadh'; // Arabian Standard Time (UTC+3, no DST)
    const datePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);
    let hour = '12';
    let minute = '00';
    let dayPeriod = 'am';
    for (const p of timeParts) {
      if (p.type === 'hour') hour = p.value.padStart(2, '0');
      else if (p.type === 'minute') minute = p.value.padStart(2, '0');
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toLowerCase().replace(/\./g, '');
    }
    return `${datePart} ${hour}:${minute}${dayPeriod}`;
  };

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(doc.doc_number)} — ${esc(title)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1613;max-width:800px;margin:32px auto;padding:0 24px}
  h1{font-family:Georgia,serif;font-size:26px;margin:0 0 4px}
  .muted{color:#7a6a58;font-size:13px}
  table{border-collapse:collapse;width:100%;margin-top:16px;border:1px solid #e7dfd0;border-radius:8px;overflow:hidden}
  th,td{border-bottom:1px solid #f0e8d6}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#f1e6c4;color:#3d2e17;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}
  .actions{margin-top:24px;text-align:right}
  button{background:#c9a24b;color:#1a1613;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}
  @media print{.actions{display:none}}
</style></head>
<body onload="window.print && setTimeout(()=>window.print(),300)">
  <div class="grid">
    <div>
      <div class="badge">${esc(title)}</div>
      <h1>${esc(doc.doc_number)}</h1>
      <div class="muted">Generated ${esc(formatGeneratedAt(new Date(doc.generated_at)))}</div>
      <div class="muted">By ${esc(doc.generated_by ?? '—')}</div>
    </div>
    <div style="text-align:right">
      <div class="muted">Stock reference</div>
      <div>${esc(stockReference)}</div>
      <div class="muted" style="margin-top:8px">Current status</div>
      <div><b>${esc(stock.status)}</b></div>
    </div>
  </div>
  <table>
    ${row('Product', productLabel)}
    ${row('Vendor', vendorLabel)}
    ${row('Batch no.', stock.batch_no)}
    ${row('Quantity', `${Number(stock.qty).toFixed(3)}${qtyUom ? ` ${qtyUom}` : ''}`)}
    ${row('Buying price @ order', money(stock.buying_price_snapshot, buyCur))}
    ${row('Total buying value', money(totalBuyingValue, buyCur))}
    ${row('Selling price @ order', money(stock.selling_price_snapshot, sellCur))}
    ${row('Manufacture date', stock.manufacture_date)}
    ${row('Expiry date', stock.expiry_date)}
    ${row('Ordered at', stock.ordered_at)}
    ${payloadRows}
  </table>
  <table>
    <tr>
      <th style="text-align:left;padding:10px 12px;background:#f1e6c4;color:#3d2e17">Document total</th>
      <td style="padding:10px 12px;text-align:right;font-size:18px;font-weight:700">${esc(
        money(doc.total_amount, docCurrency),
      )}</td>
    </tr>
    <tr>
      <th style="text-align:left;padding:10px 12px;background:#f7f2e7;color:#5a4632">Total buying value (qty × cost)</th>
      <td style="padding:10px 12px;text-align:right;font-weight:600">${esc(
        money(totalBuyingValue, buyCur),
      )}</td>
    </tr>
  </table>
  <div class="actions"><button onclick="window.print()">Print</button></div>
</body></html>`;
}

