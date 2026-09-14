import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireStaffAuthProps {
  children: ReactElement;
}

/** Redirects to `/staff/login` unless a valid staff bearer token is present. */
export function RequireStaffAuth({ children }: RequireStaffAuthProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
