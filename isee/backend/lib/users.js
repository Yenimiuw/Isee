const { admin } = require('./supabase');
const { HttpError } = require('./http');

// Creates an auth user (password handled by Supabase Auth) plus a profile row.
// The role is stored in app_metadata, which users cannot edit themselves.
async function createUser({ email, password, fullName, role }) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role }, user_metadata: { full_name: fullName },
  });
  if (error) throw new HttpError(400, error.message);
  const { error: pErr } = await admin.from('profiles')
    .insert({ id: data.user.id, full_name: fullName, role });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw pErr;
  }
  return data.user;
}
module.exports = { createUser };
