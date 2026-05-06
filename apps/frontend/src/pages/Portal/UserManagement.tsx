import { useState, useCallback } from 'react';
import { UserManagementSection } from '../../components/Portal/UserManagementSection';
import { usersApi, type ManagedUser, type UserManagementOptions } from '../../services/users';

interface UserManagementPageProps {
  token: string | null;
}

export function UserManagementPage({ token }: UserManagementPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [options, setOptions] = useState<UserManagementOptions>({
    departments: [],
    managers: [],
  });
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError('');
      const result = await usersApi.listUsers(token);
      setUsers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat user');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadOptions = useCallback(async () => {
    if (!token) return;
    
    try {
      const result = await usersApi.getOptions(token);
      setOptions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat opsi dropdown');
    }
  }, [token]);

  const handleLoadUsers = useCallback(async () => {
    await Promise.all([loadUsers(), loadOptions()]);
  }, [loadUsers, loadOptions]);

  return (
    <UserManagementSection
      users={users}
      options={options}
      loading={loading}
      error={error}
      submitLoading={submitLoading}
      onLoadUsers={handleLoadUsers}
    />
  );
}
