import { useEffect, useState } from "react";
import { salesService } from "../services/sales.service";
import { SalesOrderModal } from "../components/SalesOrderModal";
import { SalesPaymentModal } from "../components/SalesPaymentModal";
import { ConfirmDialog, PromptDialog } from "../components/Dialog";
import { DocumentPreviewModal } from "../components/DocumentPreviewModal";
import { usePermissions } from "../hooks/usePermissions";
import { formatMoney } from "../types/stock";
import { toast } from "../lib/toast";
import {
  SALES_DOC_LABEL,
  SALES_ORDER_STATUSES,
  SALES_PAYMENT_METHOD_LABEL,
  SALES_PAYMENT_STATE_LABEL,
  SALES_PAYMENT_STATUS_LABEL,
  SALES_PAYMENT_STATUS_TONE,
  SALES_STATUS_LABEL,
  SALES_STATUS_TONE,
  nextSalesStatuses,
  type SalesDocument,
  type SalesOrder,
  type SalesOrderStatus,
  type SalesPayment,
} from "../types/sales";

interface PreviewState {
  title: string;
  subtitle?: string;
  html: string;
}

export function SalesPage() {
  const { canWriteSales, canDeleteSales, canConfirmCredit } = usePermissions();
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, SalesDocument[]>>({});

  // In-app dialogs — the app never opens browser pop-ups.
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [paying, setPaying] = useState<SalesOrder | null>(null);
  const [cancelling, setCancelling] = useState<SalesOrder | null>(null);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [confirmAdvance, setConfirmAdvance] = useState<{
    order: SalesOrder;
    next: SalesOrderStatus;
  } | null>(null);
  const [creditDecision, setCreditDecision] = useState<{
    order: SalesOrder;
    payment: SalesPayment;
    decision: "confirm" | "not-received" | "cancel";
  } | null>(null);

  /** Delivery orders and invoices are issued by the system — fetch on expand. */
  const loadDocuments = async (id: string) => {
    try {
      const list = await salesService.documents(id);
      setDocs((d) => ({ ...d, [id]: list }));
    } catch {
      setDocs((d) => ({ ...d, [id]: [] }));
    }
  };

  const toggleExpand = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !docs[next]) void loadDocuments(next);
  };

  const openDocument = async (order: SalesOrder, doc: SalesDocument) => {
    try {
      const html = await salesService.documentHtml(order.id, doc.id);
      setPreview({
        title: `${SALES_DOC_LABEL[doc.doc_type]} · ${doc.doc_no}`,
        subtitle: `${order.order_no} · ${order.customer_name ?? ""}`,
        html,
      });
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not open the document");
    }
  };

  const openProof = async (order: SalesOrder, payment: SalesPayment) => {
    let src = payment.proof_file_data ?? "";
    if (!src) {
      try {
        const full = await salesService.payments(order.id);
        src = full.find((p) => p.id === payment.id)?.proof_file_data ?? "";
      } catch {
        src = "";
      }
    }
    if (!src) return toast("error", "No proof file stored for this payment");
    const body = src.startsWith("data:application/pdf")
      ? `<embed src="${src}" type="application/pdf" style="width:100%;height:100%" />`
      : `<img src="${src}" style="max-width:100%" />`;
    setPreview({
      title: `Payment proof · ${payment.proof_file_name ?? ""}`,
      html: `<html><body style="margin:0;font-family:sans-serif;height:100%">${body}</body></html>`,
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await salesService.list({
          search: search.trim() || undefined,
          status: status || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const advance = async (o: SalesOrder, next: SalesOrderStatus, reason?: string) => {
    try {
      await salesService.changeStatus(o.id, { status: next, ...(reason ? { reason } : {}) });
      toast(
        "success",
        next === "delivered"
          ? `${o.order_no} delivered — delivery order generated`
          : next === "invoiced"
            ? `${o.order_no} invoiced — invoice generated`
            : `${o.order_no} → ${SALES_STATUS_LABEL[next]}`,
      );
      if (expanded === o.id || docs[o.id]) void loadDocuments(o.id);
      void load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not update the order");
    }
  };

  const decideCredit = async (
    order: SalesOrder,
    payment: SalesPayment,
    decision: "confirm" | "not-received" | "cancel",
  ) => {
    try {
      await salesService.decideCredit(order.id, payment.id, decision);
      toast(
        "success",
        decision === "confirm"
          ? "Credit confirmed — funds booked"
          : decision === "cancel"
            ? "Credit cancelled — order flagged high priority"
            : "Marked as not received — order flagged high priority",
      );
      void load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not update the credit");
    }
  };

  const totalValue = rows.reduce((s, o) => s + Number(o.total_amount), 0);
  const outstanding = rows.reduce((s, o) => s + Number(o.outstanding_amount), 0);
  const flagged = rows.filter((o) => o.high_priority).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Sales</h1>
          <p className="text-sm text-brown-500">
            {rows.length} order{rows.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(totalValue, rows[0]?.currency_code ?? "SAR")} billed ·{" "}
            {formatMoney(outstanding, rows[0]?.currency_code ?? "SAR")} outstanding
            {flagged > 0 && <span className="text-red-600"> · {flagged} high priority</span>}
          </p>
        </div>
        {canWriteSales && (
          <button className="btn-gold" onClick={() => setCreating(true)}>
            + New sales order
          </button>
        )}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Order no, invoice no, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {SALES_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SALES_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-ghost" onClick={() => void load()}>
          Apply
        </button>
      </div>

      {error && <div className="card border-red-200 p-4 text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[1050px]">
          <thead className="bg-paper-warm text-ink">
            <tr className="text-left">
              {["Order", "Customer", "Date", "Status", "Payment", "Total", "Outstanding", "Actions"].map(
                (h, i) => (
                  <th
                    key={h || i}
                    className={`px-4 py-3 whitespace-nowrap ${
                      h === "Total" || h === "Outstanding" || h === "Actions" ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-brown-50">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-brown-500 whitespace-nowrap">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-brown-500 whitespace-nowrap">
                  No sales orders yet
                </td>
              </tr>
            )}
            {rows.map((o) => [
              <tr
                key={o.id}
                className={`hover:bg-paper-soft ${o.high_priority ? "bg-red-50/50" : ""}`}
              >
                <td className="px-4 py-3 whitespace-nowrap min-w-[180px]">
                  <button
                    className="font-mono font-medium text-ink underline-offset-2 hover:underline"
                    onClick={() => toggleExpand(o.id)}
                  >
                    {o.order_no}
                  </button>
                  {o.invoice_no && (
                    <div className="font-mono text-xs text-brown-500">{o.invoice_no}</div>
                  )}
                  {o.high_priority && (
                    <span className="mt-1 inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                      High priority
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap min-w-[200px]">
                  <div className="text-ink">{o.customer_name ?? "—"}</div>
                  {o.customer_code && (
                    <span className="block font-mono text-xs text-brown-500">
                      {o.customer_code}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-muted">
                  {o.order_date}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-medium ${SALES_STATUS_TONE[o.status]}`}
                  >
                    {SALES_STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {o.payment_state !== "settled" ? (
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-medium ${
                        o.payment_state === "not_received"
                          ? SALES_PAYMENT_STATUS_TONE.not_received
                          : SALES_PAYMENT_STATUS_TONE.pending
                      }`}
                    >
                      {SALES_PAYMENT_STATE_LABEL[o.payment_state]}
                    </span>
                  ) : (
                    <span className="text-xs text-brown-500">—</span>
                  )}
                  {o.credit_due_date && o.payment_state === "credit_pending" && (
                    <div className="font-mono text-[11px] text-brown-500">
                      due {o.credit_due_date}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-semibold text-ink">
                  {formatMoney(o.total_amount, o.currency_code)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-ink-muted">
                  {formatMoney(o.outstanding_amount, o.currency_code)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    {canWriteSales &&
                      nextSalesStatuses(o.status).map((n) => (
                        <button
                          key={n}
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() =>
                            n === "cancelled"
                              ? setCancelling(o)
                              : setConfirmAdvance({ order: o, next: n })
                          }
                        >
                          {SALES_STATUS_LABEL[n]}
                        </button>
                      ))}
                    {canWriteSales && (o.status === "invoiced" || o.status === "delivered") && (
                      <button
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => setPaying(o)}
                      >
                        Payment
                      </button>
                    )}
                    {canWriteSales && o.status === "draft" && (
                      <button
                        className="btn-ghost !px-2 !py-1 text-xs"
                        onClick={() => setEditing(o)}
                      >
                        Edit
                      </button>
                    )}
                    {canDeleteSales && (
                      <button
                        className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                        onClick={() => setDeleting(o)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>,
              expanded === o.id && (
                <tr key={`${o.id}-items`} className="bg-paper-soft">
                  <td colSpan={8} className="px-4 py-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-brown-100 text-left text-brown-500">
                          <th className="py-2 font-medium whitespace-nowrap">Product</th>
                          <th className="py-2 text-right font-medium whitespace-nowrap">Qty</th>
                          <th className="py-2 text-right font-medium whitespace-nowrap">
                            Unit price
                          </th>
                          <th className="py-2 text-right font-medium whitespace-nowrap">
                            Discount
                          </th>
                          <th className="py-2 text-right font-medium whitespace-nowrap">
                            Line total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brown-50">
                        {o.items.map((i) => (
                          <tr key={i.id} className="text-ink-muted">
                            <td className="py-2 whitespace-nowrap">
                              <span className="font-mono font-medium text-ink">
                                {i.product_code ?? "—"}
                              </span>
                              {i.description && (
                                <span className="block text-brown-500">{i.description}</span>
                              )}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap font-mono">
                              {i.qty}
                              {i.uom_code ? ` ${i.uom_code}` : ""}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap font-mono">
                              {formatMoney(i.unit_price, o.currency_code)}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap font-mono">
                              {formatMoney(i.discount_amount, o.currency_code)}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap font-mono font-medium text-ink">
                              {formatMoney(i.line_total, o.currency_code)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 text-xs font-mono text-brown-500">
                      Subtotal {formatMoney(o.subtotal, o.currency_code)} · VAT {o.vat_rate}% (
                      {formatMoney(o.vat_amount, o.currency_code)}) · Paid{" "}
                      {formatMoney(o.amount_paid, o.currency_code)}
                      {o.cancel_reason ? ` · Cancelled: ${o.cancel_reason}` : ""}
                    </div>

                    <div className="mt-3 border-t border-brown-100 pt-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-brown-500">
                        Payments
                      </div>
                      {!o.payments?.length ? (
                        <p className="mt-1 text-xs text-brown-500">No payments recorded yet.</p>
                      ) : (
                        <div className="mt-1.5 space-y-1.5">
                          {o.payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex flex-wrap items-center gap-2 rounded-md border border-brown-100 bg-white px-2.5 py-1 text-xs"
                            >
                              <span className="font-mono font-medium text-ink">
                                {formatMoney(p.amount, o.currency_code)}
                              </span>
                              <span className="text-brown-500">
                                {SALES_PAYMENT_METHOD_LABEL[p.method]}
                              </span>
                              <span
                                className={`inline-flex rounded border px-1.5 py-0.5 ${SALES_PAYMENT_STATUS_TONE[p.status]}`}
                              >
                                {SALES_PAYMENT_STATUS_LABEL[p.status]}
                              </span>
                              {p.bank_reference && (
                                <span className="font-mono text-brown-500">
                                  Ref {p.bank_reference}
                                </span>
                              )}
                              {p.credit_reference && (
                                <span className="font-mono text-brown-500">
                                  Credit {p.credit_reference}
                                </span>
                              )}
                              {p.expected_date && (
                                <span className="font-mono text-brown-500">
                                  expected {p.expected_date}
                                  {p.credit_days ? ` (${p.credit_days}d)` : ""}
                                </span>
                              )}
                              {p.proof_doc_no && (
                                <span className="font-mono text-brown-500">
                                  Doc {p.proof_doc_no}
                                </span>
                              )}
                              {(p.has_proof_file || p.proof_file_data) && (
                                <button
                                  className="btn-ghost !px-2 !py-0.5 text-xs"
                                  onClick={() => void openProof(o, p)}
                                >
                                  View proof
                                </button>
                              )}
                              {p.method === "credit" &&
                                p.status === "pending" &&
                                canConfirmCredit && (
                                  <>
                                    <button
                                      className="btn-ghost !px-2 !py-0.5 text-xs text-forest-500"
                                      onClick={() =>
                                        setCreditDecision({
                                          order: o,
                                          payment: p,
                                          decision: "confirm",
                                        })
                                      }
                                    >
                                      Confirm received
                                    </button>
                                    <button
                                      className="btn-ghost !px-2 !py-0.5 text-xs text-red-600"
                                      onClick={() =>
                                        setCreditDecision({
                                          order: o,
                                          payment: p,
                                          decision: "not-received",
                                        })
                                      }
                                    >
                                      Not received
                                    </button>
                                    <button
                                      className="btn-ghost !px-2 !py-0.5 text-xs text-brown-600"
                                      onClick={() =>
                                        setCreditDecision({
                                          order: o,
                                          payment: p,
                                          decision: "cancel",
                                        })
                                      }
                                    >
                                      Cancel credit
                                    </button>
                                  </>
                                )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 border-t border-brown-100 pt-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-brown-500">
                        System documents
                      </div>
                      {!docs[o.id]?.length ? (
                        <p className="mt-1 text-xs text-brown-500">
                          A delivery order is issued on delivery and an invoice on invoicing.
                        </p>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {docs[o.id].map((d) => (
                            <button
                              key={d.id}
                              className="btn-ghost !px-2 !py-1 text-xs font-mono"
                              onClick={() => void openDocument(o, d)}
                            >
                              {SALES_DOC_LABEL[d.doc_type]} · {d.doc_no}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <SalesOrderModal
          order={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}

      {paying && (
        <SalesPaymentModal
          order={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            void load();
          }}
        />
      )}

      {preview && (
        <DocumentPreviewModal
          title={preview.title}
          subtitle={preview.subtitle}
          html={preview.html}
          onClose={() => setPreview(null)}
        />
      )}

      {confirmAdvance && (
        <ConfirmDialog
          title={`Move to ${SALES_STATUS_LABEL[confirmAdvance.next]}`}
          message={`${confirmAdvance.order.order_no} will be marked as ${SALES_STATUS_LABEL[
            confirmAdvance.next
          ].toLowerCase()}.${
            confirmAdvance.next === "delivered"
              ? " A delivery order will be issued automatically."
              : confirmAdvance.next === "invoiced"
                ? " An invoice number will be issued automatically."
                : ""
          }`}
          confirmLabel={SALES_STATUS_LABEL[confirmAdvance.next]}
          onCancel={() => setConfirmAdvance(null)}
          onConfirm={() => {
            const { order, next } = confirmAdvance;
            setConfirmAdvance(null);
            void advance(order, next);
          }}
        />
      )}

      {cancelling && (
        <PromptDialog
          title={`Cancel ${cancelling.order_no}`}
          label="Cancellation reason"
          placeholder="Why is this order being cancelled?"
          confirmLabel="Cancel order"
          onCancel={() => setCancelling(null)}
          onSubmit={(reason) => {
            const order = cancelling;
            setCancelling(null);
            void advance(order, "cancelled", reason);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete sales order"
          tone="danger"
          confirmLabel="Delete"
          message={`Delete sales order ${deleting.order_no}? This cannot be undone.`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const order = deleting;
            setDeleting(null);
            try {
              await salesService.remove(order.id);
              toast("success", "Sales order deleted");
              void load();
            } catch (e) {
              toast("error", e instanceof Error ? e.message : "Could not delete the order");
            }
          }}
        />
      )}

      {creditDecision && (
        <ConfirmDialog
          title={
            creditDecision.decision === "confirm"
              ? "Confirm funds received"
              : creditDecision.decision === "cancel"
                ? "Cancel credit"
                : "Mark funds as not received"
          }
          tone={creditDecision.decision === "confirm" ? "gold" : "danger"}
          confirmLabel={
            creditDecision.decision === "confirm"
              ? "Confirm received"
              : creditDecision.decision === "cancel"
                ? "Cancel credit"
                : "Not received"
          }
          message={
            creditDecision.decision === "confirm"
              ? `Book ${formatMoney(
                  creditDecision.payment.amount,
                  creditDecision.order.currency_code,
                )} as received against ${creditDecision.order.order_no}.`
              : `${creditDecision.order.order_no} will be flagged "Not received" and shown as high priority.`
          }
          onCancel={() => setCreditDecision(null)}
          onConfirm={() => {
            const { order, payment, decision } = creditDecision;
            setCreditDecision(null);
            void decideCredit(order, payment, decision);
          }}
        />
      )}
    </div>
  );
}
