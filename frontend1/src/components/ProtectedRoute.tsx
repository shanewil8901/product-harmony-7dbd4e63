import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-soft">
        <div className="text-brown-500 text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // First-run setup: the temporary admin can only create the real admin.
  if (user.is_bootstrap && location.pathname !== '/employees') {
    return <Navigate to="/employees" replace />;
  }
  return <>{children}</>;
}
