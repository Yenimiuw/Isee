# Isee extension

Chrome extension (Manifest V3) that tracks **tab switches** while a student is in a Google Meet class
registered on the Isee website. It sends batches of events to the Isee backend, never straight to Supabase.

## Setup

1. Run the backend and website first (see `../backend` and `../frontend`).
2. Open `.env` and set `API_URL` (backend) and `WEB_ORIGINS` (website origins, comma-separated).
   `.env.example` is the template. The extension must be rebuilt after changing `.env`.
3. Build:
   ```bash
   npm install
   npm run build      # or: npm run dev   (rebuilds on save)
   ```
4. In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist/` folder.
   After each rebuild click the reload icon on the extension card.

## Try it

1. Click the Isee icon in the toolbar, then **Log in**. A website tab opens, you log in as a student, and the extension is connected.
2. On the website open a course, find a meeting and click **Join meeting**. Read the notice and continue.
3. Meet opens in a new tab. A green "Isee is tracking tab switches" badge appears. Switch tabs and come back.
4. Leave the call. Within about 30 seconds the educator's dashboard shows your session (log in as the educator, open the meeting).

If you open the same Meet link from anywhere else (calendar, chat, typed URL), nothing is tracked.

## How it works

| Piece | File | Job |
|---|---|---|
| Website bridge | `src/content-web.js` | Runs on the website only. Passes the login and the "arm" request to the extension |
| Meet script | `src/content-meet.js` | Shows the badge, detects joining and leaving the call, reports tab hidden/visible |
| Service worker | `src/background.js` | Holds state in `chrome.storage`, builds events, sends them every 30 seconds (also the heartbeat) |
| Popup | `src/popup.jsx` | Login, status and logout (React) |

- **Arming.** The website asks the extension to call `POST /api/sessions/start`. The extension remembers the meeting for 15 minutes and starts tracking only in a tab on that exact Meet code.
- **What counts as away.** The Meet tab being hidden (switching tabs, minimizing). Clicking into another window does not count. While away, only the **hostname** of the tab you moved to is recorded.
- **Starting and stopping.** Tracking starts when Meet's "Leave call" button appears and ends when it disappears, the tab closes, or the tab leaves the meeting. Students cannot turn tracking off from the popup while in a meeting.
- **Batching.** Events get client-side IDs, are saved in `chrome.storage.local`, and are sent every 30 seconds. Failed batches stay queued and are retried, and the backend ignores duplicates.
- **Login.** The website asks the backend for a separate session for the extension (`/api/auth/extension-session`), so the website and the extension never share a refresh token.

## Known limits

- Meet's page is not a public API. If Google renames the hang-up button, update `LEAVE_SELECTOR` in `src/content-meet.js`. If the button is never found, the student counts as joined after 45 seconds.
- Chrome slows timers in tabs hidden for several minutes, so leaving a meeting while on another tab may be recorded when the student returns, or when the tab is closed.
- Rejoining after leaving is not tracked. The student must click Join on the website again, and the session keeps only the first join and leave.
- Permissions: `tabs` is needed to read the hostname of the tab a student switches to, and Chrome will mention browsing history when installing.

## Production

Set `API_URL` and `WEB_ORIGINS` to your deployed URLs, run `npm run build`, and load or publish `dist/`. The backend's `CORS_ORIGINS` does not need the extension: its requests come from the service worker, which is allowed by `host_permissions`.
