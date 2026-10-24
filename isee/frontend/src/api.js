const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const KEY = 'isee.session';

export const getSession = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
export const setSession = (s) => (s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY));

async function send(path, method, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Calls the backend; on a 401 it tries one token refresh, then logs out.
export async function api(path, { method = 'GET', body } = {}) {
  let s = getSession();
  let { res, data } = await send(path, method, body, s?.access_token);
  if (res.status === 401 && s?.refresh_token && !path.startsWith('/api/auth/login')) {
    const r = await send('/api/auth/refresh', 'POST', { refresh_token: s.refresh_token });
    if (r.res.ok) {
      s = { ...s, ...r.data.session };
      setSession(s);
      ({ res, data } = await send(path, method, body, s.access_token));
    } else {
      setSession(null);
      window.dispatchEvent(new Event('isee:logout'));
    }
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
