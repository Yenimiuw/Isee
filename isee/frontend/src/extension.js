// Talks to the Isee browser extension through its content script (window.postMessage).
let n = 0;

export function callExtension(type, payload = {}, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${++n}`;
    const cleanup = () => { window.removeEventListener('message', on); clearTimeout(timer); };
    const on = (e) => {
      const d = e.data;
      if (e.source !== window || !d || d.source !== 'isee-ext' || d.id !== id) return;
      cleanup();
      if (d.ok) resolve(d); else reject(new Error(d.error || 'The extension refused the request'));
    };
    const timer = setTimeout(() => {
      cleanup();
      const err = new Error('The Isee extension did not respond.');
      err.code = 'not-installed';
      reject(err);
    }, timeout);
    window.addEventListener('message', on);
    window.postMessage({ source: 'isee-web', id, type, ...payload }, window.location.origin);
  });
}
