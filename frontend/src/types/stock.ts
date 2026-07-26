import type { Paginated, RoleCode } from './product';

export type StockStatus =
  | 'ordered'
  | 'in_transit'
  | 'received'
  | 'in_warehouse'
  | 'sold_out'
  | 'expired'
  | 'cancelled';

export const STOCK_STATUSES: StockStatus[] = [
  'ordered',
  'in_transit',
  'received',
  'in_warehouse',
  'sold_out',
  'expired',
  'cancelled',
];

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ordered: 'Ordered',
  in_transit: 'On the way to warehouse',
  received: 'Received',
  in_warehouse: 'In warehouse',
  sold_out: 'Sold out',
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
  vendor_id?: string;
  vendor_name?: string;
  batch_no?: string;
  manufacture_date?: string;
  expiry_date?: string;
  ordered_at?: string;
  notes?: string;
}

export type StockPage = Paginated<Stock>;

export type StockDocType =
  | 'po'
  | 'dispatch'
  | 'grn'
  | 'putaway'
  | 'sales_invoice'
  | 'write_off'
  | 'cancellation';

export const STOCK_DOC_TYPES: StockDocType[] = [
  'po',
  'dispatch',
  'grn',
  'putaway',
  'sales_invoice',
  'write_off',
  'cancellation',
];

export const STOCK_DOC_LABEL: Record<StockDocType, string> = {
  po: 'Purchase Order',
  dispatch: 'Dispatch / Shipping',
  grn: 'Goods Received Note',
  putaway: 'Putaway & Invoice',
  sales_invoice: 'Sales Invoice',
  write_off: 'Write-Off / Expiry',
  cancellation: 'Cancellation',
};

/** UI-side mirror of backend `ALLOWED_FROM` for gating stage buttons. */
export const DOC_ALLOWED_FROM: Record<StockDocType, StockStatus[]> = {
  po: ['ordered'],
  dispatch: ['ordered'],
  grn: ['in_transit'],
  putaway: ['received'],
  sales_invoice: ['in_warehouse'],
  write_off: ['ordered', 'in_transit', 'received', 'in_warehouse'],
  cancellation: ['ordered', 'in_transit'],
};

/**
 * Roles allowed to run each stage. admin/manager always allowed (see canRunStage).
 * Mirrors backend `STAGE_ROLES`.
 */
export const STAGE_ROLES: Record<StockDocType, RoleCode[]> = {
  po: ['employee'],
  dispatch: ['warehouse'],
  grn: ['warehouse'],
  putaway: ['warehouse'],
  sales_invoice: ['sales'],
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
  generated_at: string;
  generated_by: string | null;
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
