import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authService } from '../services/auth.service';
import { getToken, setToken } from '../services/api';
import { toast } from '../lib/toast';
import type { AuthUser } from '../types/product';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/** Session length, mirrored from the backend JWT (JWT_EXPIRES_IN=10m). */
const SESSION_MS = 10 * 60 * 1000;
/** Refresh the token once the session is this close to expiring. */
const REFRESH_BEFORE_MS = 2 * 60 * 1000;
/** How often the activity watcher checks whether a refresh is due. */
const TICK_MS = 30 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const lastActivity = useRef(Date.now());
  const issuedAt = useRef(Date.now());
  const refreshing = useRef(false);

  const clearSession = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  // Restore the session on refresh. /auth/me returns the live account (role
  // included) so role-gated screens survive a page reload.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then((u) => {
        setUser(u);
        issuedAt.current = Date.now();
        lastActivity.current = Date.now();
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Sliding expiry: while the user is actually working the token is renewed
  // before it can expire; after 10 idle minutes the session ends cleanly.
  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      if (document.visibilityState === 'hidden') return;
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      const idleFor = now - lastActivity.current;
      const age = now - issuedAt.current;

      if (idleFor >= SESSION_MS) {
        clearSession();
        toast('info', 'You were signed out after 10 minutes of inactivity.');
        return;
      }
      if (age >= SESSION_MS - REFRESH_BEFORE_MS && !refreshing.current) {
        refreshing.current = true;
        authService
          .refresh()
          .then((u) => {
            setUser(u);
            issuedAt.current = Date.now();
          })
          .catch(() => clearSession())
          .finally(() => {
            refreshing.current = false;
          });
      }
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      window.clearInterval(timer);
    };
  }, [user, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authService.login(email, password);
    issuedAt.current = Date.now();
    lastActivity.current = Date.now();
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
