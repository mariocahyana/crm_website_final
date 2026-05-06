import { PortalPage } from '../../pages/PortalPage';

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
    department_id?: string | null;
    join_date?: string;
    job_title?: string;
  } | null;
}

interface PortalPagesContainerProps {
  currentUser: SessionUser;
  token: string | null;
  onLogout: () => void;
  onEmployeeUpdate: (employee: SessionUser['employee']) => void;
}

export function PortalPagesContainer({
  currentUser,
  token,
  onLogout,
  onEmployeeUpdate,
}: PortalPagesContainerProps) {
  return (
    <PortalPage
      currentUser={currentUser}
      onLogout={onLogout}
      onEmployeeUpdate={onEmployeeUpdate}
    />
  );
}
