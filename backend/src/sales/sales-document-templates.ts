import { SALES_DOC_LABEL, type SalesDocument } from './sales-document.entity';

function esc(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

function pct(value: unknown): string {
  const n = Number(value ?? 0);
  return `${(Number.isNaN(n) ? 0 : n).toFixed(2)}%`;
}

function row(k: string, v: unknown) {
  return `<tr><th style="text-align:left;padding:6px 12px;background:#f7f2e7;color:#5a4632;width:220px">${esc(
    k,
  )}</th><td style="padding:6px 12px">${esc(v)}</td></tr>`;
}

interface DocLine {
  product_code?: string | null;
  description?: string | null;
  qty?: string | number | null;
  uom_code?: string | null;
  unit_price?: string | number | null;
  discount_percent?: string | number | null;
  discount_amount?: string | number | null;
  line_total?: string | number | null;
}

interface DocPayment {
  amount?: string | number | null;
  method?: string | null;
  status?: string | null;
}

interface DocOrder {
  order_no: string;
  order_date: string;
  expected_delivery_date?: string | null;
  invoice_no?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  customer_phone?: string | null;
  customer_vat_number?: string | null;
  company_vat_number?: string | null;
  currency_code?: string | null;
  subtotal: string;
  vat_rate: string;
  vat_amount: string;
  total_amount: string;
  amount_paid: string;
  notes?: string | null;
  items: DocLine[];
  payments?: DocPayment[];
}

/**
 * Delivery orders omit pricing (a warehouse hand-over note), invoices carry the
 * full VAT breakdown required by ZATCA-style Saudi invoicing.
 */
export function renderSalesDocumentHtml(doc: SalesDocument, order: DocOrder): string {
  const isInvoice = doc.doc_type === 'sales_invoice';
  const cur = order.currency_code ?? null;

  const lines = order.items
    .map(
      (i) => `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(i.product_code)}${
          i.description ? `<div style="color:#7a6a58;font-size:12px">${esc(i.description)}</div>` : ''
        }</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(i.qty)} ${esc(i.uom_code ?? '')}</td>
        ${
          isInvoice
            ? `<td style="padding:6px 12px;border-bottom:1px solid #eee">${money(i.unit_price, cur)}</td>
               <td style="padding:6px 12px;border-bottom:1px solid #eee">${pct(i.discount_percent)}${
                 Number(i.discount_amount ?? 0)
                   ? `<div style="color:#7a6a58;font-size:12px">${money(i.discount_amount, cur)}</div>`
                   : ''
               }</td>
               <td style="padding:6px 12px;border-bottom:1px solid #eee">${money(i.line_total, cur)}</td>`
            : ''
        }
      </tr>`,
    )
    .join('');

  const paid = Number(order.amount_paid ?? 0);
  const balance = Number(order.total_amount) - paid;
  const settled = (order.payments ?? []).filter((p) => p.status === 'received');

  const totals = isInvoice
    ? `<table style="margin-top:16px;width:340px;margin-left:auto;border-collapse:collapse">
        ${row('Subtotal (after discount)', money(order.subtotal, cur))}
        ${row(`VAT (${order.vat_rate}%)`, money(order.vat_amount, cur))}
        ${row('Total', money(order.total_amount, cur))}
        ${row(`Total paid${settled.length ? ` (${settled.length} payment${settled.length === 1 ? '' : 's'})` : ''}`, money(paid, cur))}
        ${row('Remaining balance', money(Math.max(balance, 0), cur))}
      </table>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.doc_no)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;color:#2b2118;margin:32px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #d4af37;padding-bottom:12px">
    <div>
      <h1 style="margin:0;font-size:24px">${esc(SALES_DOC_LABEL[doc.doc_type])}</h1>
      <div style="color:#7a6a58">${esc(doc.doc_no)}</div>
    </div>
    <div style="text-align:right;color:#7a6a58;font-size:13px">
      <div>Issued ${esc(new Date(doc.issued_at).toLocaleString())}</div>
      <div>${esc(doc.issued_by ?? '')}</div>
      ${isInvoice && order.company_vat_number ? `<div>Company VAT: ${esc(order.company_vat_number)}</div>` : ''}
    </div>
  </div>

  <table style="margin-top:16px;width:100%;border-collapse:collapse">
    ${row('Sales order', order.order_no)}
    ${row('Order date', order.order_date)}
    ${isInvoice ? row('Invoice no', order.invoice_no) : row('Expected delivery', order.expected_delivery_date)}
    ${row('Customer', `${order.customer_name ?? ''} ${order.customer_code ? `(${order.customer_code})` : ''}`)}
    ${row('Phone', order.customer_phone)}
    ${isInvoice ? row('Customer VAT number', order.customer_vat_number) : ''}
    ${isInvoice ? row('Company VAT number', order.company_vat_number) : ''}
    ${order.notes ? row('Notes', order.notes) : ''}
  </table>

  <table style="margin-top:20px;width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f7f2e7;color:#5a4632;text-align:left">
      <th style="padding:8px 12px">Product</th>
      <th style="padding:8px 12px">Qty</th>
      ${isInvoice ? '<th style="padding:8px 12px">Unit price</th><th style="padding:8px 12px">Discount %</th><th style="padding:8px 12px">Line total</th>' : ''}
    </tr></thead>
    <tbody>${lines}</tbody>
  </table>

  ${totals}

  ${
    isInvoice && settled.length
      ? `<table style="margin-top:16px;width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f2e7;color:#5a4632;text-align:left">
            <th style="padding:6px 12px">Payment</th><th style="padding:6px 12px">Method</th><th style="padding:6px 12px">Amount</th>
          </tr></thead>
          <tbody>${settled
            .map(
              (p, idx) =>
                `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">#${idx + 1}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(
                  (p.method ?? '').replace(/_/g, ' '),
                )}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${money(p.amount, cur)}</td></tr>`,
            )
            .join('')}</tbody>
        </table>`
      : ''
  }

  <div style="margin-top:48px;display:flex;justify-content:space-between;color:#7a6a58;font-size:13px">
    <div>_____________________<br/>Issued by</div>
    <div>_____________________<br/>${isInvoice ? 'Customer acknowledgement' : 'Received by'}</div>
  </div>
</body></html>`;
}
