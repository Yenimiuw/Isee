import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime } from '../format';

function AddPanel({ isEdu, onDone }) {
  const [f, setF] = useState({ code: '', name: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api(isEdu ? '/api/courses' : '/api/courses/enroll', { method: 'POST', body: f });
      onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <form className="card panel" onSubmit={submit}>
      <h2>{isEdu ? 'Create a course' : 'Enroll in a course'}</h2>
      <input className="input" aria-label="Course code" placeholder="Course code" value={f.code} onChange={set('code')} required />
      {isEdu && <input className="input" aria-label="Course name" placeholder="Course name" value={f.name} onChange={set('name')} required />}
      <input className="input" type="password" aria-label="Course password" placeholder="Course password" value={f.password} onChange={set('password')} required />
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{isEdu ? 'Create course' : 'Enroll'}</button>
    </form>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isEdu = user.role === 'educator';
  const [courses, setCourses] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const load = () => api('/api/courses').then((d) => setCourses(d.courses)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <h1>My courses</h1>
      {err && <p className="err" role="alert">{err}</p>}
      {courses && courses.length === 0 && (
        <div className="card"><p>{isEdu ? 'You have no courses yet. Use the + button to create one.' : 'You are not enrolled in any course yet. Use the + button and enter a course code and password.'}</p></div>
      )}
      <div className="grid">
        {(courses || []).map((c) => (
          <Link key={c.id} to={`/courses/${c.id}`} className="card tile">
            <span className="muted">{c.code}</span>
            <h2>{c.name}</h2>
            <p className="muted">{c.nextMeeting ? `Next meeting: ${fmtDateTime(c.nextMeeting.scheduledAt)}` : 'No upcoming meetings'}</p>
            {c.avgFocus != null ? (<>
              <div className="bar"><span style={{ width: `${c.avgFocus}%` }} /></div>
              <p className="muted">{isEdu ? 'Class focus' : 'Your focus'} {c.avgFocus}%</p>
            </>) : <p className="muted">No tracked meetings yet</p>}
          </Link>
        ))}
      </div>
      {open && <AddPanel isEdu={isEdu} onDone={() => { setOpen(false); load(); }} />}
      <button className="btn fab" aria-label={isEdu ? 'Create a course' : 'Enroll in a course'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '×' : '+'}</button>
    </>
  );
}
