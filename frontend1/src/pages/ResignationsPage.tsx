import { useEffect, useMemo, useState } from 'react';
import { resignationService } from '../services/resignation.service';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from '../lib/toast';
import { notifyApiError, type ApiError } from '../services/api';
import { UserName } from '../components/UserName';
import {
  RESIGNATION_REASONS,
  RESIGNATION_REASON_LABEL,
  RESIGNATION_STATUSES,
  RESIGNATION_STATUS_LABEL,
  RESIGNATION_STATUS_TONE,
  type BenefitPreview,
  type CreateResignationPayload,
  type ResignationReason,
  type ResignationRow,
} from '../types/resignation';

const today = () => new Date().toISOString().slice(0, 10);
const money = (v: string | number) =>
  `SR ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = (): CreateResignationPayload => ({
  resignation_date: today(),
  last_working_date: today(),
  notice_period_days: 30,
  reason_type: 'personal',
  reason: '',
  handover_notes: '',
  handover_to: '',
  contact_email: '',
  contact_mobile: '',
});

type Tab = 'mine' | 'approvals';

/** People → Resignations. Employees file, supervisor → manager → admin sign off. */
export function ResignationsPage() {
  const { isAdmin, canApproveLeave: canReview, isManager, role } = usePermissions();

  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<ResignationRow[]>([]);
  const [all, setAll] = useState<ResignationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateResignationPayload>(emptyForm);
  const [preview, setPreview] = useState<BenefitPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (tab === 'mine') setMine(await resignationService.list({ mine: true }));
      else setAll(await resignationService.list({ status: statusFilter || undefined }));
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Could not load resignations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  // Live end-of-service benefit for the chosen last working day.
  useEffect(() => {
    let cancelled = false;
    if (tab !== 'mine' || !form.last_working_date) return;
    void resignationService
      .preview(form.last_working_date)
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [form.last_working_date, tab]);

  const hasOpen = useMemo(
    () => mine.some((r) => r.status.startsWith('pending') || r.status === 'approved'),
    [mine],
  );

  const set = <K extends keyof CreateResignationPayload>(
    key: K,
    value: CreateResignationPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.last_working_date < form.resignation_date) {
      toast('error', 'The last working day cannot be before the resignation date');
      return;
    }
    if (form.reason.trim().length < 3) {
      toast('error', 'Please give a reason for the resignation');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateResignationPayload = {
        ...form,
        handover_notes: form.handover_notes || undefined,
        handover_to: form.handover_to || undefined,
        contact_email: form.contact_email || undefined,
        contact_mobile: form.contact_mobile || undefined,
      };
      await resignationService.create(payload);
      toast('success', 'Resignation submitted');
      setForm(emptyForm());
      await load();
    } catch (err) {
      notifyApiError(err, 'Could not submit the resignation');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (row: ResignationRow, action: 'approve' | 'reject') => {
    setBusyId(row.id);
    try {
      await resignationService.decide(row.id, action);
      toast('success', `Resignation ${action === 'approve' ? 'approved' : 'rejected'}`);
      await load();
    } catch (e) {
      notifyApiError(e, 'Could not record that decision');
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (row: ResignationRow) => {
    setBusyId(row.id);
    try {
      await resignationService.withdraw(row.id);
      toast('success', 'Resignation withdrawn');
      await load();
    } catch (e) {
      notifyApiError(e, 'Could not withdraw that resignation');
    } finally {
      setBusyId(null);
    }
  };

  /** Chain: supervisor clears step 1, manager step 2, admin the final step. */
  const canDecide = (row: ResignationRow) => {
    if (row.status === 'pending_admin') return isAdmin;
    if (row.status === 'pending_manager') return isAdmin || isManager;
    if (row.status === 'pending_supervisor') return canReview;
    return false;
  };

  const rows = tab === 'mine' ? mine : all;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Resignations</h1>
        <p className="text-sm text-brown-500">
          Sign-off runs supervisor → manager → admin. The end-of-service benefit is 50% of the
          basic salary for every completed year since joining.
        </p>
      </div>

      {canReview && (
        <div className="flex gap-1 border-b border-brown-100">
          {(
            [
              ['mine', 'My resignation'],
              ['approvals', 'Approvals'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${
                tab === key
                  ? 'border-gold-400 font-medium text-ink'
                  : 'border-transparent text-brown-500 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loadError && <div className="card border-red-200 p-4 text-sm text-red-600">{loadError}</div>}

      {tab === 'mine' && !hasOpen && (
        <form className="card space-y-4 p-4" onSubmit={submit}>
          <h2 className="font-serif text-lg text-ink">Submit a resignation</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="res-date">Resignation date</label>
              <input
                id="res-date"
                type="date"
                className="input"
                value={form.resignation_date}
                onChange={(e) => set('resignation_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="res-last">Last working day</label>
              <input
                id="res-last"
                type="date"
                className="input"
                min={form.resignation_date}
                value={form.last_working_date}
                onChange={(e) => set('last_working_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="res-notice">Notice period (days)</label>
              <input
                id="res-notice"
                type="number"
                min={0}
                max={365}
                className="input"
                value={form.notice_period_days ?? 30}
                onChange={(e) => set('notice_period_days', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-reason-type">Reason</label>
              <select
                id="res-reason-type"
                className="input"
                value={form.reason_type}
                onChange={(e) => set('reason_type', e.target.value as ResignationReason)}
              >
                {RESIGNATION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {RESIGNATION_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="res-handover-to">Handover to</label>
              <input
                id="res-handover-to"
                className="input"
                value={form.handover_to ?? ''}
                onChange={(e) => set('handover_to', e.target.value)}
                placeholder="Colleague taking over"
              />
            </div>
            <div>
              <label className="label" htmlFor="res-email">Personal email</label>
              <input
                id="res-email"
                type="email"
                className="input"
                value={form.contact_email ?? ''}
                onChange={(e) => set('contact_email', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="res-mobile">Contact mobile</label>
              <input
                id="res-mobile"
                className="input"
                inputMode="numeric"
                maxLength={10}
                placeholder="0501234567"
                value={form.contact_mobile ?? ''}
                onChange={(e) => set('contact_mobile', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="res-reason">Details</label>
            <textarea
              id="res-reason"
              className="input min-h-[80px]"
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="res-handover">Handover notes</label>
            <textarea
              id="res-handover"
              className="input min-h-[70px]"
              value={form.handover_notes ?? ''}
              onChange={(e) => set('handover_notes', e.target.value)}
            />
          </div>

          {preview && (
            <div className="rounded-md border border-brown-100 bg-paper-soft p-3 text-sm">
              <div className="font-medium text-ink">Estimated end-of-service benefit</div>
              <div className="text-brown-600">
                Joined {preview.join_date} · {preview.service_months} month
                {preview.service_months === 1 ? '' : 's'} ({preview.service_years.toFixed(2)} years)
                · basic {money(preview.basic_salary)}
              </div>
              <div className="mt-1 text-lg font-medium text-ink">
                {money(preview.benefit_amount)}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? 'Submitting…' : 'Submit resignation'}
            </button>
          </div>
        </form>
      )}

      {tab === 'approvals' && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label" htmlFor="res-status">Status</label>
            <select
              id="res-status"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {RESIGNATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RESIGNATION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-ghost" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brown-100 text-left text-xs uppercase tracking-wide text-brown-500">
              {['Employee', 'Dates', 'Reason', 'Service', 'Benefit', 'Status', 'Decided by', ''].map(
                (h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-brown-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-brown-500">
                  No resignations
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-brown-50 align-top hover:bg-paper-soft">
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{r.employee_name ?? '—'}</div>
                  <div className="text-xs text-brown-500">
                    {r.employee_code ?? ''} {r.job_title ? `· ${r.job_title}` : ''}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                  {r.resignation_date} → {r.last_working_date}
                  <div className="text-xs text-brown-500">{r.notice_period_days} days notice</div>
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {RESIGNATION_REASON_LABEL[r.reason_type]}
                  <div className="text-xs text-brown-500">{r.reason}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                  {r.service_years} yrs
                  <div className="text-xs text-brown-500">{r.service_months} months</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink">
                  {money(r.benefit_amount)}
                  <div className="text-xs text-brown-500">
                    basic {money(r.benefit_basic_salary)}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${RESIGNATION_STATUS_TONE[r.status]}`}
                  >
                    {RESIGNATION_STATUS_LABEL[r.status]}
                  </span>
                  {r.rejection_reason && (
                    <div className="text-xs text-brown-500">{r.rejection_reason}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-brown-500">
                  {r.decided_by ? (
                    <>
                      <div className="text-ink-muted">
                        <UserName value={r.decided_by} />
                      </div>
                      <div className="uppercase tracking-wide">{r.decided_by_role}</div>
                      <div>{r.decided_at?.slice(0, 10)}</div>
                    </>
                  ) : (
                    '—'
                  )}
                  {r.supervisor_by && (
                    <div>
                      Supervisor: <UserName value={r.supervisor_by} />
                    </div>
                  )}
                  {r.manager_by && (
                    <div>
                      Manager: <UserName value={r.manager_by} />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {tab === 'approvals' && canDecide(r) && (
                      <>
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs"
                          disabled={busyId === r.id}
                          onClick={() => void decide(r, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                          disabled={busyId === r.id}
                          onClick={() => void decide(r, 'reject')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {tab === 'mine' && r.status.startsWith('pending') && (
                      <button
                        className="btn-ghost !px-2 !py-1 text-xs text-brown-600"
                        disabled={busyId === r.id}
                        onClick={() => void withdraw(r)}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tab === 'mine' && hasOpen && (
        <p className="text-xs text-brown-500">
          You already have an active resignation on file{role ? '' : ''} — withdraw it before
          filing a new one.
        </p>
      )}
    </div>
  );
}
