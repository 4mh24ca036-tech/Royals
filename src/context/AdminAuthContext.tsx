import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { api } from '../services/api';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('royals_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

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
        setIsLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('royals_admin_token');
        localStorage.removeItem('royals_admin_user');
        setAdmin(null);
        setIsLoading(false);
      });
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
        logout
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
