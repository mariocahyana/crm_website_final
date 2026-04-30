import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PortalPage } from './pages/PortalPage';
import './styles/global.css';

interface SessionUser {
  user: {
    id: string;
    email: string;
    role: 'admin' | 'staff';
  };
  employee: {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    photo_url: string | null;
  } | null;
}

function App() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Check session on mount
  useEffect(() => {
    const bootstrap = async () => {
      const token = auth.getToken();
      if (token) {
        try {
          const res = await auth.getMe(token);
          setCurrentUser(res.data);
        } catch {
          auth.clearToken();
        }
      }
      setIsBootstrapping(false);
    };
    bootstrap();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoginLoading(true);
      setLoginError('');
      const res = await auth.login(email, password);
      auth.setToken(res.data.token);
      setCurrentUser({
        user: res.data.user,
        employee: res.data.employee,
      });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = () => {
    auth.clearToken();
    setCurrentUser(null);
  };

  if (isBootstrapping) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="boot-spinner" aria-hidden="true" />
          <p>Menyiapkan sesi Anda...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage isLoading={isLoginLoading} error={loginError} onSubmit={handleLogin} />
            )
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute currentUser={currentUser} role="admin">
              <PortalPage currentUser={currentUser!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute currentUser={currentUser} role="staff">
              <PortalPage currentUser={currentUser!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            currentUser ? (
              <Navigate to={currentUser.user.role === 'admin' ? '/admin' : '/staff'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;