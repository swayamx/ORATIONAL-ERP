import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATIONS' | 'SALES';
  assignedLocation?: {
    id: string;
    code: string;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  quickSwitchRole: (role: 'ADMIN' | 'OPERATIONS' | 'SALES') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('erp_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('erp_token');
      if (savedToken) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.data);
        } catch (err) {
          localStorage.removeItem('erp_token');
          localStorage.removeItem('erp_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data.data;

    localStorage.setItem('erp_token', newToken);
    localStorage.setItem('erp_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
  };

  const quickSwitchRole = async (role: 'ADMIN' | 'OPERATIONS' | 'SALES') => {
    const credentials = {
      ADMIN: { email: 'admin@erp.com', password: 'Admin@123' },
      OPERATIONS: { email: 'ops@erp.com', password: 'Ops@123' },
      SALES: { email: 'sales@erp.com', password: 'Sales@123' }
    };

    const cred = credentials[role];
    await login(cred.email, cred.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        quickSwitchRole
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
