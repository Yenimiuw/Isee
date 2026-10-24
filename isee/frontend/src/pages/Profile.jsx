import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { LineChart } from '../components/Charts';
import { fmtDate } from '../format';

export default function Profile() {
  const { id, studentId } = useParams();
  const { user } = useAuth();
  const isEdu = user.role === 'educator';
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); api(`/api/courses/${id}/profile/${studentId}`).then(setD).catch((e) => setErr(e.message)); }, [id, studentId]);

  if (err) return <><Link to={`/courses/${id}`}>Back to course</Link><p className="err" role="alert">{err}</p></>;
  if (!d) return <p>Loading…</p>;
  const tracked = d.perMeeting.filter((m) => m.focusPct != null);

  return (
    <>
      <div>
        <Link to={`/courses/${id}`} className="muted">{d.course.code}: {d.course.name}</Link>
        <h1>{d.student.fullName}</h1>
      </div>
      <div className="grid">
        <div className="card"><span className="muted">Average focus</span><span className="stat">{d.avgFocus != null ? `${d.avgFocus}%` : 'No data'}</span></div>
        <div className="card"><span className="muted">Meetings attended</span><span className="stat">{d.attended} / {d.totalMeetings}</span></div>
        <div className="card"><span className="muted">Top site while away</span><span className="stat small">{d.topSite || 'None'}</span></div>
      </div>
      <div className="card">
        <h2>Focus across meetings</h2>
        {tracked.length === 0 ? <p>No tracked meetings yet.</p> : (
          <LineChart values={d.perMeeting.map((m) => m.focusPct)} label="Focus percentage for each meeting"
            xLabels={d.perMeeting.map((m) => fmtDate(m.scheduledAt))} />
        )}
      </div>
      <div className="card">
        <h2>Meetings</h2>
        {d.perMeeting.map((m) => (
          <Link key={m.meetingId} className="list-row" to={`/meetings/${m.meetingId}${isEdu ? `?student=${d.student.id}` : ''}`}>
            <span style={{ flex: 2 }}>{m.title}</span>
            <span className="strong" style={{ flex: 1 }}>{m.focusPct != null ? `${m.focusPct}%` : 'No data'}</span>
            <span className="muted">View timeline</span>
          </Link>
        ))}
      </div>
    </>
  );
}
