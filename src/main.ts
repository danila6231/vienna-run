// Temporary visual harness: the street with an autopilot runner. Replaced by the real app in Task 16.
import '@fontsource/federo';
import '@fontsource/albert-sans/400.css';
import { loadArt } from './assets/manifest';
import { CONFIG } from './config';
import { Bot, BOT_SKILLS } from './core/bot';
import { createRng } from './core/rng';
import { Run } from './core/run';
import { createWorld } from './render/world';

async function boot(): Promise<void> {
  document.body.style.margin = '0';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
  document.body.append(canvas);
  const art = await loadArt();
  const world = createWorld(canvas, art, CONFIG.laneWidth);
  const fit = () => world.resize(window.innerWidth, window.innerHeight);
  fit();
  window.addEventListener('resize', fit);
  let run = new Run({ seed: 1 });
  let bot = new Bot(createRng(2), BOT_SKILLS.skilled);
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    bot.step(run, dt);
    for (const e of run.update(dt)) if (e.kind === 'question') run.answer(true);
    if (run.finished && run.speed < 1) {
      run = new Run({ seed: Math.floor(Math.random() * 1e9) });
      bot = new Bot(createRng(3), BOT_SKILLS.skilled);
      world.reset();
    }
    world.render(run, dt);
  };
  requestAnimationFrame(frame);
}

void boot();
