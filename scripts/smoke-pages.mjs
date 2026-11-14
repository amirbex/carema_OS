#!/usr/bin/env node
/**
 * Renders the real app views in demo mode (jsdom) and asserts they show the
 * sample data. This catches the "GitHub Pages shows a blank page" class of bug
 * without needing a browser in CI.
 *
 *   npm run smoke:pages
 */

import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const OUT_DIR = path.resolve(process.cwd(), '.smoke');
const OUT_FILE = path.join(OUT_DIR, 'render.cjs');

const require = createRequire(import.meta.url);
const pickerPath = require.resolve('react-multi-date-picker');

const define = {
  'import.meta.env.VITE_DEMO_MODE': '"true"',
  'import.meta.env.VITE_ENABLE_DEMO_LOGIN': '"true"',
  'import.meta.env.BASE_URL': '"/"',
  'import.meta.env.MODE': '"production"',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
};

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

await build({
  entryPoints: [path.resolve(process.cwd(), 'scripts/smoke-entry.tsx')],
  bundle: true,
  // CJS keeps Node's extension-less `require` resolution working for the
  // date-picker packages (their deep imports are not ESM-resolvable).
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: OUT_FILE,
  define,
  plugins: [
    {
      // esbuild's node-mode interop turns this CJS package into a namespace
      // object, which React cannot render. Re-export the component itself.
      name: 'picker-interop',
      setup(build) {
        build.onResolve({ filter: /^react-multi-date-picker$/ }, () => ({ path: 'picker-shim', namespace: 'picker' }));
        build.onLoad({ filter: /.*/, namespace: 'picker' }, () => ({
          contents: 'module.exports = globalThis.__caremaPicker.default || globalThis.__caremaPicker;',
          loader: 'js',
        }));
      },
    },
    {
      // Stylesheets are irrelevant to the render assertions and some live in
      // node_modules (react-multi-date-picker), which externals would try to
      // `require`.
      name: 'empty-css',
      setup(build) {
        build.onResolve({ filter: /\.css$/ }, (args) => ({ path: args.path, namespace: 'empty-css' }));
        build.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
  // Firebase's gRPC stack cannot be bundled for ESM/Node; the demo path never
  // calls it, so leave it as a runtime import.
  external: [
    'firebase',
    'firebase/*',
    '@firebase/*',
    // Shared singletons: bundling React while the date picker `require`s its
    // own copy would create two React instances (forwardRef symbols differ).
    'react',
    'react/*',
    'react-dom',
    'react-dom/*',
    'react-router',
    'react-router/*',
  ],
  logLevel: 'error',
  absWorkingDir: process.cwd(),
});

const dom = new JSDOM('<!doctype html><html lang="fa" dir="rtl"><body></body></html>', {
  url: 'https://amirbex.github.io/carema_OS/',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
// jsdom does not implement these layout/scroll APIs used by the chat view.
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

globalThis.matchMedia =
  window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

// Silence the "not wrapped in act" noise from async subscriptions.
const originalError = console.error;
console.error = (...args) => {
  const first = String(args[0] ?? '');
  if (first.includes('not wrapped in act')) return;
  originalError(...args);
};

globalThis.__caremaPicker = require(pickerPath);
const { runSmoke, runExtractionSmoke } = require(OUT_FILE);
const rendered = await runSmoke();
const extraction = await runExtractionSmoke();

const checks = [
  { name: 'Projects view lists the seeded project', text: rendered.projects, expect: 'بازطراحی وب‌سایت CaReMa' },
  { name: 'Projects view shows live task counters', text: rendered.projects, expect: 'کل وظایف' },
  { name: 'Projects view shows the demo identity', text: rendered.projects, expect: 'demo@carema.app' },
  { name: 'Timeline view shows a seeded event', text: rendered.timeline, expect: 'جلسهٔ روزانهٔ تیم محصول' },
  { name: 'Chat view renders the assistant shell', text: rendered.chat, expect: 'CaReMa' },
  { name: 'Project files view lists the seeded file', text: rendered.files, expect: 'meeting-notes.md' },
  { name: 'No React crash screen', text: JSON.stringify(rendered), expect: 'Something went wrong' },
];

const extractionOk = extraction.after > extraction.before;
console.log(`${extractionOk ? '✔' : '✘'} Offline file extraction adds demo tasks (${extraction.before} → ${extraction.after})`);
let failed = extractionOk ? 0 : 1;
for (const check of checks) {
  const expectCrash = check.name.startsWith('No React crash');
  const found = check.text.includes(check.expect);
  const ok = expectCrash ? !found : found;
  console.log(`${ok ? '✔' : '✘'} ${check.name}`);
  if (!ok) {
    failed += 1;
    console.log(`   expected${expectCrash ? ' NOT' : ''} to find: ${check.expect}`);
  }
}

console.log('\n--- Projects view (first 300 chars) ---');
console.log(rendered.projects.slice(0, 300));
console.log('\n--- Timeline view (first 500 chars) ---');
console.log(rendered.timeline.slice(0, 500));

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nAll preview smoke checks passed.');
