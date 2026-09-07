export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

export interface InventoryRow {
  product_id: string;
  product_code: string;
  description: string;
  product_barcode: string | null;
  department_name: string | null;
  vendor_name: string | null;
  uom_code: string | null;
  received_qty: string;
  incoming_qty: string;
  written_off_qty: string;
  sold_qty: string;
  adjusted_qty: string;
  returned_qty: string;
  reserved_qty: string;
  available_qty: string;
  avg_unit_cost: string;
  cost_currency: string | null;
  available_value: string;
  batches: number;
  last_movement_at: string | null;
  status: InventoryStatus;
}

export interface InventorySummary {
  products: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_available_qty: string;
  total_incoming_qty: string;
  value_by_currency: { currency_code: string; total_value: string }[];
}

export interface InventoryOverview {
  items: InventoryRow[];
  summary: InventorySummary;
  low_stock_threshold: number;
}

export interface InventoryMovement {
  id: string;
  kind: 'in' | 'out';
  date: string | null;
  reference: string;
  party: string | null;
  status: string;
  counts: boolean;
  qty: string;
  unit_value: string;
  currency_code: string | null;
}

export interface InventoryAdjustmentMovement {
  id: string;
  type: AdjustmentType;
  sign: 1 | -1;
  date: string | null;
  reference: string;
  party: string | null;
  reason: string | null;
  qty: string;
  created_by: string | null;
}

export interface InventoryMovements {
  product: { id: string; product_code: string; description: string; uom_code: string | null };
  inbound: InventoryMovement[];
  outbound: InventoryMovement[];
  adjustments: InventoryAdjustmentMovement[];
}

/* ---------------- vendor breakdown ---------------- */

export interface VendorInventoryRow {
  vendor_id: string | null;
  vendor_name: string;
  vendor_code: string | null;
  products: number;
  batches: number;
  received_qty: string;
  incoming_qty: string;
  returned_qty: string;
  low_stock_products: number;
  out_of_stock_products: number;
  last_movement_at: string | null;
  value_by_currency: { currency_code: string; total_value: string }[];
}

export interface VendorBreakdown {
  items: VendorInventoryRow[];
}

/* ---------------- low stock alerts ---------------- */

export interface InventoryAlertRow extends InventoryRow {
  severity: 'critical' | 'warning';
  suggested_reorder_qty: string;
}

export interface InventoryAlerts {
  items: InventoryAlertRow[];
  threshold: number;
  critical: number;
  warning: number;
  incoming_cover: number;
}

/* ---------------- stock adjustments ---------------- */

export type AdjustmentType =
  | 'customer_return'
  | 'vendor_return'
  | 'damage'
  | 'loss'
  | 'expiry'
  | 'found'
  | 'correction_increase'
  | 'correction_decrease';

export const ADJUSTMENT_TYPES: AdjustmentType[] = [
  'customer_return',
  'vendor_return',
  'damage',
  'loss',
  'expiry',
  'found',
  'correction_increase',
  'correction_decrease',
];

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  customer_return: 'Customer return (stock back in)',
  vendor_return: 'Return to vendor',
  damage: 'Damaged goods',
  loss: 'Lost / shrinkage',
  expiry: 'Expired write-off',
  found: 'Found during count',
  correction_increase: 'Count correction (+)',
  correction_decrease: 'Count correction (−)',
};

export const ADJUSTMENT_SIGN: Record<AdjustmentType, 1 | -1> = {
  customer_return: 1,
  found: 1,
  correction_increase: 1,
  vendor_return: -1,
  damage: -1,
  loss: -1,
  expiry: -1,
  correction_decrease: -1,
};

export interface StockAdjustment {
  id: string;
  product_id: string;
  stock_id: string | null;
  vendor_id: string | null;
  type: AdjustmentType;
  qty: string;
  signed_qty: string;
  sign: 1 | -1;
  reference_no: string | null;
  reason: string | null;
  adjusted_at: string;
  created_at: string;
  created_by: string | null;
  product_code: string | null;
  product_description: string | null;
  vendor_name: string | null;
  batch_no: string | null;
}

export interface StockAdjustmentInput {
  product_id: string;
  stock_id?: string;
  vendor_id?: string;
  type: AdjustmentType;
  qty: number;
  reference_no?: string;
  reason?: string;
  adjusted_at?: string;
}
