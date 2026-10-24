require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || 'http://localhost:54321';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// Service-role client: bypasses RLS. Only ever used on the server.
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing', opts);
// Fresh anon client per use, so one user's session never leaks into another request.
const anon = () => createClient(url, process.env.SUPABASE_ANON_KEY || 'missing', opts);

module.exports = { admin, anon };
