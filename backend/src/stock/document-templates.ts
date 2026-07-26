import { DOC_TYPE_LABEL } from './lifecycle';
import type { StockDocument } from './stock-document.entity';
import type { Stock } from './stock.entity';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function row(k: string, v: unknown) {
  return `<tr><th style="text-align:left;padding:6px 12px;background:#f7f2e7;color:#5a4632;width:220px">${esc(k)}</th><td style="padding:6px 12px">${esc(v)}</td></tr>`;
}

export function renderDocumentHtml(doc: StockDocument, stock: Stock): string {
  const title = DOC_TYPE_LABEL[doc.doc_type];
  const payload = doc.payload ?? {};
  const payloadRows = Object.entries(payload)
    .map(([k, v]) => row(k.replace(/_/g, ' '), v))
    .join('');
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
      <div class="muted">Generated ${esc(new Date(doc.generated_at).toISOString().slice(0,19).replace('T',' '))} UTC</div>
      <div class="muted">By ${esc(doc.generated_by ?? '—')}</div>
    </div>
    <div style="text-align:right">
      <div class="muted">Stock reference</div>
      <div style="font-family:monospace">${esc(stock.id)}</div>
      <div class="muted" style="margin-top:8px">Current status</div>
      <div><b>${esc(stock.status)}</b></div>
    </div>
  </div>
  <table>
    ${row('Product', stock.product_id)}
    ${row('Vendor', `${stock.vendor_name ?? '—'} (${stock.vendor_id ?? '—'})`)}
    ${row('Batch no.', stock.batch_no)}
    ${row('Quantity', `${stock.qty} (uom: ${stock.qty_uom_id ?? '—'})`)}
    ${row('Buying price @ order', `${stock.buying_price_snapshot} ${stock.buying_currency_id_snapshot ?? ''}`)}
    ${row('Selling price @ order', `${stock.selling_price_snapshot} ${stock.selling_currency_id_snapshot ?? ''}`)}
    ${row('Manufacture date', stock.manufacture_date)}
    ${row('Expiry date', stock.expiry_date)}
    ${row('Ordered at', stock.ordered_at)}
    ${payloadRows}
  </table>
  <div class="actions"><button onclick="window.print()">Print</button></div>
</body></html>`;
}
