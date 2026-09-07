export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'cancelled';

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  'draft',
  'confirmed',
  'delivered',
  'invoiced',
  'paid',
  'cancelled',
];

export const SALES_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export const SALES_STATUS_TONE: Record<SalesOrderStatus, string> = {
  draft: 'bg-paper-warm text-brown-600 border-brown-200',
  confirmed: 'bg-gold-50 text-ink border-gold-200',
  delivered: 'bg-gold-50 text-ink border-gold-200',
  invoiced: 'bg-forest-50 text-forest-500 border-forest-100',
  paid: 'bg-forest-50 text-forest-500 border-forest-100',
  cancelled: 'bg-brown-50 text-brown-600 border-brown-200',
};

/** Mirrors the backend forward-only machine. */
export const SALES_ALLOWED_FROM: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: [],
  confirmed: ['draft'],
  delivered: ['confirmed'],
  invoiced: ['delivered', 'confirmed'],
  paid: ['invoiced'],
  cancelled: ['draft', 'confirmed'],
};

export function nextSalesStatuses(current: SalesOrderStatus): SalesOrderStatus[] {
  return SALES_ORDER_STATUSES.filter((s) => SALES_ALLOWED_FROM[s].includes(current));
}

export interface SalesOrderItem {
  id: string;
  product_id: string;
  stock_id: string | null;
  product_code: string | null;
  description: string | null;
  qty: string;
  uom_id: string | null;
  uom_code: string | null;
  unit_price: string;
  unit_cost_snapshot: string;
  discount_amount: string;
  line_total: string;
}

export type SalesPaymentMethod = 'cash' | 'bank_transfer' | 'credit';
export const SALES_PAYMENT_METHODS: SalesPaymentMethod[] = ['cash', 'bank_transfer', 'credit'];
export const SALES_PAYMENT_METHOD_LABEL: Record<SalesPaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  credit: 'Credit',
};

export type SalesPaymentStatus = 'pending' | 'received' | 'not_received' | 'cancelled';
export const SALES_PAYMENT_STATUS_LABEL: Record<SalesPaymentStatus, string> = {
  pending: 'Pending payment',
  received: 'Received',
  not_received: 'Not received',
  cancelled: 'Cancelled',
};
export const SALES_PAYMENT_STATUS_TONE: Record<SalesPaymentStatus, string> = {
  pending: 'bg-gold-50 text-ink border-gold-200',
  received: 'bg-forest-50 text-forest-500 border-forest-100',
  not_received: 'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-brown-50 text-brown-600 border-brown-200',
};

export interface SalesPayment {
  id: string;
  order_id: string;
  amount: string;
  method: SalesPaymentMethod;
  status: SalesPaymentStatus;
  proof_doc_no: string | null;
  proof_file_name: string | null;
  proof_file_data?: string | null;
  has_proof_file?: boolean;
  bank_reference: string | null;
  credit_reference: string | null;
  credit_days: number | null;
  expected_date: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SalesPaymentInput {
  amount: number;
  method: SalesPaymentMethod;
  proof_doc_no?: string;
  proof_file_name?: string;
  proof_file_data?: string;
  bank_reference?: string;
  credit_reference?: string;
  credit_days?: number;
  expected_date?: string;
  note?: string;
}

export type SalesPaymentState = 'settled' | 'credit_pending' | 'not_received';
export const SALES_PAYMENT_STATE_LABEL: Record<SalesPaymentState, string> = {
  settled: 'Settled',
  credit_pending: 'Credit — pending payment',
  not_received: 'Not received',
};

export type SalesCommissionStatus = 'pending' | 'partial' | 'earned' | 'cancelled';
export const SALES_COMMISSION_STATUS_LABEL: Record<SalesCommissionStatus, string> = {
  pending: 'Commission pending — cash not received',
  partial: 'Commission partly earned',
  earned: 'Commission earned',
  cancelled: 'No commission — cancelled',
};

export interface SalesOrder {
  id: string;
  order_no: string;
  customer_id: string;
  customer_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: SalesOrderStatus;
  currency_code: string | null;
  currency_symbol: string | null;
  subtotal: string;
  discount_amount: string;
  vat_rate: string;
  vat_amount: string;
  total_amount: string;
  amount_paid: string;
  outstanding_amount: string;
  invoice_no: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  salesperson_id: string | null;
  profit_amount: string;
  commission_percent: string;
  commission_amount: string;
  commission_earned_amount: string;
  commission_status: SalesCommissionStatus;
  items: SalesOrderItem[];
  payments: SalesPayment[];
  payment_state: SalesPaymentState;
  credit_pending_amount: string;
  credit_not_received_amount: string;
  credit_due_date: string | null;
  high_priority: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface SalesOrderItemInput {
  product_id: string;
  qty: number;
  unit_price?: number;
  discount_amount?: number;
  uom_id?: string;
  stock_id?: string;
}

export interface SalesOrderInput {
  customer_id: string;
  order_date?: string;
  expected_delivery_date?: string;
  currency_code?: string;
  vat_rate?: number;
  notes?: string;
  salesperson_id?: string;
  commission_percent?: number;
  items: SalesOrderItemInput[];
}

export type SalesDocType = 'delivery_order' | 'sales_invoice';

export const SALES_DOC_LABEL: Record<SalesDocType, string> = {
  delivery_order: 'Delivery order',
  sales_invoice: 'Sales invoice',
};

export interface SalesDocument {
  id: string;
  doc_no: string;
  doc_type: SalesDocType;
  order_id: string;
  issued_at: string;
  issued_by: string | null;
}
