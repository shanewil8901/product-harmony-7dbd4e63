import { useEffect, useState, type FormEvent } from 'react';
import type { Vendor, VendorInput, PaymentTerm } from '../types/vendor';
import { PAYMENT_TERMS, PAYMENT_TERM_LABEL, VENDOR_DOC_TYPES, VENDOR_DOC_LABEL } from '../types/vendor';
import { useMasterData } from '../hooks/useMasterData';
import { vendorsService } from '../services/vendors.service';
import { DocumentUploader, type DocRow } from './DocumentUploader';

interface Props {
  vendor: Vendor | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// KSA validators — mirror backend regex.
const CR_RE = /^\d{10}$/;
const VAT_RE = /^3\d{13}3$/;
const PHONE_RE = /^\+9665\d{8}$/;
const IBAN_RE = /^SA\d{22}$/;
const NAT_ADDR_RE = /^[A-Z]{4}\d{4}$/;
const POSTAL_RE = /^\d{5}$/;
const ADDL_RE = /^\d{4}$/;

type Tab = 'info' | 'address' | 'financial' | 'documents';

const emptyForm: VendorInput = {
  legal_name: '',
  legal_name_ar: '',
  cr_number: '',
  vat_number: '',
  national_address_code: '',
  building_number: '',
  street: '',
  district: '',
  city: '',
  postal_code: '',
  additional_number: '',
  contact_person: '',
  phone: '+9665',
  email: '',
  iban: '',
  bank_name: '',
  payment_terms: 'net_30',
  lead_time_days: 7,
  currency_id: '',
  status: 'active',
  notes: '',
  import_export_license_no: '',
};

export function VendorModal({ vendor, canEdit, onClose, onSaved }: Props) {
  const { currencies } = useMasterData();
  const [tab, setTab] = useState<Tab>('info');
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof VendorInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);

  useEffect(() => {
    if (vendor) {
      setForm({
        legal_name: vendor.legal_name,
        legal_name_ar: vendor.legal_name_ar ?? '',
        cr_number: vendor.cr_number,
        vat_number: vendor.vat_number ?? '',
        national_address_code: vendor.national_address_code ?? '',
        building_number: vendor.building_number ?? '',
        street: vendor.street ?? '',
        district: vendor.district ?? '',
        city: vendor.city ?? '',
        postal_code: vendor.postal_code ?? '',
        additional_number: vendor.additional_number ?? '',
        contact_person: vendor.contact_person ?? '',
        phone: vendor.phone,
        email: vendor.email ?? '',
        iban: vendor.iban ?? '',
        bank_name: vendor.bank_name ?? '',
        payment_terms: vendor.payment_terms,
        lead_time_days: vendor.lead_time_days,
        currency_id: vendor.currency_id ?? '',
        status: vendor.status,
        notes: vendor.notes ?? '',
        import_export_license_no: vendor.import_export_license_no ?? '',
      });
      void loadDocs(vendor.id);
    } else {
      setForm(emptyForm);
      setDocs([]);
    }
    setErrors({});
    setApiError(null);
    setTab('info');
  }, [vendor]);

  const loadDocs = async (id: string) => {
    const list = await vendorsService.listDocs(id);
    setDocs(list as unknown as DocRow[]);
  };

  const set = <K extends keyof VendorInput>(k: K, v: VendorInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof VendorInput, string>> = {};
    if (!form.legal_name.trim()) e.legal_name = 'Required';
    if (!CR_RE.test(form.cr_number)) e.cr_number = 'CR must be 10 digits';
    if (form.vat_number && !VAT_RE.test(form.vat_number))
      e.vat_number = 'VAT must be 15 digits starting and ending with 3';
    if (!PHONE_RE.test(form.phone)) e.phone = 'Format: +9665XXXXXXXX';
    if (form.iban && !IBAN_RE.test(form.iban)) e.iban = 'IBAN: SA + 22 digits';
    if (form.national_address_code && !NAT_ADDR_RE.test(form.national_address_code))
      e.national_address_code = '4 uppercase letters + 4 digits';
    if (form.postal_code && !POSTAL_RE.test(form.postal_code)) e.postal_code = '5 digits';
    if (form.additional_number && !ADDL_RE.test(form.additional_number))
      e.additional_number = '4 digits';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: VendorInput = {
        ...form,
        legal_name_ar: form.legal_name_ar?.trim() || undefined,
        vat_number: form.vat_number?.trim() || undefined,
        national_address_code: form.national_address_code?.trim() || undefined,
        building_number: form.building_number?.trim() || undefined,
        street: form.street?.trim() || undefined,
        district: form.district?.trim() || undefined,
        city: form.city?.trim() || undefined,
        postal_code: form.postal_code?.trim() || undefined,
        additional_number: form.additional_number?.trim() || undefined,
        contact_person: form.contact_person?.trim() || undefined,
        email: form.email?.trim() || undefined,
        iban: form.iban?.trim() || undefined,
        bank_name: form.bank_name?.trim() || undefined,
        currency_id: form.currency_id || undefined,
        notes: form.notes?.trim() || undefined,
        import_export_license_no: form.import_export_license_no?.trim() || undefined,
      };
      if (vendor) await vendorsService.update(vendor.id, payload);
      else await vendorsService.create(payload);
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.error ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to save');
      setApiError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc: DocRow) => {
    if (!vendor) return;
    const { url, token } = vendorsService.downloadUrl(vendor.id, doc.id);
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = doc.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const handleUpload = async (
    file: File,
    meta: { doc_type: string; reference_no?: string; issue_date?: string; expiry_date?: string },
  ) => {
    if (!vendor) return;
    await vendorsService.uploadDoc(vendor.id, file, meta as Parameters<typeof vendorsService.uploadDoc>[2]);
    await loadDocs(vendor.id);
  };

  const handleDelete = async (docId: string) => {
    if (!vendor) return;
    await vendorsService.removeDoc(vendor.id, docId);
    await loadDocs(vendor.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="card w-full max-w-4xl p-6 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl text-ink">
              {vendor ? `Edit vendor · ${vendor.code}` : 'New vendor'}
            </h3>
            <p className="text-xs text-brown-500">KSA-compliant supplier record</p>
          </div>
          <button
            type="button"
            className="text-brown-500 hover:text-ink text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {apiError && (
          <div className="mb-4 rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
            {apiError}
          </div>
        )}

        <div className="mb-4 flex border-b border-brown-100 gap-1">
          {(['info', 'address', 'financial', 'documents'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              disabled={t === 'documents' && !vendor}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-gold-400 text-ink'
                  : 'border-transparent text-brown-500 hover:text-ink disabled:opacity-40'
              }`}
            >
              {t === 'documents' && !vendor ? 'Documents (save first)' : t}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="space-y-4">
            <Pair>
              <Field label="Legal name (English) *" error={errors.legal_name}>
                <input
                  className="input"
                  value={form.legal_name}
                  onChange={(e) => set('legal_name', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Legal name (Arabic)">
                <input
                  className="input"
                  dir="rtl"
                  value={form.legal_name_ar}
                  onChange={(e) => set('legal_name_ar', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="Commercial Registration (CR) *" error={errors.cr_number}>
                <input
                  className="input font-mono"
                  value={form.cr_number}
                  onChange={(e) => set('cr_number', e.target.value)}
                  disabled={!canEdit}
                  maxLength={10}
                  placeholder="1010101010"
                />
              </Field>
              <Field label="VAT Registration No." error={errors.vat_number}>
                <input
                  className="input font-mono"
                  value={form.vat_number}
                  onChange={(e) => set('vat_number', e.target.value)}
                  disabled={!canEdit}
                  maxLength={15}
                  placeholder="300000000000003"
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="Contact person">
                <input
                  className="input"
                  value={form.contact_person}
                  onChange={(e) => set('contact_person', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Phone (KSA) *" error={errors.phone}>
                <input
                  className="input font-mono"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  disabled={!canEdit}
                  placeholder="+9665XXXXXXXX"
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="Email" error={errors.email}>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Status">
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
                  disabled={!canEdit}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </Pair>
            <Field
              label="Import/Export License No."
              hint="Required if the vendor imports or exports goods. Upload the license PDF under the Documents tab."
            >
              <input
                className="input"
                value={form.import_export_license_no ?? ''}
                onChange={(e) => set('import_export_license_no', e.target.value)}
                disabled={!canEdit}
                maxLength={64}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input min-h-[72px]"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
        )}

        {tab === 'address' && (
          <div className="space-y-4">
            <p className="text-xs text-brown-500">
              Saudi National Address format — required for tax invoicing under ZATCA rules.
            </p>
            <Pair>
              <Field label="National Address short code" error={errors.national_address_code}>
                <input
                  className="input font-mono"
                  value={form.national_address_code}
                  onChange={(e) => set('national_address_code', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  maxLength={8}
                  placeholder="RRRD1234"
                />
              </Field>
              <Field label="Building number">
                <input
                  className="input"
                  value={form.building_number}
                  onChange={(e) => set('building_number', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="Street">
                <input
                  className="input"
                  value={form.street}
                  onChange={(e) => set('street', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="District">
                <input
                  className="input"
                  value={form.district}
                  onChange={(e) => set('district', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="City">
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Postal code" error={errors.postal_code}>
                <input
                  className="input font-mono"
                  value={form.postal_code}
                  onChange={(e) => set('postal_code', e.target.value)}
                  disabled={!canEdit}
                  maxLength={5}
                />
              </Field>
            </Pair>
            <Field label="Additional number" error={errors.additional_number}>
              <input
                className="input font-mono"
                value={form.additional_number}
                onChange={(e) => set('additional_number', e.target.value)}
                disabled={!canEdit}
                maxLength={4}
              />
            </Field>
          </div>
        )}

        {tab === 'financial' && (
          <div className="space-y-4">
            <Pair>
              <Field label="IBAN (SA + 22 digits)" error={errors.iban}>
                <input
                  className="input font-mono"
                  value={form.iban}
                  onChange={(e) => set('iban', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  maxLength={24}
                  placeholder="SA0380000000608010167519"
                />
              </Field>
              <Field label="Bank name">
                <input
                  className="input"
                  value={form.bank_name}
                  onChange={(e) => set('bank_name', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
            <Pair>
              <Field label="Payment terms">
                <select
                  className="input"
                  value={form.payment_terms}
                  onChange={(e) => set('payment_terms', e.target.value as PaymentTerm)}
                  disabled={!canEdit}
                >
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t} value={t}>
                      {PAYMENT_TERM_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lead time (days)">
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="365"
                  value={form.lead_time_days ?? 0}
                  onChange={(e) => set('lead_time_days', Number(e.target.value))}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
            <Field label="Default currency">
              <select
                className="input"
                value={form.currency_id ?? ''}
                onChange={(e) => set('currency_id', e.target.value)}
                disabled={!canEdit}
              >
                <option value="">— Not set —</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {tab === 'documents' && vendor && (
          <DocumentUploader
            docs={docs}
            docTypes={VENDOR_DOC_TYPES}
            docLabels={VENDOR_DOC_LABEL}
            canEdit={canEdit}
            onUpload={handleUpload}
            onDelete={handleDelete}
            onDownload={handleDownload}
          />
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && tab !== 'documents' && (
            <button type="submit" className="btn-gold" disabled={submitting}>
              {submitting ? 'Saving…' : vendor ? 'Save changes' : 'Create vendor'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-brown-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-brown-500">{error}</p>}
    </div>
  );
}
