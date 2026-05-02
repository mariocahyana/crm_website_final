const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'finalized' | 'paid';
  finalized_at: string | null;
  created_at: string;
}

export interface PayrollPreviewResult {
  employee: {
    id: string;
    employee_number: string;
    full_name: string;
    base_salary: string | number;
  };
  baseSalary: number;
  total_incentive: number;
  total_reimburse: number;
  unpaid_days: number;
  unpaid_penalty: number;
  total_late_minutes: number;
  late_penalty: number;
  late_rate_per_minute?: number;
  total_penalty: number;
  net_salary: number;
}

export interface PayrollPreviewResponse {
  period: PayrollPeriod;
  workingDays: number;
  results: PayrollPreviewResult[];
}

export interface PayrollItem {
  id: string;
  payslip_id: string;
  type: 'incentive' | 'penalty' | 'bonus' | 'reimburse';
  source: 'manual' | 'auto_late' | 'auto_reimburse' | 'auto_leave';
  amount: string | number;
  description: string | null;
}

export interface PayrollPayslip {
  id: string;
  employee_id: string;
  period_id: string;
  base_salary: string | number;
  total_incentive: string | number;
  total_penalty: string | number;
  total_bonus: string | number;
  total_reimburse: string | number;
  net_salary: string | number;
  employee?: {
    id: string;
    employee_number: string;
    full_name: string;
    base_salary: string | number;
  };
  period?: PayrollPeriod;
  items?: PayrollItem[];
}

export interface PayrollPayslipDetailResponse {
  payslip: PayrollPayslip & {
    period?: PayrollPeriod;
  };
  totals: {
    base_salary: number;
    total_incentive: number;
    total_bonus: number;
    total_reimburse: number;
    total_penalty: number;
    net_salary: number;
  };
  breakdown: {
    totalIncentive: number;
    totalPenalty: number;
    totalReimburse: number;
    totalBonus: number;
  };
  items: PayrollItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function parseApiResponse<T>(res: Response, fallbackMessage: string): Promise<ApiResponse<T>> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  const isJson = contentType.includes('application/json');
  let parsed: any = null;

  if (isJson) {
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      if (!res.ok) {
        throw new Error(`${fallbackMessage} (respons JSON tidak valid)`);
      }
      throw new Error('Format respons API tidak valid');
    }
  }

  if (!res.ok) {
    if (parsed?.message) {
      throw new Error(parsed.message);
    }

    const preview = raw.slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(
      `${fallbackMessage} (HTTP ${res.status}) - respons non-JSON dari ${res.url}${preview ? `: ${preview}` : ''}`
    );
  }

  if (!parsed) {
    throw new Error(`Respons API tidak valid dari ${res.url}`);
  }

  return parsed as ApiResponse<T>;
}

function getAuthHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const payrollApi = {
  async listPeriods(token: string): Promise<PayrollPeriod[]> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await parseApiResponse<PayrollPeriod[]>(res, 'Gagal mengambil payroll periods');
    return payload.data;
  },

  async createPeriod(token: string, month: number, year: number): Promise<PayrollPeriod> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods`, {
      method: 'POST',
      headers: getAuthHeader(token),
      body: JSON.stringify({ month, year }),
    });

    const payload = await parseApiResponse<PayrollPeriod>(res, 'Gagal membuat payroll period');
    return payload.data;
  },

  async previewPeriod(token: string, periodId: string): Promise<PayrollPreviewResponse> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods/${periodId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await parseApiResponse<PayrollPreviewResponse>(res, 'Gagal preview payroll');
    return payload.data;
  },

  async generatePeriod(token: string, periodId: string): Promise<PayrollPayslip[]> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods/${periodId}/generate`, {
      method: 'POST',
      headers: getAuthHeader(token),
    });

    const payload = await parseApiResponse<PayrollPayslip[]>(res, 'Gagal generate payslips');
    return payload.data;
  },

  async finalizePeriod(token: string, periodId: string): Promise<PayrollPeriod> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods/${periodId}/finalize`, {
      method: 'POST',
      headers: getAuthHeader(token),
    });

    const payload = await parseApiResponse<PayrollPeriod>(res, 'Gagal finalize period');
    return payload.data;
  },

  async listPayslips(token: string, periodId: string): Promise<PayrollPayslip[]> {
    const res = await fetch(`${API_BASE_URL}/payroll/periods/${periodId}/payslips`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await parseApiResponse<{ period: PayrollPeriod; payslips: PayrollPayslip[] }>(res, 'Gagal mengambil payslips');
    return payload.data.payslips;
  },

  async listMyPayslips(token: string, periodId?: string): Promise<PayrollPayslip[]> {
    const url = new URL(`${API_BASE_URL}/payroll/me/payslips`);
    if (periodId) {
      url.searchParams.set('periodId', periodId);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await parseApiResponse<{ employee_id: string; payslips: PayrollPayslip[] }>(res, 'Gagal mengambil payslip saya');
    return payload.data.payslips;
  },

  async getMyPayslipDetail(token: string, payslipId: string): Promise<PayrollPayslipDetailResponse> {
    const res = await fetch(`${API_BASE_URL}/payroll/me/payslips/${payslipId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await parseApiResponse<PayrollPayslipDetailResponse>(res, 'Gagal mengambil detail payslip saya');
    return payload.data;
  },

  async addManualItem(
    token: string,
    payslipId: string,
    body: { type: 'incentive' | 'penalty' | 'bonus'; amount: number; description?: string }
  ): Promise<PayrollPayslip> {
    const res = await fetch(`${API_BASE_URL}/payroll/payslips/${payslipId}/items`, {
      method: 'POST',
      headers: getAuthHeader(token),
      body: JSON.stringify(body),
    });

    const payload = await parseApiResponse<PayrollPayslip>(res, 'Gagal menambah item manual');
    return payload.data;
  },
};
