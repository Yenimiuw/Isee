import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const WEB = __WEB_URL__;
const open = (path) => chrome.tabs.create({ url: WEB + path });

function useStore() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => chrome.storage.local.get(['user', 'armed', 'tracking', 'queue', 'syncError']).then(setS);
    load();
    chrome.storage.onChanged.addListener(load);
    return () => chrome.storage.onChanged.removeListener(load);
  }, []);
  return s;
}

function App() {
  const s = useStore();
  const [err, setErr] = useState('');
  if (!s) return null;
  const { user, armed, tracking, queue = [], syncError } = s;

  async function logout() {
    setErr('');
    const r = await chrome.runtime.sendMessage({ type: 'logout' });
    if (!r?.ok) setErr(r?.error || 'Could not log out');
  }

  let body;
  if (!user) {
    body = (<>
      <p>Log in to track the class meetings you join from the Isee website.</p>
      <button className="btn" onClick={() => open('/extension-auth')}>Log in</button>
    </>);
  } else if (user.role !== 'student') {
    body = <p>Tracking is only for student accounts. Educators do not need the extension.</p>;
  } else if (tracking) {
    body = (<>
      <div className="status on"><span className="dot" />Tracking</div>
      <h2>{tracking.title}</h2>
      <p className="muted">
        {!tracking.joined ? 'Waiting for you to join the call.' : tracking.away ? `Away from the meeting tab${tracking.host ? ` (${tracking.host})` : ''}.` : 'You are on the meeting tab.'}
      </p>
      <p className="muted">Tracking stops when you leave the meeting.</p>
    </>);
  } else if (armed) {
    body = (<>
      <div className="status"><span className="dot" />{Date.now() - armed.at > 15 * 60 * 1000 ? 'Expired' : 'Ready'}</div>
      <h2>{armed.title}</h2>
      {Date.now() - armed.at > 15 * 60 * 1000
        ? <p className="muted">This was not opened in time. Click Join meeting on the website again.</p>
        : <p className="muted">Waiting for a Meet tab with the code <strong>{armed.meetCode}</strong>. Tracking starts when it opens (you can refresh the tab).</p>}
    </>);
  } else {
    body = (<>
      <div className="status"><span className="dot" />Idle</div>
      <p>Open a meeting from your course page on the Isee website to start tracking.</p>
      <button className="btn" onClick={() => open('/')}>Open Isee</button>
    </>);
  }

  return (
    <main>
      <header><strong className="brand">Isee</strong>{user && <span className="muted">{user.fullName}</span>}</header>
      {body}
      {syncError && <p className="err" role="alert">Could not reach the server ({queue.length} events waiting). Retrying.</p>}
      {err && <p className="err" role="alert">{err}</p>}
      {user && <button className="btn ghost" onClick={logout} disabled={Boolean(tracking)}>Log out</button>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
