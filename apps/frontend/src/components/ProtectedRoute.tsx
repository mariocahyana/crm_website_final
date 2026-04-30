import { Navigate, useLocation } from 'react-router-dom';

interface SessionUser {
  user: {
    id: string;
    email: string;
    role: 'admin' | 'staff';
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
  role?: 'admin' | 'staff';
  children: React.ReactNode;
}

export function ProtectedRoute({ currentUser, role, children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && currentUser.user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
