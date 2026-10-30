import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UNAUTHORIZED_EVENT, api } from '../api';
import { Loading } from './EmptyState';

export type Role = 'ignite' | 'managers';
type State =
  | { status: 'loading' }
  | { status: 'signed-out'; expired?: boolean }
  | { status: 'signed-in'; username: string; role: Role; expiresAt?: string };

interface AuthValue {
  state: State;
  signIn: (username: string, password: string) => Promise<Role>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({ state: { status: 'loading' }, signIn: async () => 'ignite', signOut: async () => {} });

/** Home page for each account: IGNITE → project hub, MANAGERS → Senior Manager savings module. */
export const homeFor = (role: Role) => (role === 'managers' ? '/managers' : '/');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    api.auth.session()
      .then((s) => setState(s.authenticated ? { status: 'signed-in', username: s.username!, role: (s.role as Role) || 'ignite', expiresAt: s.expiresAt } : { status: 'signed-out' }))
      .catch(() => setState({ status: 'signed-out' }));
    const onUnauthorized = () => setState((s) => (s.status === 'signed-in' ? { status: 'signed-out', expired: true } : s));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const s = await api.auth.login(username, password);
    const role = (s.role as Role) || 'ignite';
    setState({ status: 'signed-in', username: s.username!, role, expiresAt: s.expiresAt });
    return role;
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setState({ status: 'signed-out' });
  }, []);

  return <AuthContext.Provider value={{ state, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/**
 * Renders children only for a signed-in session with the required role; otherwise sends the visitor
 * to the sign-in page (signed out) or to their own home area (signed in with the other account).
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading label="Checking your session…" /></div>;
  if (state.status === 'signed-out') {
    const next = `${location.pathname}${location.search}`;
    const qs = new URLSearchParams();
    if (next !== '/') qs.set('next', next);
    if (state.expired) qs.set('expired', '1');
    if (role === 'managers') qs.set('account', 'managers');
    return <Navigate to={`/login${qs.toString() ? `?${qs}` : ''}`} replace />;
  }
  if (role && state.role !== role) return <Navigate to={homeFor(state.role)} replace />;
  return <>{children}</>;
}
