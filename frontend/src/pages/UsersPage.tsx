import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersService } from '../services/users.service';
import type { UserRow } from '../types/product';
import { usePermissions } from '../hooks/usePermissions';

export function UsersPage() {
  const { canManageUsers } = usePermissions();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersService.list());
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-ink">Users &amp; roles</h1>
        <span className="text-sm text-brown-500">{users.length} accounts</span>
      </div>

      <div
        role="note"
        className="card border border-gold-400/40 bg-paper-warm p-4 text-sm text-ink-muted"
      >
        <strong className="text-ink">Accounts are created from Employees.</strong> Every login is
        issued together with its HR profile, so new users cannot be added here — that would create
        a login with no employee record. Use{' '}
        <Link to="/employees" className="underline text-forest-500">
          Employees → New employee
        </Link>{' '}
        to add someone, and open their record there to change role or password.
      </div>

      {loading ? (
        <div className="card p-8 text-sm text-brown-500">Loading…</div>
      ) : error ? (
        <div className="card p-6 text-sm text-brown-600">
          {error}{' '}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
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
    </div>
  );
}
