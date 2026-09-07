import { useEffect, useState } from "react";
import { employeesService } from "../services/hr.service";
import { toLocalMobile } from "../lib/validators";
import type { ApiError } from "../services/api";
import {
  ATTENDANCE_LABEL,
  HR_CURRENCY,
  PAYSLIP_STATUS_LABEL,
  EMPLOYMENT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  EMPLOYEE_DOC_LABEL,
  type EmployeeSelfOverview,
} from "../types/hr";

const money = (v: string | number) =>
  `${HR_CURRENCY.symbol} ${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const monthLabel = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
};

/** Matches the KPI cards on the dashboard General tab so the app reads consistently. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-brown-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-brown-500">{hint}</div>}
    </div>
  );
}

/** Neutral "John Doe" silhouette used when no photo has been uploaded. */
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 450"><rect width="350" height="450" fill="#f4efe1"/><circle cx="175" cy="165" r="78" fill="#d4b28a"/><path d="M35 450c0-77 63-140 140-140s140 63 140 140z" fill="#d4b28a"/></svg>`,
  );

function Fact({
  label,
  value,
  size = "normal",
}: {
  label: string;
  value: string;
  size?: "normal" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wider text-brown-500">{label}</div>
      <div className={`truncate text-ink ${size === "lg" ? "text-lg font-semibold" : "text-sm"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brown-100 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-brown-500">{label}</span>
      <span className="text-sm text-ink text-right">{value || "—"}</span>
    </div>
  );
}

export function MyProfilePage() {
  const [data, setData] = useState<EmployeeSelfOverview | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await employeesService.myOverview());
    } catch (e) {
      setError((e as ApiError).userMessage ?? "Could not load your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Photo is optional — a missing one simply falls back to the default avatar.
  useEffect(() => {
    let url: string | null = null;
    employeesService
      .myPhotoUrl()
      .then((u) => {
        url = u;
        setPhoto(u);
      })
      .catch(() => setPhoto(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  if (loading) return <div className="card p-8 text-sm text-brown-500">Loading your profile…</div>;

  if (error || !data)
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">My profile</h1>
        <p className="mt-2 text-sm text-brown-600">
          {error ?? "No employee profile is linked to your account."}
        </p>
        <button className="btn-ghost mt-4" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );

  const { employee: e, attendance, payroll, documents } = data;
  const maxHours = Math.max(1, ...attendance.trend.map((t) => Number(t.hours)));

  return (
    <div className="space-y-6">
      <header className="card overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-paper-warm to-paper p-5 sm:flex-row">
          <div className="h-60 shrink-0 aspect-[35/45] overflow-hidden rounded-xl border-2 border-gold-300 bg-paper-warm shadow-card">
            <img
              src={photo ?? DEFAULT_AVATAR}
              alt={`${e.full_name} profile photo`}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 rounded-xl border border-forest-100 bg-forest-50/60 p-4">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Fact label="Full name" value={e.full_name} size="lg" />
              <Fact label="Employee ID" value={e.employee_code} size="lg" />
              <Fact label="Job title" value={e.job_title} />
              <Fact label="Department" value={e.department_name ?? "—"} />
              <Fact label="Status" value={EMPLOYMENT_STATUS_LABEL[e.employment_status]} />
              <Fact label="Contract" value={CONTRACT_TYPE_LABEL[e.contract_type]} />
              {e.role && <Fact label="Role" value={e.role.name} />}
            </div>
          </div>
        </div>
      </header>

      {e.iqama_days_left !== null && e.iqama_days_left <= 60 && (
        <div
          role="alert"
          className="card border border-brown-200 bg-paper-warm p-4 text-sm text-brown-600"
        >
          {e.iqama_days_left < 0
            ? `Your Iqama expired on ${day(e.iqama_expiry)}. Contact HR immediately.`
            : `Your Iqama expires in ${e.iqama_days_left} day(s) on ${day(e.iqama_expiry)}.`}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Gross monthly"
          value={money(e.gross_salary)}
          hint={`Paid in ${HR_CURRENCY.code}`}
        />
        <Stat
          label="Net paid YTD"
          value={money(payroll.ytd_net_paid)}
          hint={
            payroll.last_paid_period
              ? `Last paid ${monthLabel(payroll.last_paid_period)}`
              : "No payment yet"
          }
        />
        <Stat
          label="Present this month"
          value={`${attendance.this_month.present_days} days`}
          hint={`${attendance.this_month.total_hours} h worked`}
        />
        <Stat
          label="Tenure"
          value={`${Math.floor(e.tenure_months / 12)}y ${e.tenure_months % 12}m`}
          hint={`Joined ${day(e.join_date)}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2 space-y-4">
          <h2 className="font-serif text-lg text-ink">Attendance — last 6 months</h2>
          <div className="flex items-end gap-3 h-40">
            {attendance.trend.map((t) => (
              <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-brown-500">{t.hours}h</span>
                <div
                  className="w-full rounded-t bg-forest-300"
                  style={{ height: `${(Number(t.hours) / maxHours) * 100}%`, minHeight: "2px" }}
                  title={`${t.present_days} present · ${t.absent_days} absent`}
                />
                <span className="text-[10px] text-ink-muted">{monthLabel(t.period)}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4 text-center text-xs">
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.present_days}</div>
              <div className="text-brown-500">Present YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.absent_days}</div>
              <div className="text-brown-500">Absent YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.leave_days}</div>
              <div className="text-brown-500">Leave YTD</div>
            </div>
            <div className="rounded-lg bg-paper-warm p-2">
              <div className="text-ink font-semibold">{attendance.year_to_date.total_overtime}</div>
              <div className="text-brown-500">Overtime hrs</div>
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-1">
          <h2 className="font-serif text-lg text-ink mb-2">Salary breakdown</h2>
          <Row label="Basic" value={money(e.basic_salary)} />
          <Row label="Housing" value={money(e.housing_allowance)} />
          <Row label="Transport" value={money(e.transport_allowance)} />
          <Row label="Other" value={money(e.other_allowance)} />
          <Row label="Gross" value={money(e.gross_salary)} />
          <Row label="Bank" value={e.bank_name} />
          <Row label="IBAN" value={`•••• ${e.iban.slice(-4)}`} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="font-serif text-lg text-ink p-5 pb-3">Recent payslips</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Net pay</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Paid on</th>
                </tr>
              </thead>
              <tbody>
                {payroll.payslips.map((p) => (
                  <tr key={p.id} className="border-t border-brown-100">
                    <td className="px-4 py-2 text-ink">{monthLabel(p.period)}</td>
                    <td className="px-4 py-2 text-ink">{money(p.net_pay)}</td>
                    <td className="px-4 py-2 text-ink-muted">{PAYSLIP_STATUS_LABEL[p.status]}</td>
                    <td className="px-4 py-2 text-ink-muted">{day(p.paid_at)}</td>
                  </tr>
                ))}
                {payroll.payslips.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-brown-500">
                      No payslips yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="font-serif text-lg text-ink p-5 pb-3">Recent attendance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">In / Out</th>
                  <th className="px-4 py-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {attendance.recent.map((a) => (
                  <tr key={a.id} className="border-t border-brown-100">
                    <td className="px-4 py-2 text-ink whitespace-nowrap">{day(a.work_date)}</td>
                    <td className="px-4 py-2 text-ink-muted">{ATTENDANCE_LABEL[a.status]}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {(a.check_in ?? "—") + " / " + (a.check_out ?? "—")}
                    </td>
                    <td className="px-4 py-2 text-ink">{a.worked_hours}</td>
                  </tr>
                ))}
                {attendance.recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-brown-500">
                      No attendance records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 space-y-1">
          <h2 className="font-serif text-lg text-ink mb-2">Personal details</h2>
          <Row label="Email" value={e.email ?? "—"} />
          <Row label="Mobile" value={toLocalMobile(e.mobile)} />
          <Row label="Nationality" value={e.nationality ?? "—"} />
          <Row label="Iqama / ID" value={e.iqama_number} />
          <Row label="Iqama expiry" value={day(e.iqama_expiry)} />
          <Row label="Address" value={`${e.address_line1}, ${e.address_city}`} />
          <Row
            label="Emergency contact"
            value={
              e.emergency_contact_name
                ? `${e.emergency_contact_name} · ${e.emergency_contact_phone ?? ""}`
                : "—"
            }
          />
        </section>

        <section className="card p-5">
          <h2 className="font-serif text-lg text-ink mb-2">My documents</h2>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-brown-100 pb-2 last:border-0"
              >
                <div>
                  <div className="text-sm text-ink">{EMPLOYEE_DOC_LABEL[d.doc_type]}</div>
                  <div className="text-xs text-ink-muted">{d.file_name}</div>
                </div>
                <span className="text-xs text-brown-500 whitespace-nowrap">
                  {day(d.uploaded_at)}
                </span>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="text-sm text-brown-500">
                No documents on file. Contact HR to upload.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
