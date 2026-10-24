// Runs on the Isee website only. Relays messages between the page and the extension,
// so the site can hand over a login and "arm" tracking before opening a Meet link.
document.documentElement.dataset.iseeExtension = '1';

window.addEventListener('message', async (e) => {
  const d = e.data;
  if (e.source !== window || e.origin !== location.origin || !d || d.source !== 'isee-web') return;
  let res;
  try {
    res = await chrome.runtime.sendMessage({ type: 'web', payload: d });
  } catch {
    res = { ok: false, error: 'The Isee extension could not be reached. Reload this page and try again.' };
  }
  window.postMessage({ source: 'isee-ext', id: d.id, ...(res || { ok: false, error: 'No answer from the extension' }) }, location.origin);
});
