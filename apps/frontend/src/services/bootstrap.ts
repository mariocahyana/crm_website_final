const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function getBootstrap(token: string) {
  const res = await fetch(`${API_BASE_URL}/bootstrap`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to fetch bootstrap data');
  }

  return res.json();
}
