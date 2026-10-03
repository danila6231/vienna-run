import '@fontsource/federo';
import '@fontsource/albert-sans/400.css';
import '@fontsource/albert-sans/600.css';
import './ui/styles.css';
import { Game } from './app/game';
import { installKiosk } from './app/kiosk';
import { FixedStepper, startLoop, type Loop } from './app/loop';
import { parseParams } from './app/params';
import { readJson, writeJson } from './app/storage';
import { applyUpdateIfReady, setupUpdates } from './app/updates';
import { installWatchdog, shouldRefresh } from './app/watchdog';
import { loadArt } from './assets/manifest';
import { CONFIG } from './config';
import { validateBank } from './core/questions';
import { BAD_TYPES, GOOD_TYPES, type ItemType } from './core/types';
import bankJson from './data/questions.json';
import { attachInput } from './input/touch';
import * as P from './render/placeholders/paint';
import { QualityMonitor } from './render/quality';
import { createWorld, type QualityLevel } from './render/world';
import { AttractScreen } from './ui/attract';
import { Fx } from './ui/fx';
import { HowtoScreen } from './ui/howto';
import { Hud } from './ui/hud';
import { QuestionScreen } from './ui/question';
import { ResultsScreen } from './ui/results';
import { runSelfCheck } from './ui/selfcheck';

const RECENT_KEY = 'vienna-run:recent-questions';
const isRecent = (v: unknown): v is string[][] => Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((x) => typeof x === 'string'));

async function boot(): Promise<void> {
  const params = parseParams(location.search);
  installKiosk(document, { hideCursor: params.hideCursor && !params.check });

  const stage = document.createElement('div');
  stage.id = 'stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  for (const cls of ['vignette', 'grain']) {
    const layer = document.createElement('div');
    layer.className = `overlay-fx ${cls}`;
    if (cls === 'grain') {
      const url = P.grainDataUrl();
      if (url) layer.style.backgroundImage = `url(${url})`;
    }
    stage.append(layer);
  }
  document.body.append(stage);

  let loop: Loop | null = null;
  installWatchdog({ cfg: CONFIG.watchdog, canvas, lastFrameAt: () => loop?.lastFrameAt() ?? performance.now() });
  setupUpdates();

  const art = await loadArt();
  const world = createWorld(canvas, art, CONFIG.laneWidth);
  const fit = () => world.resize(stage.clientWidth, stage.clientHeight);
  fit();
  new ResizeObserver(fit).observe(stage);
  // Low quality also drops the full-screen paper-grain blend, which costs compositing time on weak GPUs.
  const applyQuality = (level: QualityLevel) => {
    world.setQuality(level);
    stage.classList.toggle('quality-low', level === 'low');
  };
  if (params.quality) applyQuality(params.quality);
  if (params.check) {
    runSelfCheck(stage, world, art);
    return;
  }

  const icons = Object.fromEntries([...GOOD_TYPES, ...BAD_TYPES].map((t) => [t, art.get(`item-${t}`).toDataURL()])) as Record<ItemType, string>;
  const ui = {
    hud: new Hud(stage, 'Stephansplatz → Riesenrad'),
    fx: new Fx(stage),
    attract: new AttractScreen(stage, icons, art.url('logo')),
    howto: new HowtoScreen(stage),
    question: new QuestionScreen(stage),
    results: new ResultsScreen(stage, CONFIG.flow.holdSeconds * 1000),
  };
  const bootedAt = performance.now();
  const game = new Game({
    cfg: CONFIG,
    bank: validateBank(bankJson),
    world,
    ui,
    seed: params.seed,
    autoplay: params.autoplay,
    recent: { read: () => readJson(RECENT_KEY, [], isRecent), write: (h) => writeJson(RECENT_KEY, h) },
    onAttract: (cycles) => {
      applyUpdateIfReady();
      if (!params.autoplay && shouldRefresh(cycles, performance.now() - bootedAt, CONFIG.watchdog)) location.reload();
    },
  });

  attachInput(stage, CONFIG.input, { onLane: (d) => game.lane(d), onPress: () => game.press() });
  const monitor = params.quality ? null : new QualityMonitor('high');
  const stepper = new FixedStepper(1 / 60, params.speed);
  loop = startLoop(
    stepper,
    (dt) => game.update(dt),
    (sec) => {
      const level = monitor?.sample(sec);
      if (level) applyQuality(level);
      game.render(Math.min(sec, 0.1) * params.speed);
    },
  );
  if (params.autoplay) exposeDebugHook(game, canvas);
}

/** Read by the Playwright smoke and soak tests (autoplay mode only). */
function exposeDebugHook(game: Game, canvas: HTMLCanvasElement): void {
  const hook = { cycles: 0, screen: 'attract' as string, errors: [] as string[], contextLost: false };
  (window as unknown as { __vr: typeof hook }).__vr = hook;
  window.addEventListener('error', (e) => hook.errors.push(e.message));
  canvas.addEventListener('webglcontextlost', () => {
    hook.contextLost = true;
  });
  window.setInterval(() => {
    hook.cycles = game.cycles;
    hook.screen = game.flow.screen;
  }, 250);
}

void boot();
