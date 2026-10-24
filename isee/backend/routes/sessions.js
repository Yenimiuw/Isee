// Ingest endpoints for the browser extension (built in the next step).
const router = require('express').Router();
const { admin: db } = require('../lib/supabase');
const { HttpError, wrap, must, isUuid } = require('../lib/http');
const { auth, requireRole } = require('../middleware/auth');
const { meetingFor } = require('../lib/access');

const TYPES = new Set(['join', 'away', 'site', 'return', 'leave']);

// Arms a tracking session for the signed-in student (one per student per meeting).
router.post('/start', auth, requireRole('student'), wrap(async (req, res) => {
  const { meeting } = await meetingFor(req.body?.meetingId, req.user);
  let session = (await db.from('sessions').select('id').eq('meeting_id', meeting.id).eq('student_id', req.user.id).maybeSingle()).data;
  if (!session) {
    session = await must(db.from('sessions').insert({
      meeting_id: meeting.id, student_id: req.user.id, last_heartbeat_at: new Date().toISOString(),
    }).select('id').single());
  }
  res.status(201).json({ sessionId: session.id, meetCode: meeting.meet_code, title: meeting.title });
}));

// Accepts a batch of events. Event ids are client-generated, so retries never duplicate.
router.post('/:id/events', auth, requireRole('student'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(404, 'Session not found');
  const { data: session } = await db.from('sessions').select('id, student_id').eq('id', req.params.id).maybeSingle();
  if (!session || session.student_id !== req.user.id) throw new HttpError(404, 'Session not found');
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
  const rows = events.filter((e) => isUuid(e.id) && TYPES.has(e.type) && !Number.isNaN(new Date(e.clientTs).getTime()))
    .map((e) => ({
      id: e.id, session_id: session.id, type: e.type,
      hostname: e.hostname ? String(e.hostname).slice(0, 253) : null,
      client_ts: new Date(e.clientTs).toISOString(),
    }));
  if (rows.length) await must(db.from('activity_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
  const leave = rows.filter((r) => r.type === 'leave').map((r) => r.client_ts).sort().pop();
  await must(db.from('sessions').update({
    last_heartbeat_at: new Date().toISOString(), ...(leave ? { ended_at: leave } : {}),
  }).eq('id', session.id));
  res.json({ accepted: rows.length });
}));

module.exports = router;
