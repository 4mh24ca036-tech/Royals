import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { api, ApiError } from '../services/api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  sessionError: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('royals_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.warn('Discarding corrupt stored admin session:', err);
      localStorage.removeItem('royals_admin_user');
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('royals_admin_token');
    if (!token) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    // Verify admin token by fetching stats
    api.getAdminStats()
      .then(() => {
        setSessionError(null);
      })
      .catch((err) => {
        const isRejectedSession = err instanceof ApiError && (err.status === 401 || err.status === 403);
        if (isRejectedSession) {
          localStorage.removeItem('royals_admin_token');
          localStorage.removeItem('royals_admin_user');
          setAdmin(null);
          return;
        }
        // A server or network failure must not masquerade as an expired admin session
        console.error('Admin session verification failed:', err);
        setSessionError(err instanceof Error ? err.message : 'Unable to verify the admin session.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const res = await api.adminLogin(credentials);
    localStorage.setItem('royals_admin_token', res.token);
    localStorage.setItem('royals_admin_user', JSON.stringify(res.admin));
    setAdmin(res.admin);
  };

  const logout = () => {
    localStorage.removeItem('royals_admin_token');
    localStorage.removeItem('royals_admin_user');
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAdminAuthenticated: !!admin,
        isLoading,
        login,
        logout,
        sessionError
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
