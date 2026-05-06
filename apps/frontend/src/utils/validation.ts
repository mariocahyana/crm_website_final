export function normalizePhoneValue(phone: string): string {
  let normalizedPhone = phone.trim().replace(/\s/g, '');

  if (normalizedPhone.startsWith('+62')) {
    normalizedPhone = '0' + normalizedPhone.slice(3);
  } else if (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone.slice(2);
  }

  return normalizedPhone;
}

export function validateProfileForm(fullName: string, phone: string, address: string, isDirty: boolean): string | null {
  if (!fullName.trim()) {
    return 'Nama Lengkap wajib diisi';
  }

  if (!phone.trim()) {
    return 'Nomor Telepon wajib diisi';
  }

  const normalizedPhone = normalizePhoneValue(phone);
  const phoneDigitsOnly = normalizedPhone.replace(/\D/g, '');
  if (phoneDigitsOnly.length < 10) {
    return 'Nomor Telepon harus minimal 10 digit (contoh: 081234567890)';
  }

  if (!address.trim()) {
    return 'Alamat wajib diisi';
  }

  if (address.trim().length < 15) {
    return 'Alamat harus minimal 15 karakter (contoh: Jl. Merdeka No. 123)';
  }

  if (!isDirty) {
    return 'Tidak ada perubahan pada profile';
  }

  return null;
}

export function validatePhotoFile(file: File | null, maxSize: number): string | null {
  if (file && file.size > maxSize) {
    return `Ukuran foto maksimal ${maxSize / (1024 * 1024)}MB`;
  }
  return null;
}

export function validateLeaveForm(reason: string, startDate: string, endDate: string): string | null {
  const today = new Date().toISOString().slice(0, 10);

  if (!reason || !reason.trim()) {
    return 'Alasan cuti wajib diisi';
  }

  if (startDate < today) {
    return 'Tanggal mulai cuti tidak boleh sebelum hari ini';
  }

  if (endDate < startDate) {
    return 'Tanggal selesai cuti harus lebih besar atau sama dengan tanggal mulai';
  }

  return null;
}

export function validateUserForm(
  fullName: string,
  email: string,
  password: string,
  departmentId: string,
  joinDate: string,
  baseSalary: number,
  jobTitle: string,
  phone: string,
  address: string,
  role: string,
  managerId: string,
  isEditing: boolean
): string | null {
  if (!fullName.trim()) {
    return 'Nama lengkap wajib diisi';
  }

  if (!email.trim()) {
    return 'Email wajib diisi';
  }

  if (!/^\S+@company\.com$/i.test(email.trim())) {
    return 'Email harus menggunakan domain @company.com';
  }

  if (!isEditing && !password.trim()) {
    return 'Password wajib diisi';
  }

  if (!isEditing && password.trim().length < 8) {
    return 'Password minimal 8 karakter';
  }

  if (!departmentId) {
    return 'Department wajib dipilih';
  }

  if (role === 'staff' && !managerId) {
    return 'Manager wajib dipilih untuk staff';
  }

  if (!joinDate) {
    return 'Tanggal bergabung wajib diisi';
  }

  if (baseSalary < 0) {
    return 'Gaji pokok tidak boleh negatif';
  }

  if (phone.trim() && phone.trim().replace(/\D/g, '').length < 10) {
    return 'Nomor telepon harus minimal 10 digit';
  }

  if (address.trim() && address.trim().length < 15) {
    return 'Alamat harus minimal 15 karakter';
  }

  if (!jobTitle.trim()) {
    return 'Jabatan wajib diisi';
  }

  return null;
}

export function validateReimbursementForm(
  category: string,
  amount: string | number,
  expenseDate: string,
  description: string,
  receiptFile: File | null,
  maxFileSize: number
): string | null {
  if (!receiptFile) {
    return 'Foto struk/bukti wajib diupload';
  }

  if (receiptFile.size > maxFileSize) {
    return `Ukuran file struk maksimal ${maxFileSize / (1024 * 1024)}MB`;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (expenseDate > today) {
    return 'Tanggal pengeluaran tidak boleh melebihi hari ini';
  }

  if (!description.trim()) {
    return 'Deskripsi pengeluaran wajib diisi';
  }

  if (!amount || Number(amount) <= 0) {
    return 'Nominal harus lebih dari 0';
  }

  return null;
}
69