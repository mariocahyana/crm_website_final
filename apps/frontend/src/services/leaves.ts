const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

export interface LeaveType {
  id: string;
  name: string;
  is_paid: boolean;
  max_days_per_year: number | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  decline_reason: string | null;
  created_at: string;
  leaveType?: LeaveType;
  employee?: {
    id: string;
    employee_number: string;
    full_name: string;
    department_id: string | null;
    manager_id: string | null;
    job_title: string | null;
  };
  approver?: {
    id: string;
    employee_number: string;
    full_name: string;
  } | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function getAuthHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const leavesApi = {
  async listTypes(token: string): Promise<LeaveType[]> {
    const res = await fetch(`${API_BASE_URL}/leaves/types`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil jenis cuti');
    }

    const payload: ApiResponse<LeaveType[]> = await res.json();
    return payload.data;
  },

  async listRequests(token: string): Promise<LeaveRequest[]> {
    const res = await fetch(`${API_BASE_URL}/leaves/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil request cuti');
    }

    const payload: ApiResponse<LeaveRequest[]> = await res.json();
    return payload.data;
  },

  async createRequest(
    token: string,
    body: { leave_type_id: string; start_date: string; end_date: string; reason?: string }
  ): Promise<LeaveRequest> {
    const res = await fetch(`${API_BASE_URL}/leaves/requests`, {
      method: 'POST',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membuat request cuti');
    }

    const payload: ApiResponse<LeaveRequest> = await res.json();
    return payload.data;
  },

  async decideRequest(
    token: string,
    requestId: string,
    body: { status: 'approved' | 'declined'; decline_reason?: string }
  ): Promise<LeaveRequest> {
    const res = await fetch(`${API_BASE_URL}/leaves/requests/${requestId}/decision`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memproses request cuti');
    }

    const payload: ApiResponse<LeaveRequest> = await res.json();
    return payload.data;
  },

  async cancelRequest(token: string, requestId: string): Promise<LeaveRequest> {
    const res = await fetch(`${API_BASE_URL}/leaves/requests/${requestId}/cancel`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membatalkan request cuti');
    }

    const payload: ApiResponse<LeaveRequest> = await res.json();
    return payload.data;
  },
};
