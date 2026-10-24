// Service worker. Holds no state in memory: everything lives in chrome.storage.local,
// because Chrome stops idle service workers after ~30 seconds.
const API = __API_URL__;
const WEB_ORIGINS = __WEB_ORIGINS__;
const ARM_TTL = 15 * 60 * 1000; // armed meeting must be opened within 15 minutes

const get = async (k) => (await chrome.storage.local.get(k))[k];
const set = (o) => chrome.storage.local.set(o);
const hostOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname : 'browser page'; } catch { return null; } };

// One handler at a time, so storage read-modify-write never interleaves.
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn); chain = p.catch((e) => console.error(e)); return p; };

async function api(path, { method = 'GET', body } = {}) {
  let s = await get('session');
  if (!s) throw new Error('Log in to the Isee extension first');
  const call = (token) => fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  }).catch((e) => {
    throw new Error(e.name === 'TimeoutError' ? 'The Isee server took too long to answer' : 'Could not reach the Isee server');
  });
  let res = await call(s.access_token);
  if (res.status === 401 && s.refresh_token) {
    const r = await fetch(API + '/api/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (r.ok) { s = { ...s, ...(await r.json()).session }; await set({ session: s }); res = await call(s.access_token); }
    else await set({ session: null, user: null });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function pushEvent(tr, type, hostname, ts) {
  const q = (await get('queue')) || [];
  q.push({ sessionId: tr.sessionId, event: { id: crypto.randomUUID(), type, hostname: hostname || null, clientTs: new Date(ts).toISOString() } });
  await set({ queue: q });
  if (q.length >= 20 || type === 'leave') await flushNow();
}

// Sends queued events (and acts as a heartbeat while tracking). Failed batches stay queued.
async function flushNow() {
  const queue = (await get('queue')) || [];
  const tr = await get('tracking');
  const ids = new Set(queue.map((i) => i.sessionId));
  if (tr) ids.add(tr.sessionId);
  for (const sid of ids) {
    const mine = queue.filter((i) => i.sessionId === sid).slice(0, 500);
    const drop = async () => {
      const sent = new Set(mine.map((i) => i.event.id));
      await set({ queue: ((await get('queue')) || []).filter((i) => !sent.has(i.event.id)) });
    };
    try {
      await api(`/api/sessions/${sid}/events`, { method: 'POST', body: { events: mine.map((i) => i.event) } });
      await drop();
      await set({ syncError: null });
    } catch (e) {
      if (e.message === 'Session not found') await drop();
      else await set({ syncError: e.message });
    }
  }
}

async function endTracking(tr, ts) {
  await pushEvent(tr, 'leave', null, ts);
  await set({ tracking: null });
  await flushNow();
}

async function goAway(tr, ts) {
  const [tab] = await chrome.tabs.query({ active: true, windowId: tr.windowId }).catch(() => []);
  const host = tab && tab.id !== tr.tabId ? hostOf(tab.url) : null;
  Object.assign(tr, { away: true, host });
  await set({ tracking: tr });
  await pushEvent(tr, 'away', host, ts);
}

const fromWeb = (sender) => {
  try { return Boolean(sender.tab) && WEB_ORIGINS.includes(new URL(sender.url).origin); } catch { return false; }
};

async function onWeb(p, sender) {
  if (!fromWeb(sender)) throw new Error('Not allowed');
  if (p.type === 'ping') return { ok: true };
  if (p.type === 'login') {
    if (!p.session?.access_token || !p.user?.id) throw new Error('Login data was incomplete');
    await set({ session: p.session, user: p.user });
    return { ok: true };
  }
  if (p.type === 'arm') {
    const user = await get('user');
    if (!user) throw new Error('Log in to the Isee extension first: click its icon in the toolbar');
    if (user.role !== 'student') throw new Error('Only student accounts are tracked');
    if (await get('tracking')) throw new Error('You are already in a tracked meeting. Leave it before joining another');
    const d = await api('/api/sessions/start', { method: 'POST', body: { meetingId: p.meetingId } });
    await set({ armed: { sessionId: d.sessionId, meetingId: p.meetingId, meetCode: d.meetCode, title: d.title, at: Date.now() } });
    // If the Meet tab is already open, tell it now instead of waiting for a reload.
    const open = await chrome.tabs.query({ url: `https://meet.google.com/${d.meetCode}*` });
    for (const t of open) chrome.tabs.sendMessage(t.id, { type: 'meet:armed' }).catch(() => {});
    return { ok: true, title: d.title };
  }
  throw new Error('Unknown request');
}

async function onMeet(msg, sender, ts) {
  const tab = sender.tab;
  if (!tab) return { track: false };
  let tr = await get('tracking');
  if (msg.type === 'meet:hello') {
    if (tr && tr.tabId === tab.id) { Object.assign(tr, { windowId: tab.windowId }); await set({ tracking: tr }); return { track: true, joined: tr.joined }; }
    const armed = await get('armed');
    if (!tr && armed && armed.meetCode === msg.code && ts - armed.at < ARM_TTL) {
      tr = { sessionId: armed.sessionId, meetingId: armed.meetingId, meetCode: armed.meetCode, title: armed.title,
        tabId: tab.id, windowId: tab.windowId, joined: false, away: false, host: null };
      await set({ tracking: tr, armed: null });
      return { track: true, joined: false };
    }
    return { track: false };
  }
  if (!tr || tr.tabId !== tab.id) return { ok: false };
  if (msg.type === 'meet:joined' && !tr.joined) {
    tr.joined = true; tr.windowId = tab.windowId;
    await set({ tracking: tr });
    await pushEvent(tr, 'join', null, ts);
    if (msg.hidden) await goAway(tr, ts);
  } else if (msg.type === 'meet:visibility' && tr.joined) {
    tr.windowId = tab.windowId;
    if (msg.hidden && !tr.away) await goAway(tr, ts);
    else if (!msg.hidden && tr.away) {
      Object.assign(tr, { away: false, host: null });
      await set({ tracking: tr });
      await pushEvent(tr, 'return', null, ts);
    }
  } else if (msg.type === 'meet:left') await endTracking(tr, ts);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'web' && msg.payload?.type === 'ping') { // answered at once, never queued behind slow requests
    respond(fromWeb(sender) ? { ok: true } : { ok: false, error: 'Not allowed: this site is not in WEB_ORIGINS' });
    return false;
  }
  const ts = Date.now();
  serial(async () => {
    if (msg.type === 'web') return onWeb(msg.payload, sender);
    if (msg.type?.startsWith('meet:')) return onMeet(msg, sender, ts);
    if (msg.type === 'logout') {
      if (await get('tracking')) throw new Error('Tracking cannot be turned off while you are in a meeting. Leave the meeting first');
      await chrome.storage.local.remove(['session', 'user', 'armed', 'queue', 'syncError']);
      return { ok: true };
    }
    return { ok: false };
  }).then(respond).catch((e) => respond({ ok: false, error: e.message }));
  return true; // answer asynchronously
});

// Student moves between tabs while away: record the site (hostname only).
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  const ts = Date.now();
  serial(async () => {
    const tr = await get('tracking');
    if (!tr || !tr.joined || !tr.away || tr.windowId !== windowId || tabId === tr.tabId) return;
    const h = hostOf((await chrome.tabs.get(tabId)).url);
    if (h && h !== tr.host) { tr.host = h; await set({ tracking: tr }); await pushEvent(tr, 'site', h, ts); }
  });
});

// Closing the meeting tab, or navigating it away from the meeting, ends tracking.
chrome.tabs.onRemoved.addListener((tabId) => {
  const ts = Date.now();
  serial(async () => { const tr = await get('tracking'); if (tr && tr.tabId === tabId) await endTracking(tr, ts); });
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url) return;
  const ts = Date.now();
  serial(async () => {
    const tr = await get('tracking');
    if (tr && tr.tabId === tabId && !change.url.startsWith(`https://meet.google.com/${tr.meetCode}`)) await endTracking(tr, ts);
  });
});

// Every 30 seconds: send queued events. While tracking this doubles as the heartbeat.
chrome.alarms.get('flush', (a) => { if (!a) chrome.alarms.create('flush', { periodInMinutes: 0.5 }); });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== 'flush') return;
  serial(async () => { if ((await get('tracking')) || ((await get('queue')) || []).length) await flushNow(); });
});
