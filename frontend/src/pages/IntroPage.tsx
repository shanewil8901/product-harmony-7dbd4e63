import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Dialog';
import { Combobox } from '../components/Combobox';

/**
 * Public, single-page introduction to Product Manager. This is the marketing /
 * orientation page shown before sign-in — it explains what the system does and
 * links into the app.
 */

type Area = 'catalog' | 'operations' | 'people';

const AREAS: { value: Area; label: string }[] = [
  { value: 'catalog', label: 'Catalog' },
  { value: 'operations', label: 'Operations' },
  { value: 'people', label: 'People' },
];

const FEATURES: { title: string; body: string; area: Area }[] = [
  {
    title: 'Product catalog',
    body: 'Every SKU with units of measure, currency, department and generated barcodes — searchable by code or barcode.',
    area: 'catalog',
  },
  {
    title: 'Vendors & customers',
    body: 'Trading partners with CR/VAT details, contact numbers and supporting documents kept on the record.',
    area: 'catalog',
  },
  {
    title: 'Stock & inventory',
    body: 'Receive, adjust and move stock through a documented lifecycle, with manufacture and expiry dates enforced.',
    area: 'operations',
  },
  {
    title: 'Sales orders',
    body: 'Quotations through invoices and payments, with printable documents and a complete sales history.',
    area: 'operations',
  },
  {
    title: 'Employees & attendance',
    body: 'Employee profiles, daily punches and self-service attendance for every member of the team.',
    area: 'people',
  },
  {
    title: 'Leave & payroll',
    body: 'Tiered leave approvals that record who approved what, plus payroll settings and payslip generation.',
    area: 'people',
  },
];

const STEPS = [
  'Sign in with the bootstrap account created on first start.',
  'Create the first administrator — the temporary account is removed automatically.',
  'Add departments, units and currencies, then load your product catalog.',
  'Invite the team and start recording stock, sales and attendance.',
];

export function IntroPage() {
  const [area, setArea] = useState<'' | Area>('');
  const [jump, setJump] = useState('');
  const [tourOpen, setTourOpen] = useState(false);

  const visible = useMemo(
    () => (area ? FEATURES.filter((f) => f.area === area) : FEATURES),
    [area],
  );

  const jumpOptions = FEATURES.map((f) => ({
    value: f.title,
    label: f.title,
    hint: AREAS.find((a) => a.value === f.area)?.label,
  }));

  return (
    <div className="min-h-dvh bg-paper-soft">
      <header className="border-b border-brown-100 bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400 font-bold text-ink">
              P
            </span>
            <span className="font-serif text-xl text-ink">Product Manager</span>
          </div>
          <Link className="btn-primary" to="/login">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-8">
        <section className="space-y-4">
          <p className="label">Introduction</p>
          <h1 className="text-4xl leading-tight text-ink">
            One system for your <span className="text-gold-700">products</span>, stock and team.
          </h1>
          <p className="max-w-2xl text-brown-500">
            Product Manager keeps the catalog, warehouse movements, sales paperwork and HR records
            in a single place — so a product code, its stock, its last invoice and the person who
            handled it are never more than one screen apart.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-gold" to="/login">
              Open the app
            </Link>
            <button className="btn-ghost" type="button" onClick={() => setTourOpen(true)}>
              How it fits together
            </button>
          </div>
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="modules-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="modules-heading" className="text-2xl text-ink">
              What&rsquo;s inside
            </h2>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px]">
                <label className="label" htmlFor="area-filter">
                  Filter by area
                </label>
                <select
                  id="area-filter"
                  className="input"
                  value={area}
                  onChange={(e) => setArea(e.target.value as '' | Area)}
                >
                  <option value="">All areas</option>
                  {AREAS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px]">
                <label className="label" htmlFor="module-jump">
                  Find a module
                </label>
                <Combobox
                  id="module-jump"
                  options={jumpOptions}
                  value={jump}
                  onChange={setJump}
                  allowClear
                  clearLabel="All modules"
                  placeholder="Type a module name…"
                />
              </div>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {visible
              .filter((f) => !jump || f.title === jump)
              .map((f) => (
                <li key={f.title} className="rounded-xl border border-brown-100 bg-paper p-4">
                  <h3 className="font-serif text-base text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm text-brown-500">{f.body}</p>
                </li>
              ))}
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="start-heading">
          <h2 id="start-heading" className="text-2xl text-ink">
            Getting started
          </h2>
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-brown-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 text-xs font-semibold text-ink">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-brown-100 py-6 text-center text-xs text-brown-500">
        © {new Date().getFullYear()} Product Manager
      </footer>

      {tourOpen && (
        <Modal
          title="How it fits together"
          subtitle="A single flow from catalog to cash"
          onClose={() => setTourOpen(false)}
          footer={
            <button className="btn-gold" onClick={() => setTourOpen(false)}>
              Got it
            </button>
          }
        >
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>Products define what you trade, with units, currency and barcodes.</li>
            <li>Stock records what you hold, tracked through documented lifecycle stages.</li>
            <li>Sales draw down stock and produce invoices, payments and history.</li>
            <li>People run all of it — attendance, leave approvals and payroll included.</li>
          </ul>
        </Modal>
      )}
    </div>
  );
}
