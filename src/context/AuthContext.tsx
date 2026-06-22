import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API, authHeaders, clearSession, getSessionId, setSessionId } from '@/lib/api';

export interface User {
  id: number;
  email: string;
  full_name: string;
  credits: number;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getSessionId()) { setLoading(false); return; }
    try {
      const res = await fetch(API.auth, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'me' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        clearSession();
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch(API.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    setSessionId(data.session_id);
    setUser(data.user);
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await fetch(API.auth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, full_name: fullName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
    setSessionId(data.session_id);
    setUser(data.user);
  };

  const logout = () => {
    fetch(API.auth, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'logout' }) });
    clearSession();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
