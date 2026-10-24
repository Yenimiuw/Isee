// Bundles the extension into dist/ (load that folder in chrome://extensions).
// Usage: npm run build   |   npm run dev (rebuilds on save)
import 'dotenv/config';
import { build, context } from 'esbuild';
import fs from 'node:fs';

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const WEB_ORIGINS = (process.env.WEB_ORIGINS || 'http://localhost:5173')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
const watch = process.argv.includes('--watch');

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
fs.cpSync('public', 'dist', { recursive: true });
fs.writeFileSync('dist/manifest.json', JSON.stringify({
  manifest_version: 3,
  name: 'Isee',
  version: '1.0.0',
  description: 'Tracks tab switches during class meetings you join from the Isee website.',
  permissions: ['storage', 'alarms', 'tabs'],
  host_permissions: [`${API_URL}/*`, 'https://meet.google.com/*'],
  background: { service_worker: 'background.js', type: 'module' },
  action: { default_popup: 'popup.html', default_title: 'Isee' },
  content_scripts: [
    { matches: ['https://meet.google.com/*'], js: ['content-meet.js'], run_at: 'document_idle' },
    { matches: WEB_ORIGINS.map((o) => `${o}/*`), js: ['content-web.js'], run_at: 'document_start' },
  ],
  icons: { 16: 'icons/16.png', 48: 'icons/48.png', 128: 'icons/128.png' },
}, null, 2));

const shared = {
  bundle: true, outdir: 'dist', jsx: 'automatic', target: 'chrome110', logLevel: 'info',
  minify: !watch, sourcemap: watch ? 'inline' : false,
  define: {
    __API_URL__: JSON.stringify(API_URL),
    __WEB_URL__: JSON.stringify(WEB_ORIGINS[0]),
    __WEB_ORIGINS__: JSON.stringify(WEB_ORIGINS),
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
  },
};
const groups = [
  { ...shared, format: 'iife', entryPoints: ['src/content-meet.js', 'src/content-web.js', 'src/popup.jsx'] },
  { ...shared, format: 'esm', entryPoints: ['src/background.js'] },
];
if (watch) {
  for (const g of groups) await (await context(g)).watch();
  console.log('Watching for changes. Reload the extension in chrome://extensions after each build.');
} else {
  for (const g of groups) await build(g);
}
