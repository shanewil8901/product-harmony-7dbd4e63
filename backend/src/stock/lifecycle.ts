import type { StockDocType } from './stock-document.entity';
import type { StockStatus } from './stock.entity';
import type { RoleCode } from '../master-data/role.entity';

/**
 * Roles allowed to generate each document type.
 * `admin` and `manager` implicitly get access to everything (enforced in the guard).
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
  write_off: [], // admin/manager only
  cancellation: [], // admin/manager only
};

/** Roles that can always do anything within stock lifecycle. */
export const SUPER_ROLES: RoleCode[] = ['admin', 'manager'];

export function canRunStage(role: RoleCode | null | undefined, docType: StockDocType) {
  if (!role) return false;
  if (SUPER_ROLES.includes(role)) return true;
  return STAGE_ROLES[docType].includes(role);
}


/** Which status a stock row moves to after each document is generated. */
export const DOC_TYPE_TO_STATUS: Record<StockDocType, StockStatus> = {
  inquiry: 'inquiry_sent',
  quotation: 'quotation_received',
  po: 'quotation_approved',
  vendor_invoice: 'invoice_received',
  payment: 'payment_processed',
  shipping: 'shipped',
  customs_clearance: 'customs_cleared',
  dispatch: 'in_transit',
  grn: 'received',
  putaway: 'in_warehouse',
  sales_invoice: 'sold_out',
  payment_receipt: 'settled',
  write_off: 'expired',
  cancellation: 'cancelled',
};

/**
 * Allowed current statuses for generating each document type.
 * Enforces strict sequential procurement lifecycle:
 * inquiry → quotation → PO → vendor invoice → payment → shipping → customs → GRN → putaway → sales invoice → payment receipt.
 * Legacy `ordered` / `in_transit` statuses remain acceptable inputs for backward compatibility
 * with existing stock rows that predate this expansion.
 */
export const ALLOWED_FROM: Record<StockDocType, StockStatus[]> = {
  inquiry: ['inquiry_sent'], // auto-generated at creation only
  quotation: ['inquiry_sent'],
  po: ['quotation_received', 'ordered'],
  vendor_invoice: ['quotation_approved'],
  payment: ['invoice_received'],
  shipping: ['payment_processed'],
  customs_clearance: ['shipped', 'in_transit'],
  dispatch: ['quotation_approved', 'ordered'], // legacy path
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

export const DOC_TYPE_LABEL: Record<StockDocType, string> = {
  inquiry: 'Inquiry',
  quotation: 'Vendor Quotation',
  po: 'Purchase Order',
  vendor_invoice: 'Vendor Invoice',
  payment: 'Payment',
  shipping: 'Shipping / Incoterms',
  customs_clearance: 'Customs Clearance',
  dispatch: 'Dispatch / Shipping Advice',
  grn: 'Goods Received Note',
  putaway: 'Putaway & Invoice Match',
  sales_invoice: 'Sales Invoice',
  payment_receipt: 'Payment Receipt',
  write_off: 'Stock Write-Off',
  cancellation: 'Cancellation Voucher',
};

export const DOC_TYPE_PREFIX: Record<StockDocType, string> = {
  inquiry: 'INQ',
  quotation: 'QUO',
  po: 'PO',
  vendor_invoice: 'VINV',
  payment: 'PAY',
  shipping: 'SHP',
  customs_clearance: 'CUS',
  dispatch: 'DN',
  grn: 'GRN',
  putaway: 'PA',
  sales_invoice: 'INV',
  payment_receipt: 'RCP',
  write_off: 'WO',
  cancellation: 'CN',
};
