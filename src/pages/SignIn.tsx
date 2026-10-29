import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { BRAND, CHARACTERS } from '../characters';
import { useAuth } from '../components/Auth';

/** Only allow same-app paths as the post-login destination (prevents open redirects). */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/login') ? v : '/');

export function SignIn() {
  const { state, signIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const next = safeNext(params.get('next'));

  if (state.status === 'signed-in') return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter the username and password.'); return; }
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Sign-in failed. Please try again.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="signin">
      <div className="signin-art">
        <div className="signin-art-copy">
          <span className="hero-tag"><img src={BRAND.fire} alt="" /> Payment Integrity · IGNITE</span>
          <h1>{BRAND.name}</h1>
          <p>Ideas, improvement initiatives and projects across the SBF Tower — from first spark to implementation.</p>
        </div>
        <img className="signin-team" src={CHARACTERS.team} alt="" />
      </div>

      <main className="signin-panel">
        <form className="signin-card" onSubmit={submit} noValidate aria-labelledby="signin-title">
          <img src={BRAND.full} alt="Payment Integrity IGNITE" className="signin-logo" />
          <h2 id="signin-title">Sign in to {BRAND.name}</h2>
          <p className="muted small" style={{ marginBottom: 18 }}>Use the shared IGNITE account to continue.</p>

          {params.get('expired') && !error && (
            <div className="signin-note" role="status">Your session has ended. Please sign in again.</div>
          )}
          {error && (
            <div className="signin-error" role="alert"><AlertCircle size={16} /> {error}</div>
          )}

          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="input-icon">
              <User size={16} />
              <input id="username" className="input" autoComplete="username" autoCapitalize="characters" spellCheck={false}
                value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="password">Password</label>
            <div className="input-icon">
              <Lock size={16} />
              <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} onKeyUp={onKey} onKeyDown={onKey} />
              <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />} {show ? 'Hide' : 'Show'}
              </button>
            </div>
            {capsLock && <span className="hint" style={{ color: '#8a5a00' }}>Caps Lock is on</span>}
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', height: 44, marginTop: 20 }}>
            <LogIn size={17} /> {busy ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>Authorized SBF Tower users only.</p>
        </form>
      </main>
    </div>
  );
}
