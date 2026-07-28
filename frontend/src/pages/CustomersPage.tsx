import { useEffect, useState } from 'react';
import { customersService } from '../services/customers.service';
import type { Customer, CustomerType } from '../types/customer';
import { PAYMENT_TERM_LABEL } from '../types/customer';
import { CustomerModal } from '../components/CustomerModal';
import { useAuth } from '../hooks/useAuth';

export function CustomersPage() {
  const { user } = useAuth();
  const role = user?.role?.code;
  const canEdit = role === 'admin' || role === 'manager' || role === 'sales';
  const canDelete = role === 'admin' || role === 'manager';

  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [type, setType] = useState<'' | CustomerType>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customersService.list({
        search: search.trim() || undefined,
        status: status || undefined,
        customer_type: type || undefined,
        limit: 100,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (c: Customer) => {
    if (!window.confirm(`Delete customer "${c.legal_name}"? This removes all uploaded documents.`))
      return;
    await customersService.remove(c.id);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Customers</h1>
          <p className="text-sm text-brown-500">
            Saudi-compliant customer register · {total} record{total === 1 ? '' : 's'}
          </p>
        </div>
        {canEdit && (
          <button className="btn-gold" onClick={() => setCreating(true)}>
            + New customer
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Name, CR, National ID, phone, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as '' | CustomerType)}
          >
            <option value="">All</option>
            <option value="business">Business</option>
            <option value="individual">Individual</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | 'active' | 'inactive')}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="btn-ghost" onClick={load}>
          Apply
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-sm text-brown-500">Loading…</div>
      ) : error ? (
        <div className="card p-6 text-sm text-brown-600">{error}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Credit</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-brown-100">
                  <td className="px-4 py-3 font-mono text-ink">{c.code}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink font-medium">{c.legal_name}</div>
                    {c.legal_name_ar && (
                      <div className="text-xs text-brown-500" dir="rtl">
                        {c.legal_name_ar}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{c.customer_type}</td>
                  <td className="px-4 py-3 text-ink-muted font-mono text-xs">
                    {c.customer_type === 'business' ? (
                      <>
                        <div>CR: {c.cr_number ?? '—'}</div>
                        <div>VAT: {c.vat_number ?? '—'}</div>
                      </>
                    ) : (
                      <div>ID: {c.national_id ?? '—'}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <div>{c.phone}</div>
                    {c.email && <div className="text-xs">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted font-mono text-xs">
                    {Number(c.credit_limit).toFixed(2)} {c.currency?.code ?? ''}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {PAYMENT_TERM_LABEL[c.payment_terms]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.status === 'active'
                          ? 'bg-forest-50 text-forest-500'
                          : 'bg-brown-50 text-brown-500'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      className="btn-ghost !py-1 !px-2 text-xs"
                      onClick={() => setEditing(c)}
                    >
                      {canEdit ? 'Edit' : 'View'}
                    </button>
                    {canDelete && (
                      <button
                        className="btn-danger !py-1 !px-2 text-xs ml-2"
                        onClick={() => remove(c)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-brown-500">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <CustomerModal
          customer={editing}
          canEdit={canEdit}
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
    </div>
  );
}
