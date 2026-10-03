import type { ArtSet } from '../assets/manifest';
import { Bot, BOT_SKILLS } from '../core/bot';
import { createRng } from '../core/rng';
import { Run } from '../core/run';
import type { World } from '../render/world';
import { el } from './dom';

/** Full-screen 3×3 grid: every zone must register a touch (IR frames often miss the corners). */
export function createTouchTest(parent: HTMLElement, onComplete: () => void): HTMLElement {
  const grid = el('div', 'sc-grid');
  grid.dataset.ui = '';
  let hits = 0;
  for (let i = 0; i < 9; i++) {
    const cell = el('div', 'sc-cell', String(i + 1));
    cell.addEventListener('pointerdown', () => {
      if (cell.classList.contains('hit')) return;
      cell.classList.add('hit');
      if (++hits === 9) onComplete();
    });
    grid.append(cell);
  }
  parent.append(grid);
  return grid;
}

/** `?check=1`: touch test first, then device facts, live frame rate and art sources over a demo run. */
export function runSelfCheck(stage: HTMLElement, world: World, art: ArtSet): void {
  const panel = el('div', 'selfcheck');
  panel.dataset.ui = '';
  panel.hidden = true;
  const fpsEl = el('dd', '', 'measuring…');
  const touchesEl = el('dd', '', '0');
  const gl = world.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const facts: Array<[string, string | HTMLElement]> = [
    ['Build', __BUILD__],
    ['Screen', `${screen.width}×${screen.height} at ${devicePixelRatio}x`],
    ['Window', `${innerWidth}×${innerHeight}`],
    ['Graphics card', gpu],
    ['Touch points supported', String(navigator.maxTouchPoints)],
    ['Touches right now', touchesEl],
    ['Frame rate', fpsEl],
    ['Network', navigator.onLine ? 'online' : 'offline (fine)'],
    ['Offline cache', navigator.serviceWorker?.controller ? 'active' : 'not active (normal for the USB copy)'],
  ];
  const dl = el('dl');
  for (const [k, v] of facts) dl.append(el('dt', '', k), typeof v === 'string' ? el('dd', '', v) : v);
  const artList = el('ul', 'sc-art');
  for (const a of art.list()) artList.append(el('li', a.source, `${a.id}: ${a.source === 'designer' ? 'designer file' : 'placeholder'}`));
  const again = el('button', 'sc-button', 'Repeat touch test');
  again.type = 'button';
  const start = el('button', 'sc-button primary', 'Start the game');
  start.type = 'button';
  start.addEventListener('click', () => {
    location.href = location.pathname;
  });
  panel.append(el('h2', '', 'Booth self-check'), dl, el('h3', '', 'Art'), artList, again, start);
  stage.append(panel);

  const showTouchTest = () => {
    panel.hidden = true;
    const grid = createTouchTest(stage, () => {
      window.setTimeout(() => {
        grid.remove();
        panel.hidden = false;
      }, 400);
    });
  };
  again.addEventListener('click', showTouchTest);
  showTouchTest();

  const active = new Set<number>();
  const show = () => (touchesEl.textContent = String(active.size));
  window.addEventListener('pointerdown', (e) => { active.add(e.pointerId); show(); });
  for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, (e) => { active.delete((e as PointerEvent).pointerId); show(); });

  let run = new Run({ seed: 1 });
  let bot = new Bot(createRng(1), BOT_SKILLS.skilled);
  world.reset();
  let last = performance.now(), frames = 0, acc = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frames++;
    acc += dt;
    if (acc >= 1) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps`;
      frames = 0;
      acc = 0;
    }
    bot.step(run, dt);
    for (const e of run.update(dt)) if (e.kind === 'question') run.answer(true);
    if (run.finished && run.speed < 1) {
      run = new Run({ seed: Math.floor(Math.random() * 1e9) });
      bot = new Bot(createRng(2), BOT_SKILLS.skilled);
      world.reset();
    }
    world.render(run, dt);
  };
  requestAnimationFrame(frame);
}
