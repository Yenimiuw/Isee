class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
// Unwrap a Supabase response or throw its error.
async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
module.exports = { HttpError, wrap, isUuid, must };
