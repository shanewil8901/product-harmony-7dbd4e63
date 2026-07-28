import { useEffect, useState, type FormEvent } from 'react';
import { usersService } from '../services/users.service';
import { masterDataService } from '../services/masterData.service';
import type { Role, RoleCode, UserRow } from '../types/product';
import { usePermissions } from '../hooks/usePermissions';
import { EMAIL_RE, HELP } from '../lib/validators';
import { toast } from '../lib/toast';
import type { ApiError } from '../services/api';

export function UsersPage() {
  const { canManageUsers } = usePermissions();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleCode>('employee');
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    if (canManageUsers) void load();
    else setLoading(false);
  }, [canManageUsers]);

  if (!canManageUsers) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-brown-500">
          You need an admin or manager role to manage users.
        </p>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (name.trim().length < 2) e.name = 'At least 2 characters';
    if (!email.trim()) e.email = 'Required';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    if (!role) e.role = 'Required';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await usersService.create({ email, name, password, role });
      toast('success', 'User created');
      setEmail('');
      setName('');
      setPassword('');
      setRole('employee');
      setFormErrors({});
      await load();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setFormErrors({ ...apiErr.fieldErrors, form: apiErr.userMessage ?? 'Could not create user' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_360px]">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
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
                      <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
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
          </div>
        )}
      </section>

      <aside>
        <form onSubmit={onSubmit} noValidate className="card p-6 lg:sticky lg:top-6">
          <h2 className="font-serif text-xl text-ink">Create user</h2>
          <p className="mt-1 text-sm text-brown-500">Add a teammate and assign a role.</p>

          {formErrors.form && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-brown-300 bg-brown-50 px-3 py-2 text-sm text-brown-700"
            >
              {formErrors.form}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <Field label="Full name" error={formErrors.name} help="Displayed across the app">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="Email" error={formErrors.email} help={HELP.EMAIL}>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="Password" error={formErrors.password} help={HELP.PASSWORD}>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
              />
            </Field>
            <Field label="Role" error={formErrors.role}>
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
            </Field>
          </div>

          <button type="submit" className="btn-forest w-full mt-6" disabled={saving}>
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      <p className={`mt-1 text-xs ${error ? 'text-brown-700' : 'text-brown-500'}`}>
        {error ?? help ?? ' '}
      </p>
    </div>
  );
}
