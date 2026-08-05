import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { employeesService } from '../services/hr.service';
import { masterDataService } from '../services/masterData.service';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from '../lib/toast';
import { EMAIL_RE, HELP, KSA } from '../lib/validators';
import type { ApiError } from '../services/api';
import type { Currency, Department, Role, RoleCode } from '../types/product';
import {
  HR_CURRENCY,

  CONTRACT_TYPES,
  CONTRACT_TYPE_LABEL,
  EMPLOYEE_DOC_LABEL,
  EMPLOYEE_DOC_TYPES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABEL,
  type CreateEmployeePayload,
  type Employee,
  type EmployeeDocType,
  type EmployeeDocument,
  type EmploymentStatus,
} from '../types/hr';

type FormState = Record<string, string>;

const EMPTY: FormState = {
  email: '',
  password: '',
  role: 'employee',
  first_name: '',
  last_name: '',
  iqama_number: '',
  iqama_expiry: '',
  nationality: '',
  date_of_birth: '',
  mobile: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  address_line1: '',
  address_city: '',
  address_postal_code: '',
  bank_name: '',
  bank_account_name: '',
  iban: '',
  job_title: '',
  department_id: '',
  join_date: '',
  contract_type: 'full_time',
  employment_status: 'active',
  basic_salary: '',
  housing_allowance: '',
  transport_allowance: '',
  other_allowance: '',
  salary_currency_id: '',
  notes: '',
};

function Field({
  label,
  required,
  error,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-brown-400">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-brown-600">{error}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-brown-400">{help}</p>
      ) : null}
    </div>
  );
}

export function EmployeesPage() {
  const { canManageUsers, isAdmin, isManager } = usePermissions();
  const canEdit = isAdmin || isManager;

  const [rows, setRows] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [docsFor, setDocsFor] = useState<Employee | null>(null);
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [docType, setDocType] = useState<EmployeeDocType>('iqama');
  const [uploading, setUploading] = useState(false);

  const [emailChecking, setEmailChecking] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ taken: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /**
   * Debounced, read-only lookup of the typed email. Nothing is written — it only
   * warns the user before they submit so no existing account is ever touched.
   */
  useEffect(() => {
    if (editing || !modalOpen) {
      setEmailNotice(null);
      return;
    }
    const email = form.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      setEmailNotice(null);
      return;
    }
    let cancelled = false;
    setEmailChecking(true);
    const t = window.setTimeout(() => {
      void employeesService
        .checkEmail(email)
        .then((res) => {
          if (cancelled) return;
          if (!res.exists) {
            setEmailNotice({ taken: false, message: 'This email is available.' });
          } else if (res.has_employee_profile) {
            setEmailNotice({
              taken: true,
              message: `This email already exists in the user system and is linked to employee ${res.employee_code}. Use a different email.`,
            });
          } else {
            setEmailNotice({
              taken: true,
              message:
                'This email already exists in the user system as a login account. Use a different email — existing accounts are never overwritten.',
            });
          }
        })
        .catch(() => {
          if (!cancelled) setEmailNotice(null);
        })
        .finally(() => {
          if (!cancelled) setEmailChecking(false);
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setEmailChecking(false);
    };
  }, [form.email, editing, modalOpen]);


  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await employeesService.list({
        search: search.trim() || undefined,
        status: status || undefined,
      });
      setRows(list);
    } catch (e) {
      setLoadError((e as ApiError).userMessage ?? 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [r, d, c] = await Promise.all([
          masterDataService.roles(),
          masterDataService.departments(),
          masterDataService.currencies(),
        ]);
        setRoles(r);
        setDepartments(d);
        setCurrencies(c);
      } catch (e) {
        toast('error', (e as ApiError).userMessage ?? 'Could not load master data');
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers]);

  const totals = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.employment_status === 'active').length,
    }),
    [rows],
  );

  if (!canManageUsers) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-brown-500">
          You need an admin or manager role to manage employees.
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, salary_currency_id: currencies[0]?.id ?? '' });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setErrors({});
    setForm({
      ...EMPTY,
      email: e.email ?? '',
      password: '',
      role: e.role?.code ?? 'employee',
      first_name: e.first_name,
      last_name: e.last_name,
      iqama_number: e.iqama_number,
      iqama_expiry: e.iqama_expiry ?? '',
      nationality: e.nationality ?? '',
      date_of_birth: e.date_of_birth ?? '',
      mobile: e.mobile,
      emergency_contact_name: e.emergency_contact_name ?? '',
      emergency_contact_phone: e.emergency_contact_phone ?? '',
      address_line1: e.address_line1,
      address_city: e.address_city,
      address_postal_code: e.address_postal_code ?? '',
      bank_name: e.bank_name,
      bank_account_name: e.bank_account_name ?? '',
      iban: e.iban,
      job_title: e.job_title,
      department_id: e.department_id ?? '',
      join_date: e.join_date,
      contract_type: e.contract_type,
      employment_status: e.employment_status,
      basic_salary: e.basic_salary,
      housing_allowance: e.housing_allowance,
      transport_allowance: e.transport_allowance,
      other_allowance: e.other_allowance,
      salary_currency_id: e.salary_currency_id ?? '',
      notes: e.notes ?? '',
    });
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const req = (k: string, msg = 'Required') => {
      if (!form[k]?.trim()) e[k] = msg;
    };
    if (!editing) {
      if (!form.email.trim()) e.email = 'Required';
      else if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address';
      else if (emailNotice?.taken) e.email = emailNotice.message;
      if (!form.password) e.password = 'Required';
      else if (form.password.length < 6) e.password = HELP.PASSWORD;
    } else if (form.password && form.password.length < 6) {
      e.password = HELP.PASSWORD;
    }
    req('first_name');
    req('last_name');
    if (!KSA.NATIONAL_ID.test(form.iqama_number)) e.iqama_number = HELP.NATIONAL_ID;
    if (!KSA.PHONE.test(form.mobile)) e.mobile = HELP.PHONE;
    if (form.emergency_contact_phone && !KSA.PHONE.test(form.emergency_contact_phone))
      e.emergency_contact_phone = HELP.PHONE;
    req('address_line1');
    req('address_city');
    if (form.address_postal_code && !KSA.POSTAL.test(form.address_postal_code))
      e.address_postal_code = HELP.POSTAL;
    req('bank_name');
    if (!KSA.IBAN.test(form.iban)) e.iban = HELP.IBAN;
    req('job_title');
    req('join_date');
    if (form.basic_salary === '' || Number.isNaN(Number(form.basic_salary)))
      e.basic_salary = 'Enter a valid amount';
    else if (Number(form.basic_salary) < 0) e.basic_salary = 'Cannot be negative';
    setErrors(e);
    if (Object.keys(e).length) toast('error', 'Please fix the highlighted fields.');
    return Object.keys(e).length === 0;
  };

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const str = (v: string) => (v.trim() === '' ? undefined : v.trim());

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const base = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        iqama_number: form.iqama_number.trim(),
        iqama_expiry: str(form.iqama_expiry),
        nationality: str(form.nationality),
        date_of_birth: str(form.date_of_birth),
        mobile: form.mobile.trim(),
        emergency_contact_name: str(form.emergency_contact_name),
        emergency_contact_phone: str(form.emergency_contact_phone),
        address_line1: form.address_line1.trim(),
        address_city: form.address_city.trim(),
        address_postal_code: str(form.address_postal_code),
        bank_name: form.bank_name.trim(),
        bank_account_name: str(form.bank_account_name),
        iban: form.iban.trim(),
        job_title: form.job_title.trim(),
        department_id: str(form.department_id),
        join_date: form.join_date,
        contract_type: form.contract_type as CreateEmployeePayload['contract_type'],
        employment_status: form.employment_status as EmploymentStatus,
        basic_salary: Number(form.basic_salary),
        housing_allowance: num(form.housing_allowance),
        transport_allowance: num(form.transport_allowance),
        other_allowance: num(form.other_allowance),
        notes: str(form.notes),
      };

      if (editing) {
        await employeesService.update(editing.id, {
          ...base,
          role: form.role as RoleCode,
          password: form.password || undefined,
        });
        toast('success', 'Employee updated');
      } else {
        await employeesService.create({
          ...base,
          email: form.email.trim(),
          password: form.password,
          role: form.role as RoleCode,
        });
        toast('success', 'Employee created');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({ ...apiErr.fieldErrors });
      toast('error', apiErr.userMessage ?? 'Could not save employee');
    } finally {
      setSaving(false);
    }
  };

  const openDocs = async (e: Employee) => {
    setDocsFor(e);
    setDocType('iqama');
    try {
      setDocs(await employeesService.documents(e.id));
    } catch (err) {
      toast('error', (err as ApiError).userMessage ?? 'Could not load documents');
      setDocs([]);
    }
  };

  const upload = async (file: File) => {
    if (!docsFor) return;
    setUploading(true);
    try {
      await employeesService.uploadDocument(docsFor.id, file, docType);
      setDocs(await employeesService.documents(docsFor.id));
      toast('success', 'Document uploaded');
    } catch (err) {
      toast('error', (err as ApiError).userMessage ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (docId: string) => {
    if (!docsFor) return;
    try {
      await employeesService.deleteDocument(docsFor.id, docId);
      setDocs((d) => d.filter((x) => x.id !== docId));
      toast('success', 'Document removed');
    } catch (err) {
      toast('error', (err as ApiError).userMessage ?? 'Could not delete document');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Employees</h1>
          <p className="text-sm text-brown-500">
            {totals.total} total · {totals.active} active
          </p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            New employee
          </button>
        )}
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        <input
          className="input"
          placeholder="Search name, code, Iqama or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
        />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EMPLOYMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={() => void load()}>
          Apply
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-sm text-brown-500">Loading…</div>
      ) : loadError ? (
        <div className="card p-6 text-sm text-brown-600">
          {loadError}{' '}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Gross salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-brown-100">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {e.employee_code}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      <div>{e.full_name}</div>
                      <div className="text-xs text-brown-500">{e.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{e.job_title}</td>
                    <td className="px-4 py-3 text-ink-muted">{e.department_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{e.role?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{e.mobile}</td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">
                      {e.salary_currency_code ?? ''} {e.gross_salary}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-medium text-forest-500">
                        {EMPLOYMENT_STATUS_LABEL[e.employment_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => openEdit(e)}>
                        Edit
                      </button>{' '}
                      <button
                        className="btn-ghost !py-1 !px-2 text-xs"
                        onClick={() => void openDocs(e)}
                      >
                        Documents
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-brown-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
          <form
            onSubmit={onSubmit}
            className="card my-6 w-full max-w-3xl p-5 sm:p-6 space-y-5"
            noValidate
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">
                {editing ? `Edit ${editing.full_name}` : 'New employee'}
              </h2>
              <button type="button" className="btn-ghost !py-1 !px-3" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
                Login &amp; role
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Email"
                  required={!editing}
                  error={errors.email}
                  help={emailNotice ? undefined : HELP.EMAIL}
                >
                  <input
                    className="input"
                    value={form.email}
                    disabled={!!editing}
                    onChange={(e) => set('email', e.target.value)}
                  />
                  {!editing && emailChecking && (
                    <p className="mt-1 text-xs text-brown-500">Checking email…</p>
                  )}
                  {!editing && emailNotice && (
                    <p
                      role="alert"
                      className={`mt-1 text-xs ${
                        emailNotice.taken ? 'text-brown-600 font-medium' : 'text-forest-500'
                      }`}
                    >
                      {emailNotice.message}
                    </p>
                  )}
                </Field>

                <Field
                  label={editing ? 'New password' : 'Password'}
                  required={!editing}
                  error={errors.password}
                  help={editing ? 'Leave blank to keep current' : HELP.PASSWORD}
                >
                  <input
                    className="input"
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                  />
                </Field>
                <Field label="Role" required error={errors.role}>
                  <select
                    className="input"
                    value={form.role}
                    onChange={(e) => set('role', e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
                Personal
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="First name" required error={errors.first_name}>
                  <input
                    className="input"
                    value={form.first_name}
                    onChange={(e) => set('first_name', e.target.value)}
                  />
                </Field>
                <Field label="Last name" required error={errors.last_name}>
                  <input
                    className="input"
                    value={form.last_name}
                    onChange={(e) => set('last_name', e.target.value)}
                  />
                </Field>
                <Field
                  label="Iqama / National ID"
                  required
                  error={errors.iqama_number}
                  help={HELP.NATIONAL_ID}
                >
                  <input
                    className="input"
                    value={form.iqama_number}
                    onChange={(e) => set('iqama_number', e.target.value)}
                  />
                </Field>
                <Field label="Iqama expiry" error={errors.iqama_expiry}>
                  <input
                    className="input"
                    type="date"
                    value={form.iqama_expiry}
                    onChange={(e) => set('iqama_expiry', e.target.value)}
                  />
                </Field>
                <Field label="Nationality" error={errors.nationality}>
                  <input
                    className="input"
                    value={form.nationality}
                    onChange={(e) => set('nationality', e.target.value)}
                  />
                </Field>
                <Field label="Date of birth" error={errors.date_of_birth}>
                  <input
                    className="input"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                  />
                </Field>
                <Field label="Mobile" required error={errors.mobile} help={HELP.PHONE}>
                  <input
                    className="input"
                    value={form.mobile}
                    onChange={(e) => set('mobile', e.target.value)}
                  />
                </Field>
                <Field label="Emergency contact" error={errors.emergency_contact_name}>
                  <input
                    className="input"
                    value={form.emergency_contact_name}
                    onChange={(e) => set('emergency_contact_name', e.target.value)}
                  />
                </Field>
                <Field
                  label="Emergency phone"
                  error={errors.emergency_contact_phone}
                  help={HELP.PHONE}
                >
                  <input
                    className="input"
                    value={form.emergency_contact_phone}
                    onChange={(e) => set('emergency_contact_phone', e.target.value)}
                  />
                </Field>
                <Field label="Address" required error={errors.address_line1}>
                  <input
                    className="input"
                    value={form.address_line1}
                    onChange={(e) => set('address_line1', e.target.value)}
                  />
                </Field>
                <Field label="City" required error={errors.address_city}>
                  <input
                    className="input"
                    value={form.address_city}
                    onChange={(e) => set('address_city', e.target.value)}
                  />
                </Field>
                <Field label="Postal code" error={errors.address_postal_code} help={HELP.POSTAL}>
                  <input
                    className="input"
                    value={form.address_postal_code}
                    onChange={(e) => set('address_postal_code', e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
                Bank details
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Bank name" required error={errors.bank_name}>
                  <input
                    className="input"
                    value={form.bank_name}
                    onChange={(e) => set('bank_name', e.target.value)}
                  />
                </Field>
                <Field label="Account holder" error={errors.bank_account_name}>
                  <input
                    className="input"
                    value={form.bank_account_name}
                    onChange={(e) => set('bank_account_name', e.target.value)}
                  />
                </Field>
                <Field label="IBAN" required error={errors.iban} help={HELP.IBAN}>
                  <input
                    className="input"
                    value={form.iban}
                    onChange={(e) => set('iban', e.target.value.toUpperCase())}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brown-500">
                Employment &amp; compensation
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Job title" required error={errors.job_title}>
                  <input
                    className="input"
                    value={form.job_title}
                    onChange={(e) => set('job_title', e.target.value)}
                  />
                </Field>
                <Field label="Department" error={errors.department_id}>
                  <select
                    className="input"
                    value={form.department_id}
                    onChange={(e) => set('department_id', e.target.value)}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Join date" required error={errors.join_date}>
                  <input
                    className="input"
                    type="date"
                    value={form.join_date}
                    onChange={(e) => set('join_date', e.target.value)}
                  />
                </Field>
                <Field label="Contract type" error={errors.contract_type}>
                  <select
                    className="input"
                    value={form.contract_type}
                    onChange={(e) => set('contract_type', e.target.value)}
                  >
                    {CONTRACT_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {CONTRACT_TYPE_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Employment status" error={errors.employment_status}>
                  <select
                    className="input"
                    value={form.employment_status}
                    onChange={(e) => set('employment_status', e.target.value)}
                  >
                    {EMPLOYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {EMPLOYMENT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Salary currency"
                  help="HR payroll is always recorded in Saudi Riyal"
                >
                  <input
                    className="input bg-paper-warm cursor-not-allowed"
                    value={`${HR_CURRENCY.code} — ${HR_CURRENCY.name}`}
                    readOnly
                    disabled
                  />
                </Field>

                <Field label="Basic salary" required error={errors.basic_salary}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.basic_salary}
                    onChange={(e) => set('basic_salary', e.target.value)}
                  />
                </Field>
                <Field label="Housing allowance" error={errors.housing_allowance}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.housing_allowance}
                    onChange={(e) => set('housing_allowance', e.target.value)}
                  />
                </Field>
                <Field label="Transport allowance" error={errors.transport_allowance}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.transport_allowance}
                    onChange={(e) => set('transport_allowance', e.target.value)}
                  />
                </Field>
                <Field label="Other allowance" error={errors.other_allowance}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.other_allowance}
                    onChange={(e) => set('other_allowance', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notes" error={errors.notes}>
                <textarea
                  className="input min-h-[72px]"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </section>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create employee'}
              </button>
            </div>
          </form>
        </div>
      )}

      {docsFor && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
          <div className="card my-6 w-full max-w-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Documents — {docsFor.full_name}</h2>
              <button className="btn-ghost !py-1 !px-3" onClick={() => setDocsFor(null)}>
                Close
              </button>
            </div>

            {canEdit && (
              <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                <select
                  className="input"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as EmployeeDocType)}
                >
                  {EMPLOYEE_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYEE_DOC_LABEL[t]}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void upload(f);
                  }}
                />
              </div>
            )}
            <p className="text-xs text-brown-400">PDF, JPG, PNG or WEBP · max 10 MB</p>

            <div className="divide-y divide-brown-100 border-t border-brown-100">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{d.file_name}</div>
                    <div className="text-xs text-brown-500">
                      {EMPLOYEE_DOC_LABEL[d.doc_type]} ·{' '}
                      {(d.size_bytes / 1024).toFixed(0)} KB ·{' '}
                      {new Date(d.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button
                      className="btn-ghost !py-1 !px-2 text-xs"
                      onClick={() =>
                        void employeesService
                          .openDocument(docsFor.id, d)
                          .catch((err) => toast('error', (err as Error).message))
                      }
                    >
                      View
                    </button>{' '}
                    {canEdit && (
                      <button
                        className="btn-danger !py-1 !px-2 text-xs"
                        onClick={() => void removeDoc(d.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {docs.length === 0 && (
                <p className="py-6 text-center text-sm text-brown-500">No documents uploaded.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
