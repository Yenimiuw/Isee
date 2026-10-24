import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { fmtDate } from '../format';
import JoinButton from '../components/JoinButton';

export default function Course() {
  const { id } = useParams();
  const { user } = useAuth();
  const isEdu = user.role === 'educator';
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ meetLink: '', title: '', scheduledAt: '' });
  const [formErr, setFormErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = () => api(`/api/courses/${id}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  async function register(e) {
    e.preventDefault(); setFormErr('');
    try {
      await api(`/api/courses/${id}/meetings`, { method: 'POST', body: { ...f, scheduledAt: f.scheduledAt || undefined } });
      setF({ meetLink: '', title: '', scheduledAt: '' });
      load();
    } catch (x) { setFormErr(x.message); }
  }

  if (err) return <><Link to="/">Back to courses</Link><p className="err" role="alert">{err}</p></>;
  if (!data) return <p>Loading…</p>;

  return (
    <>
      <div className="row between wrap">
        <div><Link to="/" className="muted">All courses</Link><p className="muted">{data.course.code}</p><h1>{data.course.name}</h1></div>
        {!isEdu && <Link className="btn ghost" to={`/courses/${id}/profile/${user.id}`}>My profile</Link>}
      </div>

      {isEdu && (
        <form className="card" onSubmit={register}>
          <h2>Register a Google Meet link</h2>
          <div className="row wrap">
            <input className="input" aria-label="Meet link" placeholder="https://meet.google.com/abc-defg-hij" value={f.meetLink} onChange={set('meetLink')} required />
            <input className="input" aria-label="Meeting title" placeholder="Meeting title" value={f.title} onChange={set('title')} required />
            <input className="input" type="datetime-local" aria-label="Date and time" value={f.scheduledAt} onChange={set('scheduledAt')} />
            <button className="btn">Register</button>
          </div>
          {formErr && <p className="err" role="alert">{formErr}</p>}
        </form>
      )}

      <div className="card">
        <h2>Meetings</h2>
        {data.meetings.length === 0 && <p>{isEdu ? 'No meetings yet. Register a Meet link above.' : 'Your educator has not registered a meeting yet.'}</p>}
        {data.meetings.map((m) => (
          <div key={m.id} className="row">
            <Link to={`/meetings/${m.id}`} className="list-row">
              <span style={{ flex: 2 }}>{m.title}</span>
              <span style={{ flex: 1 }}>{fmtDate(m.scheduledAt)}</span>
              <span style={{ flex: 1 }}>{isEdu ? `${m.attended} / ${m.enrolled} attended` : m.attended ? 'Attended' : 'No data'}</span>
              <span className="strong" style={{ flex: 1 }}>{m.focusPct != null ? `${m.focusPct}%` : ''}</span>
            </Link>
            {isEdu
              ? <a className="btn ghost" href={m.meetUrl} target="_blank" rel="noreferrer">Open Meet</a>
              : <JoinButton meeting={m} />}
          </div>
        ))}
        <p className="muted">Students must join with the Join meeting button so the Isee extension can start tracking.</p>
      </div>

      {isEdu && (
        <div className="card">
          <h2>Students</h2>
          {data.students.length === 0 && <p>No one has enrolled yet. Share the course code and password.</p>}
          {data.students.map((s) => (
            <Link key={s.id} to={`/courses/${id}/profile/${s.id}`} className="list-row"><span>{s.fullName}</span><span className="muted">View profile</span></Link>
          ))}
        </div>
      )}
    </>
  );
}
