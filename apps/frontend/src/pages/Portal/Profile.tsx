import { useEffect, useState } from 'react';
import { profileApi } from '../../services/profile';

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

interface ProfilePageProps {
  currentUser: SessionUser;
  onEmployeeUpdate: (employee: SessionUser['employee']) => void;
  token: string | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function normalizePhoneValue(phone: string) {
  let normalizedPhone = phone.trim().replace(/\s/g, '');

  if (normalizedPhone.startsWith('+62')) {
    normalizedPhone = '0' + normalizedPhone.slice(3);
  } else if (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone.slice(2);
  }

  return normalizedPhone;
}

export function ProfilePage({ currentUser, onEmployeeUpdate, token }: ProfilePageProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: currentUser.employee?.full_name || '',
    phone: currentUser.employee?.phone || '',
    address: currentUser.employee?.address || '',
    photo_file: null as File | null,
    photo_deleted: false,
  });

  const defaultProfilePhoto = '/images/default-profile.svg';
  const currentProfilePhotoSrc = form.photo_deleted
    ? defaultProfilePhoto
    : form.photo_file
      ? URL.createObjectURL(form.photo_file)
      : currentUser.employee?.photo_url?.startsWith('http')
        ? currentUser.employee.photo_url
        : currentUser.employee?.photo_url
          ? `${import.meta.env.VITE_API_BASE_URL}${currentUser.employee.photo_url}`
          : defaultProfilePhoto;

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm((prev) => ({
        ...prev,
        [name]: normalizePhoneValue(value),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError('File size must be less than 5 MB');
        return;
      }
      setForm((prev) => ({
        ...prev,
        photo_file: file,
        photo_deleted: false,
      }));
    }
  };

  const handleProfilePhotoDelete = () => {
    setForm((prev) => ({
      ...prev,
      photo_file: null,
      photo_deleted: true,
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Not authenticated');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('full_name', form.full_name);
      formData.append('phone', form.phone);
      formData.append('address', form.address);

      if (form.photo_file) {
        formData.append('photo', form.photo_file);
      }

      if (form.photo_deleted) {
        formData.append('photo_deleted', 'true');
      }

      const res = await profileApi.updateMyProfile(token, formData);
      setMessage('Profile updated successfully');
      onEmployeeUpdate(res.data.employee);
      setForm((prev) => ({
        ...prev,
        photo_file: null,
        photo_deleted: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser.employee) {
    return (
      <section className="panel profile-panel">
        <h3>Profile</h3>
        <p>No employee data available</p>
      </section>
    );
  }

  return (
    <section className="panel profile-panel">
      <h3>Profile</h3>
      <form className="profile-form" onSubmit={handleProfileUpdate}>
        {error && <p className="inline-error" style={{ color: '#dc2626' }}>{error}</p>}
        {message && <p className="inline-success">{message}</p>}

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Foto Profile</label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <img
                src={currentProfilePhotoSrc}
                alt="Current profile photo"
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: '2px solid #ddd',
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', padding: '4px 12px', background: '#5B6EFF', color: 'white', borderRadius: 4, fontSize: '0.875rem' }}>
                  Choose Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoChange}
                    style={{ display: 'none' }}
                  />
                </label>
                {(form.photo_file || currentUser.employee.photo_url) && !form.photo_deleted && (
                  <button
                    type="button"
                    onClick={handleProfilePhotoDelete}
                    style={{ cursor: 'pointer', padding: '4px 12px', background: '#dc2626', color: 'white', borderRadius: 4, fontSize: '0.875rem', border: 'none' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Nama Lengkap</label>
          <input
            type="text"
            name="full_name"
            value={form.full_name}
            onChange={handleProfileChange}
            required
            minLength={3}
          />
        </div>

        <div className="form-group">
          <label>Telepon</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleProfileChange}
            placeholder="0812..."
            minLength={10}
          />
        </div>

        <div className="form-group">
          <label>Alamat</label>
          <textarea
            name="address"
            value={form.address}
            onChange={handleProfileChange}
            minLength={15}
            rows={4}
          />
        </div>

        <button type="submit" disabled={loading} style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );
}
