import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ConfirmDialog } from '../components/Dialog';
import { usePermissions } from '../hooks/usePermissions';
import {
  IconBox,
  IconCalendar,
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
type Group = { title: string; items: Item[]; icon?: ComponentType<SVGProps<SVGSVGElement>> };

const COLLAPSE_KEY = 'nav:collapsed';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const {
    canManageUsers,
    canConfigureLeave,
    canViewDashboard,
    canViewProducts,
    canViewStock,
    canViewSales,
    canViewVendors,
    canViewCustomers,
  } = perms;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Icon-only rail on desktop, persisted between visits.
  const [railCollapsed, setRailCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(COLLAPSE_KEY) === '1',
  );

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, railCollapsed ? '1' : '0');
  }, [railCollapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const groups: Group[] = useMemo(() => {
    const operations: Item[] = [];
    if (canViewProducts) operations.push({ to: '/products', label: 'Products', icon: IconBox });
    if (canViewStock) operations.push({ to: '/stock', label: 'Stock', icon: IconLayers });
    if (canViewStock)
      operations.push({ to: '/inventory', label: 'Inventory', icon: IconBox });
    if (canViewSales) operations.push({ to: '/sales', label: 'Sales', icon: IconWallet });
    if (canViewProducts) operations.push({ to: '/history', label: 'History', icon: IconHistory });

    const partners: Item[] = [];
    if (canViewVendors) partners.push({ to: '/vendors', label: 'Vendors', icon: IconTruck });
    if (canViewCustomers) partners.push({ to: '/customers', label: 'Customers', icon: IconUsers });

    return [
      ...(canViewDashboard
        ? [
            {
              title: 'Overview',
              icon: IconDashboard,
              items: [{ to: '/', label: 'Dashboard', icon: IconDashboard, end: true }],
            },
          ]
        : []),
      {
        title: 'My workspace',
        icon: IconIdCard,
        items: [
          { to: '/my-profile', label: 'My profile', icon: IconIdCard },
          { to: '/my-attendance', label: 'Check in / out', icon: IconClock },
          { to: '/leave', label: 'Leave', icon: IconCalendar, end: true },
          { to: '/resignations', label: 'Resignation', icon: IconIdCard },
        ],
      },
      ...(operations.length ? [{ title: 'Operations', icon: IconLayers, items: operations }] : []),
      ...(partners.length ? [{ title: 'Partners', icon: IconTruck, items: partners }] : []),
      ...(canConfigureLeave && !canManageUsers
        ? [
            {
              title: 'People',
              icon: IconUsers,
              items: [
                { to: '/attendance/report', label: 'Attendance report', icon: IconClock },
                { to: '/leave/approvals', label: 'Leave approvals', icon: IconCalendar },
                { to: '/resignations', label: 'Resignations', icon: IconIdCard },
                { to: '/leave/settings', label: 'Leave settings', icon: IconShield },
              ],
            },
          ]
        : []),
      ...(canManageUsers
        ? [
            {
              title: 'People',
              icon: IconUsers,
              items: [
                { to: '/employees', label: 'Employees', icon: IconIdCard },
                { to: '/attendance', label: 'Attendance', icon: IconClock, end: true },
                { to: '/attendance/report', label: 'Attendance report', icon: IconClock },
                { to: '/leave/approvals', label: 'Leave approvals', icon: IconCalendar },
                { to: '/resignations', label: 'Resignations', icon: IconIdCard },
                { to: '/leave/settings', label: 'Leave settings', icon: IconShield },
              ],
            },

            {
              title: 'Finance',
              icon: IconWallet,
              items: [
                { to: '/payroll', label: 'Payroll', icon: IconWallet, end: true },
                { to: '/payroll/settings', label: 'Payroll settings', icon: IconShield },
              ],
            },
            {
              title: 'Administration',
              icon: IconShield,
              items: [{ to: '/users', label: 'Users & roles', icon: IconShield }],
            },
          ]
        : []),
    ];
  }, [
    canConfigureLeave,
    canManageUsers,
    canViewCustomers,
    canViewDashboard,
    canViewProducts,
    canViewSales,
    canViewStock,
    canViewVendors,
  ]);

  // Accordion: at most one group is expanded at a time. The group holding the
  // current route opens automatically so the user never loses their place.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  useEffect(() => {
    const active = groups.find((g) =>
      g.items.some((i) =>
        i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
      ),
    );
    if (active) setOpenGroup(active.title);
  }, [location.pathname, groups]);


  const closeMobile = () => setMobileOpen(false);

  const renderSidebar = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={`h-16 shrink-0 flex items-center border-b border-brown-100 ${
          collapsed ? 'justify-center px-2' : 'gap-2 px-5'
        }`}
      >
        <Link to="/" onClick={closeMobile} className="flex min-w-0 items-center gap-2">
          <span className="h-8 w-8 shrink-0 rounded-lg bg-gold-400 flex items-center justify-center text-ink font-bold">
            P
          </span>
          {!collapsed && (
            <span className="truncate font-serif text-lg text-ink">Product Manager</span>
          )}
        </Link>
      </div>

      <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2 space-y-1' : 'px-3 space-y-3'}`}>
        {groups.map((g) => {
          const isOverview = g.title === 'Overview';
          const open = isOverview || collapsed || openGroup === g.title;
          const GroupIcon = g.icon;
          return (
            <div key={g.title}>
              {!isOverview && !collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenGroup((cur) => (cur === g.title ? null : g.title))}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink transition-colors ${
                    open ? 'bg-brown-100/70' : 'bg-paper-warm hover:bg-brown-50'
                  }`}
                >
                  {GroupIcon && <GroupIcon className="h-5 w-5 shrink-0 text-gold-600" />}
                  <span className="flex-1 truncate text-left">{g.title}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className={`shrink-0 text-brown-400 transition-transform ${open ? 'rotate-90' : ''}`}
                  >
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {collapsed && !isOverview && <div className="my-1 border-t border-brown-100" />}
              {open && (
                <div className={`space-y-1 ${!collapsed && !isOverview ? 'mt-2 pl-1' : ''}`}>
                  {g.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={closeMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group flex items-center rounded-lg text-sm font-medium transition-colors ${
                          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-forest-50 text-forest-500'
                            : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0 text-gold-600" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>


      <div className="shrink-0 border-t border-brown-100 p-3">
        {collapsed ? (
          <div
            title={user?.name ?? ''}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-forest-50 text-sm font-semibold text-forest-500"
          >
            {(user?.name ?? '?').slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <div className="rounded-xl border border-forest-100 bg-forest-50 px-3 py-2.5">
            <div className="truncate text-sm font-medium text-forest-600">{user?.name}</div>
            {user?.role && (
              <div className="mt-1 inline-flex rounded-md bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-forest-500">
                {user.role.name ?? user.role.code}
              </div>
            )}
          </div>
        )}
        <button
          className={`btn mt-2 w-full !py-1.5 text-sm bg-brick-500 text-paper hover:bg-brick-600 ${
            collapsed ? '!px-0' : ''
          }`}
          title="Sign out"

          onClick={() => setConfirmSignOut(true)}
        >
          {collapsed ? '⎋' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-soft">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-40 border-r border-brown-100 bg-paper transition-[width] duration-200 ${
          railCollapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {renderSidebar(railCollapsed)}
        <button
          type="button"
          aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={() => setRailCollapsed((c) => !c)}
          className="absolute -right-3 top-20 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-brown-100 bg-paper text-brown-500 shadow-sm hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={railCollapsed ? '' : 'rotate-180'}
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={closeMobile} aria-hidden="true" />
          <aside className="relative w-72 max-w-[85vw] bg-paper border-r border-brown-100">
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      <div className={railCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}>
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

      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out"
          message="Are you sure you want to sign out?"
          confirmLabel="Yes, sign out"
          tone="danger"
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            closeMobile();
            logout();
            navigate('/login');
          }}
        />
      )}
    </div>
  );
}
