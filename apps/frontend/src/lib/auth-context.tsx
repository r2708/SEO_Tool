'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from './api-client';
import type { User, AuthResult } from '@seo-saas/shared-types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load token and user on mount
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      apiClient.loadToken();
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (token) {
        // Verify token by fetching user profile
        const userData = await apiClient.get<User>('/api/auth/me');
        setUser(userData);
      }
    } catch (error) {
      // Token invalid or expired
      apiClient.clearToken();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await apiClient.post<AuthResult>('/api/auth/login', {
      email,
      password,
    });
    
    apiClient.setToken(result.token);
    setUser(result.user);
  };

  const register = async (email: string, password: string) => {
    const result = await apiClient.post<AuthResult>('/api/auth/register', {
      email,
      password,
    });
    
    apiClient.setToken(result.token);
    setUser(result.user);
  };

  const logout = () => {
    apiClient.clearToken();
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
