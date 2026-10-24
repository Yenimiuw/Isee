# Isee

Tracks how long students stay on a Google Meet tab during online classes.

| Folder | What | Deploys to |
|---|---|---|
| [`backend/`](./backend) | Node.js + Express API, Supabase database setup (`setup.sql`) | Vercel (root: `backend`) |
| [`frontend/`](./frontend) | React (Vite) website | Vercel (root: `frontend`) |

Set up the backend first (its README covers Supabase), then the frontend. Each folder deploys as its own Vercel project.
| [`extension/`](./extension) | Chrome extension (Manifest V3) that tracks tab switches in Meet | Load unpacked / Chrome Web Store |

Build the extension last: it needs the backend and website running.
