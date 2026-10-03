import type { GameConfig } from '../config';
import { readJson, safeSessionStorage, writeJson } from './storage';

const RELOADS_KEY = 'vienna-run:reloads';
const LOG_KEY = 'vienna-run:errors';
const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Records a reload attempt; refuses once `max` reloads happened inside `windowMs` (a crash loop). */
export function allowReload(history: readonly number[], now: number, max: number, windowMs: number): { allowed: boolean; history: number[] } {
  const recent = history.filter((t) => now - t < windowMs);
  if (recent.length >= max) return { allowed: false, history: recent };
  return { allowed: true, history: [...recent, now] };
}

/** Fresh page between players every N runs or hours, to shed any slow leak. */
export function shouldRefresh(runsSinceBoot: number, uptimeMs: number, cfg: GameConfig['watchdog']): boolean {
  return runsSinceBoot >= cfg.reloadEveryRuns || uptimeMs >= cfg.reloadEveryHours * 3_600_000;
}

export interface WatchdogDeps {
  cfg: GameConfig['watchdog'];
  canvas: HTMLCanvasElement;
  lastFrameAt: () => number;
  reload?: () => void;
}

/** Any error, lost GPU context or frozen frame loop → a short card, then a clean reload. */
export function installWatchdog(d: WatchdogDeps): { restart(reason: string): void } {
  const reload = d.reload ?? (() => location.reload());
  let restarting = false;
  const card = (text: string) => {
    const c = document.createElement('div');
    c.className = 'restart-card';
    c.textContent = text;
    document.body.append(c);
  };
  const restart = (reason: string) => {
    if (restarting) return;
    restarting = true;
    const log = readJson<string[]>(LOG_KEY, [], isStrings);
    writeJson(LOG_KEY, [...log, `${new Date().toISOString()} ${reason}`].slice(-50));
    const session = safeSessionStorage();
    const r = allowReload(readJson<number[]>(RELOADS_KEY, [], isNumbers, session), Date.now(), d.cfg.maxReloads, d.cfg.reloadWindowMs);
    writeJson(RELOADS_KEY, r.history, session);
    if (r.allowed) {
      card("Let's restart!");
      window.setTimeout(reload, 1500);
    } else {
      card('Short break. Please ask the staff.');
    }
  };
  window.addEventListener('error', (e) => restart(`error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => restart(`rejection: ${String(e.reason)}`));
  d.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    restart('webgl context lost');
  });
  window.setInterval(() => {
    if (!document.hidden && performance.now() - d.lastFrameAt() > d.cfg.stallSeconds * 1000) restart('frame loop stalled');
  }, 1000);
  return { restart };
}
