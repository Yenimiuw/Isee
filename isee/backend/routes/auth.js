const router = require('express').Router();
const { admin, anon } = require('../lib/supabase');
const { HttpError, wrap } = require('../lib/http');
const { createUser } = require('../lib/users');
const { auth } = require('../middleware/auth');

const publicUser = (id, email, profile) => ({
  id, email, fullName: profile?.full_name || email, role: profile?.role,
});
const sessionOut = (s) => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });

// Students register themselves. Educator accounts are issued by the organization (npm run create-educator).
router.post('/register', wrap(async (req, res) => {
  const { email, password, fullName } = req.body || {};
  if (!email || !fullName || !password || password.length < 6)
    throw new HttpError(400, 'Enter your name, an email and a password of at least 6 characters');
  await createUser({ email: String(email).trim().toLowerCase(), password, fullName: String(fullName).trim(), role: 'student' });
  res.status(201).json({ ok: true });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Enter your email and password');
  const { data, error } = await anon().auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
  if (error || !data.session) throw new HttpError(401, 'Wrong email or password');
  const { data: profile } = await admin.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle();
  res.json({ session: sessionOut(data.session), user: publicUser(data.user.id, data.user.email, profile) });
}));

router.post('/refresh', wrap(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) throw new HttpError(400, 'Missing refresh token');
  const { data, error } = await anon().auth.refreshSession({ refresh_token });
  if (error || !data.session) throw new HttpError(401, 'Your session has expired. Please log in again');
  res.json({ session: sessionOut(data.session) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const { data: profile } = await admin.from('profiles').select('full_name, role').eq('id', req.user.id).maybeSingle();
  res.json({ user: publicUser(req.user.id, req.user.email, profile) });
}));

// Gives the browser extension its own session (separate refresh token) for the signed-in user.
router.post('/extension-session', auth, wrap(async (req, res) => {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: req.user.email });
  const hash = link?.properties?.hashed_token;
  if (error || !hash) throw new HttpError(500, 'Could not connect the extension');
  let session;
  for (const type of ['email', 'magiclink']) {
    const { data, error: vErr } = await anon().auth.verifyOtp({ token_hash: hash, type });
    if (!vErr && data.session) { session = data.session; break; }
  }
  if (!session) throw new HttpError(500, 'Could not connect the extension');
  res.json({ session: sessionOut(session) });
}));

module.exports = router;
