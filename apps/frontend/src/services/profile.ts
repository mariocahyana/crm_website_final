const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface EmployeeProfile {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  photo_url?: string | null;
}

interface ProfileResponse {
  success: boolean;
  data: {
    message: string;
    employee: EmployeeProfile;
  };
}

function getAuthHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const profileApi = {
  async updateMyProfile(
    token: string,
    body: { phone?: string; address?: string }
  ): Promise<EmployeeProfile> {
    const res = await fetch(`${API_BASE_URL}/profile/me`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memperbarui profile');
    }

    const payload: ProfileResponse = await res.json();
    return payload.data.employee;
  },

  async updateEmployeeProfile(
    token: string,
    employeeId: string,
    body: { phone?: string; address?: string }
  ): Promise<EmployeeProfile> {
    const res = await fetch(`${API_BASE_URL}/profile/${employeeId}`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memperbarui profile employee');
    }

    const payload: ProfileResponse = await res.json();
    return payload.data.employee;
  },
};
