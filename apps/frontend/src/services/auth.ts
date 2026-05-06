const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
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
  };
}

interface MeResponse {
  success: boolean;
  data: {
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
  };
}

interface ForgotPasswordResponse {
  success: boolean;
  data: {
    message: string;
    reset_token?: string;
  };
}

interface ResetPasswordResponse {
  success: boolean;
  data: {
    message: string;
  };
}

export interface PendingResetRequest {
  id: string;
  created_at: string;
  expires_at: string;
  token_value?: string | null;
  user: {
    id: string;
    email: string;
    role: string;
    employee: {
      full_name: string;
      employee_number: string;
      job_title: string | null;
    } | null;
  };
}

export const auth = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    return res.json();
  },

  async getMe(token: string): Promise<MeResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Session expired');
    }
    return res.json();
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengirim reset token');
    }

    return res.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal reset password');
    }

    return res.json();
  },


  async getPendingResets(token: string): Promise<PendingResetRequest[]> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil daftar request');
    }
    const payload = await res.json();
    return payload.data;
  },

  async approveReset(token: string, resetId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-requests/${resetId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal approve request');
    }
  },

  async rejectReset(token: string, resetId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/reset-requests/${resetId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal reject request');
    }
  },

  async changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengubah password');
    }
  },

  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  },

  clearToken() {
    localStorage.removeItem('auth_token');
  },

  getAuthHeader() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  },
};