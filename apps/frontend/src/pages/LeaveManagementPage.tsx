import { useEffect, useMemo, useState } from 'react';
import { leavesApi, type LeaveRequest, type LeaveType } from '../services/leaves';
import { auth } from '../services/auth';

interface SessionUser {
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
    join_date?: string;
    job_title?: string;
  } | null;
}

interface LeaveManagementPageProps {
  currentUser: SessionUser;
}

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
});

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isDateWithinRange(dateKey: string, startDate: string, endDate: string) {
  return dateKey >= startDate && dateKey <= endDate;
}

export function LeaveManagementPage({ currentUser }: LeaveManagementPageProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSubmitLoading, setLeaveSubmitLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveMessage, setLeaveMessage] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const token = auth.getToken();
  const employeeName = currentUser.employee?.full_name || 'User';
  const canReviewLeaves = currentUser.user.role === 'admin' || currentUser.user.role === 'manager';

  const getLeaveValidationError = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (!leaveForm.reason || !leaveForm.reason.trim()) {
      return 'Alasan cuti wajib diisi';
    }

    if (leaveForm.start_date < today) {
      return 'Tanggal mulai cuti tidak boleh sebelum hari ini';
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      return 'Tanggal selesai cuti harus lebih besar atau sama dengan tanggal mulai';
    }

    return null;
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlankDays = firstDay.getDay();
    const days: Array<{
      key: string;
      date: Date | null;
      dayNumber: number | null;
      requests: LeaveRequest[];
    }> = [];

    for (let i = 0; i < leadingBlankDays; i += 1) {
      days.push({ key: `blank-${i}`, date: null, dayNumber: null, requests: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dateKey = toDateKey(date);
      days.push({
        key: dateKey,
        date,
        dayNumber: day,
        requests: leaveRequests.filter((request) => (
          request.status !== 'cancelled'
          && isDateWithinRange(dateKey, request.start_date, request.end_date)
        )),
      });
    }

    return days;
  }, [calendarMonth, leaveRequests]);

  const leaveSummary = useMemo(() => ({
    pending: leaveRequests.filter((request) => request.status === 'pending').length,
    approved: leaveRequests.filter((request) => request.status === 'approved').length,
    declined: leaveRequests.filter((request) => request.status === 'declined').length,
  }), [leaveRequests]);

  const loadLeaves = async () => {
    if (!token) return;

    try {
      setLeaveLoading(true);
      setLeaveError('');
      const [types, requests] = await Promise.all([
        leavesApi.listTypes(token),
        leavesApi.listRequests(token),
      ]);
      setLeaveTypes(types);
      setLeaveRequests(requests);
      setLeaveForm((prev) => ({
        ...prev,
        leave_type_id: prev.leave_type_id || types[0]?.id || '',
      }));
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal memuat data cuti');
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaves();
  }, [token]);

  useEffect(() => {
    setLeaveForm((current) => ({
      ...current,
      leave_type_id: current.leave_type_id || leaveTypes[0]?.id || '',
    }));
  }, [leaveTypes]);

  const goToPreviousMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLeaveSubmitLoading(true);
      setLeaveError('');
      setLeaveMessage('');
      const leaveValidationError = getLeaveValidationError();
      if (leaveValidationError) {
        setLeaveError(leaveValidationError);
        return;
      }

      await leavesApi.createRequest(token, leaveForm);
      setLeaveForm((prev) => ({
        ...prev,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        reason: '',
      }));
      setLeaveMessage('Request cuti berhasil dibuat');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal membuat request cuti');
    } finally {
      setLeaveSubmitLoading(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!token) return;

    try {
      setLeaveError('');
      setLeaveMessage('');
      await leavesApi.cancelRequest(token, requestId);
      setLeaveMessage('Request cuti berhasil dibatalkan');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal membatalkan request cuti');
    }
  };

  const handleDecideLeave = async (requestId: string, status: 'approved' | 'declined') => {
    if (!token) return;

    const declineReason = status === 'declined'
      ? window.prompt('Alasan penolakan') || ''
      : '';

    if (status === 'declined' && !declineReason.trim()) {
      setLeaveError('Alasan penolakan wajib diisi');
      return;
    }

    try {
      setLeaveError('');
      setLeaveMessage('');
      await leavesApi.decideRequest(token, requestId, {
        status,
        decline_reason: declineReason,
      });
      setLeaveMessage(status === 'approved' ? 'Request cuti disetujui' : 'Request cuti ditolak');
      await loadLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Gagal memproses request cuti');
    }
  };

  return (
    <section className="panel leave-panel">
      <h3>Leave Management</h3>
      <div className="section-head">
        <p>{canReviewLeaves ? 'Review dan ajukan request cuti.' : 'Ajukan dan pantau request cuti Anda.'}</p>
        <div className="leave-summary">
          <span>Pending: {leaveSummary.pending}</span>
          <span>Approved: {leaveSummary.approved}</span>
          <span>Declined: {leaveSummary.declined}</span>
        </div>
      </div>

      {leaveError && <p className="inline-error">{leaveError}</p>}
      {leaveMessage && <p className="inline-success">{leaveMessage}</p>}

      {currentUser.employee ? (
        <form className="leave-form crm-form" onSubmit={handleCreateLeave}>
          <div className="form-row-three">
            <div className="form-group">
              <label>Jenis Cuti</label>
              <select
                value={leaveForm.leave_type_id}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type_id: e.target.value }))}
                required
                disabled={leaveSubmitLoading || leaveTypes.length === 0}
              >
                {leaveTypes.length === 0 && <option value="">Belum ada jenis cuti</option>}
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.is_paid ? 'Paid' : 'Unpaid'})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Tanggal Mulai</label>
              <input
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, start_date: e.target.value }))}
                min={new Date().toISOString().slice(0, 10)}
                required
                disabled={leaveSubmitLoading}
              />
            </div>
            <div className="form-group">
              <label>Tanggal Selesai</label>
              <input
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, end_date: e.target.value }))}
                min={leaveForm.start_date || new Date().toISOString().slice(0, 10)}
                required
                disabled={leaveSubmitLoading}
              />
            </div>
          </div>
          <div className="form-row-one">
            <div className="form-group">
              <label>Alasan</label>
              <input
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Alasan cuti"
                required
                minLength={3}
                maxLength={300}
                disabled={leaveSubmitLoading}
                pattern="^[a-zA-Z\s\-_]+$"
              />
            </div>
          </div>
          <div className="form-actions compact-actions">
            <button type="submit" disabled={leaveSubmitLoading || leaveTypes.length === 0} className="primary-btn">
              {leaveSubmitLoading ? 'Mengirim...' : 'Ajukan Cuti'}
            </button>
          </div>
        </form>
      ) : (
        <p>Data employee belum tersedia untuk mengajukan cuti.</p>
      )}

      <div className="calendar-panel">
        <div className="calendar-header">
          <button type="button" className="ghost-btn" onClick={goToPreviousMonth}>
            Sebelumnya
          </button>
          <h4>{monthFormatter.format(calendarMonth)}</h4>
          <button type="button" className="ghost-btn" onClick={goToNextMonth}>
            Berikutnya
          </button>
        </div>
        <div className="calendar-weekdays">
          {Array.from({ length: 7 }).map((_, index) => {
            const day = new Date(2026, 1, index + 1);
            return <span key={index}>{dayFormatter.format(day)}</span>;
          })}
        </div>
        <div className="calendar-grid">
          {calendarDays.map((day) => (
            <div
              key={day.key}
              className={day.date ? 'calendar-day' : 'calendar-day calendar-day-empty'}
            >
              {day.dayNumber && <span className="calendar-date">{day.dayNumber}</span>}
              <div className="calendar-events">
                {day.requests.slice(0, 3).map((request) => (
                  <span key={request.id} className={`calendar-event status-${request.status}`}>
                    {request.employee?.full_name || employeeName}
                  </span>
                ))}
                {day.requests.length > 3 && (
                  <span className="calendar-more">+{day.requests.length - 3} lagi</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="leave-list">
        {leaveLoading ? (
          <p>Memuat data cuti...</p>
        ) : leaveRequests.length === 0 ? (
          <p>Belum ada request cuti.</p>
        ) : (
          leaveRequests.map((request) => {
            const isOwnRequest = request.employee_id === currentUser.employee?.id;
            const canCancel = isOwnRequest && request.status === 'pending';
            const canDecide = canReviewLeaves && !isOwnRequest && request.status === 'pending';

            return (
              <div key={request.id} className="leave-item">
                <div>
                  <strong>{request.employee?.full_name || employeeName}</strong>
                  <p>
                    {request.leaveType?.name || 'Cuti'} | {request.start_date} - {request.end_date} |
                    {' '}{request.total_days} hari
                  </p>
                  {request.reason && <p>Alasan: {request.reason}</p>}
                  {request.decline_reason && <p>Ditolak: {request.decline_reason}</p>}
                </div>
                <div className="leave-actions">
                  <span className={`status-pill status-${request.status}`}>{request.status.toUpperCase()}</span>
                  {canCancel && (
                    <button type="button" className="ghost-btn" onClick={() => handleCancelLeave(request.id)}>
                      Batalkan
                    </button>
                  )}
                  {canDecide && (
                    <>
                      <button type="button" className="primary-btn" onClick={() => handleDecideLeave(request.id, 'approved')}>
                        Approve
                      </button>
                      <button type="button" className="danger-btn" onClick={() => handleDecideLeave(request.id, 'declined')}>
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
