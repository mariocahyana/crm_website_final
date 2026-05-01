const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface EmployeeProfile {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  photo_url?: string | null;
  join_date?: string;
  job_title?: string;
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
    body: { full_name?: string; phone?: string; address?: string; photo_file?: File; photo_deleted?: boolean }
  ): Promise<EmployeeProfile> {
    // Jika ada file foto, gunakan FormData
    if (body.photo_file) {
      const formData = new FormData();
      if (body.full_name) formData.append('full_name', body.full_name);
      if (body.phone) formData.append('phone', body.phone);
      if (body.address) formData.append('address', body.address);
      formData.append('photo', body.photo_file);

      const res = await fetch(`${API_BASE_URL}/profile/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Gagal memperbarui profile');
      }

      const payload: ProfileResponse = await res.json();
      return payload.data.employee;
    }

    // Jika tidak ada file, gunakan JSON
    const jsonBody: any = {
      full_name: body.full_name,
      phone: body.phone,
      address: body.address,
    };
    
    // Jika user mau hapus foto, set photo_url ke null
    if (body.photo_deleted) {
      jsonBody.photo_url = null;
    }

    const res = await fetch(`${API_BASE_URL}/profile/me`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(jsonBody),
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
    body: { full_name?: string; phone?: string; address?: string; photo_file?: File; photo_deleted?: boolean }
  ): Promise<EmployeeProfile> {
    // Jika ada file foto, gunakan FormData
    if (body.photo_file) {
      const formData = new FormData();
      if (body.full_name) formData.append('full_name', body.full_name);
      if (body.phone) formData.append('phone', body.phone);
      if (body.address) formData.append('address', body.address);
      formData.append('photo', body.photo_file);

      const res = await fetch(`${API_BASE_URL}/profile/${employeeId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Gagal memperbarui profile employee');
      }

      const payload: ProfileResponse = await res.json();
      return payload.data.employee;
    }

    // Jika tidak ada file, gunakan JSON
    const jsonBody: any = {
      full_name: body.full_name,
      phone: body.phone,
      address: body.address,
    };
    
    // Jika user mau hapus foto, set photo_url ke null
    if (body.photo_deleted) {
      jsonBody.photo_url = null;
    }

    const res = await fetch(`${API_BASE_URL}/profile/${employeeId}`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(jsonBody),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memperbarui profile employee');
    }

    const payload: ProfileResponse = await res.json();
    return payload.data.employee;
  },
};
