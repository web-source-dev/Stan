'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, ApiException } from './api';
import type { AuthUser } from './types';

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export type TwoFactorMethod = 'email' | 'authenticator';

/** Login may return a session, OR a 2FA challenge that must be verified next. */
export interface LoginResult {
  twoFactorRequired?: boolean;
  challengeId?: string;
  methods?: TwoFactorMethod[];
  devCode?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Complete a 2FA login with email code or authenticator TOTP. */
  verifyTwoFactor: (challengeId: string, code: string, method: TwoFactorMethod) => Promise<void>;
  /** Resend the email login code for an active 2FA challenge. */
  resendTwoFactorEmail: (challengeId: string) => Promise<void>;
  signup: (email: string, password: string, ref?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Authenticated request that attaches the access token and refreshes on 401. */
  authedRequest: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  // De-dupes concurrent refreshes. The refresh token rotates on every use and
  // the backend treats a replayed (already-rotated) token as reuse → it revokes
  // the whole session. On a hard page load the bootstrap refresh and several
  // data-fetching requests can all 401 and refresh at once; collapsing them into
  // a single in-flight request avoids tripping that reuse detection.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const setSession = (res: AuthResponse) => {
    tokenRef.current = res.accessToken;
    setUser(res.user);
  };

  const tryRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const p = (async () => {
      try {
        const res = await apiRequest<AuthResponse>('/api/auth/refresh', { method: 'POST' });
        setSession(res);
        return res.accessToken;
      } catch {
        tokenRef.current = null;
        setUser(null);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = p;
    return p;
  }, []);

  // Restore session on first load via the httpOnly refresh cookie.
  useEffect(() => {
    void tryRefresh().finally(() => setLoading(false));
  }, [tryRefresh]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiRequest<AuthResponse & LoginResult>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (res.twoFactorRequired) {
      return {
        twoFactorRequired: true,
        challengeId: res.challengeId,
        methods: res.methods ?? ['email'],
        devCode: res.devCode,
      };
    }
    setSession(res);
    return {};
  }, []);

  const verifyTwoFactor = useCallback(async (challengeId: string, code: string, method: TwoFactorMethod) => {
    const res = await apiRequest<AuthResponse>('/api/auth/login/verify-2fa', {
      method: 'POST',
      body: { challengeId, code, method },
    });
    setSession(res);
  }, []);

  const resendTwoFactorEmail = useCallback(async (challengeId: string) => {
    await apiRequest('/api/auth/login/resend-2fa', { method: 'POST', body: { challengeId } });
  }, []);

  const signup = useCallback(async (email: string, password: string, ref?: string) => {
    const res = await apiRequest<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: { email, password, ref },
    });
    setSession(res);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    tokenRef.current = null;
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) return;
    const res = await apiRequest<{ user: AuthUser }>('/api/auth/me', { token: tokenRef.current });
    setUser(res.user);
  }, []);

  const authedRequest = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
      const run = (token: string | null) =>
        apiRequest<T>(path, { method: opts.method, body: opts.body, token });
      // If we don't yet hold an access token (e.g. right after a hard page
      // reload, before the bootstrap refresh resolves), get one first instead
      // of firing a guaranteed-401 request and retrying. tryRefresh() is
      // de-duped, so concurrent callers share a single refresh.
      let token = tokenRef.current;
      if (!token) token = await tryRefresh();
      try {
        return await run(token);
      } catch (err) {
        if (err instanceof ApiException && err.status === 401) {
          const newToken = await tryRefresh();
          if (newToken) return run(newToken);
        }
        throw err;
      }
    },
    [tryRefresh],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, verifyTwoFactor, resendTwoFactorEmail, signup, logout, refreshUser, authedRequest }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
