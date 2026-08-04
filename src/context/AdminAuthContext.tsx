import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { api } from '../services/api';
import { STORAGE_KEYS, readJson, readStorage, removeStorage, writeJson, writeStorage } from '../utils/storage';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => readJson<AdminUser | null>(STORAGE_KEYS.adminUser, null));

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = readStorage(STORAGE_KEYS.adminToken);
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
        removeStorage(STORAGE_KEYS.adminToken, STORAGE_KEYS.adminUser);
        setAdmin(null);
        setIsLoading(false);
      });
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const res = await api.adminLogin(credentials);
    writeStorage(STORAGE_KEYS.adminToken, res.token);
    writeJson(STORAGE_KEYS.adminUser, res.admin);
    setAdmin(res.admin);
  };

  const logout = () => {
    removeStorage(STORAGE_KEYS.adminToken, STORAGE_KEYS.adminUser);
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
