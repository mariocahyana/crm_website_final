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
