import type { Paginated, RoleCode } from './product';

export type StockStatus =
  | 'inquiry_sent'
  | 'quotation_received'
  | 'quotation_approved'
  | 'invoice_received'
  | 'payment_processed'
  | 'shipped'
  | 'customs_cleared'
  | 'ordered'
  | 'in_transit'
  | 'received'
  | 'in_warehouse'
  | 'sold_out'
  | 'settled'
  | 'expired'
  | 'cancelled';

export const STOCK_STATUSES: StockStatus[] = [
  'inquiry_sent',
  'quotation_received',
  'quotation_approved',
  'invoice_received',
  'payment_processed',
  'shipped',
  'customs_cleared',
  'ordered',
  'in_transit',
  'received',
  'in_warehouse',
  'sold_out',
  'settled',
  'expired',
  'cancelled',
];

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  inquiry_sent: 'Inquiry sent',
  quotation_received: 'Quotation received',
  quotation_approved: 'Quotation approved (PO issued)',
  invoice_received: 'Vendor invoice received',
  payment_processed: 'Payment processed',
  shipped: 'Shipped',
  customs_cleared: 'Customs cleared',
  ordered: 'Ordered',
  in_transit: 'On the way to warehouse',
  received: 'Received',
  in_warehouse: 'In warehouse',
  sold_out: 'Sold out',
  settled: 'Settled',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export interface Stock {
  id: string;
  product_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  batch_no: string | null;
  qty: string;
  qty_uom_id: string | null;
  buying_price_snapshot: string;
  buying_currency_id_snapshot: string | null;
  selling_price_snapshot: string;
  selling_currency_id_snapshot: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  ordered_at: string | null;
  status: StockStatus;
  notes: string | null;
  // Enriched by backend joins — safe to render directly.
  product_code?: string | null;
  product_description?: string | null;
  qty_uom_code?: string | null;
  qty_uom_name?: string | null;
  buying_currency_code?: string | null;
  buying_currency_symbol?: string | null;
  selling_currency_code?: string | null;
  selling_currency_symbol?: string | null;
  /** qty × buying (cost) price — the value used across inventory reports. */
  total_buying_value?: string | null;
  total_selling_value?: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/** Status is intentionally omitted — it's driven by document generation. */
export interface StockInput {
  product_id: string;
  qty: number;
  qty_uom_id?: string;
  /** Required — only registered, active vendors are accepted by the API. */
  vendor_id: string;
  vendor_name?: string;
  batch_no?: string;
  manufacture_date?: string;
  /** Required — enforced from the PO stage onwards. */
  expiry_date: string;

  ordered_at?: string;
  notes?: string;
}

export interface StockCurrencyTotal {
  currency_code: string;
  total_buying_value: string;
  total_qty: string;
  lines: number;
}

export type StockPage = Paginated<Stock> & { summary?: StockCurrencyTotal[] };

export type StockDocType =
  | 'inquiry'
  | 'quotation'
  | 'po'
  | 'vendor_invoice'
  | 'payment'
  | 'shipping'
  | 'customs_clearance'
  | 'dispatch'
  | 'grn'
  | 'putaway'
  | 'sales_invoice'
  | 'payment_receipt'
  | 'write_off'
  | 'cancellation';

export const STOCK_DOC_TYPES: StockDocType[] = [
  'inquiry',
  'quotation',
  'po',
  'vendor_invoice',
  'payment',
  'shipping',
  'customs_clearance',
  'dispatch',
  'grn',
  'putaway',
  'sales_invoice',
  'payment_receipt',
  'write_off',
  'cancellation',
];

export const STOCK_DOC_LABEL: Record<StockDocType, string> = {
  inquiry: 'Inquiry',
  quotation: 'Vendor Quotation',
  po: 'Purchase Order',
  vendor_invoice: 'Vendor Invoice',
  payment: 'Payment',
  shipping: 'Shipping / Incoterms',
  customs_clearance: 'Customs Clearance',
  dispatch: 'Dispatch / Shipping',
  grn: 'Goods Received Note',
  putaway: 'Putaway & Invoice',
  sales_invoice: 'Sales Invoice',
  payment_receipt: 'Payment Receipt',
  write_off: 'Write-Off / Expiry',
  cancellation: 'Cancellation',
};

/** UI-side mirror of backend `ALLOWED_FROM` for gating stage buttons. */
export const DOC_ALLOWED_FROM: Record<StockDocType, StockStatus[]> = {
  inquiry: ['inquiry_sent'],
  quotation: ['inquiry_sent'],
  po: ['quotation_received', 'ordered'],
  vendor_invoice: ['quotation_approved'],
  payment: ['invoice_received'],
  shipping: ['payment_processed'],
  customs_clearance: ['shipped', 'in_transit'],
  dispatch: ['quotation_approved', 'ordered'],
  grn: ['customs_cleared', 'in_transit'],
  putaway: ['received'],
  sales_invoice: ['in_warehouse'],
  payment_receipt: ['sold_out'],
  write_off: [
    'inquiry_sent',
    'quotation_received',
    'quotation_approved',
    'invoice_received',
    'payment_processed',
    'shipped',
    'customs_cleared',
    'ordered',
    'in_transit',
    'received',
    'in_warehouse',
  ],
  cancellation: [
    'inquiry_sent',
    'quotation_received',
    'quotation_approved',
    'invoice_received',
    'payment_processed',
    'shipped',
    'customs_cleared',
    'ordered',
    'in_transit',
  ],
};

/**
 * Roles allowed to run each stage. admin/manager always allowed (see canRunStage).
 * Mirrors backend `STAGE_ROLES`.
 */
export const STAGE_ROLES: Record<StockDocType, RoleCode[]> = {
  inquiry: ['employee'],
  quotation: ['employee'],
  po: ['employee'],
  vendor_invoice: ['employee'],
  payment: ['employee'],
  shipping: ['employee', 'warehouse'],
  customs_clearance: ['employee', 'warehouse'],
  dispatch: ['warehouse'],
  grn: ['warehouse'],
  putaway: ['warehouse'],
  sales_invoice: ['sales'],
  payment_receipt: ['sales', 'employee'],
  write_off: [],
  cancellation: [],
};

export const STOCK_SUPER_ROLES: RoleCode[] = ['admin', 'manager'];

export function canRunStage(role: RoleCode | null | undefined, docType: StockDocType) {
  if (!role) return false;
  if (STOCK_SUPER_ROLES.includes(role)) return true;
  return STAGE_ROLES[docType].includes(role);
}

export interface StockDocument {
  id: string;
  stock_id: string;
  doc_type: StockDocType;
  doc_number: string;
  payload: Record<string, unknown> | null;
  total_amount: string | null;
  currency_code: string | null;
  generated_at: string;
  generated_by: string | null;
}

/** Files may be attached at any lifecycle stage (or generally to the stock row). */
export type StockAttachmentStage = StockDocType | 'general';

export const STOCK_ATTACHMENT_STAGES: StockAttachmentStage[] = ['general', ...STOCK_DOC_TYPES];

export const STOCK_ATTACHMENT_STAGE_LABEL: Record<StockAttachmentStage, string> = {
  general: 'General / Other',
  ...STOCK_DOC_LABEL,
};

export interface StockAttachment {
  id: string;
  stock_id: string;
  stage: StockAttachmentStage;
  stock_document_id: string | null;
  file_name: string;
  mime_type: string;
  size: number;
  reference_no: string | null;
  notes: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

/** "10,000.00 SAR" — never render a bare amount without its currency. */
export function formatMoney(amount: string | number | null | undefined, currency?: string | null) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

export interface ProductHistoryEntry {
  id: string;
  product_id: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { from: unknown; to: unknown }> | null;
  snapshot: Record<string, unknown> | null;
  changed_at: string;
  changed_by: string | null;
}
