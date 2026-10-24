const { admin: db } = require('./supabase');
const { must } = require('./http');
const { analyze } = require('./analytics');

async function allEvents(sessionIds) {
  const out = [];
  for (let from = 0; ; from += 1000) { // Supabase returns at most 1000 rows per request
    const rows = await must(db.from('activity_events')
      .select('session_id, type, hostname, client_ts')
      .in('session_id', sessionIds).order('client_ts').range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// Sessions + analysis for some meetings, optionally for a single student.
async function loadAnalyses(meetingIds, studentId) {
  if (!meetingIds.length) return [];
  let q = db.from('sessions').select('*').in('meeting_id', meetingIds);
  if (studentId) q = q.eq('student_id', studentId);
  const sessions = await must(q);
  if (!sessions.length) return [];
  const events = await allEvents(sessions.map((s) => s.id));
  const by = {};
  for (const e of events) (by[e.session_id] ||= []).push(e);
  return sessions
    .map((session) => ({ session, analysis: analyze(session, by[session.id] || []) }))
    .filter((x) => x.analysis);
}
module.exports = { loadAnalyses };
