import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-paper-soft">
      <header className="border-b border-brown-100 bg-paper">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
              P
            </span>
            <span className="font-serif text-xl text-ink">Product Manager</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/products">Products</NavItem>
            <NavItem to="/stock">Stock</NavItem>
            <NavItem to="/vendors">Vendors</NavItem>
            <NavItem to="/customers">Customers</NavItem>
            <NavItem to="/history">History</NavItem>
            {(user?.role?.code === 'admin' || user?.role?.code === 'manager') && (
              <NavItem to="/users">Users</NavItem>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-ink">{user?.name}</div>
              <div className="text-xs text-brown-500">{user?.email}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-forest-50 text-forest-500'
            : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
