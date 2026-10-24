import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Donut, LineChart, StepTimeline } from '../components/Charts';
import { fmtDateTime, fmtDur } from '../format';
import JoinButton from '../components/JoinButton';

function Detail({ d }) {
  const [all, setAll] = useState(false);
  const a = d.analysis;
  if (!a) return <div className="card"><h2>{d.student.fullName}</h2><p>No tracked activity for this meeting.</p></div>;
  const sites = all ? a.sites : a.sites.slice(0, 3);
  return (
    <>
      <div className="row stretch wrap">
        <div className="card row grow">
          <Donut pct={a.focusPct} />
          <div>
            <h2>{d.student.fullName}</h2>
            <p className="muted">On the meeting tab {a.focusPct}% / On other tabs {100 - a.focusPct}%</p>
            <p className="muted">{fmtDur(a.awaySeconds)} away of {fmtDur(a.durationSeconds)}</p>
          </div>
        </div>
        <div className="card grow">
          <h2>Sites visited while away</h2>
          {a.sites.length === 0 && <p className="muted">No other sites recorded.</p>}
          {sites.map((s) => <p key={s.hostname} className="muted">{s.hostname}: {fmtDur(s.seconds)}</p>)}
          {a.sites.length > 3 && (
            <button className="link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `+${a.sites.length - 3} more`}</button>
          )}
        </div>
      </div>
      <div className="card">
        <h2>Timeline: on the meeting (1) or on another tab (0)</h2>
        <StepTimeline timeline={a.timeline} duration={a.durationSeconds} />
        <p className="muted">Only switching tabs counts as away. Clicking another window does not.</p>
      </div>
      <div className="card">
        <h2>Focus per minute (0 to 100)</h2>
        <LineChart values={a.perMinute} label="Focus per minute of the meeting" xLabels={['0 min', `${a.perMinute.length} min`]} />
      </div>
    </>
  );
}

export default function Meeting() {
  const { id } = useParams();
  const { user } = useAuth();
  const isEdu = user.role === 'educator';
  const [sp] = useSearchParams();
  const [roster, setRoster] = useState(null);
  const [sid, setSid] = useState(isEdu ? sp.get('student') : user.id);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isEdu) return;
    api(`/api/meetings/${id}/students`).then((d) => {
      setRoster(d);
      setSid((cur) => cur || d.students.find((s) => s.focusPct != null)?.id || d.students[0]?.id || null);
    }).catch((e) => setErr(e.message));
  }, [id, isEdu]);

  useEffect(() => {
    if (!sid) return;
    setDetail(null);
    api(`/api/meetings/${id}/students/${sid}`).then(setDetail).catch((e) => setErr(e.message));
  }, [id, sid]);

  const course = detail?.course || roster?.course;
  const meeting = detail?.meeting || roster?.meeting;
  return (
    <>
      <div className="row between wrap">
        <div>
          {course && <Link to={`/courses/${course.id}`} className="muted">{course.code}: {course.name}</Link>}
          <h1>{meeting ? meeting.title : 'Meeting'}</h1>
          {meeting && <p className="muted">{fmtDateTime(meeting.scheduledAt)}</p>}
        </div>
        {!isEdu && meeting && <JoinButton meeting={meeting} />}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="split">
        {isEdu && (
          <div className="card side">
            <h2>Students</h2>
            {!roster && <p className="muted">Loading…</p>}
            {roster?.students.length === 0 && <p className="muted">No students enrolled.</p>}
            {roster?.students.map((s) => (
              <button key={s.id} className={`list-row pick${s.id === sid ? ' sel' : ''}`} aria-pressed={s.id === sid} onClick={() => setSid(s.id)}>
                <span>{s.fullName}</span>
                <span className={s.focusPct != null ? 'strong' : 'muted'}>{s.focusPct != null ? `${s.focusPct}%` : 'No data'}</span>
              </button>
            ))}
          </div>
        )}
        <div className="main">
          {!detail && sid && !err && <p>Loading…</p>}
          {detail && <Detail key={detail.student.id} d={detail} />}
          {detail && (
            <Link className="btn ghost" style={{ alignSelf: 'flex-start' }} to={`/courses/${detail.course.id}/profile/${detail.student.id}`}>
              {isEdu ? `${detail.student.fullName.split(' ')[0]}'s profile` : 'My profile'}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
