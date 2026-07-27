import { useEffect, useState } from 'react';
import { vendorsService } from '../services/vendors.service';
import type { Vendor } from '../types/vendor';
import { PAYMENT_TERM_LABEL } from '../types/vendor';
import { VendorModal } from '../components/VendorModal';
import { useAuth } from '../hooks/useAuth';

export function VendorsPage() {
  const { user } = useAuth();
  const canEdit = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const [rows, setRows] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vendorsService.list({
        search: search.trim() || undefined,
        status: status || undefined,
        limit: 100,
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (v: Vendor) => {
    if (!window.confirm(`Delete vendor "${v.legal_name}"? This removes all uploaded documents.`))
      return;
    await vendorsService.remove(v.id);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Vendors</h1>
          <p className="text-sm text-brown-500">
            Saudi-compliant supplier register · {total} record{total === 1 ? '' : 's'}
          </p>
        </div>
        {canEdit && (
          <button className="btn-gold" onClick={() => setCreating(true)}>
            + New vendor
          </button>
        )}
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Name, CR, VAT, phone, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
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
          <table className="w-full text-sm">
            <thead className="bg-paper-warm text-left text-xs uppercase tracking-wide text-brown-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">CR / VAT</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-brown-100">
                  <td className="px-4 py-3 font-mono text-ink">{v.code}</td>
                  <td className="px-4 py-3">
                    <div className="text-ink font-medium">{v.legal_name}</div>
                    {v.legal_name_ar && (
                      <div className="text-xs text-brown-500" dir="rtl">
                        {v.legal_name_ar}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted font-mono text-xs">
                    <div>CR: {v.cr_number}</div>
                    <div>VAT: {v.vat_number ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <div>{v.phone}</div>
                    {v.email && <div className="text-xs">{v.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <div>{PAYMENT_TERM_LABEL[v.payment_terms]}</div>
                    <div className="text-xs">Lead {v.lead_time_days}d</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        v.status === 'active'
                          ? 'bg-forest-50 text-forest-500'
                          : 'bg-brown-50 text-brown-500'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      className="btn-ghost !py-1 !px-2 text-xs"
                      onClick={() => setEditing(v)}
                    >
                      {canEdit ? 'Edit' : 'View'}
                    </button>
                    {canEdit && (
                      <button
                        className="btn-danger !py-1 !px-2 text-xs ml-2"
                        onClick={() => remove(v)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brown-500">
                    No vendors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <VendorModal
          vendor={editing}
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
