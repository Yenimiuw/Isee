// Fills the database with demo data: 1 educator, 4 students, 1 course, 4 meetings and tracked sessions.
// Usage: npm run seed
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { admin: db } = require('../lib/supabase');
const { createUser } = require('../lib/users');
const { must } = require('../lib/http');

const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const SITES = ['docs.google.com', 'youtube.com', 'reddit.com', 'github.com', 'facebook.com', 'wikipedia.org', 'mail.google.com'];
const pick = () => SITES[rand(0, SITES.length - 1)];

function genEvents(sessionId, startMs, durMin, awayChance) {
  const ev = [];
  const add = (type, t, hostname = null) =>
    ev.push({ id: crypto.randomUUID(), session_id: sessionId, type, hostname, client_ts: new Date(t).toISOString() });
  const end = startMs + durMin * 60000;
  add('join', startMs);
  let t = startMs + rand(2, 6) * 60000;
  while (t < end - 60000) {
    if (Math.random() < awayChance) {
      const dur = Math.min(rand(20, 240) * 1000, end - t - 5000);
      add('away', t, pick());
      if (dur > 90000 && Math.random() < 0.5) add('site', t + dur / 2, pick());
      add('return', t + dur);
      t += dur;
    }
    t += rand(2, 8) * 60000;
  }
  add('leave', end);
  return ev;
}

(async () => {
  let educator;
  try {
    educator = await createUser({ email: 'prof@isee.test', password: 'password123', fullName: 'Prof. Dela Cruz', role: 'educator' });
  } catch (e) {
    console.log(`Skipping seed: ${e.message}. (Already seeded?)`);
    return;
  }
  const names = [['Ana Reyes', 'ana', 0.25], ['Ben Cruz', 'ben', 0.6], ['Carla Lim', 'carla', 0.1], ['Dan Tan', 'dan', 0.8]];
  const students = [];
  for (const [fullName, handle, away] of names) {
    const u = await createUser({ email: `${handle}@isee.test`, password: 'password123', fullName, role: 'student' });
    students.push({ id: u.id, away });
  }
  const course = await must(db.from('courses').insert({
    code: 'CS101', name: 'Intro to Programming', educator_id: educator.id, password_hash: await bcrypt.hash('isee123', 10),
  }).select('id').single());
  await must(db.from('enrollments').insert(students.map((s) => ({ course_id: course.id, student_id: s.id }))));

  const DAY = 86400000;
  const defs = [['Week 1: Intro', 'abc-defg-hij', -21], ['Week 2: Variables', 'klm-nopq-rst', -14],
    ['Week 3: Loops', 'uvw-xyza-bcd', -7], ['Week 4: Functions', 'efg-hijk-lmn', 7]];
  for (const [title, code, offset] of defs) {
    const startMs = Date.now() + offset * DAY;
    const meeting = await must(db.from('meetings').insert({
      course_id: course.id, title, meet_code: code, meet_url: `https://meet.google.com/${code}`,
      scheduled_at: new Date(startMs).toISOString(),
    }).select('id').single());
    if (offset > 0) continue; // upcoming meeting: nothing tracked yet
    for (const [i, s] of students.entries()) {
      if (i === 3 && title.startsWith('Week 3')) continue; // one absence
      const dur = rand(40, 55);
      const session = await must(db.from('sessions').insert({
        meeting_id: meeting.id, student_id: s.id, started_at: new Date(startMs).toISOString(),
        ended_at: new Date(startMs + dur * 60000).toISOString(), last_heartbeat_at: new Date(startMs + dur * 60000).toISOString(),
      }).select('id').single());
      await must(db.from('activity_events').insert(genEvents(session.id, startMs, dur, s.away)));
    }
  }
  console.log('Seeded. Educator: prof@isee.test / password123. Students: ana|ben|carla|dan @isee.test / password123. Course CS101, password isee123.');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
