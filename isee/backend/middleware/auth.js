const { admin } = require('../lib/supabase');
const { HttpError, wrap } = require('../lib/http');

// Verifies the Supabase access token; the role comes from app_metadata (server-controlled).
const auth = wrap(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please log in');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please log in again');
  req.user = { id: data.user.id, email: data.user.email, role: data.user.app_metadata?.role };
  next();
});

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : next(new HttpError(403, `Only ${role}s can do this`));

module.exports = { auth, requireRole };
