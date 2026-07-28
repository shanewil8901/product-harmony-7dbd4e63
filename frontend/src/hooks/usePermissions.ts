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
    canWriteProducts: has('admin', 'manager', 'sales'),
    canDeleteProducts: has('admin', 'manager'),
    canCreateStock: has('admin', 'manager', 'employee'),
    canUpdateStock: has('admin', 'manager', 'warehouse', 'sales', 'employee'),
    canDeleteStock: has('admin', 'manager'),
    canRunStockDocument: has('admin', 'manager', 'warehouse', 'sales', 'employee'),
    canWriteVendors: has('admin', 'manager'),
    canDeleteVendors: has('admin', 'manager'),
    canWriteCustomers: has('admin', 'manager', 'sales'),
    canDeleteCustomers: has('admin', 'manager'),
    canManageUsers: has('admin', 'manager'),
  };
}
