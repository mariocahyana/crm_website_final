const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface ReimbursementRequest {
  id: string;
  employee_id: string;
  category: string;
  amount: string | number;
  description: string | null;
  receipt_url: string | null;
  expense_date: string;
  status: 'pending' | 'approved' | 'declined';
  approved_by: string | null;
  approved_at: string | null;
  decline_reason: string | null;
  payroll_item_id: string | null;
  created_at: string;
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

export const reimbursementsApi = {
  async listRequests(token: string): Promise<ReimbursementRequest[]> {
    const res = await fetch(`${API_BASE_URL}/reimbursements`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil request reimburse');
    }

    const payload: ApiResponse<ReimbursementRequest[]> = await res.json();
    return payload.data;
  },

  async createRequest(
    token: string,
    body: {
      category: string;
      amount: number;
      description?: string;
      receipt_url?: string;
      expense_date: string;
    }
  ): Promise<ReimbursementRequest> {
    const res = await fetch(`${API_BASE_URL}/reimbursements`, {
      method: 'POST',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membuat request reimburse');
    }

    const payload: ApiResponse<ReimbursementRequest> = await res.json();
    return payload.data;
  },

  async decideRequest(
    token: string,
    reimbursementId: string,
    body: { status: 'approved' | 'declined'; decline_reason?: string }
  ): Promise<ReimbursementRequest> {
    const res = await fetch(`${API_BASE_URL}/reimbursements/${reimbursementId}/decision`, {
      method: 'PATCH',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memproses request reimburse');
    }

    const payload: ApiResponse<ReimbursementRequest> = await res.json();
    return payload.data;
  },
};
