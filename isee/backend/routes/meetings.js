const router = require('express').Router();
const { admin: db } = require('../lib/supabase');
const { HttpError, wrap, must, isUuid } = require('../lib/http');
const { auth, requireRole } = require('../middleware/auth');
const { meetingFor } = require('../lib/access');
const { loadAnalyses } = require('../lib/stats');

const meetingOut = (m) => ({ id: m.id, title: m.title, meetUrl: m.meet_url, scheduledAt: m.scheduled_at });

// Educator: every enrolled student with their focus for this meeting.
router.get('/:id/students', auth, requireRole('educator'), wrap(async (req, res) => {
  const { meeting, course } = await meetingFor(req.params.id, req.user);
  const rows = await must(db.from('enrollments').select('profiles(id, full_name)').eq('course_id', course.id));
  const analyses = await loadAnalyses([meeting.id]);
  const students = rows.map((r) => {
    const a = analyses.find((x) => x.session.student_id === r.profiles.id);
    return { id: r.profiles.id, fullName: r.profiles.full_name, focusPct: a ? a.analysis.focusPct : null };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));
  res.json({ meeting: meetingOut(meeting), course: { id: course.id, code: course.code, name: course.name }, students });
}));

// Educator: any student. Student: only themselves.
router.get('/:id/students/:studentId', auth, wrap(async (req, res) => {
  const u = req.user;
  const { meeting, course } = await meetingFor(req.params.id, u);
  const sid = req.params.studentId;
  if (!isUuid(sid)) throw new HttpError(404, 'Student not found');
  if (u.role === 'student' && sid !== u.id) throw new HttpError(403, 'You can only view your own activity');
  const { data: enr } = await db.from('enrollments').select('profiles(id, full_name)')
    .eq('course_id', course.id).eq('student_id', sid).maybeSingle();
  if (!enr) throw new HttpError(404, 'Student not found in this course');
  const [found] = await loadAnalyses([meeting.id], sid);
  res.json({
    meeting: meetingOut(meeting),
    course: { id: course.id, code: course.code, name: course.name },
    student: { id: enr.profiles.id, fullName: enr.profiles.full_name },
    analysis: found ? found.analysis : null,
  });
}));

module.exports = router;
