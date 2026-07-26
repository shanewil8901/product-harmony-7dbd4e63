import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { RoleCode } from '../types/product';

export function RoleRoute({
  allow,
  children,
}: {
  allow: RoleCode[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user?.role || !allow.includes(user.role.code)) {
    return <Navigate to="/products" replace />;
  }
  return <>{children}</>;
}
