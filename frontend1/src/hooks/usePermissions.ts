import { useAuth } from './useAuth';
import type { RoleCode } from '../types/product';

/**
 * Central role-based permission helpers. Mirror backend @Roles(...) decorators
 * so UI hides / disables actions the API would otherwise reject with 403.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role: RoleCode | null = user?.role?.code ?? null;
  const has = (...roles: RoleCode[]) => (role ? roles.includes(role) : false);

  return {
    role,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
    isManager: role === 'manager',

    /* ---------- module visibility (read access) ---------- */
    /** Plain employees only get their own workspace (profile, attendance, leave). */
    isSelfServiceOnly: role === 'employee',
    canViewDashboard: has('admin', 'manager', 'supervisor', 'warehouse', 'sales'),
    canViewProducts: has('admin', 'manager', 'supervisor', 'warehouse', 'sales'),
    canViewStock: has('admin', 'manager', 'supervisor', 'warehouse', 'sales'),
    /** Sales staff may look at stock but cannot act on it. */
    canViewSales: has('admin', 'manager', 'supervisor', 'warehouse', 'sales'),
    /** Warehouse owns vendors; sales staff do not see them. */
    canViewVendors: has('admin', 'manager', 'supervisor', 'warehouse'),
    /** Sales owns customers; warehouse staff do not see them. */
    canViewCustomers: has('admin', 'manager', 'supervisor', 'sales'),

    /* ---------- dashboard tabs ---------- */
    canViewGeneralTab: has('admin', 'manager'),
    canViewEmployeesTab: has('admin', 'manager', 'supervisor'),
    /** Read-only aggregated attendance reporting. */
    canViewAttendanceReport: has('admin', 'manager', 'supervisor'),
    /** Supervisors see attendance-style people data only — no salary/confidential cards. */
    canViewConfidentialHr: has('admin', 'manager'),

    /* ---------- write access ---------- */
    canWriteProducts: has('admin', 'manager', 'sales'),
    canDeleteProducts: has('admin', 'manager'),
    canCreateStock: has('admin', 'manager', 'employee'),
    canUpdateStock: has('admin', 'manager', 'warehouse', 'employee'),
    canDeleteStock: has('admin', 'manager'),
    canRunStockDocument: has('admin', 'manager', 'warehouse', 'employee'),
    /** Only the top two roles may jump the lifecycle, and only with a reason. */
    canSkipStockStage: has('admin', 'manager'),
    canWriteVendors: has('admin', 'manager'),
    canDeleteVendors: has('admin', 'manager'),
    canWriteCustomers: has('admin', 'manager', 'sales'),
    canDeleteCustomers: has('admin', 'manager'),
    canWriteSales: has('admin', 'manager', 'sales'),
    canDeleteSales: has('admin', 'manager'),
    canConfirmCredit: has('admin', 'manager', 'supervisor'),
    canManageUsers: has('admin', 'manager'),
    canApproveLeave: has('admin', 'manager', 'supervisor'),
    canFinalApproveLeave: has('admin', 'manager'),
    canConfigurePayroll: has('admin', 'manager'),
    /** Leave entitlement master data is editable by supervisors too. */
    canConfigureLeave: has('admin', 'manager', 'supervisor'),
  };
}