const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

export interface ManagedUser {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'manager';
  is_active: boolean;
  employee: {
    id: string;
    employee_number: string;
    full_name: string;
    job_title: string | null;
    department_id: string | null;
    manager_id: string | null;
    join_date: string;
    base_salary: string | number;
    phone: string | null;
    address: string | null;
    photo_url: string | null;
    is_active: boolean;
  } | null;
}

export interface UserManagementOptions {
  departments: Array<{
    id: string;
    name: string;
  }>;
  managers: Array<{
    id: string;
    full_name: string;
    employee_number: string;
    department_id: string | null;
  }>;
}

interface ListUsersResponse {
  success: boolean;
  data: ManagedUser[];
}

interface OptionsResponse {
  success: boolean;
  data: UserManagementOptions;
}

interface CreateUserPayload {
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'manager';
  full_name: string;
  join_date: string;
  base_salary: number;
  job_title?: string;
  phone?: string;
  address?: string;
  department_id?: string | null;
  manager_id?: string | null;
}

interface UpdateUserPayload {
  email?: string;
  role?: 'admin' | 'staff' | 'manager';
  full_name?: string;
  join_date?: string;
  base_salary?: number;
  job_title?: string;
  phone?: string;
  address?: string;
  department_id?: string | null;
  manager_id?: string | null;
}

function getAuthHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const usersApi = {
  async listUsers(token: string): Promise<ManagedUser[]> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil daftar user');
    }

    const payload: ListUsersResponse = await res.json();
    return payload.data;
  },

  async getOptions(token: string): Promise<UserManagementOptions> {
    const res = await fetch(`${API_BASE_URL}/users/options`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil opsi dropdown');
    }

    const payload: OptionsResponse = await res.json();
    return payload.data;
  },

  async createUser(token: string, body: CreateUserPayload): Promise<ManagedUser> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membuat user');
    }

    const payload = await res.json();
    return payload.data;
  },

  async updateUser(token: string, userId: string, body: UpdateUserPayload): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memperbarui user');
    }
  },

  async updateUserStatus(token: string, userId: string, isActive: boolean): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify({ is_active: isActive }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal update status user');
    }
  },
};
