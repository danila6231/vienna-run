// Builds the street looks demo (demo/buildings) into one self-contained HTML file for sharing:
// dist-demo/vienna-run-street-looks.html. Measured numbers come from demo/buildings/perf.json (npm run demo:perf).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${root}dist-demo/vienna-run-street-looks.html`;

interface PerfRow { look: string; label: string; calls: number; triangles: number; fps: number; fpsSlow: number }
interface Perf { machine: string; date: string; rows: PerfRow[] }

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    lib: { entry: 'demo/buildings/main.ts', formats: ['iife'], name: 'StreetLooks', fileName: () => 'demo.js' },
  },
});

const js = readFileSync(`${root}dist-demo/demo.js`, 'utf8').replace(/<\/script/gi, '<\\/script');
const perfFile = `${root}demo/buildings/perf.json`;
const perf: Perf | null = existsSync(perfFile) ? JSON.parse(readFileSync(perfFile, 'utf8')) : null;
const tris = (n: number) => (n < 10_000 ? n.toLocaleString('en-US') : `${Math.round(n / 1000)}k`);
const rows = perf
  ? perf.rows.map((r) => `<tr><td>${r.label}</td><td>${r.calls}</td><td>${tris(r.triangles)}</td><td>${Math.round(r.fps)}</td><td>${Math.round(r.fpsSlow)}</td></tr>`).join('')
  : '<tr><td colspan="5">Not measured yet.</td></tr>';
const caption = perf
  ? `Measured ${perf.date} in Chrome on an ${perf.machine}, a much faster graphics chip than a typical booth PC, so every look reaches the display's 60 fps cap here. Compare the draw calls and triangles: they are what a weak GPU pays for.`
  : '';

const html = readFileSync(`${root}demo/buildings/page.html`, 'utf8')
  .replace('<!-- perf rows -->', () => rows)
  .replace('<!-- perf caption -->', () => caption)
  .replace('<!-- bundle -->', () => `<script>${js}</script>`);
writeFileSync(OUT, html);
console.log(`${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
