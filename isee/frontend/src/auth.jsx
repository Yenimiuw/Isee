import { createContext, useContext, useEffect, useState } from 'react';
import { api, getSession, setSession } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('isee:logout', out);
    if (getSession()) {
      api('/api/auth/me').then((d) => setUser(d.user)).catch(() => setSession(null)).finally(() => setReady(true));
    } else setReady(true);
    return () => window.removeEventListener('isee:logout', out);
  }, []);

  const login = async (email, password, role) => {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (role && d.user.role !== role) throw new Error(`This is not ${role === 'educator' ? 'an educator' : 'a student'} account.`);
    setSession(d.session);
    setUser(d.user);
  };
  const register = async (fullName, email, password) => {
    await api('/api/auth/register', { method: 'POST', body: { fullName, email, password } });
    await login(email, password, 'student');
  };
  const logout = () => { setSession(null); setUser(null); };

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
