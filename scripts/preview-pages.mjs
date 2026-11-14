#!/usr/bin/env node
/**
 * Serves `dist/` exactly the way GitHub Pages serves a project site
 * (https://<user>.github.io/<repo>/), so the preview build can be verified
 * locally including asset paths and deep links.
 *
 *   npm run build:pages && npm run preview:pages
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const PORT = Number(process.env.PORT || 4173);
const BASE = (process.env.VITE_BASE || '/carema_OS/').endsWith('/')
  ? process.env.VITE_BASE || '/carema_OS/'
  : `${process.env.VITE_BASE}/`;
const root = path.resolve(process.cwd(), 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  if (!pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: BASE });
    res.end();
    return;
  }

  const relative = pathname.slice(BASE.length);
  const candidate = path.join(root, relative);

  if (relative && existsSync(candidate) && statSync(candidate).isFile()) {
    send(res, 200, candidate);
    return;
  }

  // Directory-style request → index.html
  const indexCandidate = path.join(candidate, 'index.html');
  if (existsSync(indexCandidate) && statSync(indexCandidate).isFile()) {
    send(res, 200, indexCandidate);
    return;
  }

  // SPA fallback: Pages uses 404.html, which is a copy of index.html.
  const fallback = path.join(root, '404.html');
  const notFound = existsSync(fallback) ? fallback : path.join(root, 'index.html');
  send(res, 404, notFound);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[preview:pages] http://0.0.0.0:${PORT}${BASE} (serving dist/)`);
});
