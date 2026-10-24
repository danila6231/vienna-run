// Builds the 3D street viewer (demo/buildings) into one self-contained HTML file for sharing:
// dist-demo/vienna-run-street-looks.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${root}dist-demo/vienna-run-street-looks.html`;

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
const html = readFileSync(`${root}demo/buildings/page.html`, 'utf8')
  .replace('<!-- bundle -->', () => `<script>${js}</script>`);
writeFileSync(OUT, html);
console.log(`${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
