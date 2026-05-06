import { useEffect, useMemo, useRef, useState } from 'react';
import { reimbursementsApi, type ReimbursementRequest } from '../services/reimbursements';
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

interface ReimburseManagementPageProps {
  currentUser: SessionUser;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ReimburseManagementPage({ currentUser }: ReimburseManagementPageProps) {
  const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
  const [reimbursementLoading, setReimbursementLoading] = useState(false);
  const [reimbursementSubmitLoading, setReimbursementSubmitLoading] = useState(false);
  const [reimbursementError, setReimbursementError] = useState('');
  const [reimbursementMessage, setReimbursementMessage] = useState('');
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  const [reimbursementForm, setReimbursementForm] = useState<{
    category: string;
    amount: string | number;
    expense_date: string;
    description: string;
    receipt_file: File | null;
  }>({
    category: 'Transport',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    receipt_file: null as File | null,
  });

  const token = auth.getToken();
  const employeeName = currentUser.employee?.full_name || 'User';
  const canReviewLeaves = currentUser.user.role === 'admin' || currentUser.user.role === 'manager';

  const getDefaultReimbursementForm = () => ({
    category: 'Transport',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    receipt_file: null as File | null,
  });

  const reimbursementSummary = useMemo(() => ({
    pending: reimbursementRequests.filter((request) => request.status === 'pending').length,
    approved: reimbursementRequests.filter((request) => request.status === 'approved').length,
    declined: reimbursementRequests.filter((request) => request.status === 'declined').length,
    totalApproved: reimbursementRequests
      .filter((request) => request.status === 'approved')
      .reduce((sum, request) => sum + Number(request.amount || 0), 0),
  }), [reimbursementRequests]);

  const handleViewPhoto = (receiptUrl: string | null) => {
    if (receiptUrl) {
      let fullUrl: string;

      if (receiptUrl.startsWith('http')) {
        fullUrl = receiptUrl;
      } else {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const baseUrl = apiBase.replace('/api', '');
        fullUrl = baseUrl + receiptUrl;
      }

      console.log('Opening photo:', fullUrl);
      setSelectedPhotoUrl(fullUrl);
      setPhotoModalOpen(true);
    }
  };

  const handleClosePhotoModal = () => {
    setPhotoModalOpen(false);
    setSelectedPhotoUrl(null);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    setReimbursementForm((prev) => ({ ...prev, receipt_file: file }));

    if (receiptPreviewUrl) {
      try { URL.revokeObjectURL(receiptPreviewUrl); } catch {}
      setReceiptPreviewUrl(null);
    }

    if (file) {
      const objUrl = URL.createObjectURL(file);
      setReceiptPreviewUrl(objUrl);
    }
  };

  const loadReimbursements = async () => {
    if (!token) return;

    try {
      setReimbursementLoading(true);
      setReimbursementError('');
      const requests = await reimbursementsApi.listRequests(token);
      setReimbursementRequests(requests);
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal memuat data reimburse');
    } finally {
      setReimbursementLoading(false);
    }
  };

  useEffect(() => {
    void loadReimbursements();
  }, [token]);

  const handleCreateReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!reimbursementForm.receipt_file) {
      setReimbursementError('Foto struk/bukti wajib diupload');
      return;
    }
    if (reimbursementForm.receipt_file && reimbursementForm.receipt_file.size > MAX_FILE_SIZE) {
      setReimbursementError('Ukuran file struk maksimal 5MB');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (reimbursementForm.expense_date > today) {
      setReimbursementError('Tanggal pengeluaran tidak boleh melebihi hari ini');
      return;
    }
    if (!reimbursementForm.description.trim()) {
      setReimbursementError('Deskripsi pengeluaran wajib diisi');
      return;
    }
    if (!reimbursementForm.amount || Number(reimbursementForm.amount) <= 0) {
      setReimbursementError('Nominal harus lebih dari 0');
      return;
    }
    try {
      setReimbursementSubmitLoading(true);
      setReimbursementError('');
      setReimbursementMessage('');
      await reimbursementsApi.createRequest(token, {
        category: reimbursementForm.category,
        amount: Number(reimbursementForm.amount),
        expense_date: reimbursementForm.expense_date,
        description: reimbursementForm.description,
        receipt_file: reimbursementForm.receipt_file,
      });
      setReimbursementForm((prev) => ({
        ...prev,
        amount: '',
        description: '',
        receipt_file: null,
      }));
      if (receiptPreviewUrl) {
        try { URL.revokeObjectURL(receiptPreviewUrl); } catch {}
        setReceiptPreviewUrl(null);
      }
      if (receiptInputRef && receiptInputRef.current) {
        try { receiptInputRef.current.value = ''; } catch {}
      }
      setReimbursementMessage('Request reimburse berhasil dibuat');
      await loadReimbursements();
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal membuat request reimburse');
    } finally {
      setReimbursementSubmitLoading(false);
    }
  };

  const handleDecideReimbursement = async (requestId: string, status: 'approved' | 'declined') => {
    if (!token) return;

    const declineReason = status === 'declined'
      ? window.prompt('Alasan penolakan') || ''
      : '';

    if (status === 'declined' && !declineReason.trim()) {
      setReimbursementError('Alasan penolakan wajib diisi');
      return;
    }

    try {
      setReimbursementError('');
      setReimbursementMessage('');
      await reimbursementsApi.decideRequest(token, requestId, {
        status,
        decline_reason: declineReason,
      });
      setReimbursementMessage(status === 'approved' ? 'Request reimburse disetujui' : 'Request reimburse ditolak');
      await loadReimbursements();
    } catch (err) {
      setReimbursementError(err instanceof Error ? err.message : 'Gagal memproses request reimburse');
    }
  };

  return (
    <section className="panel reimburse-panel">
      <h3>Reimburse Management</h3>
      <div className="section-head">
        <p>{canReviewLeaves ? 'Review dan ajukan reimburse.' : 'Ajukan dan pantau reimburse Anda.'}</p>
        <div className="leave-summary">
          <span>Pending: {reimbursementSummary.pending}</span>
          <span>Approved: {reimbursementSummary.approved}</span>
          <span>Declined: {reimbursementSummary.declined}</span>
          <span>Total Approved: Rp {reimbursementSummary.totalApproved.toLocaleString('id-ID')}</span>
        </div>
      </div>

      {reimbursementError && <p className="inline-error" style={{ color: '#dc2626' }}>{reimbursementError}</p>}
      {reimbursementMessage && <p className="inline-success">{reimbursementMessage}</p>}

      {currentUser.employee ? (
        <form className="reimburse-form crm-form" onSubmit={handleCreateReimbursement}>
          <div className="form-row-three">
            <div className="form-group">
              <label>Kategori</label>
              <select
                value={reimbursementForm.category}
                onChange={(e) => setReimbursementForm((prev) => ({ ...prev, category: e.target.value }))}
                disabled={reimbursementSubmitLoading}
              >
                <option value="Transport">Transport</option>
                <option value="Meal">Meal</option>
                <option value="Medical">Medical</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nominal</label>
              <input
                type="number"
                min={1}
                value={reimbursementForm.amount}
                onChange={(e) => setReimbursementForm((prev) => ({ ...prev, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                required
                disabled={reimbursementSubmitLoading}
              />
            </div>
            <div className="form-group">
              <label>Tanggal Pengeluaran</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={reimbursementForm.expense_date}
                onChange={(e) => setReimbursementForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                required
                disabled={reimbursementSubmitLoading}
              />
            </div>
          </div>
          <div className="form-row-two">
            <div className="form-group">
              <label>Deskripsi</label>
              <input
                value={reimbursementForm.description}
                pattern="^[a-zA-Z\s\-_]+$"
                onChange={(e) => setReimbursementForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Contoh: Transport meeting client"
                disabled={reimbursementSubmitLoading}
                maxLength={50}
              />
            </div>
            <div className="form-group">
              <label>Upload Foto Struk/Bukti</label>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                onChange={handleReceiptFileChange}
                required
                disabled={reimbursementSubmitLoading}
              />
              {receiptPreviewUrl && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={receiptPreviewUrl}
                    alt="Preview struk"
                    style={{ maxWidth: 200, maxHeight: 160, display: 'block', marginBottom: 6, objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      try { if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl); } catch {}
                      setReceiptPreviewUrl(null);
                      setReimbursementForm((prev) => ({ ...prev, receipt_file: null }));
                      if (receiptInputRef.current) {
                        try { receiptInputRef.current.value = ''; } catch {}
                      }
                    }}
                  >
                    Hapus Foto
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="form-actions compact-actions">
            <button type="submit" disabled={reimbursementSubmitLoading} className="primary-btn">
              {reimbursementSubmitLoading ? 'Mengirim...' : 'Ajukan Reimburse'}
            </button>
          </div>
        </form>
      ) : (
        <p>Data employee belum tersedia untuk mengajukan reimburse.</p>
      )}

      <div className="reimburse-list">
        {reimbursementLoading ? (
          <p>Memuat data reimburse...</p>
        ) : reimbursementRequests.length === 0 ? (
          <p>Belum ada request reimburse.</p>
        ) : (
          reimbursementRequests.map((request) => {
            const isOwnRequest = request.employee_id === currentUser.employee?.id;
            const canDecide = canReviewLeaves && !isOwnRequest && request.status === 'pending';

            return (
              <div key={request.id} className="reimburse-item">
                <div>
                  <strong>{request.employee?.full_name || employeeName}</strong>
                  <p>
                    {request.category} | Rp {Number(request.amount || 0).toLocaleString('id-ID')} |
                    {' '}{request.expense_date}
                  </p>
                  {request.description && <p>Deskripsi: {request.description}</p>}
                  {request.receipt_url && (
                    <p>
                      Bukti:{' '}
                      <button
                        type="button"
                        onClick={() => handleViewPhoto(request.receipt_url)}
                        className="link-btn"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0066cc',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        Lihat Foto
                      </button>
                    </p>
                  )}
                  {request.decline_reason && <p>Ditolak: {request.decline_reason}</p>}
                </div>
                <div className="reimburse-actions">
                  <span className={`status-pill status-${request.status}`}>{request.status.toUpperCase()}</span>
                  {canDecide && (
                    <>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleDecideReimbursement(request.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleDecideReimbursement(request.id, 'declined')}
                      >
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

      {photoModalOpen && selectedPhotoUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleClosePhotoModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhotoUrl}
              alt="Reimbursement Receipt"
              style={{
                maxWidth: '80vw',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
            <button
              type="button"
              onClick={handleClosePhotoModal}
              className="primary-btn"
              style={{
                marginTop: '15px',
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
