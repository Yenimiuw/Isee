const { admin: db } = require('./supabase');
const { HttpError, isUuid } = require('./http');

// Returns the course if the user may see it (owner educator or enrolled student).
async function courseFor(courseId, user) {
  if (!isUuid(courseId)) throw new HttpError(404, 'Course not found');
  const { data: course } = await db.from('courses')
    .select('id, code, name, educator_id, created_at').eq('id', courseId).maybeSingle();
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role === 'educator') {
    if (course.educator_id !== user.id) throw new HttpError(403, 'This is not your course');
  } else {
    const { data: enr } = await db.from('enrollments').select('student_id')
      .eq('course_id', course.id).eq('student_id', user.id).maybeSingle();
    if (!enr) throw new HttpError(403, 'You are not enrolled in this course');
  }
  return course;
}

async function meetingFor(meetingId, user) {
  if (!isUuid(meetingId)) throw new HttpError(404, 'Meeting not found');
  const { data: meeting } = await db.from('meetings').select('*').eq('id', meetingId).maybeSingle();
  if (!meeting) throw new HttpError(404, 'Meeting not found');
  const course = await courseFor(meeting.course_id, user);
  return { meeting, course };
}
module.exports = { courseFor, meetingFor };
