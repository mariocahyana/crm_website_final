import { Navigate, useLocation } from 'react-router-dom';

interface SessionUser {
  user: {
    id: string;
    email: string;
    role: 'admin' | 'staff' | 'manager';
  };
  employee: {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    photo_url: string | null;
  } | null;
}

interface ProtectedRouteProps {
  currentUser: SessionUser | null;
  allowedRoles?: ('admin' | 'staff' | 'manager')[];
  children: React.ReactNode;
}

export function ProtectedRoute({ currentUser, allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
