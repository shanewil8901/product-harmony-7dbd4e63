import { useEffect, useState, type FormEvent } from 'react';
import type { Customer, CustomerInput, CustomerType } from '../types/customer';
import {
  CUSTOMER_DOC_LABEL,
  CUSTOMER_DOC_TYPES,
  PAYMENT_TERMS,
  PAYMENT_TERM_LABEL,
  type PaymentTerm,
} from '../types/customer';
import { useMasterData } from '../hooks/useMasterData';
import { customersService } from '../services/customers.service';
import { DocumentUploader, type DocRow } from './DocumentUploader';

interface Props {
  customer: Customer | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CR_RE = /^\d{10}$/;
const VAT_RE = /^3\d{13}3$/;
const PHONE_RE = /^\+9665\d{8}$/;
const NATID_RE = /^[12]\d{9}$/;
const NAT_ADDR_RE = /^[A-Z]{4}\d{4}$/;
const POSTAL_RE = /^\d{5}$/;
const ADDL_RE = /^\d{4}$/;

type Tab = 'info' | 'address' | 'financial' | 'documents';

const emptyForm: CustomerInput = {
  customer_type: 'business',
  legal_name: '',
  legal_name_ar: '',
  cr_number: '',
  vat_number: '',
  national_id: '',
  national_address_code: '',
  phone: '+9665',
  email: '',
  billing_building_number: '',
  billing_street: '',
  billing_district: '',
  billing_city: '',
  billing_postal_code: '',
  billing_additional_number: '',
  shipping_same_as_billing: true,
  shipping_building_number: '',
  shipping_street: '',
  shipping_district: '',
  shipping_city: '',
  shipping_postal_code: '',
  shipping_additional_number: '',
  credit_limit: 0,
  currency_id: '',
  payment_terms: 'cod',
  status: 'active',
  notes: '',
};

export function CustomerModal({ customer, canEdit, onClose, onSaved }: Props) {
  const { currencies } = useMasterData();
  const [tab, setTab] = useState<Tab>('info');
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);

  useEffect(() => {
    if (customer) {
      setForm({
        customer_type: customer.customer_type,
        legal_name: customer.legal_name,
        legal_name_ar: customer.legal_name_ar ?? '',
        cr_number: customer.cr_number ?? '',
        vat_number: customer.vat_number ?? '',
        national_id: customer.national_id ?? '',
        national_address_code: customer.national_address_code ?? '',
        phone: customer.phone,
        email: customer.email ?? '',
        billing_building_number: customer.billing_building_number ?? '',
        billing_street: customer.billing_street ?? '',
        billing_district: customer.billing_district ?? '',
        billing_city: customer.billing_city ?? '',
        billing_postal_code: customer.billing_postal_code ?? '',
        billing_additional_number: customer.billing_additional_number ?? '',
        shipping_same_as_billing: customer.shipping_same_as_billing,
        shipping_building_number: customer.shipping_building_number ?? '',
        shipping_street: customer.shipping_street ?? '',
        shipping_district: customer.shipping_district ?? '',
        shipping_city: customer.shipping_city ?? '',
        shipping_postal_code: customer.shipping_postal_code ?? '',
        shipping_additional_number: customer.shipping_additional_number ?? '',
        credit_limit: Number(customer.credit_limit),
        currency_id: customer.currency_id ?? '',
        payment_terms: customer.payment_terms,
        status: customer.status,
        notes: customer.notes ?? '',
      });
      void loadDocs(customer.id);
    } else {
      setForm(emptyForm);
      setDocs([]);
    }
    setErrors({});
    setApiError(null);
    setTab('info');
  }, [customer]);

  const loadDocs = async (id: string) => {
    const list = await customersService.listDocs(id);
    setDocs(list as unknown as DocRow[]);
  };

  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.legal_name.trim()) e.legal_name = 'Required';
    if (form.customer_type === 'business') {
      if (!form.cr_number || !CR_RE.test(form.cr_number)) e.cr_number = 'CR must be 10 digits';
      if (!form.vat_number || !VAT_RE.test(form.vat_number))
        e.vat_number = 'VAT is required — 15 digits starting/ending with 3';
    }
    // National ID / Iqama required for BOTH business and individual customers.
    if (!form.national_id || !NATID_RE.test(form.national_id))
      e.national_id = '10 digits starting with 1 or 2';
    if (!PHONE_RE.test(form.phone)) e.phone = 'Format: +9665XXXXXXXX';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    if (form.national_address_code && !NAT_ADDR_RE.test(form.national_address_code))
      e.national_address_code = '4 letters + 4 digits';
    if (form.billing_postal_code && !POSTAL_RE.test(form.billing_postal_code))
      e.billing_postal_code = '5 digits';
    if (form.billing_additional_number && !ADDL_RE.test(form.billing_additional_number))
      e.billing_additional_number = '4 digits';
    if (!form.shipping_same_as_billing) {
      if (form.shipping_postal_code && !POSTAL_RE.test(form.shipping_postal_code))
        e.shipping_postal_code = '5 digits';
      if (form.shipping_additional_number && !ADDL_RE.test(form.shipping_additional_number))
        e.shipping_additional_number = '4 digits';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const clean = <T extends string | undefined>(v: T) =>
        (typeof v === 'string' ? v.trim() : v) || undefined;
      const payload: CustomerInput = {
        customer_type: form.customer_type,
        legal_name: form.legal_name.trim(),
        legal_name_ar: clean(form.legal_name_ar),
        cr_number: form.customer_type === 'business' ? clean(form.cr_number) : undefined,
        vat_number: form.customer_type === 'business' ? clean(form.vat_number) : undefined,
        national_id: clean(form.national_id),
        national_address_code: clean(form.national_address_code),
        phone: form.phone,
        email: clean(form.email),
        billing_building_number: clean(form.billing_building_number),
        billing_street: clean(form.billing_street),
        billing_district: clean(form.billing_district),
        billing_city: clean(form.billing_city),
        billing_postal_code: clean(form.billing_postal_code),
        billing_additional_number: clean(form.billing_additional_number),
        shipping_same_as_billing: form.shipping_same_as_billing,
        shipping_building_number: form.shipping_same_as_billing
          ? undefined
          : clean(form.shipping_building_number),
        shipping_street: form.shipping_same_as_billing ? undefined : clean(form.shipping_street),
        shipping_district: form.shipping_same_as_billing
          ? undefined
          : clean(form.shipping_district),
        shipping_city: form.shipping_same_as_billing ? undefined : clean(form.shipping_city),
        shipping_postal_code: form.shipping_same_as_billing
          ? undefined
          : clean(form.shipping_postal_code),
        shipping_additional_number: form.shipping_same_as_billing
          ? undefined
          : clean(form.shipping_additional_number),
        credit_limit: form.credit_limit ?? 0,
        currency_id: form.currency_id || undefined,
        payment_terms: form.payment_terms,
        status: form.status,
        notes: clean(form.notes),
      };
      if (customer) await customersService.update(customer.id, payload);
      else await customersService.create(payload);
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
    if (!customer) return;
    const { url, token } = customersService.downloadUrl(customer.id, doc.id);
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
    if (!customer) return;
    await customersService.uploadDoc(
      customer.id,
      file,
      meta as Parameters<typeof customersService.uploadDoc>[2],
    );
    await loadDocs(customer.id);
  };

  const handleDelete = async (docId: string) => {
    if (!customer) return;
    await customersService.removeDoc(customer.id, docId);
    await loadDocs(customer.id);
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
              {customer ? `Edit customer · ${customer.code}` : 'New customer'}
            </h3>
            <p className="text-xs text-brown-500">KSA-compliant customer record</p>
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
              disabled={t === 'documents' && !customer}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-gold-400 text-ink'
                  : 'border-transparent text-brown-500 hover:text-ink disabled:opacity-40'
              }`}
            >
              {t === 'documents' && !customer ? 'Documents (save first)' : t}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="space-y-4">
            <Pair>
              <Field label="Customer type *">
                <select
                  className="input"
                  value={form.customer_type}
                  onChange={(e) => set('customer_type', e.target.value as CustomerType)}
                  disabled={!canEdit || !!customer}
                >
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                </select>
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
            {form.customer_type === 'business' ? (
              <Pair>
                <Field label="Commercial Registration (CR) *" error={errors.cr_number}>
                  <input
                    className="input font-mono"
                    value={form.cr_number}
                    onChange={(e) => set('cr_number', e.target.value)}
                    disabled={!canEdit}
                    maxLength={10}
                  />
                </Field>
                <Field label="VAT Registration No." error={errors.vat_number}>
                  <input
                    className="input font-mono"
                    value={form.vat_number}
                    onChange={(e) => set('vat_number', e.target.value)}
                    disabled={!canEdit}
                    maxLength={15}
                  />
                </Field>
              </Pair>
            ) : (
              <Field label="National ID / Iqama *" error={errors.national_id}>
                <input
                  className="input font-mono"
                  value={form.national_id}
                  onChange={(e) => set('national_id', e.target.value)}
                  disabled={!canEdit}
                  maxLength={10}
                  placeholder="1XXXXXXXXX or 2XXXXXXXXX"
                />
              </Field>
            )}
            <Pair>
              <Field label="Phone (KSA) *" error={errors.phone}>
                <input
                  className="input font-mono"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  disabled={!canEdit}
                  placeholder="+9665XXXXXXXX"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Pair>
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
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-ink">Billing address</h4>
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
              <Pair>
                <Field label="Building number">
                  <input
                    className="input"
                    value={form.billing_building_number}
                    onChange={(e) => set('billing_building_number', e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Street">
                  <input
                    className="input"
                    value={form.billing_street}
                    onChange={(e) => set('billing_street', e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </Pair>
              <Pair>
                <Field label="District">
                  <input
                    className="input"
                    value={form.billing_district}
                    onChange={(e) => set('billing_district', e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="City">
                  <input
                    className="input"
                    value={form.billing_city}
                    onChange={(e) => set('billing_city', e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </Pair>
              <Pair>
                <Field label="Postal code" error={errors.billing_postal_code}>
                  <input
                    className="input font-mono"
                    value={form.billing_postal_code}
                    onChange={(e) => set('billing_postal_code', e.target.value)}
                    disabled={!canEdit}
                    maxLength={5}
                  />
                </Field>
                <Field label="Additional number" error={errors.billing_additional_number}>
                  <input
                    className="input font-mono"
                    value={form.billing_additional_number}
                    onChange={(e) => set('billing_additional_number', e.target.value)}
                    disabled={!canEdit}
                    maxLength={4}
                  />
                </Field>
              </Pair>
            </div>

            <div className="space-y-4 pt-4 border-t border-brown-100">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.shipping_same_as_billing}
                  onChange={(e) => set('shipping_same_as_billing', e.target.checked)}
                  disabled={!canEdit}
                />
                Shipping address same as billing
              </label>

              {!form.shipping_same_as_billing && (
                <>
                  <h4 className="text-sm font-semibold text-ink">Shipping address</h4>
                  <Pair>
                    <Field label="Building number">
                      <input
                        className="input"
                        value={form.shipping_building_number}
                        onChange={(e) => set('shipping_building_number', e.target.value)}
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="Street">
                      <input
                        className="input"
                        value={form.shipping_street}
                        onChange={(e) => set('shipping_street', e.target.value)}
                        disabled={!canEdit}
                      />
                    </Field>
                  </Pair>
                  <Pair>
                    <Field label="District">
                      <input
                        className="input"
                        value={form.shipping_district}
                        onChange={(e) => set('shipping_district', e.target.value)}
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="City">
                      <input
                        className="input"
                        value={form.shipping_city}
                        onChange={(e) => set('shipping_city', e.target.value)}
                        disabled={!canEdit}
                      />
                    </Field>
                  </Pair>
                  <Pair>
                    <Field label="Postal code" error={errors.shipping_postal_code}>
                      <input
                        className="input font-mono"
                        value={form.shipping_postal_code}
                        onChange={(e) => set('shipping_postal_code', e.target.value)}
                        disabled={!canEdit}
                        maxLength={5}
                      />
                    </Field>
                    <Field label="Additional number" error={errors.shipping_additional_number}>
                      <input
                        className="input font-mono"
                        value={form.shipping_additional_number}
                        onChange={(e) => set('shipping_additional_number', e.target.value)}
                        disabled={!canEdit}
                        maxLength={4}
                      />
                    </Field>
                  </Pair>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'financial' && (
          <div className="space-y-4">
            <Pair>
              <Field label="Credit limit">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.credit_limit ?? 0}
                  onChange={(e) => set('credit_limit', Number(e.target.value))}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Currency">
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
            </Pair>
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
          </div>
        )}

        {tab === 'documents' && customer && (
          <DocumentUploader
            docs={docs}
            docTypes={CUSTOMER_DOC_TYPES}
            docLabels={CUSTOMER_DOC_LABEL}
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
              {submitting ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}
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
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-brown-500">{error}</p>}
    </div>
  );
}
