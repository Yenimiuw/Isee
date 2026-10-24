import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Course from './pages/Course';
import Meeting from './pages/Meeting';
import Profile from './pages/Profile';
import ExtensionAuth from './pages/ExtensionAuth';

function Shell() {
  const { user, ready, logout } = useAuth();
  if (!ready) return <div className="page"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="page">
      <header className="top">
        <div className="row">
          <Link to="/" className="brand">Isee</Link>
          <span className="muted">{user.role === 'educator' ? 'Educator' : 'Student'}</span>
        </div>
        <div className="who">
          <span>{user.fullName}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/extension-auth" element={<ExtensionAuth />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses/:id" element={<Course />} />
        <Route path="/courses/:id/profile/:studentId" element={<Profile />} />
        <Route path="/meetings/:id" element={<Meeting />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
