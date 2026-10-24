// Runs on meet.google.com. It only does anything if the background script says this
// meeting was armed from the Isee website. It reports three things: joined, tab hidden/visible, left.
const LEAVE_SELECTOR = 'button[aria-label^="Leave call"]'; // Meet's hang-up button. Edit if Meet changes it.
const JOIN_FALLBACK_MS = 45000; // if the button is never found, count the student as joined after this long

(() => {
  const m = location.pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
  if (!m) return;
  const code = m[1].toLowerCase();
  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
  let started = false;

  async function begin() {
    if (started) return;
    const hello = await send({ type: 'meet:hello', code });
    if (started || !hello || !hello.track) return;
    started = true;

    let joined = Boolean(hello.joined), seen = false, missing = 0, over = false;
    const startedAt = Date.now();

    // Small notice so students always know tracking is on.
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:16px;bottom:96px;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>.b{display:flex;gap:8px;align-items:center;background:#25451f;color:#b9d6b4;font:13px system-ui,sans-serif;padding:8px 12px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.4)}.d{width:8px;height:8px;border-radius:50%;background:#88f549}</style><div class="b"><span class="d"></span><span>Isee is tracking tab switches in this meeting</span></div>';
    document.documentElement.appendChild(host);

    const tick = async () => {
      if (over) return;
      const inCall = Boolean(document.querySelector(LEAVE_SELECTOR));
      if (!joined) {
        if (inCall || Date.now() - startedAt > JOIN_FALLBACK_MS) {
          joined = true; seen = inCall;
          await send({ type: 'meet:joined', hidden: document.hidden });
        }
      } else if (inCall) { seen = true; missing = 0; }
      else if (seen && ++missing >= 2) {
        over = true; clearInterval(timer); host.remove();
        await send({ type: 'meet:left' });
      }
    };
    const timer = setInterval(tick, 2000);
    tick();

    document.addEventListener('visibilitychange', () => {
      if (joined && !over) send({ type: 'meet:visibility', hidden: document.hidden });
      if (!document.hidden) tick();
    });
  }

  // The extension tells an already-open Meet tab when the meeting gets armed (arming can finish after the tab loads).
  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'meet:armed') begin(); });
  begin();
})();
