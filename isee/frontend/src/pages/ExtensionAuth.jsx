import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { callExtension } from '../extension';

// Opened from the extension popup. Hands the extension its own login, then says it is done.
export default function ExtensionAuth() {
  const { user, ready } = useAuth();
  const [state, setState] = useState('working');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    (async () => {
      try {
        const { session } = await api('/api/auth/extension-session', { method: 'POST' });
        await callExtension('login', { session, user });
        setState('ok');
      } catch (e) {
        setState('fail');
        setMsg(e.code === 'not-installed' ? 'We could not find the Isee extension. Install it, then open it from its toolbar icon and click Log in.' : e.message);
      }
    })();
  }, [user]);

  if (!ready) return <div className="page"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login?next=/extension-auth" replace />;

  return (
    <main className="center">
      <div className="card auth">
        <h1 className="strong">Isee extension</h1>
        {user.role !== 'student' && <p>Tracking is only for student accounts. Educators do not need the extension.</p>}
        {user.role === 'student' && state === 'working' && <p>Connecting the extension…</p>}
        {state === 'ok' && <p>Connected as {user.fullName}. You can close this tab. Join meetings from your course page to start tracking.</p>}
        {state === 'fail' && <p className="err" role="alert">{msg}</p>}
        <Link className="btn ghost" to="/">Go to my courses</Link>
      </div>
    </main>
  );
}
