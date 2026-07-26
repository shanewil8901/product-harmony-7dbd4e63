import { useEffect, useState, type FormEvent } from 'react';
import { usersService } from '../services/users.service';
import { masterDataService } from '../services/masterData.service';
import type { Role, RoleCode, UserRow } from '../types/product';

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleCode>('employee');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [u, r] = await Promise.all([usersService.list(), masterDataService.roles()]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await usersService.create({ email, name, password, role });
      setEmail('');
      setName('');
      setPassword('');
      setRole('employee');
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Could not create user')
          : 'Could not create user';
      setFormError(typeof msg === 'string' ? msg : 'Could not create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-serif text-2xl text-ink">Users</h1>
          <span className="text-sm text-brown-500">{users.length} total</span>
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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-brown-100">
                    <td className="px-4 py-3 text-ink">{u.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-medium text-forest-500">
                          {u.role.name}
                        </span>
                      ) : (
                        <span className="text-xs text-brown-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-brown-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside>
        <form onSubmit={onSubmit} className="card p-6 sticky top-6">
          <h2 className="font-serif text-xl text-ink">Create user</h2>
          <p className="mt-1 text-sm text-brown-500">Add a teammate and assign a role.</p>

          {formError && (
            <div className="mt-4 rounded-lg border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-600">
              {formError}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleCode)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="btn-forest w-full mt-6" disabled={saving}>
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </aside>
    </div>
  );
}
