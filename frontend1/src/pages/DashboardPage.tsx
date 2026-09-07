import { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardOverview } from '../types/dashboard';
import { STOCK_STATUS_LABEL, formatMoney } from '../types/stock';
import type { StockStatus } from '../types/stock';
import { BarChart, CHART_COLORS, ChartCard, DonutChart, HBarChart, LineChart } from '../components/Charts';
import { usePermissions } from '../hooks/usePermissions';

const PERIODS = [7, 30, 90, 365];

type TabKey = 'general' | 'inventory' | 'sales' | 'employees';

const TAB_LABEL: Record<TabKey, string> = {
  general: 'General',
  inventory: 'Inventory',
  sales: 'Sales',
  employees: 'Employees',
};

export function DashboardPage() {
  const { canViewGeneralTab, canViewEmployeesTab, canViewConfidentialHr, role } = usePermissions();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('');

  // Tabs available to this role: warehouse / sales staff never see General,
  // and only admin / manager / supervisor see the Employees tab.
  const tabs: TabKey[] = useMemo(() => {
    const t: TabKey[] = [];
    if (canViewGeneralTab) t.push('general');
    t.push('inventory', 'sales');
    if (canViewEmployeesTab) t.push('employees');
    return t;
  }, [canViewGeneralTab, canViewEmployeesTab]);

  const [tab, setTab] = useState<TabKey>(tabs[0] ?? 'inventory');
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? 'inventory');
  }, [tabs, tab]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    dashboardService
      .overview(days)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    data?.monthly_procurement.forEach((m) => Object.keys(m.by_currency).forEach((c) => set.add(c)));
    data?.kpis.inventory_value.forEach((v) => set.add(v.currency_code));
    return [...set];
  }, [data]);

  const activeCurrency = currency || currencies[0] || '';

  if (loading && !data) return <p className="text-sm text-brown-500">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const k = data.kpis;
  const hr = data.hr;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Dashboard</h1>
          <p className="text-sm text-brown-500">
            Procurement, inventory and team analytics · rolling {days}-day window
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {currencies.length > 1 && (
            <div>
              <label className="label">Currency</label>
              <select className="input" value={activeCurrency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex rounded-lg border border-brown-100 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`px-3 py-2 text-sm ${
                  days === p ? 'bg-forest-50 text-forest-500 font-medium' : 'text-ink-muted hover:bg-paper-warm'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-paper-warm p-1.5">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`rounded-lg px-5 py-2.5 text-base transition-colors ${
              tab === t
                ? 'bg-brown-600 font-bold text-paper shadow-card'
                : 'font-medium text-brown-500 hover:bg-brown-50 hover:text-brown-600'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>


      {/* ---------------- GENERAL ---------------- */}
      {tab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Products" value={k.products} />
            <Kpi
              label={`Inventory on hand (${activeCurrency || '—'})`}
              value={formatMoney(
                k.inventory_value.find((v) => v.currency_code === activeCurrency)?.on_hand_value ?? 0,
                activeCurrency,
              )}
              hint="Qty × cost price"
            />
            <Kpi label="Open stock lines" value={k.stock_lines_open} hint={`${k.stock_lines_on_hand} in warehouse`} />
            <Kpi
              label="Revenue billed"
              value={
                data.sales.kpis.revenue_by_currency
                  .map((r) => formatMoney(r.revenue, r.currency_code))
                  .join(' · ') || '—'
              }
              hint={`${data.sales.kpis.orders_period} orders in ${days}d`}
            />
            <Kpi
              label="Outstanding"
              tone="warn"
              value={
                data.sales.kpis.revenue_by_currency
                  .map((r) => formatMoney(r.outstanding, r.currency_code))
                  .join(' · ') || '—'
              }
            />
            <Kpi
              label="Headcount"
              value={hr.kpis.active_employees}
              hint={`${hr.kpis.present_today} present today`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Revenue trend" subtitle="Billed vs collected per month">
              <LineChart
                labels={data.sales.monthly.map((m) => m.label)}
                series={[
                  { name: 'Billed', color: CHART_COLORS[0], points: data.sales.monthly.map((m) => m.revenue) },
                  { name: 'Collected', color: CHART_COLORS[1], points: data.sales.monthly.map((m) => m.collected) },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Procurement value by month"
              subtitle={`Cost value of stock ordered per month · ${activeCurrency || '—'}`}
            >
              <BarChart
                data={data.monthly_procurement.map((m) => ({
                  label: m.label.slice(0, 3),
                  value: m.by_currency[activeCurrency] ?? 0,
                }))}
                color={CHART_COLORS[0]}
              />
            </ChartCard>

            <ChartCard title="Procurement pipeline" subtitle="Where every stock line currently sits">
              <HBarChart
                data={data.pipeline
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((p) => ({
                    label: STOCK_STATUS_LABEL[p.status as StockStatus] ?? p.status,
                    value: p.count,
                  }))}
              />
            </ChartCard>

            <ChartCard title="Expiry risk" subtitle="Open lines by remaining shelf life">
              <DonutChart
                data={[
                  { label: 'Already expired', value: data.expiry_buckets.expired },
                  { label: '≤ 30 days', value: data.expiry_buckets.d30 },
                  { label: '31–60 days', value: data.expiry_buckets.d60 },
                  { label: '61–90 days', value: data.expiry_buckets.d90 },
                ].filter((d) => d.value > 0)}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Top customers" subtitle="By billed revenue">
              <Table
                head={['Customer', 'Orders', 'Revenue', 'Outstanding']}
                rows={data.sales.top_customers.slice(0, 5).map((c) => [
                  <span key="c" className="font-medium text-ink">
                    {c.customer_name}
                  </span>,
                  c.orders,
                  formatMoney(c.revenue, c.currency_code),
                  formatMoney(c.outstanding, c.currency_code),
                ])}
              />
            </ChartCard>
            <ChartCard title="Most effective vendors" subtitle="Spend and fulfilment rate">
              <Table
                head={['Vendor', 'Lines', 'Spend', 'Fulfilled']}
                rows={data.top_vendors.slice(0, 5).map((v) => [
                  <span key="v" className="font-medium text-ink">
                    {v.vendor_name}
                  </span>,
                  v.lines,
                  formatMoney(v.value, v.currency_code),
                  `${v.fulfilment_rate}%`,
                ])}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {/* ---------------- INVENTORY ---------------- */}
      {tab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Products" value={k.products} />
            <Kpi label="Open stock lines" value={k.stock_lines_open} hint={`${k.stock_lines_on_hand} in warehouse`} />
            <Kpi
              label={`Inventory on hand (${activeCurrency || '—'})`}
              value={formatMoney(
                k.inventory_value.find((v) => v.currency_code === activeCurrency)?.on_hand_value ?? 0,
                activeCurrency,
              )}
              hint="Qty × cost price"
            />
            <Kpi label="Active vendors" value={k.vendors_active} hint={`${k.vendors_total} registered`} />
            <Kpi label={`Documents (${days}d)`} value={k.documents_period} hint={`${k.new_stock_lines_period} new lines`} />
            <Kpi label="Expiry risk lines" value={k.expiry_risk_lines} hint="≤ 90 days" tone="warn" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Procurement value by month"
              subtitle={`Cost value of stock ordered per month · ${activeCurrency || '—'}`}
            >
              <BarChart
                data={data.monthly_procurement.map((m) => ({
                  label: m.label.slice(0, 3),
                  value: m.by_currency[activeCurrency] ?? 0,
                }))}
                color={CHART_COLORS[0]}
              />
            </ChartCard>

            <ChartCard title="Daily operations" subtitle={`Stock lines, documents and invoices — last ${days} days`}>
              <LineChart
                labels={data.daily_activity.map((d) => d.label)}
                series={[
                  { name: 'Documents', color: CHART_COLORS[1], points: data.daily_activity.map((d) => d.documents) },
                  { name: 'New stock lines', color: CHART_COLORS[0], points: data.daily_activity.map((d) => d.created) },
                  { name: 'Sold (sales invoices)', color: CHART_COLORS[2], points: data.daily_activity.map((d) => d.sold) },
                ]}
              />
            </ChartCard>

            <ChartCard title="Procurement pipeline" subtitle="Where every stock line currently sits in the 11-stage lifecycle">
              <HBarChart
                data={data.pipeline
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((p) => ({
                    label: STOCK_STATUS_LABEL[p.status as StockStatus] ?? p.status,
                    value: p.count,
                  }))}
              />
            </ChartCard>

            <ChartCard title="Stock ageing" subtitle="Open lines by age since creation — spot slow-moving capital">
              <BarChart data={data.stock_ageing.map((b) => ({ label: b.label, value: b.lines }))} color={CHART_COLORS[2]} />
            </ChartCard>

            <ChartCard title="Expiry risk" subtitle="Open lines by remaining shelf life">
              <DonutChart
                data={[
                  { label: 'Already expired', value: data.expiry_buckets.expired },
                  { label: '≤ 30 days', value: data.expiry_buckets.d30 },
                  { label: '31–60 days', value: data.expiry_buckets.d60 },
                  { label: '61–90 days', value: data.expiry_buckets.d90 },
                ].filter((d) => d.value > 0)}
              />
            </ChartCard>

            <ChartCard title="Products by department" subtitle="Catalogue composition">
              <DonutChart
                data={data.products_by_department.slice(0, 6).map((d) => ({ label: d.label, value: d.count }))}
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Most important products" subtitle="Ranked by procured cost value">
              <Table
                head={['Product', 'Lines', 'Qty', 'Value', 'Sold']}
                rows={data.top_products.map((p) => [
                  <span key="p">
                    <span className="font-medium text-ink">{p.product_code ?? '—'}</span>
                    <span className="block text-xs text-brown-500 truncate max-w-[220px]">{p.description}</span>
                  </span>,
                  p.lines,
                  p.qty,
                  formatMoney(p.value, p.currency_code),
                  p.sold_lines,
                ])}
              />
            </ChartCard>

            <ChartCard title="Most effective vendors" subtitle="Spend, fulfilment rate and average lead time (PO → GRN)">
              <Table
                head={['Vendor', 'Lines', 'Spend', 'Fulfilled', 'Avg lead']}
                rows={data.top_vendors.map((v) => [
                  <span key="v" className="font-medium text-ink">
                    {v.vendor_name}
                  </span>,
                  v.lines,
                  formatMoney(v.value, v.currency_code),
                  `${v.fulfilment_rate}%`,
                  v.avg_lead_days === null ? '—' : `${v.avg_lead_days} d`,
                ])}
              />
            </ChartCard>

            <ChartCard title="Fastest-selling stock" subtitle="Shortest time from stock creation to sales invoice">
              <Table
                head={['Product', 'Batch', 'Qty', 'Days to sell', 'Value']}
                rows={data.fastest_moving.map((f) => [
                  <span key="f" className="font-medium text-ink">
                    {f.product_code ?? '—'}
                  </span>,
                  f.batch_no ?? '—',
                  `${f.qty}${f.uom ? ` ${f.uom}` : ''}`,
                  `${f.days_to_sell} d`,
                  formatMoney(f.value, f.currency_code),
                ])}
              />
            </ChartCard>

            <ChartCard title="Stock nearing expiry" subtitle="Act first on the lines with the least shelf life">
              <Table
                head={['Product', 'Batch', 'Expiry', 'Days left', 'Value at risk']}
                rows={data.near_expiry.map((n) => [
                  <span key="n" className="font-medium text-ink">
                    {n.product_code ?? '—'}
                  </span>,
                  n.batch_no ?? '—',
                  n.expiry_date ?? '—',
                  <span key="d" className={n.days_left < 0 ? 'text-red-600 font-medium' : 'text-ink'}>
                    {n.days_left < 0 ? 'Expired' : `${n.days_left} d`}
                  </span>,
                  formatMoney(n.value_at_risk, n.currency_code),
                ])}
              />
            </ChartCard>

            <ChartCard title="Lifecycle bottlenecks" subtitle="Average days between consecutive procurement stages">
              <HBarChart
                data={data.stage_durations.slice(0, 8).map((s) => ({
                  label: s.transition.replace(/_/g, ' '),
                  value: s.avg_days,
                  color: CHART_COLORS[1],
                }))}
                valueSuffix=" d"
              />
            </ChartCard>

            {canViewGeneralTab && (
              <ChartCard title="Most active users" subtitle={`Audit-trail events in the last ${days} days`}>
                <Table
                  head={['User', 'Role', 'Events', 'Docs', 'Edits']}
                  rows={data.active_users.map((u) => [
                    <span key="u">
                      <span className="font-medium text-ink">{u.name}</span>
                      <span className="block text-xs text-brown-500">{u.user}</span>
                    </span>,
                    u.role ?? '—',
                    u.total,
                    u.documents,
                    u.updates,
                  ])}
                />
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SALES ---------------- */}
      {tab === 'sales' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Sales orders"
              value={data.sales.kpis.orders_total}
              hint={`${data.sales.kpis.orders_period} in the last ${days} days`}
            />
            <Kpi
              label="Open orders"
              value={data.sales.kpis.orders_open}
              hint={`${data.sales.kpis.orders_cancelled} cancelled`}
            />
            <Kpi
              label="Revenue billed"
              value={
                data.sales.kpis.revenue_by_currency
                  .map((r) => formatMoney(r.revenue, r.currency_code))
                  .join(' · ') || '—'
              }
              hint={`Avg order ${formatMoney(
                data.sales.kpis.avg_order_value,
                data.sales.kpis.revenue_by_currency[0]?.currency_code ?? 'SAR',
              )}`}
            />
            <Kpi
              label="Outstanding"
              tone="warn"
              value={
                data.sales.kpis.revenue_by_currency
                  .map((r) => formatMoney(r.outstanding, r.currency_code))
                  .join(' · ') || '—'
              }
              hint={`${data.sales.kpis.customers_buying} of ${data.sales.kpis.customers_active} active customers buying`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue trend" subtitle="Billed vs collected per month">
              <LineChart
                labels={data.sales.monthly.map((m) => m.label)}
                series={[
                  { name: 'Billed', color: CHART_COLORS[0], points: data.sales.monthly.map((m) => m.revenue) },
                  { name: 'Collected', color: CHART_COLORS[1], points: data.sales.monthly.map((m) => m.collected) },
                ]}
              />
            </ChartCard>

            <ChartCard title="Order status" subtitle="Where the sales pipeline sits today">
              <DonutChart
                data={data.sales.status_breakdown.map((s, i) => ({
                  label: s.status.replace(/_/g, ' '),
                  value: s.count,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
              />
            </ChartCard>

            <ChartCard title="Best sellers" subtitle="Products driving revenue and margin">
              <Table
                head={['Product', 'Qty sold', 'Revenue', 'Margin']}
                rows={data.sales.best_sellers.map((b) => [
                  <span key="b">
                    <span className="font-medium text-ink">{b.product_code ?? '—'}</span>
                    {b.description && <span className="block text-xs text-brown-500">{b.description}</span>}
                  </span>,
                  b.qty,
                  formatMoney(b.revenue),
                  formatMoney(b.margin),
                ])}
              />
            </ChartCard>

            <ChartCard title="Fastest-selling stock" subtitle="Shortest time from stock creation to sales invoice">
              <Table
                head={['Product', 'Batch', 'Qty', 'Days to sell']}
                rows={data.fastest_moving.map((f) => [
                  <span key="f" className="font-medium text-ink">
                    {f.product_code ?? '—'}
                  </span>,
                  f.batch_no ?? '—',
                  `${f.qty}${f.uom ? ` ${f.uom}` : ''}`,
                  `${f.days_to_sell} d`,
                ])}
              />
            </ChartCard>

            {/* Customer-level detail is not shown to warehouse staff. */}
            {role !== 'warehouse' && (
              <>
                <ChartCard title="Top customers" subtitle="By billed revenue">
                  <Table
                    head={['Customer', 'Orders', 'Revenue', 'Outstanding']}
                    rows={data.sales.top_customers.map((c) => [
                      <span key="c">
                        <span className="font-medium text-ink">{c.customer_name}</span>
                        {c.customer_code && <span className="block text-xs text-brown-500">{c.customer_code}</span>}
                      </span>,
                      c.orders,
                      formatMoney(c.revenue, c.currency_code),
                      formatMoney(c.outstanding, c.currency_code),
                    ])}
                  />
                </ChartCard>

                <ChartCard title="Recent sales orders" subtitle="Latest customer activity">
                  <Table
                    head={['Order', 'Customer', 'Status', 'Total', 'Outstanding']}
                    rows={data.sales.recent_orders.map((o) => [
                      <span key="o" className="font-medium text-ink">
                        {o.order_no}
                      </span>,
                      o.customer_name,
                      o.status,
                      formatMoney(o.total_amount, o.currency_code),
                      formatMoney(o.outstanding, o.currency_code),
                    ])}
                  />
                </ChartCard>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------- EMPLOYEES ---------------- */}
      {tab === 'employees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Headcount" value={hr.kpis.headcount} hint={`${hr.kpis.active_employees} active`} />
            <Kpi label="Present today" value={hr.kpis.present_today} hint={`${hr.kpis.late_today} late`} />
            <Kpi label="Absent today" value={hr.kpis.absent_today} tone="warn" />
            <Kpi label="On leave today" value={hr.kpis.on_leave_today} />
            <Kpi label={`Attendance rate (${days}d)`} value={`${hr.kpis.attendance_rate}%`} hint={`${hr.kpis.records_period} records`} />
            <Kpi label="Pending leave requests" value={hr.kpis.pending_leave} tone="warn" />
          </div>

          {canViewConfidentialHr && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label={`Payroll ${hr.payroll.period}`}
                value={`${hr.payroll.generated_this_period} payslips`}
                hint={`${hr.payroll.pending_generation} still to generate`}
              />
              <Kpi label="Pending salary payments" value={formatMoney(hr.payroll.pending_amount)} tone="warn" hint={`${hr.payroll.draft} draft · ${hr.payroll.approved} approved`} />
              <Kpi label="Paid this period" value={formatMoney(hr.payroll.paid_amount)} hint={`${hr.payroll.paid} payslips paid`} />
              <Kpi label="Monthly salary cost" value={formatMoney(hr.payroll.monthly_salary_cost)} hint="Basic + allowances" />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Daily attendance" subtitle={`Company-wide presence over the last ${days} days`}>
              <LineChart
                labels={hr.daily_attendance.map((d) => d.label)}
                series={[
                  { name: 'Present', color: CHART_COLORS[0], points: hr.daily_attendance.map((d) => d.present) },
                  { name: 'Absent', color: CHART_COLORS[2], points: hr.daily_attendance.map((d) => d.absent) },
                  { name: 'On leave', color: CHART_COLORS[1], points: hr.daily_attendance.map((d) => d.leave) },
                ]}
              />
            </ChartCard>

            <ChartCard title="Leave by type" subtitle="Approved leave distribution">
              <DonutChart
                data={hr.leave_by_type.map((l) => ({ label: l.label.replace(/_/g, ' '), value: l.count }))}
              />
            </ChartCard>

            <ChartCard title="Attendance records" subtitle="Per-employee presence in the window">
              <Table
                head={['Employee', 'Present', 'Absent', 'Late', 'Rate']}
                rows={hr.attendance_records.map((a) => [
                  <span key="a" className="font-medium text-ink">
                    {a.name}
                  </span>,
                  a.present,
                  a.absent,
                  a.late,
                  `${a.rate}%`,
                ])}
              />
            </ChartCard>

            <ChartCard title="Members on leave" subtitle="Approved upcoming leave">
              <Table
                head={['Employee', 'Type', 'From', 'To', 'Days']}
                rows={hr.upcoming_leave.map((l) => [
                  <span key="l" className="font-medium text-ink">
                    {l.employee_name}
                  </span>,
                  l.leave_type.replace(/_/g, ' '),
                  l.from_date,
                  l.to_date,
                  l.days,
                ])}
              />
            </ChartCard>

            <ChartCard title="Pending leave approvals" subtitle="Awaiting supervisor or manager sign-off">
              <Table
                head={['Employee', 'Type', 'From', 'To', 'Status']}
                rows={hr.pending_leave_requests.map((l) => [
                  <span key="p" className="font-medium text-ink">
                    {l.employee_name}
                  </span>,
                  l.leave_type.replace(/_/g, ' '),
                  l.from_date,
                  l.to_date,
                  l.status.replace(/_/g, ' '),
                ])}
              />
            </ChartCard>

            {canViewConfidentialHr && (
              <ChartCard title="Headcount by department" subtitle="Active employees">
                <HBarChart
                  data={hr.headcount_by_department.map((d) => ({ label: d.label, value: d.count }))}
                />
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'warn';
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brown-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === 'warn' ? 'text-gold-600' : 'text-ink'}`}>{value}</div>
      {hint && <div className="text-xs text-brown-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length)
    return <p className="text-sm text-brown-500 py-6 text-center border border-dashed border-brown-100 rounded-lg">No data yet</p>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-brown-500 border-b border-brown-100">
            {head.map((h) => (
              <th key={h} className="py-2 px-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-brown-50 last:border-0 hover:bg-paper-soft">
              {r.map((c, j) => (
                <td key={j} className="py-2 px-2 align-top whitespace-nowrap text-ink-muted">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
