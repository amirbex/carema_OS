#!/usr/bin/env node
/**
 * Builds the static preview that GitHub Pages can serve.
 *
 * Differences from `npm run build`:
 *   - `base` is set to `/<repo>/` so hashed assets resolve on
 *     https://<user>.github.io/<repo>/
 *   - `VITE_DEMO_MODE=true` — no Firebase project, no Express API, sample data
 *     in localStorage (see src/lib/demoStore.ts)
 *   - `index.html` is copied to `404.html` so deep links boot the SPA
 *   - `.nojekyll` stops Jekyll from dropping files that start with `_`
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoName = (process.env.GITHUB_REPOSITORY || 'amirbex/carema_OS').split('/').pop() || 'carema_OS';

function normalizeBase(value) {
  const raw = value && value.trim() ? value.trim() : `/${repoName}/`;
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

const base = normalizeBase(process.env.VITE_BASE);
const distDir = path.resolve(process.cwd(), 'dist');

console.log(`[build:pages] base=${base} demo=true`);

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, VITE_BASE: base, VITE_DEMO_MODE: 'true' },
    shell: false,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

const status = run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build']);
if (status !== 0) process.exit(status);

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('[build:pages] dist/index.html is missing — did the build fail?');
  process.exit(1);
}

// SPA fallback: Pages serves 404.html for unknown paths, so the client router
// can pick the route up instead of showing GitHub's 404 page.
copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
writeFileSync(path.join(distDir, '.nojekyll'), '');
console.log('[build:pages] wrote dist/404.html and dist/.nojekyll');
