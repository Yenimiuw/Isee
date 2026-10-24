// Turns a session's raw events into the numbers the dashboards show.
// Event types: join, away (switched to another tab, hostname = that site),
// site (moved between non-meeting tabs), return (back on the meeting tab), leave.
// Only tab switches count as away; clicking another window does not.
const MIN = 60000;

function analyze(session, events) {
  const ev = events
    .map((e) => ({ ...e, t: new Date(e.client_ts).getTime() }))
    .sort((a, b) => a.t - b.t);
  if (!ev.length) return null;

  const join = ev.find((e) => e.type === 'join');
  const start = (join || ev[0]).t;
  const leave = ev.find((e) => e.type === 'leave');
  const lastSeen = Math.max(new Date(session.last_heartbeat_at || 0).getTime(), ev[ev.length - 1].t);
  const end = leave ? leave.t : session.ended_at ? new Date(session.ended_at).getTime() : lastSeen;
  if (end <= start) return null;

  const segs = [];
  let state = 'in', cur = start, host = null;
  const close = (to) => {
    if (to > cur) segs.push({ state, start: cur, end: to, hostname: host });
    cur = to;
  };
  for (const e of ev) {
    if (e.t < start) continue;
    if (e.t >= end) break;
    if (e.type === 'away' && state === 'in') { close(e.t); state = 'away'; host = e.hostname || null; }
    else if (e.type === 'site' && state === 'away') { close(e.t); host = e.hostname || null; }
    else if (e.type === 'return' && state === 'away') { close(e.t); state = 'in'; host = null; }
  }
  close(end);

  const total = end - start;
  const awayMs = segs.filter((s) => s.state === 'away').reduce((a, s) => a + (s.end - s.start), 0);

  const bySite = {};
  for (const s of segs) if (s.state === 'away' && s.hostname) bySite[s.hostname] = (bySite[s.hostname] || 0) + (s.end - s.start);
  const sites = Object.entries(bySite)
    .map(([hostname, ms]) => ({ hostname, seconds: Math.round(ms / 1000) }))
    .sort((a, b) => b.seconds - a.seconds);

  const perMinute = [];
  for (let b = start; b < end; b += MIN) {
    const be = Math.min(b + MIN, end);
    const inMs = segs.filter((s) => s.state === 'in')
      .reduce((a, s) => a + Math.max(0, Math.min(s.end, be) - Math.max(s.start, b)), 0);
    perMinute.push(Math.round((inMs / (be - b)) * 100));
  }

  return {
    startedAt: new Date(start).toISOString(),
    durationSeconds: Math.round(total / 1000),
    awaySeconds: Math.round(awayMs / 1000),
    focusPct: Math.round(((total - awayMs) / total) * 100),
    sites,
    perMinute,
    timeline: segs.map((s) => ({
      state: s.state,
      start: Math.round((s.start - start) / 1000),
      end: Math.round((s.end - start) / 1000),
    })),
  };
}

const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

function mergeSites(list) {
  const m = {};
  for (const sites of list) for (const s of sites) m[s.hostname] = (m[s.hostname] || 0) + s.seconds;
  return Object.entries(m).map(([hostname, seconds]) => ({ hostname, seconds })).sort((a, b) => b.seconds - a.seconds);
}
module.exports = { analyze, avg, mergeSites };
