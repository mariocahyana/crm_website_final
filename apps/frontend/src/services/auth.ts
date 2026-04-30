const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
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
  };
}

interface MeResponse {
  success: boolean;
  data: {
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
    if (!res.ok) throw new Error('Session expired');
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
};
