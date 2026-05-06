import { useEffect, useState } from 'react';
import { payrollApi, type PayrollPeriod, type PayrollPayslip, type PayrollPayslipDetailResponse } from '../services/payroll';
import { usersApi, type ManagedUser } from '../services/users';
import { auth } from '../services/auth';

interface PayrollPageProps {
  currentUser: {
    user: {
      id: string;
      email: string;
      role: 'admin' | 'staff' | 'manager';
    };
    employee: {
      id: string;
      full_name: string;
    } | null;
  };
  activePayrollView: 'admin' | 'my-payroll';
}

export function PayrollPage({ currentUser, activePayrollView }: PayrollPageProps) {
  const token = auth.getToken();
  const canManagePayroll = currentUser.user.role === 'admin';
  const canViewMyPayroll = Boolean(currentUser.employee);
  const employeeName = currentUser.employee?.full_name || 'User';

  const [users, setUsers] = useState<ManagedUser[]>([]);

  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [payrollPayslips, setPayrollPayslips] = useState<PayrollPayslip[]>([]);
  const [selectedPayrollPeriodId, setSelectedPayrollPeriodId] = useState('');
  const [selectedPayrollPayslipId, setSelectedPayrollPayslipId] = useState('');
  const [payrollPayslipDetail, setPayrollPayslipDetail] = useState<PayrollPayslipDetailResponse | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollActionLoading, setPayrollActionLoading] = useState(false);
  const [payrollDetailLoading, setPayrollDetailLoading] = useState(false);
  const [payrollError, setPayrollError] = useState('');
  const [payrollDetailError, setPayrollDetailError] = useState('');
  const [payrollMessage, setPayrollMessage] = useState('');
  const [payrollView, setPayrollView] = useState<'payslips' | 'items'>('payslips');

  const [myPayrollPayslips, setMyPayrollPayslips] = useState<PayrollPayslip[]>([]);
  const [myPayrollDetail, setMyPayrollDetail] = useState<PayrollPayslipDetailResponse | null>(null);
  const [myPayrollLoading, setMyPayrollLoading] = useState(false);
  const [myPayrollError, setMyPayrollError] = useState('');
  const [selectedMyPayslipId, setSelectedMyPayslipId] = useState('');

  const [periodForm, setPeriodForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const [manualItemForm, setManualItemForm] = useState({
    payslip_id: '',
    employee_id: '',
    type: 'incentive' as 'incentive' | 'penalty',
    amount: 0,
    description: '',
  });

  const loadPayrollPeriods = async () => {
    if (!token || !canManagePayroll) return;

    try {
      setPayrollLoading(true);
      setPayrollError('');
      const periods = await payrollApi.listPeriods(token);
      setPayrollPeriods(periods);
      if (!selectedPayrollPeriodId && periods.length > 0) {
        setSelectedPayrollPeriodId(periods[0].id);
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal memuat payroll periods');
    } finally {
      setPayrollLoading(false);
    }
  };

  const loadPayrollPayslips = async (periodId: string) => {
    if (!token || !periodId) return;
    try {
      const payslips = await payrollApi.listPayslips(token, periodId);
      setPayrollPayslips(payslips);
      const nextSelectedPayslipId = payslips.some((payslip) => payslip.id === selectedPayrollPayslipId)
        ? selectedPayrollPayslipId
        : payslips[0]?.id || '';

      if (nextSelectedPayslipId !== selectedPayrollPayslipId) {
        setSelectedPayrollPayslipId(nextSelectedPayslipId);
      }

      if (!manualItemForm.payslip_id && payslips.length > 0) {
        setManualItemForm((prev) => ({ ...prev, payslip_id: payslips[0].id }));
      }

      if (nextSelectedPayslipId) {
        await loadPayrollPayslipDetail(nextSelectedPayslipId);
      }

      if (payslips.length === 0) {
        setSelectedPayrollPayslipId('');
        setPayrollPayslipDetail(null);
        setPayrollDetailError('');
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal memuat payslips');
    }
  };

  const loadPayrollPayslipDetail = async (payslipId: string) => {
    if (!token || !payslipId || !canManagePayroll) return;

    try {
      setPayrollDetailLoading(true);
      setPayrollDetailError('');
      const detail = await payrollApi.getPayslipDetail(token, payslipId);
      setPayrollPayslipDetail(detail);
    } catch (err) {
      setPayrollDetailError(err instanceof Error ? err.message : 'Gagal memuat detail payslip');
    } finally {
      setPayrollDetailLoading(false);
    }
  };

  const loadMyPayrollPayslips = async () => {
    if (!token || !canViewMyPayroll) return;

    try {
      setMyPayrollLoading(true);
      setMyPayrollError('');
      const payslips = await payrollApi.listMyPayslips(token);
      setMyPayrollPayslips(payslips);
      if (!selectedMyPayslipId && payslips.length > 0) {
        setSelectedMyPayslipId(payslips[0].id);
      }
      if (payslips.length === 0) {
        setMyPayrollDetail(null);
      }
    } catch (err) {
      setMyPayrollError(err instanceof Error ? err.message : 'Gagal memuat payslip saya');
    } finally {
      setMyPayrollLoading(false);
    }
  };

  const loadMyPayrollDetail = async (payslipId: string) => {
    if (!token || !payslipId || !canViewMyPayroll) return;

    try {
      setMyPayrollLoading(true);
      setMyPayrollError('');
      const detail = await payrollApi.getMyPayslipDetail(token, payslipId);
      setMyPayrollDetail(detail);
    } catch (err) {
      setMyPayrollError(err instanceof Error ? err.message : 'Gagal memuat detail payslip saya');
    } finally {
      setMyPayrollLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canManagePayroll || !token) {
      return;
    }

    try {
      setPayrollLoading(true);
      setPayrollError('');
      const result = await usersApi.listUsers(token);
      setUsers(result);
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal memuat user');
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    if (activePayrollView === 'admin' && canManagePayroll && token) {
      void Promise.all([loadPayrollPeriods(), loadUsers()]);
    }
  }, [activePayrollView, token, canManagePayroll]);

  useEffect(() => {
    if (activePayrollView !== 'my-payroll') return;
    void loadMyPayrollPayslips();
  }, [activePayrollView, token, canViewMyPayroll]);

  useEffect(() => {
    if (activePayrollView !== 'my-payroll' || !selectedMyPayslipId) return;
    void loadMyPayrollDetail(selectedMyPayslipId);
  }, [activePayrollView, selectedMyPayslipId, token, canViewMyPayroll]);

  useEffect(() => {
    if (!selectedPayrollPeriodId) {
      setPayrollPayslips([]);
      setSelectedPayrollPayslipId('');
      setPayrollPayslipDetail(null);
      return;
    }

    void loadPayrollPayslips(selectedPayrollPeriodId);
  }, [selectedPayrollPeriodId, token]);

  useEffect(() => {
    if (activePayrollView !== 'admin' || !selectedPayrollPayslipId) return;
    void loadPayrollPayslipDetail(selectedPayrollPayslipId);
  }, [activePayrollView, selectedPayrollPayslipId, token, canManagePayroll]);

  const handleCreatePayrollPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canManagePayroll) return;

    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      const period = await payrollApi.createPeriod(token, periodForm.month, periodForm.year);
      setPayrollMessage('Payroll period berhasil dibuat');
      setSelectedPayrollPeriodId(period.id);
      await loadPayrollPeriods();
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal membuat payroll period');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!token || !selectedPayrollPeriodId) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.generatePeriod(token, selectedPayrollPeriodId);
      await loadPayrollPayslips(selectedPayrollPeriodId);
      if (selectedPayrollPayslipId) {
        await loadPayrollPayslipDetail(selectedPayrollPayslipId);
      }
      setPayrollMessage('Payslip berhasil di-generate dan semua item sudah di-attach');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal membuat payslip draft');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleFinalizePayroll = async () => {
    if (!token || !selectedPayrollPeriodId) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.finalizePeriod(token, selectedPayrollPeriodId);
      await loadPayrollPeriods();
      setPayrollMessage('Payroll period berhasil difinalisasi');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal finalize payroll period');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleAddManualPayrollItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      if (payrollView === 'items') {
        if (!selectedPayrollPeriodId || !manualItemForm.employee_id) {
          setPayrollError('Pilih period dan employee terlebih dahulu');
          return;
        }

        await payrollApi.addManualItemToPeriod(token, selectedPayrollPeriodId, {
          employee_id: manualItemForm.employee_id,
          type: manualItemForm.type,
          amount: Number(manualItemForm.amount),
          description: manualItemForm.description,
        });

        setManualItemForm((prev) => ({ ...prev, employee_id: '', amount: 0, description: '' }));
        await loadPayrollPayslips(selectedPayrollPeriodId);
        setPayrollMessage('Item manual berhasil ditambahkan dan langsung attach ke payslip');
      } else {
        if (!manualItemForm.payslip_id) return;
        await payrollApi.addManualItem(token, manualItemForm.payslip_id, {
          type: manualItemForm.type,
          amount: Number(manualItemForm.amount),
          description: manualItemForm.description,
        });

        setManualItemForm((prev) => ({ ...prev, amount: 0, description: '' }));
        await loadPayrollPayslips(selectedPayrollPeriodId);
        setPayrollMessage('Item manual berhasil ditambahkan');
      }
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal menambah item manual');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  const handleDeleteManualPayrollItem = async (payslipId: string, itemId: string) => {
    if (!token || !canManagePayroll) return;

    try {
      setPayrollActionLoading(true);
      setPayrollError('');
      setPayrollMessage('');
      await payrollApi.deleteManualItem(token, payslipId, itemId);
      await loadPayrollPayslips(selectedPayrollPeriodId);
      if (selectedPayrollPayslipId === payslipId) {
        await loadPayrollPayslipDetail(payslipId);
      }
      setPayrollMessage('Item manual berhasil dihapus');
    } catch (err) {
      setPayrollError(err instanceof Error ? err.message : 'Gagal menghapus item manual');
    } finally {
      setPayrollActionLoading(false);
    }
  };

  if (activePayrollView === 'admin' && canManagePayroll) {
    return (
      <section className="panel payroll-panel">
        <h3>Payroll Management</h3>
        <p className="subtext">Buat period, tambah item manual saat draft, generate payslip, lalu finalize untuk mengunci.</p>

        {payrollError && <p className="inline-error">{payrollError}</p>}
        {payrollMessage && <p className="inline-success">{payrollMessage}</p>}

        <div className="form-group" style={{ maxWidth: 320 }}>
          <label>Menu Payroll</label>
          <select value={payrollView} onChange={(e) => setPayrollView(e.target.value as 'payslips' | 'items')}>
            <option value="payslips">Daftar Payslip</option>
            <option value="items">Tambah Item Manual</option>
          </select>
        </div>

        {payrollView === 'payslips' && (
          <>
            <form className="crm-form" onSubmit={handleCreatePayrollPeriod}>
              <div className="form-header">
                <h4>Buat Payroll Period</h4>
              </div>
              <div className="form-row-three">
                <div className="form-group">
                  <label>Bulan</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={periodForm.month}
                    onChange={(e) => setPeriodForm((prev) => ({ ...prev, month: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tahun</label>
                  <input
                    type="number"
                    min={2000}
                    value={periodForm.year}
                    onChange={(e) => setPeriodForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="submit" className="primary-btn" disabled={payrollActionLoading}>
                    {payrollActionLoading ? 'Menyimpan...' : 'Buat Period'}
                  </button>
                </div>
              </div>
            </form>

            <div className="crm-form">
              <div className="form-header">
                <h4>Period Aktif</h4>
              </div>
              <div className="form-row-three">
                <div className="form-group">
                  <label>Period</label>
                  <select
                    value={selectedPayrollPeriodId}
                    onChange={(e) => setSelectedPayrollPeriodId(e.target.value)}
                    disabled={payrollLoading || payrollPeriods.length === 0}
                  >
                    {payrollPeriods.length === 0 && <option value="">Belum ada period</option>}
                    {payrollPeriods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {String(period.month).padStart(2, '0')}/{period.year} ({period.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="button" className="secondary-btn" onClick={handleGeneratePayroll} disabled={payrollActionLoading || !selectedPayrollPeriodId} style={{ width: '100%' }}>
                    {payrollActionLoading ? 'Generating...' : 'Generate Payslip'}
                  </button>
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="button" className="danger-btn" onClick={handleFinalizePayroll} disabled={payrollActionLoading || !selectedPayrollPeriodId} style={{ width: '100%' }}>
                    Finalize Period
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {payrollView === 'payslips' && (
          <>
            <div className="payroll-preview-table">
              <h4>Payslips</h4>
              {payrollPayslips.length > 0 && (
                <div className="form-group" style={{ maxWidth: 320, marginBottom: 16 }}>
                  <label>Pilih Detail Payslip</label>
                  <select value={selectedPayrollPayslipId} onChange={(e) => setSelectedPayrollPayslipId(e.target.value)}>
                    <option value="">Pilih payslip</option>
                    {payrollPayslips.map((payslip) => (
                      <option key={payslip.id} value={payslip.id}>
                        {payslip.employee?.full_name || payslip.employee_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {payrollPayslips.length === 0 ? (
                <p>Belum ada payslip di period ini.</p>
              ) : (
                <div className="payroll-grid">
                  {payrollPayslips.map((payslip) => (
                    <div key={payslip.id} className="user-item">
                      <div>
                        <strong>{payslip.employee?.full_name || payslip.employee_id}</strong>
                        <p>
                          Incentive: Rp {Number(payslip.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(payslip.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(payslip.total_penalty || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <span className="status-pill">Net: Rp {Number(payslip.net_salary || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {payrollDetailError && <p className="inline-error">{payrollDetailError}</p>}

            {payrollDetailLoading && <p>Memuat detail payslip...</p>}

            {payrollPayslipDetail && !payrollDetailLoading && (
              <div className="payroll-preview-table">
                <h4>Detail Payslip</h4>
                <div className="payroll-grid">
                  <div className="user-item">
                    <div>
                      <strong>{payrollPayslipDetail.payslip.employee?.full_name || payrollPayslipDetail.payslip.employee_id}</strong>
                      <p>
                        Base: Rp {Number(payrollPayslipDetail.totals.base_salary || 0).toLocaleString('id-ID')} | Incentive: Rp {Number(payrollPayslipDetail.totals.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(payrollPayslipDetail.totals.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(payrollPayslipDetail.totals.total_penalty || 0).toLocaleString('id-ID')}
                      </p>
                      <p>
                        Net: Rp {Number(payrollPayslipDetail.totals.net_salary || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div>
                      <span className="status-pill">
                        {payrollPayslipDetail.payslip.period?.month
                          ? `${String(payrollPayslipDetail.payslip.period.month).padStart(2, '0')}/${payrollPayslipDetail.payslip.period.year}`
                          : 'Payslip'}
                      </span>
                    </div>
                  </div>

                  <div className="user-item" style={{ gridColumn: '1 / -1' }}>
                    <div>
                      <strong>Breakdown Item</strong>
                      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        {payrollPayslipDetail.items.length === 0 ? (
                          <p>Tidak ada item detail.</p>
                        ) : (
                          payrollPayslipDetail.items.map((item) => (
                            <div key={item.id} className="summary-item">
                              <span>{item.type.toUpperCase()} / {item.source}</span>
                              <strong>Rp {Number(item.amount || 0).toLocaleString('id-ID')}</strong>
                              {item.description && <p>{item.description}</p>}
                              {item.source === 'manual' && payrollPeriods.find((period) => period.id === selectedPayrollPeriodId)?.status === 'draft' && (
                                <button
                                  type="button"
                                  className="danger-btn"
                                  onClick={() => void handleDeleteManualPayrollItem(payrollPayslipDetail.payslip.id, item.id)}
                                  disabled={payrollActionLoading}
                                  style={{ width: 'fit-content' }}
                                >
                                  Hapus Item Manual
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {payrollView === 'items' && (
          <>
            <div className="crm-form">
              <div className="form-header">
                <h4>Period</h4>
              </div>
              <div className="form-row-three">
                <div className="form-group">
                  <label>Pilih Period</label>
                  <select
                    value={selectedPayrollPeriodId}
                    onChange={(e) => setSelectedPayrollPeriodId(e.target.value)}
                    disabled={payrollLoading || payrollPeriods.filter((p) => p.status === 'draft').length === 0}
                  >
                    {payrollPeriods.filter((p) => p.status === 'draft').length === 0 && <option value="">Belum ada period draft</option>}
                    {payrollPeriods.filter((p) => p.status === 'draft').map((period) => (
                      <option key={period.id} value={period.id}>
                        {String(period.month).padStart(2, '0')}/{period.year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <form className="crm-form" onSubmit={handleAddManualPayrollItem}>
              <div className="form-header">
                <h4>Tambah Item Manual (Insentif / Penalti)</h4>
              </div>
              <div className="form-row-three">
                <div className="form-group">
                  <label>Employee</label>
                  <select
                    value={manualItemForm.employee_id}
                    onChange={(e) => setManualItemForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                    required
                  >
                    <option value="">Pilih employee</option>
                    {users.filter((u) => u.employee).map((u) => (
                      <option key={u.id} value={u.employee?.id || ''}>
                        {u.employee?.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tipe</label>
                  <select
                    value={manualItemForm.type}
                    onChange={(e) => setManualItemForm((prev) => ({ ...prev, type: e.target.value as 'incentive' | 'penalty' }))}
                  >
                    <option value="incentive">Incentive</option>
                    <option value="penalty">Penalty (kerusakan/dll)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nominal</label>
                  <input
                    type="number"
                    min={1}
                    value={manualItemForm.amount}
                    onChange={(e) => setManualItemForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>
              <div className="form-row-one">
                <div className="form-group">
                  <label>Deskripsi</label>
                  <input
                    value={manualItemForm.description}
                    onChange={(e) => setManualItemForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Contoh: Penalti kerusakan inventaris"
                  />
                </div>
              </div>
              <div className="form-actions compact-actions">
                <button type="submit" className="primary-btn" disabled={payrollActionLoading || !selectedPayrollPeriodId || !manualItemForm.employee_id}>
                  {payrollActionLoading ? 'Menyimpan...' : 'Tambah Item Manual'}
                </button>
              </div>
            </form>

            {payrollPayslips.length > 0 && (
              <div className="payroll-preview-table">
                <h4>Item Manual di Payslips</h4>
                <div className="payroll-grid">
                  {payrollPayslips.map((payslip) => {
                    const manualItems = payslip.items?.filter((item) => item.source === 'manual') || [];
                    return (
                      <div key={payslip.id} className="user-item">
                        <div>
                          <strong>{payslip.employee?.full_name || payslip.employee_id}</strong>
                          {manualItems.length > 0 ? (
                            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                              {manualItems.map((item) => (
                                <div key={item.id} style={{ fontSize: 12, color: '#666' }}>
                                  {item.type.toUpperCase()}: Rp {Number(item.amount || 0).toLocaleString('id-ID')} {item.description && `(${item.description})`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Tidak ada item manual</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  if (activePayrollView === 'my-payroll' && canViewMyPayroll) {
    return (
      <section className="panel payroll-panel">
        <h3>Payslip Saya</h3>
        <p>Lihat ringkasan gaji, insentif, dan penalti Anda sendiri.</p>

        {myPayrollError && <p className="inline-error">{myPayrollError}</p>}

        {myPayrollLoading && <p>Memuat payslip...</p>}

        {!myPayrollLoading && myPayrollPayslips.length === 0 && (
          <p>Belum ada payslip untuk akun ini.</p>
        )}

        {myPayrollPayslips.length > 0 && (
          <div className="payroll-preview-table">
            <div className="form-group" style={{ maxWidth: 320 }}>
              <label>Pilih Payslip</label>
              <select
                value={selectedMyPayslipId}
                onChange={(e) => setSelectedMyPayslipId(e.target.value)}
              >
                <option value="">Pilih payslip</option>
                {myPayrollPayslips.map((payslip) => (
                  <option key={payslip.id} value={payslip.id}>
                    {(() => {
                      const payslipPeriod = (payslip as PayrollPayslip & { period?: PayrollPeriod }).period;
                      return payslipPeriod?.month
                        ? `${String(payslipPeriod.month).padStart(2, '0')}/${payslipPeriod.year}`
                        : payslip.period_id;
                    })()}
                  </option>
                ))}
              </select>
            </div>

            {myPayrollDetail && (
              <div className="payroll-grid" style={{ marginTop: 16 }}>
                <div className="user-item">
                  <div>
                    <strong>{myPayrollDetail.payslip.employee?.full_name || employeeName}</strong>
                    <p>
                      Base: Rp {Number(myPayrollDetail.totals.base_salary || 0).toLocaleString('id-ID')} | Incentive: Rp {Number(myPayrollDetail.totals.total_incentive || 0).toLocaleString('id-ID')} | Reimburse: Rp {Number(myPayrollDetail.totals.total_reimburse || 0).toLocaleString('id-ID')} | Penalty: Rp {Number(myPayrollDetail.totals.total_penalty || 0).toLocaleString('id-ID')}
                    </p>
                    <p>
                      Net: Rp {Number(myPayrollDetail.totals.net_salary || 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="status-pill">{myPayrollDetail.payslip.period?.month ? `${String(myPayrollDetail.payslip.period.month).padStart(2, '0')}/${myPayrollDetail.payslip.period.year}` : 'Payslip'}</span>
                  </div>
                </div>

                <div className="user-item" style={{ gridColumn: '1 / -1' }}>
                  <div>
                    <strong>Breakdown Item</strong>
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      {myPayrollDetail.items.length === 0 ? (
                        <p>Tidak ada item detail.</p>
                      ) : (
                        myPayrollDetail.items.map((item) => (
                          <div key={item.id} className="summary-item">
                            <span>{item.type.toUpperCase()} / {item.source}</span>
                            <strong>Rp {Number(item.amount || 0).toLocaleString('id-ID')}</strong>
                            {item.description && <p>{item.description}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  return null;
}
