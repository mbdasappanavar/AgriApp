import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Store } from '../types';
import { apiRequest, setAuthToken, getAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  stores: Store[];
  activeStoreId: string;
  setActiveStoreId: (storeId: string) => void;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>('store-main');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchStores = async () => {
    try {
      const data = await apiRequest('/api/stores');
      setStores(data.stores || []);
    } catch (err) {
      console.error('Failed to load stores:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let token = getAuthToken();
      if (token) {
        try {
          const data = await apiRequest('/api/auth/me');
          if (data && data.user) {
            setUser(data.user);
            setActiveStoreId(data.user.storeId || 'store-main');
            await fetchStores();
            setIsLoading(false);
            return;
          }
        } catch {
          // Token expired or invalid; silently clear and proceed to auto-login
          setAuthToken(null);
          setUser(null);
        }
      }

      // Default auto-login as admin for instant preview access
      try {
        const loginData = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        setAuthToken(loginData.token);
        setUser(loginData.user);
        setActiveStoreId(loginData.user.storeId || 'store-main');
        await fetchStores();
      } catch (err) {
        console.error("Auto login failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (token: string, userData: User) => {
    setAuthToken(token);
    setUser(userData);
    setActiveStoreId(userData.storeId || 'store-main');
    fetchStores();
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.roleCode === 'SUPER_ADMIN') return true;
    return user.permissions ? user.permissions.includes(code) : false;
  };

  return (
    <AuthContext.Provider value={{
      user, stores, activeStoreId, setActiveStoreId, isLoading, login, logout, hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
