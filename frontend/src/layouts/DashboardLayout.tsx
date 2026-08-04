import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import {
  IconBox,
  IconClock,
  IconDashboard,
  IconHistory,
  IconIdCard,
  IconLayers,
  IconShield,
  IconTruck,
  IconUsers,
  IconWallet,
} from '../components/NavIcons';

type Item = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
};
type Group = { title: string; items: Item[] };

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { canManageUsers } = usePermissions();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const groups: Group[] = [
    {
      title: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: IconDashboard, end: true }],
    },
    {
      title: 'Operations',
      items: [
        { to: '/products', label: 'Products', icon: IconBox },
        { to: '/stock', label: 'Stock', icon: IconLayers },
        { to: '/history', label: 'History', icon: IconHistory },
      ],
    },
    {
      title: 'Partners',
      items: [
        { to: '/vendors', label: 'Vendors', icon: IconTruck },
        { to: '/customers', label: 'Customers', icon: IconUsers },
      ],
    },
    {
      title: 'My workspace',
      items: [{ to: '/my-attendance', label: 'Check in / out', icon: IconClock }],
    },
    ...(canManageUsers
      ? [
          {
            title: 'People',
            items: [
              { to: '/employees', label: 'Employees', icon: IconIdCard },
              { to: '/attendance', label: 'Attendance', icon: IconClock },
            ],
          },
          {
            title: 'Finance',
            items: [{ to: '/payroll', label: 'Payroll', icon: IconWallet }],
          },
          {
            title: 'Administration',
            items: [{ to: '/users', label: 'Users & roles', icon: IconShield }],
          },
        ]
      : []),
  ];

  const closeMobile = () => setMobileOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-16 shrink-0 px-5 flex items-center gap-2 border-b border-brown-100">
        <Link to="/" onClick={closeMobile} className="flex min-w-0 items-center gap-2">
          <span className="h-8 w-8 shrink-0 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
            P
          </span>
          <span className="truncate font-serif text-lg text-ink">Product Manager</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brown-500">
              {g.title}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-forest-50 text-forest-500'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                    }`
                  }
                >
                  <item.icon className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-brown-100 p-3">
        <div className="rounded-xl bg-paper-warm px-3 py-2.5">
          <div className="truncate text-sm font-medium text-ink">{user?.name}</div>
          <div className="truncate text-xs text-brown-500">{user?.email}</div>
          {user?.role && (
            <div className="mt-1 inline-flex rounded-md bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brown-500">
              {user.role.name ?? user.role.code}
            </div>
          )}
        </div>
        <button
          className="btn-ghost mt-2 w-full !py-1.5 text-sm"
          onClick={() => {
            closeMobile();
            logout();
            navigate('/login');
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-soft">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-64 border-r border-brown-100 bg-paper">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-paper border-r border-brown-100">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="lg:hidden sticky top-0 z-30 h-16 border-b border-brown-100 bg-paper">
          <div className="flex h-full items-center justify-between px-4">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brown-100 text-ink"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16" strokeLinecap="round" />
                <path d="M4 12h16" strokeLinecap="round" />
                <path d="M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <Link to="/" className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
                P
              </span>
              <span className="font-serif text-lg text-ink">Product Manager</span>
            </Link>
            <span className="w-10" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
