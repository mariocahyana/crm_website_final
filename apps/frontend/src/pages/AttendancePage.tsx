import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { attendanceApi, type AdminAttendanceQrCode } from '../services/attendance';
import { AttendanceScanner } from '../components/AttendanceScanner';
import { auth } from '../services/auth';

interface AdminAttendanceQrCodeWithUrl extends AdminAttendanceQrCode {
  qrDataUrl: string;
}

interface AttendancePageProps {
  currentUser: {
    user: {
      id: string;
      email: string;
      role: 'admin' | 'staff' | 'manager';
    };
  };
  activeAttendanceView: 'qr' | 'scan' | 'history';
}

interface AttendanceRecord {
  id: string;
  employee_name: string;
  employee_email: string;
  date: string;
  check_in_at: string | null;
  late_minutes: number;
  status: 'present' | 'late' | 'absent';
}

export function AttendancePage({ currentUser, activeAttendanceView }: AttendancePageProps) {
  const [attendanceQr, setAttendanceQr] = useState<AdminAttendanceQrCodeWithUrl | null>(null);
  const [attendanceQrLoading, setAttendanceQrLoading] = useState(false);
  const [attendanceQrError, setAttendanceQrError] = useState('');
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState(false);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState('');
  const [attendanceHistoryFilters, setAttendanceHistoryFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const token = auth.getToken();
  const canManageAttendanceQr = currentUser.user.role === 'admin';
  const canScanAttendance = currentUser.user.role === 'staff' || currentUser.user.role === 'manager';

  const loadAttendanceQr = async (forceRefresh = false) => {
    if (!canManageAttendanceQr || !token) {
      return;
    }

    try {
      setAttendanceQrLoading(true);
      setAttendanceQrError('');
      const result = await attendanceApi.getAdminQrCode(token, forceRefresh);

      if (!result || !result.token) {
        throw new Error('Data QR tidak lengkap dari server');
      }

      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(result.token, {
          width: 260,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
      } catch (genErr) {
        console.error('QR generation failed', genErr);
        throw new Error('Gagal membuat gambar QR');
      }

      setAttendanceQr({
        ...result,
        qrDataUrl,
      });
    } catch (err) {
      console.error('loadAttendanceQr error', err);
      setAttendanceQrError(err instanceof Error ? err.message : 'Gagal memuat QR absensi');
    } finally {
      setAttendanceQrLoading(false);
    }
  };

  const loadAttendanceHistory = async () => {
    if (!canManageAttendanceQr || !token) {
      return;
    }

    try {
      setAttendanceHistoryLoading(true);
      setAttendanceHistoryError('');
      const result = await attendanceApi.getAttendanceHistory(token, {
        month: attendanceHistoryFilters.month,
        year: attendanceHistoryFilters.year,
      });

      setAttendanceHistory(result || []);
    } catch (error) {
      setAttendanceHistoryError(error instanceof Error ? error.message : 'Failed to load attendance history');
    } finally {
      setAttendanceHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeAttendanceView !== 'qr' || !canManageAttendanceQr || !token) {
      return;
    }
    void loadAttendanceQr();
  }, [activeAttendanceView, canManageAttendanceQr, token]);

  useEffect(() => {
    if (activeAttendanceView !== 'history') return;
    void loadAttendanceHistory();
  }, [activeAttendanceView, attendanceHistoryFilters, token, canManageAttendanceQr]);

  const handleRefreshAttendanceQr = async () => {
    await loadAttendanceQr(true);
  };

  if (activeAttendanceView === 'qr' && canManageAttendanceQr) {
    return (
      <section className="panel attendance-panel">
        <div className="section-head">
          <div>
            <h3>Attendance QR</h3>
            <p className="subtext">QR hari ini untuk absensi masuk. Klik Refresh QR untuk membuat kode baru.</p>
          </div>
          <button type="button" onClick={handleRefreshAttendanceQr} disabled={attendanceQrLoading}>
            {attendanceQrLoading ? 'Memuat...' : 'Refresh QR'}
          </button>
        </div>

        {attendanceQrError && <div className="alert-error">{attendanceQrError}</div>}

        {attendanceQr ? (
          <div className="qr-layout">
            <div className="qr-card">
              <img
                className="qr-code-image"
                src={attendanceQr.qrDataUrl}
                alt="QR code absensi"
              />
              <div className="qr-card-meta">
                <span className="qr-card-pill">Hari ini</span>
                <strong>{attendanceQr.valid_for_date}</strong>
              </div>
              <p className="subtext qr-card-note">QR akan berganti saat Anda menekan Refresh QR.</p>
            </div>
          </div>
        ) : (
          !attendanceQrLoading && !attendanceQrError && (
            <p className="subtext">Belum ada QR code yang dimuat.</p>
          )
        )}
      </section>
    );
  }

  if (activeAttendanceView === 'scan' && canScanAttendance) {
    return (
      <section className="panel scanner-panel">
        <div className="section-head">
          <div>
            <h3>Scan QR Absensi</h3>
            <p className="subtext">Scan QR absensi yang ditampilkan admin untuk mencatat kehadiran Anda.</p>
          </div>
        </div>

        {token && <AttendanceScanner token={token} />}
      </section>
    );
  }

  if (activeAttendanceView === 'history' && canManageAttendanceQr) {
    return (
      <section className="panel attendance-history-panel">
        <div className="section-head">
          <div>
            <h3>Riwayat Absensi</h3>
            <p className="subtext">Lihat riwayat absensi semua karyawan.</p>
          </div>
        </div>

        {attendanceHistoryError && <div className="alert-error">{attendanceHistoryError}</div>}

        <div className="filter-row" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label>Bulan</label>
            <select
              value={attendanceHistoryFilters.month}
              onChange={(e) => setAttendanceHistoryFilters((prev) => ({ ...prev, month: Number(e.target.value) }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {String(month).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
            <label>Tahun</label>
            <select
              value={attendanceHistoryFilters.year}
              onChange={(e) => setAttendanceHistoryFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {attendanceHistoryLoading ? (
          <p>Memuat riwayat absensi...</p>
        ) : attendanceHistory.length === 0 ? (
          <p className="subtext">Tidak ada data absensi untuk bulan ini.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Nama</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Tanggal</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Jam Masuk</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Terlambat (menit)</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record, idx) => (
                  <tr
                    key={record.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <td style={{ padding: 12 }}>
                      <strong>{record.employee_name || 'N/A'}</strong>
                    </td>
                    <td style={{ padding: 12 }}>
                      {record.employee_email || 'N/A'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.date}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.check_in_at
                        ? new Date(record.check_in_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {record.late_minutes || 0}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span
                        className={`status-pill status-${record.status}`}
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor:
                            record.status === 'present' ? '#d1fae5' :
                            record.status === 'late' ? '#fef3c7' :
                            '#f3f4f6',
                          color:
                            record.status === 'present' ? '#065f46' :
                            record.status === 'late' ? '#92400e' :
                            '#374151',
                        }}
                      >
                        {record.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return null;
}
