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

/**
 * Mandatory payload fields per lifecycle stage.
 * These are the reference/bill numbers and dates that a real procurement audit
 * trail cannot be missing — the document is rejected if any of them is blank.
 */
export const STAGE_REQUIRED_FIELDS: Record<StockDocType, { name: string; label: string }[]> = {
  inquiry: [],
  quotation: [
    { name: 'quote_no', label: 'Vendor quotation no.' },
    { name: 'quote_date', label: 'Quotation date' },
  ],
  po: [
    { name: 'batch_no', label: 'Batch number' },
    { name: 'manufacture_date', label: 'Manufacture date (MFD)' },
  ],
  vendor_invoice: [
    { name: 'invoice_no', label: 'Vendor invoice no.' },
    { name: 'invoice_date', label: 'Invoice date' },
  ],
  payment: [
    { name: 'payment_method', label: 'Payment method' },
    { name: 'reference_no', label: 'Reference / LC / Cheque no.' },
    { name: 'paid_at', label: 'Paid at' },
  ],
  shipping: [
    { name: 'incoterm', label: 'Incoterm' },
    { name: 'carrier', label: 'Carrier / Shipping line' },
    { name: 'awb_no', label: 'AWB / BL no.' },
  ],
  customs_clearance: [
    { name: 'clearance_ref', label: 'Customs clearance reference' },
    { name: 'port', label: 'Port of entry' },
  ],
  dispatch: [
    { name: 'carrier', label: 'Carrier' },
    { name: 'tracking_no', label: 'Tracking no.' },
  ],
  grn: [
    { name: 'received_qty', label: 'Received qty' },
    { name: 'received_at', label: 'Received at' },
  ],
  putaway: [
    { name: 'invoice_no', label: 'Supplier invoice no.' },
    { name: 'location', label: 'Warehouse location' },
  ],
  sales_invoice: [
    { name: 'invoice_no', label: 'Sales invoice no.' },
    { name: 'customer', label: 'Customer' },
    { name: 'sold_qty', label: 'Sold qty' },
  ],
  payment_receipt: [
    { name: 'receipt_no', label: 'Receipt no.' },
    { name: 'received_at', label: 'Received at' },
  ],
  write_off: [{ name: 'reason', label: 'Reason' }],
  cancellation: [{ name: 'reason', label: 'Reason' }],
};

/** Stages that must record a monetary total (amount + currency). */
export const STAGES_REQUIRING_AMOUNT: StockDocType[] = [
  'quotation',
  'po',
  'vendor_invoice',
  'payment',
  'sales_invoice',
  'payment_receipt',
];

/**
 * Linear order of the procurement pipeline. Used to enforce that a skip may
 * only ever jump FORWARD — the lifecycle can never be moved back a stage.
 */
export const STAGE_SEQUENCE: StockDocType[] = [
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
];

/** How far along the pipeline each status sits (index into STAGE_SEQUENCE). */
export const STATUS_PROGRESS: Record<StockStatus, number> = {
  inquiry_sent: 0,
  quotation_received: 1,
  quotation_approved: 2,
  invoice_received: 3,
  payment_processed: 4,
  shipped: 5,
  customs_cleared: 6,
  ordered: 2,
  in_transit: 7,
  received: 8,
  in_warehouse: 9,
  sold_out: 10,
  settled: 11,
  expired: 11,
  cancelled: 11,
};

/** Terminal documents are always permitted — they close the row, not rewind it. */
export function isForwardStage(docType: StockDocType, status: StockStatus) {
  if (docType === 'write_off' || docType === 'cancellation') return true;
  // The Inquiry is generated automatically the moment a stock row is created,
  // when the row already sits at "inquiry_sent" — that is not a rewind.
  if (docType === 'inquiry') return true;
  const target = STAGE_SEQUENCE.indexOf(docType);
  if (target < 0) return true;
  return target > STATUS_PROGRESS[status];
}
