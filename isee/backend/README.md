# Isee backend

Node.js + Express API for Isee. It handles login, courses, meetings and focus analytics, and it is the only
thing that talks to Supabase. Deployed to Vercel as a serverless function.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the tables.** Open *SQL Editor*, paste the contents of [`setup.sql`](./setup.sql) and run it.
3. **Add your keys.** Open `.env` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API). `.env` is git-ignored; `.env.example` is the template.
4. **Install and run:**
   ```bash
   npm install
   npm run dev        # http://localhost:4000, check /api/health
   ```
5. **Add data** (pick one):
   ```bash
   npm run seed       # demo educator, 4 students, course CS101 (password isee123) and tracked sessions
   npm run create-educator -- teacher@school.edu "a-password" "Full Name"
   ```
   Seeded logins use `password123`: `prof@isee.test` (educator) and `ana|ben|carla|dan@isee.test` (students).

Students register themselves on the website. Educator accounts are only created with `create-educator`.
Roles live in Supabase `app_metadata`, which users cannot edit.

## Deploy to Vercel

1. Push the repo, then in Vercel choose **Add New > Project** and set **Root Directory** to `backend`.
2. Add the environment variables from `.env.example`. Set `CORS_ORIGINS` to your deployed frontend URL
   (comma-separate several; add `chrome-extension://<id>` when the extension exists).
3. Deploy. All paths are rewritten to `api/index.js` (see `vercel.json`).

CLI alternative: `npm i -g vercel && vercel` from this folder.

## API

All routes need `Authorization: Bearer <access_token>` unless marked public.

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/health` | public | Status and whether env vars are set |
| `POST /api/auth/register` | public | Student sign-up |
| `POST /api/auth/login`, `/refresh` | public | Returns a Supabase session |
| `GET /api/auth/me` | any | Current user |
| `POST /api/auth/extension-session` | any | Separate session for the browser extension |
| `GET /api/courses` | any | Dashboard courses with average focus |
| `POST /api/courses` | educator | Create a course (code, name, password) |
| `POST /api/courses/enroll` | student | Join with course code and password |
| `GET /api/courses/:id` | member | Course, meetings (and students for educators) |
| `POST /api/courses/:id/meetings` | educator | Register a Meet link |
| `GET /api/courses/:id/profile/:studentId` | educator, or the student themself | Focus across meetings |
| `GET /api/meetings/:id/students` | educator | Students with focus for this meeting |
| `GET /api/meetings/:id/students/:studentId` | educator, or the student themself | Timeline, per-minute focus, sites |
| `POST /api/sessions/start`, `/:id/events` | student | Extension ingest (used in the next step) |

## How focus is calculated

Events are `join`, `away`, `site`, `return` and `leave`. Only **switching tabs** counts as away; clicking
another window does not. Focus % = time on the meeting tab divided by total session time. See `lib/analytics.js`.

## Notes for production

Add rate limiting on `/api/courses/enroll` and `/api/auth/login`, turn email confirmation on in Supabase
(registration currently auto-confirms for easy testing), and review what the extension is allowed to collect.
