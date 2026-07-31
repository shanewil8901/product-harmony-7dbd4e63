export interface CurrencyValue {
  currency_code: string;
  on_hand_value: number;
  pipeline_value: number;
  lines: number;
}

export interface DashboardOverview {
  generated_at: string;
  period_days: number;
  kpis: {
    products: number;
    stock_lines_open: number;
    stock_lines_on_hand: number;
    vendors_active: number;
    vendors_total: number;
    users: number;
    documents_period: number;
    new_stock_lines_period: number;
    expiry_risk_lines: number;
    cancelled_lines: number;
    inventory_value: CurrencyValue[];
  };
  pipeline: { status: string; count: number }[];
  monthly_procurement: {
    month: string;
    label: string;
    lines: number;
    qty: number;
    by_currency: Record<string, number>;
  }[];
  daily_activity: { date: string; label: string; created: number; documents: number; sold: number }[];
  fastest_moving: {
    stock_id: string;
    product_code: string | null;
    product_description: string | null;
    batch_no: string | null;
    vendor_name: string | null;
    qty: number;
    uom: string | null;
    sold_at: string;
    days_to_sell: number;
    value: number;
    currency_code: string;
  }[];
  top_products: {
    product_id: string;
    product_code: string | null;
    description: string | null;
    department: string | null;
    lines: number;
    qty: number;
    value: number;
    currency_code: string;
    sold_lines: number;
    margin: number;
  }[];
  top_vendors: {
    vendor_id: string | null;
    vendor_name: string;
    lines: number;
    value: number;
    currency_code: string;
    delivered: number;
    cancelled: number;
    fulfilment_rate: number;
    avg_lead_days: number | null;
  }[];
  active_users: {
    user: string;
    name: string;
    role: string | null;
    total: number;
    creates: number;
    updates: number;
    documents: number;
    attachments: number;
    last_at: string;
  }[];
  expiry_buckets: { expired: number; d30: number; d60: number; d90: number };
  near_expiry: {
    stock_id: string;
    product_code: string | null;
    product_description: string | null;
    batch_no: string | null;
    vendor_name: string | null;
    qty: number;
    uom: string | null;
    expiry_date: string | null;
    days_left: number;
    status: string;
    value_at_risk: number;
    currency_code: string;
  }[];
  stock_ageing: { label: string; lines: number; value: number }[];
  products_by_department: { label: string; count: number }[];
  stage_durations: { transition: string; avg_days: number; samples: number }[];
}
