// GitHub Pages has no server-side rewrite, so a deep link like /setup/install
// returns a hard 404 before the SPA router ever loads. Pages does serve
// 404.html for unmatched paths, so shipping a byte-for-byte copy of index.html
// under that name makes the router pick the route up on the client.
//
// `.nojekyll` is copied from public/ by Vite; without it Pages runs the output
// through Jekyll, which silently drops any file or directory starting with an
// underscore (Vite emits none today, but that is one refactor away).
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('[spa-fallback] dist/index.html not found — did vite build run?');
  process.exit(1);
}

copyFileSync(index, join(dist, '404.html'));
console.log('[spa-fallback] wrote dist/404.html');
