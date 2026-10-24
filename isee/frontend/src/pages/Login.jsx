import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login, register } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const [role, setRole] = useState('student');
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ fullName: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const registering = mode === 'register' && role === 'student';

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (registering) await register(f.fullName, f.email, f.password);
      else await login(f.email, f.password, role);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  if (user) return <Navigate to={dest} replace />;

  return (
    <main className="center">
      <form className="card auth" onSubmit={submit}>
        <h1 className="strong">{registering ? 'Create your account' : 'Log in to Isee'}</h1>
        <p className="muted">I am a</p>
        <div className="row">
          <button type="button" className={role === 'student' ? 'btn seg' : 'btn ghost seg'} aria-pressed={role === 'student'} onClick={() => setRole('student')}>Student</button>
          <button type="button" className={role === 'educator' ? 'btn seg' : 'btn ghost seg'} aria-pressed={role === 'educator'} onClick={() => { setRole('educator'); setMode('login'); }}>Educator</button>
        </div>
        {registering && (<>
          <label className="muted" htmlFor="n">Full name</label>
          <input id="n" className="input" value={f.fullName} onChange={set('fullName')} autoComplete="name" required />
        </>)}
        <label className="muted" htmlFor="e">Email</label>
        <input id="e" className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
        <label className="muted" htmlFor="p">Password</label>
        <input id="p" className="input" type="password" value={f.password} onChange={set('password')} autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Register' : 'Log in'}</button>
        {role === 'student' ? (
          <p className="muted">
            {registering ? 'Already registered? ' : 'New student? '}
            <button type="button" className="link" onClick={() => { setMode(registering ? 'login' : 'register'); setErr(''); }}>
              {registering ? 'Log in' : 'Register'}
            </button>
          </p>
        ) : (
          <p className="muted">Educator accounts are issued by your organization.</p>
        )}
      </form>
    </main>
  );
}
