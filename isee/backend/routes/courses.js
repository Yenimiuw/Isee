const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { admin: db } = require('../lib/supabase');
const { HttpError, wrap, must, isUuid } = require('../lib/http');
const { auth, requireRole } = require('../middleware/auth');
const { courseFor } = require('../lib/access');
const { loadAnalyses } = require('../lib/stats');
const { avg, mergeSites } = require('../lib/analytics');

// Courses for the dashboard: owned (educator) or enrolled (student), with average focus.
router.get('/', auth, wrap(async (req, res) => {
  const u = req.user;
  let courses;
  if (u.role === 'educator') {
    courses = await must(db.from('courses').select('id, code, name, created_at').eq('educator_id', u.id).order('created_at'));
  } else {
    const rows = await must(db.from('enrollments').select('courses(id, code, name, created_at)').eq('student_id', u.id));
    courses = rows.map((r) => r.courses).filter(Boolean);
  }
  const ids = courses.map((c) => c.id);
  const meetings = ids.length ? await must(db.from('meetings').select('id, course_id, title, scheduled_at').in('course_id', ids)) : [];
  const analyses = await loadAnalyses(meetings.map((m) => m.id), u.role === 'student' ? u.id : undefined);
  const now = Date.now();
  res.json({
    courses: courses.map((c) => {
      const ms = meetings.filter((m) => m.course_id === c.id);
      const set = new Set(ms.map((m) => m.id));
      const next = ms.filter((m) => new Date(m.scheduled_at).getTime() >= now)
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
      return {
        ...c,
        meetingCount: ms.length,
        avgFocus: avg(analyses.filter((a) => set.has(a.session.meeting_id)).map((a) => a.analysis.focusPct)),
        nextMeeting: next ? { title: next.title, scheduledAt: next.scheduled_at } : null,
      };
    }),
  });
}));

router.post('/', auth, requireRole('educator'), wrap(async (req, res) => {
  const { code, name, password } = req.body || {};
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(c)) throw new HttpError(400, 'Course code needs 3 to 20 letters, numbers or dashes');
  if (!name || !password || password.length < 4) throw new HttpError(400, 'Enter a course name and a password of at least 4 characters');
  const { data, error } = await db.from('courses')
    .insert({ code: c, name: String(name).trim(), educator_id: req.user.id, password_hash: await bcrypt.hash(password, 10) })
    .select('id, code, name').single();
  if (error?.code === '23505') throw new HttpError(409, 'That course code is already taken');
  if (error) throw error;
  res.status(201).json({ course: data });
}));

router.post('/enroll', auth, requireRole('student'), wrap(async (req, res) => {
  const { code, password } = req.body || {};
  const { data: course } = await db.from('courses').select('id, code, name, password_hash')
    .eq('code', String(code || '').trim().toUpperCase()).maybeSingle();
  if (!course) throw new HttpError(404, 'No course has that code');
  if (!(await bcrypt.compare(String(password || ''), course.password_hash))) throw new HttpError(401, 'Wrong course password');
  const { error } = await db.from('enrollments').insert({ course_id: course.id, student_id: req.user.id });
  if (error?.code === '23505') throw new HttpError(409, 'You are already enrolled in this course');
  if (error) throw error;
  res.status(201).json({ course: { id: course.id, code: course.code, name: course.name } });
}));

router.get('/:id', auth, wrap(async (req, res) => {
  const u = req.user;
  const course = await courseFor(req.params.id, u);
  const isEdu = u.role === 'educator';
  const meetings = await must(db.from('meetings').select('*').eq('course_id', course.id).order('scheduled_at', { ascending: false }));
  const analyses = await loadAnalyses(meetings.map((m) => m.id), isEdu ? undefined : u.id);
  let students = [];
  if (isEdu) {
    const rows = await must(db.from('enrollments').select('profiles(id, full_name)').eq('course_id', course.id));
    students = rows.map((r) => ({ id: r.profiles.id, fullName: r.profiles.full_name }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
  res.json({
    course: { id: course.id, code: course.code, name: course.name },
    students,
    meetings: meetings.map((m) => {
      const mine = analyses.filter((a) => a.session.meeting_id === m.id);
      return {
        id: m.id, title: m.title, meetUrl: m.meet_url, scheduledAt: m.scheduled_at,
        attended: mine.length, enrolled: students.length,
        focusPct: avg(mine.map((a) => a.analysis.focusPct)),
      };
    }),
  });
}));

router.post('/:id/meetings', auth, requireRole('educator'), wrap(async (req, res) => {
  const course = await courseFor(req.params.id, req.user);
  const { meetLink, title, scheduledAt } = req.body || {};
  const m = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i.exec(String(meetLink || ''));
  if (!m) throw new HttpError(400, 'Paste a Google Meet link like https://meet.google.com/abc-defg-hij');
  if (!title || !String(title).trim()) throw new HttpError(400, 'Enter a meeting title');
  const code = m[1].toLowerCase();
  const when = scheduledAt ? new Date(scheduledAt) : new Date();
  if (Number.isNaN(when.getTime())) throw new HttpError(400, 'That date is not valid');
  const data = await must(db.from('meetings').insert({
    course_id: course.id, title: String(title).trim(), meet_code: code,
    meet_url: `https://meet.google.com/${code}`, scheduled_at: when.toISOString(),
  }).select('id, title, meet_url, scheduled_at').single());
  res.status(201).json({ meeting: data });
}));

// Overall analytics for one student in a course. Students can only open their own.
router.get('/:id/profile/:studentId', auth, wrap(async (req, res) => {
  const u = req.user;
  const course = await courseFor(req.params.id, u);
  const sid = req.params.studentId;
  if (!isUuid(sid)) throw new HttpError(404, 'Student not found');
  if (u.role === 'student' && sid !== u.id) throw new HttpError(403, 'You can only view your own profile');
  const { data: enr } = await db.from('enrollments').select('profiles(id, full_name)')
    .eq('course_id', course.id).eq('student_id', sid).maybeSingle();
  if (!enr) throw new HttpError(404, 'Student not found in this course');
  const meetings = await must(db.from('meetings').select('id, title, scheduled_at').eq('course_id', course.id).order('scheduled_at'));
  const analyses = await loadAnalyses(meetings.map((m) => m.id), sid);
  const sites = mergeSites(analyses.map((a) => a.analysis.sites));
  res.json({
    course: { id: course.id, code: course.code, name: course.name },
    student: { id: enr.profiles.id, fullName: enr.profiles.full_name },
    avgFocus: avg(analyses.map((a) => a.analysis.focusPct)),
    attended: analyses.length,
    totalMeetings: meetings.length,
    topSite: sites[0]?.hostname || null,
    perMeeting: meetings.map((m) => ({
      meetingId: m.id, title: m.title, scheduledAt: m.scheduled_at,
      focusPct: analyses.find((a) => a.session.meeting_id === m.id)?.analysis.focusPct ?? null,
    })),
  });
}));

module.exports = router;
