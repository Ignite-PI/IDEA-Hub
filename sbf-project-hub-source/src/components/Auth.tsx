import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UNAUTHORIZED_EVENT, api } from '../api';
import { Loading } from './EmptyState';

type State = { status: 'loading' } | { status: 'signed-out'; expired?: boolean } | { status: 'signed-in'; username: string; expiresAt?: string };

interface AuthValue {
  state: State;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({ state: { status: 'loading' }, signIn: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    api.auth.session()
      .then((s) => setState(s.authenticated ? { status: 'signed-in', username: s.username!, expiresAt: s.expiresAt } : { status: 'signed-out' }))
      .catch(() => setState({ status: 'signed-out' }));
    const onUnauthorized = () => setState((s) => (s.status === 'signed-in' ? { status: 'signed-out', expired: true } : s));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const s = await api.auth.login(username, password);
    setState({ status: 'signed-in', username: s.username!, expiresAt: s.expiresAt });
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setState({ status: 'signed-out' });
  }, []);

  return <AuthContext.Provider value={{ state, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Renders children only for a signed-in session; otherwise sends the visitor to the sign-in page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading label="Checking your session…" /></div>;
  if (state.status === 'signed-out') {
    const next = `${location.pathname}${location.search}`;
    const qs = new URLSearchParams();
    if (next !== '/') qs.set('next', next);
    if (state.expired) qs.set('expired', '1');
    return <Navigate to={`/login${qs.toString() ? `?${qs}` : ''}`} replace />;
  }
  return <>{children}</>;
}
