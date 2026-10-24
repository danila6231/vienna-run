// Measures each street look in the built demo (npm run demo:buildings first): 5 s of driving from the start line at
// 1600×900, at normal CPU speed and with the CPU slowed 4× (the design spec's booth check). Writes
// demo/buildings/perf.json, which the next demo build shows as a table.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const LOOKS = [
  ['paper', 'Paper (today)'],
  ['stylized', 'Stylized 3D'],
  ['lowpoly', 'Low-poly'],
  ['realistic', 'Closer to realistic'],
] as const;

interface Sample { fps: number; calls: number; triangles: number }

async function sample(page: Page, look: string): Promise<Sample> {
  return page.evaluate(async (l) => {
    const d = (window as any).__demo;
    d.setLook(l);
    d.restart();
    d.setDriving(true);
    await new Promise((r) => setTimeout(r, 800)); // first frames compile shaders
    let frames = 0, calls = 0, triangles = 0;
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const tick = () => {
        frames++;
        const s = d.stats();
        calls = Math.max(calls, s.calls);
        triangles = Math.max(triangles, s.triangles);
        if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { fps: frames / ((performance.now() - t0) / 1000), calls, triangles };
  }, look);
}

const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
// tsx keeps function names with an `__name` helper that does not exist inside the page.
await page.addInitScript({ content: 'window.__name = (f) => f;' });
await page.goto(`file://${root}dist-demo/vienna-run-street-looks.html`);
await page.waitForFunction(() => (window as any).__demo?.ready === true, null, { timeout: 60_000 });
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown GPU';
});
const cdp = await page.context().newCDPSession(page);
const rows = [];
for (const [look, label] of LOOKS) {
  const fast = await sample(page, look);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const slow = await sample(page, look);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  rows.push({ look, label, calls: fast.calls, triangles: fast.triangles, fps: fast.fps, fpsSlow: slow.fps });
  console.log(`${label.padEnd(20)} ${String(fast.calls).padStart(4)} draws ${String(Math.round(fast.triangles / 1000)).padStart(5)}k tris ${fast.fps.toFixed(1).padStart(5)} fps  ${slow.fps.toFixed(1).padStart(5)} fps at 4× CPU`);
}
await browser.close();
const machine = gpu.match(/Renderer: ([^,)]+)/)?.[1] ?? gpu;
writeFileSync(`${root}demo/buildings/perf.json`, JSON.stringify({ machine, date: new Date().toISOString().slice(0, 10), rows }, null, 2) + '\n');
console.log(`GPU: ${machine}`);
