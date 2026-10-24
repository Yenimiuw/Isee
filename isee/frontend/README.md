# Isee frontend

React (Vite) website for Isee: login, course dashboard, meeting activity and student profiles.
It only talks to the Isee backend API; it never touches Supabase directly.

The database tables live with the backend: run `../backend/setup.sql` in Supabase (see `../backend/README.md`).

## Setup

1. Start the backend first (`../backend`, `npm run dev`).
2. Open `.env` and set `VITE_API_URL` to the backend URL (`http://localhost:4000` for local work).
   `.env` is git-ignored; `.env.example` is the template.
3. Install and run:
   ```bash
   npm install
   npm run dev        # http://localhost:5173
   ```
4. Log in with seeded demo accounts (after `npm run seed` in the backend), password `password123`:
   `prof@isee.test` (educator) or `ana@isee.test` (student). Course `CS101` has password `isee123`.

## Deploy to Vercel

1. In Vercel choose **Add New > Project** and set **Root Directory** to `frontend`. Vercel detects Vite.
2. Add the environment variable `VITE_API_URL` = your deployed backend URL (e.g. `https://isee-api.vercel.app`).
3. Deploy, then add the frontend URL to `CORS_ORIGINS` in the backend project and redeploy the backend.

`VITE_` variables are baked in at build time, so redeploy after changing them.

## Screens

| Route | Who | Screen |
|---|---|---|
| `/login` | everyone | Pick student or educator, log in, or register (students) |
| `/` | both | Courses. **+** enrolls (student) or creates a course (educator) |
| `/courses/:id` | both | Meetings; educators register Meet links and see students |
| `/meetings/:id` | both | Focus split, sites visited, timeline, per-minute focus. Educators pick a student |
| `/courses/:id/profile/:studentId` | both | Focus across meetings |
| `/extension-auth` | student | Connects the browser extension (opened from its popup) |

Students start tracking with **Join meeting**, which shows a notice, tells the extension to arm, then opens Meet.

## Project layout

```
src/api.js          fetch wrapper with token refresh
src/auth.jsx        login state
src/components/     Charts.jsx (SVG charts)
src/pages/          one file per screen
src/styles.css      theme (palette from the mockup)
```
