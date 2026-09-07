import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "../components/Dialog";
import { inventoryService } from "../services/inventory.service";
import { usePermissions } from "../hooks/usePermissions";
import { StockAdjustmentModal } from "../components/StockAdjustmentModal";
import { toast } from "../lib/toast";
import type {
  InventoryAlerts,
  InventoryMovements,
  InventoryOverview,
  InventoryRow,
  InventoryStatus,
  StockAdjustment,
  VendorBreakdown,
} from "../types/inventory";
import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_LABEL,
  INVENTORY_STATUS_LABEL,
} from "../types/inventory";
import { formatMoney } from "../types/stock";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All products" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

type TabKey = "overview" | "vendors" | "alerts" | "adjustments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "vendors", label: "Vendor breakdown" },
  { key: "alerts", label: "Low stock alerts" },
  { key: "adjustments", label: "Adjustments" },
];

const qty = (v: string | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 });

export function InventoryPage() {
  const { confirm, dialog } = useConfirm();
  const { role } = usePermissions();
  const canAdjust = !!role && ["admin", "manager", "warehouse"].includes(role);
  const canVoid = !!role && ["admin", "manager"].includes(role);

  const [tab, setTab] = useState<TabKey>("overview");
  const [data, setData] = useState<InventoryOverview | null>(null);
  const [vendors, setVendors] = useState<VendorBreakdown | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  const [adjustments, setAdjustments] = useState<StockAdjustment[] | null>(null);
  const [adjType, setAdjType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<InventoryMovements | null>(null);
  const [detailFor, setDetailFor] = useState<InventoryRow | null>(null);
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "overview") {
        setData(await inventoryService.overview({ search: search || undefined, status }));
      } else if (tab === "vendors") {
        setVendors(await inventoryService.vendors({ search: search || undefined }));
      } else if (tab === "alerts") {
        setAlerts(await inventoryService.alerts());
      } else {
        const res = await inventoryService.adjustments({
          search: search || undefined,
          type: adjType,
        });
        setAdjustments(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [search, status, tab, adjType]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (row: InventoryRow) => {
    setDetailFor(row);
    setDetail(null);
    try {
      setDetail(await inventoryService.movements(row.product_id));
    } catch {
      setDetail(null);
    }
  };

  const voidAdjustment = async (id: string) => {
    const ok = await confirm({
      title: "Void adjustment",
      message: "Void this adjustment? The stock effect will be reversed.",
      confirmLabel: "Void",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await inventoryService.voidAdjustment(id);
      toast("success", "Adjustment voided");
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to void the adjustment");
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-ink">Inventory</h1>
          <p className="text-sm text-brown-500 mt-1">
            Live availability per product — received stock minus sold quantities, plus recorded
            adjustments. Levels are never entered directly.
          </p>
        </div>
        <div className="flex gap-2">
          {canAdjust && (
            <button
              className="btn-primary"
              onClick={() => {
                setAdjustFor(null);
                setAdjustOpen(true);
              }}
            >
              Record adjustment
            </button>
          )}
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-base transition-colors ${
              tab === t.key
                ? "bg-brown-600 font-bold text-white"
                : "bg-paper-warm text-brown-600 hover:bg-brown-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Products tracked" value={s ? String(s.products) : "—"} />
          <StatCard label="Available quantity" value={s ? qty(s.total_available_qty) : "—"} />
          <StatCard
            label="Incoming (not received)"
            value={s ? qty(s.total_incoming_qty) : "—"}
            tone="gold"
          />
          <StatCard
            label="Out of stock"
            value={s ? String(s.out_of_stock) : "—"}
            tone={s && s.out_of_stock > 0 ? "brick" : "default"}
          />
        </div>
      )}

      {tab === "overview" && s && s.value_by_currency.length > 0 && (
        <div className="card p-4">
          <div className="label mb-2">Stock value on hand (at cost)</div>
          <div className="flex flex-wrap gap-4">
            {s.value_by_currency.map((v) => (
              <div
                key={v.currency_code}
                className="rounded-lg border border-brown-100 bg-paper-warm px-3 py-2 text-sm font-semibold text-ink"
              >
                {formatMoney(v.total_value, v.currency_code)}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "alerts" && alerts && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Critical (out of stock)" value={String(alerts.critical)} tone="brick" />
          <StatCard label="Warning (low stock)" value={String(alerts.warning)} tone="gold" />
          <StatCard label="Covered by incoming" value={String(alerts.incoming_cover)} />
          <StatCard label="Threshold" value={String(alerts.threshold)} />
        </div>
      )}

      {tab !== "alerts" && (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="label">
                {tab === "vendors"
                  ? "Search by vendor name or code"
                  : "Search by product code, description or reference"}
              </label>
              <input
                className="input"
                placeholder="e.g. SKU-000123"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tab === "overview" && (
              <div className="sm:w-56">
                <label className="label">Availability</label>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {tab === "adjustments" && (
              <div className="sm:w-64">
                <label className="label">Adjustment type</label>
                <select
                  className="input"
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                >
                  <option value="all">All types</option>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ADJUSTMENT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-600">
          {error}
        </div>
      )}

      {tab === "overview" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[1150px]">
            <thead className="bg-paper-warm text-ink">
              <tr className="text-left">
                <th className="px-4 py-3 whitespace-nowrap">Product</th>
                <th className="px-4 py-3 whitespace-nowrap">Supplier</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Received</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Sold</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Adjusted</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Reserved</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Available</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Incoming</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Value at cost</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-50">
              {loading && !data && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-brown-500 whitespace-nowrap"
                  >
                    Loading inventory…
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-brown-500 whitespace-nowrap"
                  >
                    No products match this filter.
                  </td>
                </tr>
              )}
              {data?.items.map((r) => (
                <tr key={r.product_id} className="hover:bg-paper-soft">
                  <td className="px-4 py-3 whitespace-nowrap min-w-[200px]">
                    <div className="font-mono text-ink font-medium">{r.product_code}</div>
                    <div className="text-xs text-brown-500 truncate max-w-[220px]">
                      {r.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap min-w-[180px]">
                    <div className="text-ink">{r.vendor_name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                    {qty(r.received_qty)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                    {qty(r.sold_qty)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                    {qty(r.adjusted_qty)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                    {qty(r.reserved_qty)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-semibold text-ink">
                    {qty(r.available_qty)}
                    {r.uom_code && (
                      <span className="text-brown-500 ml-1 font-normal">{r.uom_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                    {qty(r.incoming_qty)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-semibold text-ink">
                    {formatMoney(r.available_value, r.cost_currency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AvailabilityBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-ghost !py-1 !px-2 text-xs"
                        onClick={() => openDetail(r)}
                      >
                        Movements
                      </button>
                      {canAdjust && (
                        <button
                          className="btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => {
                            setAdjustFor(r.product_id);
                            setAdjustOpen(true);
                          }}
                        >
                          Adjust
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "vendors" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wider text-brown-500">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Batches</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Incoming</th>
                <th className="px-4 py-3 text-right">Returned</th>
                <th className="px-4 py-3 text-right">Low / Out</th>
                <th className="px-4 py-3">Stock value</th>
                <th className="px-4 py-3">Last movement</th>
              </tr>
            </thead>
            <tbody>
              {loading && !vendors && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-brown-500">
                    Loading vendors…
                  </td>
                </tr>
              )}
              {vendors?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-brown-500">
                    No vendors with stock yet.
                  </td>
                </tr>
              )}
              {vendors?.items.map((v) => (
                <tr
                  key={v.vendor_id ?? v.vendor_name}
                  className="border-b border-brown-50 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="text-ink">{v.vendor_name}</div>
                    {v.vendor_code && (
                      <div className="font-mono text-xs text-brown-500">{v.vendor_code}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">{v.products}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{v.batches}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{qty(v.received_qty)}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{qty(v.incoming_qty)}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{qty(v.returned_qty)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-gold-600 font-semibold">{v.low_stock_products}</span>
                    <span className="text-brown-400"> / </span>
                    <span className="text-brick-600 font-semibold">{v.out_of_stock_products}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {v.value_by_currency.length === 0 && (
                        <span className="text-brown-500">—</span>
                      )}
                      {v.value_by_currency.map((c) => (
                        <span
                          key={c.currency_code}
                          className="rounded-md bg-paper-warm px-2 py-0.5 text-xs font-semibold text-ink"
                        >
                          {formatMoney(c.total_value, c.currency_code)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {v.last_movement_at ? new Date(v.last_movement_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "alerts" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wider text-brown-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Incoming</th>
                <th className="px-4 py-3 text-right">Suggested reorder</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && !alerts && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-brown-500">
                    Loading alerts…
                  </td>
                </tr>
              )}
              {alerts?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-brown-500">
                    Every product is above the low-stock threshold.
                  </td>
                </tr>
              )}
              {alerts?.items.map((r) => (
                <tr key={r.product_id} className="border-b border-brown-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-brown-500">{r.product_code}</div>
                    <div className="text-ink">{r.description}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{r.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                        r.severity === "critical"
                          ? "bg-brick-50 text-brick-600"
                          : "bg-gold-100 text-brown-600"
                      }`}
                    >
                      {r.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {qty(r.available_qty)} {r.uom_code ?? ""}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">{qty(r.incoming_qty)}</td>
                  <td className="px-4 py-3 text-right text-ink">{qty(r.suggested_reorder_qty)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost !py-1 text-xs" onClick={() => openDetail(r)}>
                      Movements
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "adjustments" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wider text-brown-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Vendor / batch</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Effect</th>
                <th className="px-4 py-3">Recorded by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && !adjustments && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-brown-500">
                    Loading adjustments…
                  </td>
                </tr>
              )}
              {adjustments?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-brown-500">
                    No adjustments recorded yet.
                  </td>
                </tr>
              )}
              {adjustments?.map((a) => (
                <tr key={a.id} className="border-b border-brown-50 last:border-0">
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(a.adjusted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-brown-500">{a.product_code ?? "—"}</div>
                    <div className="text-ink">{a.product_description ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{ADJUSTMENT_TYPE_LABEL[a.type]}</td>
                  <td className="px-4 py-3 text-ink-muted">{a.vendor_name ?? a.batch_no ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{a.reference_no ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{a.reason ?? "—"}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      a.sign > 0 ? "text-forest-600" : "text-brick-600"
                    }`}
                  >
                    {a.sign > 0 ? "+" : "−"}
                    {qty(a.qty)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{a.created_by ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canVoid && (
                      <button
                        className="btn-ghost !py-1 text-xs text-brick-600"
                        onClick={() => voidAdjustment(a.id)}
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "overview" && data && (
        <p className="text-xs text-brown-500">
          Available = quantities received into the warehouse (GRN / putaway onwards) minus
          quantities on confirmed, delivered, invoiced or paid sales orders, plus recorded stock
          adjustments. Products with {data.low_stock_threshold} units or less are flagged as low
          stock.
        </p>
      )}

      {adjustOpen && (
        <StockAdjustmentModal
          productId={adjustFor}
          onClose={() => setAdjustOpen(false)}
          onSaved={load}
        />
      )}

      {detailFor && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setDetailFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl text-ink">Stock movements</h3>
                <p className="text-sm text-brown-500">
                  {detailFor.product_code} — {detailFor.description}
                </p>
              </div>
              <button
                className="text-brown-500 hover:text-ink text-xl leading-none"
                onClick={() => setDetailFor(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {!detail ? (
              <p className="text-sm text-brown-500">Loading movements…</p>
            ) : (
              <div className="space-y-6">
                <MovementTable
                  title="Inbound — stock batches"
                  partyLabel="Vendor"
                  rows={detail.inbound}
                />
                <MovementTable
                  title="Outbound — sales orders"
                  partyLabel="Customer"
                  rows={detail.outbound}
                />
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-ink">Stock adjustments</h4>
                  <div className="overflow-x-auto rounded-lg border border-brown-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-brown-100 bg-paper-warm text-left text-xs uppercase tracking-wider text-brown-500">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Reference</th>
                          <th className="px-3 py-2">Party</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2 text-right">Effect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.adjustments.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-center text-brown-500">
                              No adjustments.
                            </td>
                          </tr>
                        )}
                        {detail.adjustments.map((a) => (
                          <tr key={a.id} className="border-b border-brown-50 last:border-0">
                            <td className="px-3 py-2 text-ink-muted">
                              {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-muted">
                              {ADJUSTMENT_TYPE_LABEL[a.type]}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-ink">{a.reference}</td>
                            <td className="px-3 py-2 text-ink-muted">{a.party ?? "—"}</td>
                            <td className="px-3 py-2 text-ink-muted">{a.reason ?? "—"}</td>
                            <td
                              className={`px-3 py-2 text-right font-semibold ${
                                a.sign > 0 ? "text-forest-600" : "text-brick-600"
                              }`}
                            >
                              {a.sign > 0 ? "+" : "−"}
                              {qty(a.qty)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

function MovementTable({
  title,
  partyLabel,
  rows,
}: {
  title: string;
  partyLabel: string;
  rows: InventoryMovements["inbound"];
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-ink">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-brown-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brown-100 bg-paper-warm text-left text-xs uppercase tracking-wider text-brown-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">{partyLabel}</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit value</th>
              <th className="px-3 py-2">Counted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-brown-500">
                  No records.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-brown-50 last:border-0">
                <td className="px-3 py-2 text-ink-muted">
                  {m.date ? new Date(m.date).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink">{m.reference}</td>
                <td className="px-3 py-2 text-ink-muted">{m.party ?? "—"}</td>
                <td className="px-3 py-2 text-ink-muted">{m.status.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 text-right font-semibold text-ink">{qty(m.qty)}</td>
                <td className="px-3 py-2 text-right text-ink-muted">
                  {formatMoney(m.unit_value, m.currency_code)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {m.counts ? (
                    <span className="rounded-md bg-forest-50 px-2 py-0.5 font-semibold text-forest-600">
                      Yes
                    </span>
                  ) : (
                    <span className="rounded-md bg-paper-warm px-2 py-0.5 text-brown-500">
                      Not yet
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AvailabilityBadge({ status }: { status: InventoryStatus }) {
  const cls =
    status === "in_stock"
      ? "bg-forest-50 text-forest-600"
      : status === "low_stock"
        ? "bg-gold-100 text-brown-600"
        : "bg-brick-50 text-brick-600";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {INVENTORY_STATUS_LABEL[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "brick";
}) {
  const valueCls =
    tone === "brick" ? "text-brick-600" : tone === "gold" ? "text-gold-600" : "text-ink";
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-brown-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueCls}`}>{value}</div>
    </div>
  );
}
