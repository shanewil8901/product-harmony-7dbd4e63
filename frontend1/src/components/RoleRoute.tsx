import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import type { RoleCode } from '../types/product';

export function RoleRoute({
  allow,
  children,
}: {
  allow: RoleCode[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { canViewDashboard } = usePermissions();
  // Land the user somewhere they are actually allowed to be.
  const fallback = canViewDashboard ? '/' : '/my-profile';
  if (!user?.role || !allow.includes(user.role.code)) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

/** Index route: roles without dashboard access go straight to their workspace. */
export function HomeRoute({ children }: { children: ReactNode }) {
  const { canViewDashboard } = usePermissions();
  if (!canViewDashboard) return <Navigate to="/my-profile" replace />;
  return <>{children}</>;
}
