import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TOKEN_STORAGE_KEY, getMe, login as apiLogin, signup as apiSignup } from '../api/client';
import type { LoginPayload, SignupPayload, User } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  signup: (payload: SignupPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(payload: LoginPayload) {
    const res = await apiLogin(payload);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }

  async function signup(payload: SignupPayload) {
    const res = await apiSignup(payload);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
