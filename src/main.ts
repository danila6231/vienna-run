import '@fontsource/federo';
import '@fontsource/albert-sans/400.css';
import '@fontsource/albert-sans/600.css';
import './ui/styles.css';
import './ui/staff.css';
import { Game } from './app/game';
import { installKiosk } from './app/kiosk';
import { FixedStepper, startLoop, type Loop } from './app/loop';
import { parseParams } from './app/params';
import { loadSettings, saveSettings } from './app/settingsStore';
import { readJson, writeJson } from './app/storage';
import { applyUpdateIfReady, setupUpdates } from './app/updates';
import { installWatchdog, shouldRefresh } from './app/watchdog';
import { loadArt } from './assets/manifest';
import { CONFIG } from './config';
import { validateBank } from './core/questions';
import { buildConfig, featuresOf } from './core/settings';
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
import { attachCornerHold } from './ui/staff/cornerHold';
import { PinPad } from './ui/staff/pinPad';
import { SettingsPanel } from './ui/staff/settingsPanel';

const RECENT_KEY = 'vienna-run:recent-questions';
const CORNER_HOLD_MS = 3000;
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

  let settings = loadSettings();

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
    cfg: buildConfig(settings),
    features: featuresOf(settings),
    giftUrl: (tier) => art.url(`gift-${tier}`),
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

  // Staff settings: hold the top-left corner of the start screen, then the PIN. The game pauses meanwhile.
  let staffOpen = false;
  const pinPad = new PinPad(stage);
  const panel = new SettingsPanel(stage, {
    onSave: (s) => {
      settings = s;
      saveSettings(s);
      game.configure(buildConfig(s), featuresOf(s));
    },
    onClose: () => {
      staffOpen = false;
    },
  });
  attachCornerHold(ui.attract.root, CORNER_HOLD_MS, () => {
    if (staffOpen || game.flow.screen !== 'attract') return;
    staffOpen = true;
    pinPad.open({
      check: (pin) => pin === settings.pin,
      onSuccess: () => panel.open(settings),
      onCancel: () => {
        staffOpen = false;
      },
    });
  });

  attachInput(stage, CONFIG.input, {
    onLane: (d) => {
      if (!staffOpen) game.lane(d);
    },
    onPress: () => {
      if (!staffOpen) game.press();
    },
  });
  const monitor = params.quality ? null : new QualityMonitor('high');
  const stepper = new FixedStepper(1 / 60, params.speed);
  loop = startLoop(
    stepper,
    (dt) => {
      if (!staffOpen) game.update(dt);
    },
    (sec) => {
      const level = monitor?.sample(sec);
      if (level) applyQuality(level);
      game.render(Math.min(sec, 0.1) * params.speed);
    },
  );
  exposeDebugHook(game, canvas);
}

/** Read-only state for the Playwright tests. */
function exposeDebugHook(game: Game, canvas: HTMLCanvasElement): void {
  const hook = { cycles: 0, screen: 'attract' as string, errors: [] as string[], contextLost: false, baseSpeed: 0 };
  (window as unknown as { __vr: typeof hook }).__vr = hook;
  window.addEventListener('error', (e) => hook.errors.push(e.message));
  canvas.addEventListener('webglcontextlost', () => {
    hook.contextLost = true;
  });
  const sync = () => {
    hook.cycles = game.cycles;
    hook.screen = game.flow.screen;
    hook.baseSpeed = game.run.cfg.baseSpeed;
  };
  sync();
  window.setInterval(sync, 250);
}

void boot();
