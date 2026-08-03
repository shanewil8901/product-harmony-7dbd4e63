import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { canManageUsers } = usePermissions();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/products', label: 'Products' },
    { to: '/stock', label: 'Stock' },
    { to: '/vendors', label: 'Vendors' },
    { to: '/customers', label: 'Customers' },
    { to: '/history', label: 'History' },
    ...(canManageUsers
      ? [
          { to: '/employees', label: 'Employees' },
          { to: '/attendance', label: 'Attendance' },
          { to: '/payroll', label: 'Payroll' },
          { to: '/users', label: 'Users' },
        ]
      : []),

  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-paper-soft">
      <header className="border-b border-brown-100 bg-paper sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="h-8 w-8 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
              P
            </span>
            <span className="font-serif text-lg sm:text-xl text-ink">Product Manager</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((n) => (
              <NavItem key={n.to} to={n.to} end={n.to === '/'}>
                {n.label}
              </NavItem>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium text-ink truncate max-w-[160px]">{user?.name}</div>
              <div className="text-xs text-brown-500 truncate max-w-[160px]">{user?.email}</div>
            </div>
            <button
              className="btn-ghost !py-1.5 !px-3 text-sm hidden sm:inline-flex"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
            {/* Hamburger */}
            <button
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brown-100 text-ink"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? (
                  <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
                ) : (
                  <>
                    <path d="M4 7h16" strokeLinecap="round" />
                    <path d="M4 12h16" strokeLinecap="round" />
                    <path d="M4 17h16" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-brown-100 bg-paper">
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-forest-50 text-forest-500'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              <div className="mt-2 pt-2 border-t border-brown-100 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{user?.name}</div>
                  <div className="text-xs text-brown-500 truncate">{user?.email}</div>
                </div>
                <button
                  className="btn-ghost !py-1.5 !px-3 text-sm"
                  onClick={() => {
                    closeMobile();
                    logout();
                    navigate('/login');
                  }}
                >
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
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
