import type { StockDocType } from './stock-document.entity';
import type { StockStatus } from './stock.entity';
import type { RoleCode } from '../master-data/role.entity';

/**
 * Roles allowed to generate each document type.
 * `admin` and `manager` implicitly get access to everything (enforced in the guard).
 */
export const STAGE_ROLES: Record<StockDocType, RoleCode[]> = {
  po: ['employee'],
  dispatch: ['warehouse'],
  grn: ['warehouse'],
  putaway: ['warehouse'],
  sales_invoice: ['sales'],
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
  po: 'ordered',
  dispatch: 'in_transit',
  grn: 'received',
  putaway: 'in_warehouse',
  sales_invoice: 'sold_out',
  write_off: 'expired',
  cancellation: 'cancelled',
};

/**
 * Allowed current statuses for generating each document type.
 * Guards out-of-order transitions (e.g. GRN before dispatch).
 */
export const ALLOWED_FROM: Record<StockDocType, StockStatus[]> = {
  po: ['ordered'], // auto-generated at creation only
  dispatch: ['ordered'],
  grn: ['in_transit'],
  putaway: ['received'],
  sales_invoice: ['in_warehouse'],
  write_off: ['ordered', 'in_transit', 'received', 'in_warehouse'],
  cancellation: ['ordered', 'in_transit'],
};

export const DOC_TYPE_LABEL: Record<StockDocType, string> = {
  po: 'Purchase Order',
  dispatch: 'Dispatch / Shipping Advice',
  grn: 'Goods Received Note',
  putaway: 'Putaway & Invoice Match',
  sales_invoice: 'Sales Invoice',
  write_off: 'Stock Write-Off',
  cancellation: 'Cancellation Voucher',
};

export const DOC_TYPE_PREFIX: Record<StockDocType, string> = {
  po: 'PO',
  dispatch: 'DN',
  grn: 'GRN',
  putaway: 'PA',
  sales_invoice: 'INV',
  write_off: 'WO',
  cancellation: 'CN',
};
