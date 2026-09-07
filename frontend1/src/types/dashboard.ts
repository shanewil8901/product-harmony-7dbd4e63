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
  sales: {
    kpis: {
      orders_total: number;
      orders_period: number;
      orders_open: number;
      orders_cancelled: number;
      customers_total: number;
      customers_active: number;
      customers_buying: number;
      avg_order_value: number;
      gross_margin: number;
      revenue_by_currency: {
        currency_code: string;
        revenue: number;
        collected: number;
        outstanding: number;
        orders: number;
      }[];
    };
    status_breakdown: { status: string; count: number }[];
    monthly: { month: string; label: string; orders: number; revenue: number; collected: number }[];
    daily: { date: string; label: string; orders: number; revenue: number }[];
    top_customers: {
      customer_id: string;
      customer_code: string | null;
      customer_name: string;
      orders: number;
      revenue: number;
      collected: number;
      outstanding: number;
      currency_code: string;
      last_order_at: string | null;
    }[];
    best_sellers: {
      product_id: string;
      product_code: string | null;
      description: string | null;
      qty: number;
      revenue: number;
      margin: number;
      orders: number;
    }[];
    recent_orders: {
      id: string;
      order_no: string;
      customer_name: string;
      status: string;
      order_date: string;
      total_amount: number;
      outstanding: number;
      currency_code: string;
    }[];
  };
  hr: DashboardHr;
}

/** People analytics returned under `hr` by GET /dashboard/overview. */
export interface DashboardHr {
  kpis: {
    headcount: number;
    active_employees: number;
    present_today: number;
    absent_today: number;
    late_today: number;
    on_leave_today: number;
    attendance_rate: number;
    pending_leave: number;
    records_period: number;
  };
  daily_attendance: {
    date: string;
    label: string;
    present: number;
    absent: number;
    leave: number;
    late: number;
  }[];
  attendance_records: {
    name: string;
    present: number;
    absent: number;
    late: number;
    leave: number;
    rate: number;
  }[];
  leave_by_type: { label: string; count: number }[];
  pending_leave_requests: {
    id: string;
    employee_name: string;
    leave_type: string;
    from_date: string;
    to_date: string;
    days: number;
    status: string;
  }[];
  upcoming_leave: {
    id: string;
    employee_name: string;
    leave_type: string;
    from_date: string;
    to_date: string;
    days: number;
  }[];
  headcount_by_department: { label: string; count: number }[];
  payroll: {
    period: string;
    generated_this_period: number;
    pending_generation: number;
    draft: number;
    approved: number;
    paid: number;
    pending_amount: number;
    paid_amount: number;
    monthly_salary_cost: number;
  };
}
