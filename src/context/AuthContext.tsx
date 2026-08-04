import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Address, Notification } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  addresses: Address[];
  notifications: Notification[];
  unreadNotificationCount: number;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  addAddress: (addressData: any) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const refreshProfile = async () => {
    const token = localStorage.getItem('royals_user_token');
    if (!token) {
      setUser(null);
      setAddresses([]);
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getProfile();
      setUser(data.user);
      setAddresses(data.addresses);
      setNotifications(data.notifications);
    } catch (err) {
      console.error('Failed to load profile:', err);
      localStorage.removeItem('royals_user_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.customerLogin(credentials);
    localStorage.setItem('royals_user_token', res.token);
    setUser(res.user);
    await refreshProfile();
    setIsAuthModalOpen(false);
  };

  const register = async (data: { name: string; email: string; phone?: string; password: string }) => {
    const res = await api.customerRegister(data);
    localStorage.setItem('royals_user_token', res.token);
    setUser(res.user);
    await refreshProfile();
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('royals_user_token');
    setUser(null);
    setAddresses([]);
    setNotifications([]);
  };

  const addAddress = async (addressData: any) => {
    const updated = await api.addAddress(addressData);
    setAddresses(updated);
  };

  const deleteAddress = async (id: string) => {
    const updated = await api.deleteAddress(id);
    setAddresses(updated);
  };

  const markNotificationAsRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
    );
  };

  const unreadNotificationCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        addresses,
        notifications,
        unreadNotificationCount,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        addAddress,
        deleteAddress,
        markNotificationAsRead,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
