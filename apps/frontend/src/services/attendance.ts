const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;

export interface AdminAttendanceQrCode {
  id: string;
  token: string;
  valid_for_date: string;
  expires_at: string;
  created_by: string;
}

export interface AttendanceScanResult {
  attendance: {
    id: string;
    date: string;
    check_in_at: string;
    late_minutes: number;
    status: 'present' | 'late';
    note: string | null;
  };
  employee: {
    id: string;
    full_name: string;
    employee_number: string;
  };
  qrToken: AdminAttendanceQrCode;
}

interface AdminAttendanceQrResponse {
  success: boolean;
  data: AdminAttendanceQrCode;
}

interface AttendanceScanResponse {
  success: boolean;
  data: AttendanceScanResult;
}

export const attendanceApi = {
  async getAdminQrCode(token: string, forceRefresh = false): Promise<AdminAttendanceQrCode> {
    const url = new URL(`${API_BASE_URL}/attendance/qr`);
    if (forceRefresh) {
      url.searchParams.set('force_refresh', 'true');
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil QR code absensi');
    }

    const payload: AdminAttendanceQrResponse = await res.json();
    return payload.data;
  },

  async scanQrCode(token: string, qrToken: string): Promise<AttendanceScanResult> {
    const res = await fetch(`${API_BASE_URL}/attendance/scan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: qrToken }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal memproses scan QR absensi');
    }

    const payload: AttendanceScanResponse = await res.json();
    return payload.data;
  },
};