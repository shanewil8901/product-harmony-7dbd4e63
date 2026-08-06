import { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardOverview } from '../types/dashboard';
import { STOCK_STATUS_LABEL, formatMoney } from '../types/stock';
import type { StockStatus } from '../types/stock';
import { BarChart, CHART_COLORS, ChartCard, DonutChart, HBarChart, LineChart } from '../components/Charts';

const PERIODS = [7, 30, 90, 365];

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('');

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

      {/* KPI strip — single numbers belong on cards, not in a chart */}
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

        <ChartCard title="Daily operations" subtitle={`Stock lines created, documents issued and sales invoices — last ${days} days`}>
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
            data={data.products_by_department
              .slice(0, 6)
              .map((d) => ({ label: d.label, value: d.count }))}
          />
        </ChartCard>
      </div>

      {/* Tables — precise, multi-column, per-row data */}
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
      </div>
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
