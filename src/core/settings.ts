import { CONFIG, type GameConfig, type Tier } from '../config';
import { createRng } from './rng';
import { generateItems } from './spawner';
import type { ItemType } from './types';

export type Preset = 'easy' | 'normal' | 'hard' | 'custom';
export type Mode = 'random' | 'fixed';

export interface Settings {
  version: 1;
  preset: Preset;
  roundSeconds: number;
  startSpeedKmh: number;
  endSpeedKmh: number;
  mode: Mode;
  obstacles: number;
  treats: number;
  points: Record<ItemType, number>;
  tiers: Tier[];
  showGifts: boolean;
  questions: { enabled: boolean; perRun: number; timeLimit: number };
  leaderboard: { enabled: boolean; board: string };
  /** 4 digits, stored as is: a 4-digit PIN has only 10,000 values, so hashing would add nothing. */
  pin: string;
}

/** Switches that change what the screens show (not the rules). */
export interface Features {
  showGifts: boolean;
  leaderboard: boolean;
}

type Difficulty = Pick<Settings, 'roundSeconds' | 'startSpeedKmh' | 'endSpeedKmh' | 'mode' | 'obstacles' | 'treats'>;
const DIFFICULTY_KEYS: ReadonlyArray<keyof Difficulty> = ['roundSeconds', 'startSpeedKmh', 'endSpeedKmh', 'mode', 'obstacles', 'treats'];

export const PRESETS: Record<Exclude<Preset, 'custom'>, Difficulty> = {
  easy: { roundSeconds: 38, startSpeedKmh: 40, endSpeedKmh: 50, mode: 'random', obstacles: 7, treats: 34 },
  normal: { roundSeconds: 38, startSpeedKmh: 50, endSpeedKmh: 63, mode: 'random', obstacles: 11, treats: 31 },
  hard: { roundSeconds: 38, startSpeedKmh: 58, endSpeedKmh: 76, mode: 'random', obstacles: 16, treats: 28 },
};

export const LIMITS = {
  roundSeconds: [20, 90],
  startSpeedKmh: [30, 90],
  endSpeedKmh: [30, 110],
  obstacles: [0, 40],
  treats: [5, 80],
  goodPoints: [1, 50],
  badPoints: [-50, -1],
  tierMin: [0, 999],
  perRun: [1, 5],
  timeLimit: [5, 15],
} as const;

export const BOARD_RE = /^[a-z0-9-]{1,24}$/;
const PIN_RE = /^\d{4}$/;

export function defaultSettings(): Settings {
  return {
    version: 1,
    preset: 'normal',
    ...PRESETS.normal,
    points: Object.fromEntries(Object.entries(CONFIG.items).map(([k, v]) => [k, v.points])) as Record<ItemType, number>,
    tiers: CONFIG.tiers.map((t) => ({ ...t })),
    showGifts: false,
    questions: { enabled: true, perRun: CONFIG.questions.perRun, timeLimit: CONFIG.questions.timeLimit },
    leaderboard: { enabled: true, board: 'booth' },
    pin: '2468',
  };
}

export function featuresOf(s: Settings): Features {
  return { showGifts: s.showGifts, leaderboard: s.leaderboard.enabled };
}

export function applyPreset(s: Settings, preset: Exclude<Preset, 'custom'>): Settings {
  return { ...s, ...PRESETS[preset], preset };
}

/** The named preset whose difficulty values all match, otherwise 'custom'. */
export function detectPreset(s: Settings): Preset {
  for (const p of ['easy', 'normal', 'hard'] as const) {
    if (DIFFICULTY_KEYS.every((k) => s[k] === PRESETS[p][k])) return p;
  }
  return 'custom';
}

/** Shortest round (seconds) that fits `perRun` question slots at least 4 s apart inside the question window. */
export function minRoundSeconds(perRun: number): number {
  return 12 + 4 * Math.max(0, perRun - 1);
}

const clamp = (v: unknown, range: readonly [number, number], fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(range[1], Math.max(range[0], Math.round(v))) : fallback;

function sanitizeTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) return null;
  const tiers: Tier[] = [];
  for (const entry of raw) {
    const o = entry as Partial<Tier>;
    if (typeof o.name !== 'string' || !o.name.trim() || o.name.trim().length > 24) return null;
    if (typeof o.min !== 'number' || !Number.isFinite(o.min)) return null;
    tiers.push({ name: o.name.trim(), min: clamp(o.min, LIMITS.tierMin, 0) });
  }
  tiers[0].min = 0;
  for (let i = 1; i < tiers.length; i++) if (tiers[i].min <= tiers[i - 1].min) return null;
  return tiers;
}

/** Anything (stored JSON, a pasted code) → valid settings. Bad fields fall back to defaults; numbers are clamped. */
export function sanitize(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const rawPoints = (r.points && typeof r.points === 'object' ? r.points : {}) as Record<string, unknown>;
  const points = { ...d.points };
  for (const k of Object.keys(points) as ItemType[]) {
    points[k] = clamp(rawPoints[k], CONFIG.items[k].good ? LIMITS.goodPoints : LIMITS.badPoints, d.points[k]);
  }
  const q = (r.questions && typeof r.questions === 'object' ? r.questions : {}) as Record<string, unknown>;
  const lb = (r.leaderboard && typeof r.leaderboard === 'object' ? r.leaderboard : {}) as Record<string, unknown>;
  const start = clamp(r.startSpeedKmh, LIMITS.startSpeedKmh, d.startSpeedKmh);
  const s: Settings = {
    version: 1,
    preset: 'normal',
    roundSeconds: clamp(r.roundSeconds, LIMITS.roundSeconds, d.roundSeconds),
    startSpeedKmh: start,
    endSpeedKmh: Math.max(start, clamp(r.endSpeedKmh, LIMITS.endSpeedKmh, d.endSpeedKmh)),
    mode: r.mode === 'fixed' ? 'fixed' : 'random',
    obstacles: clamp(r.obstacles, LIMITS.obstacles, d.obstacles),
    treats: clamp(r.treats, LIMITS.treats, d.treats),
    points,
    tiers: sanitizeTiers(r.tiers) ?? d.tiers,
    showGifts: typeof r.showGifts === 'boolean' ? r.showGifts : d.showGifts,
    questions: {
      enabled: typeof q.enabled === 'boolean' ? q.enabled : d.questions.enabled,
      perRun: clamp(q.perRun, LIMITS.perRun, d.questions.perRun),
      timeLimit: clamp(q.timeLimit, LIMITS.timeLimit, d.questions.timeLimit),
    },
    leaderboard: {
      enabled: typeof lb.enabled === 'boolean' ? lb.enabled : d.leaderboard.enabled,
      board: typeof lb.board === 'string' && BOARD_RE.test(lb.board) ? lb.board : d.leaderboard.board,
    },
    pin: typeof r.pin === 'string' && PIN_RE.test(r.pin) ? r.pin : d.pin,
  };
  s.preset = detectPreset(s);
  return s;
}

/** Human-readable reasons the menu must not save these settings (empty = fine). */
export function validate(s: Settings): string[] {
  const problems: string[] = [];
  if (s.questions.enabled && s.roundSeconds < minRoundSeconds(s.questions.perRun)) {
    problems.push(`${s.questions.perRun} questions need a round of at least ${minRoundSeconds(s.questions.perRun)} s.`);
  }
  if (s.endSpeedKmh < s.startSpeedKmh) problems.push('End speed must be at least the start speed.');
  if (!PIN_RE.test(s.pin)) problems.push('The PIN must be exactly 4 digits.');
  if (!BOARD_RE.test(s.leaderboard.board)) problems.push('Board name: 1–24 lowercase letters, digits or "-".');
  const tiersOk =
    s.tiers.length >= 1 && s.tiers.length <= 6 && s.tiers[0].min === 0 &&
    s.tiers.every((t, i) => t.name.trim().length > 0 && t.name.trim().length <= 24 && Number.isInteger(t.min) && t.min <= LIMITS.tierMin[1] && (i === 0 || t.min > s.tiers[i - 1].min));
  if (!tiersOk) problems.push('Gift tiers need names and rising minimum scores, starting at 0.');
  return problems;
}

const FIT_SEEDS = [1, 2, 3, 4, 5];

/**
 * Non-blocking notes for the menu: counts this round cannot fit at its length and speeds
 * (the spawner keeps obstacles readable by leaving treats, then obstacles, out).
 */
export function warnings(s: Settings): string[] {
  const cfg = buildConfig(s);
  const exact: GameConfig = { ...cfg, spawn: { ...cfg.spawn, mode: 'fixed' } };
  let bad = 0;
  let good = 0;
  for (const seed of FIT_SEEDS) {
    for (const it of generateItems(createRng(seed), exact)) {
      if (cfg.items[it.type].good) good++;
      else bad++;
    }
  }
  const avg = (n: number) => Math.round(n / FIT_SEEDS.length);
  const notes: string[] = [];
  if (avg(bad) < s.obstacles * 0.9) notes.push(`Only about ${avg(bad)} of ${s.obstacles} obstacles fit in a round this long at these speeds.`);
  if (avg(good) < s.treats * 0.9) notes.push(`Only about ${avg(good)} of ${s.treats} treats fit in a round this long at these speeds; the rest are left out.`);
  return notes;
}

/** Settings → the config the rules run on. Always returns a playable config, even from unsaved/invalid input. */
export function buildConfig(s: Settings, base: GameConfig = CONFIG): GameConfig {
  const start = s.startSpeedKmh / 3.6;
  const end = Math.max(start, s.endSpeedKmh / 3.6);
  const runLength = Math.round((s.roundSeconds * (start + end)) / 2);
  const windowStart = 4;
  const windowEnd = Math.max(windowStart, s.roundSeconds - 8);
  let perRun = s.questions.enabled ? s.questions.perRun : 0;
  const minGap = perRun > 1 ? Math.max(4, Math.min(7, (windowEnd - windowStart) / (perRun - 1))) : 7;
  // Defensive: never ask scheduleSlots for more slots than fit (it throws), whatever got past validation.
  while (perRun > 1 && windowEnd - windowStart < (perRun - 1) * minGap) perRun--;
  const items = Object.fromEntries(
    Object.entries(base.items).map(([k, v]) => [k, { ...v, points: s.points[k as ItemType] ?? v.points }]),
  ) as GameConfig['items'];
  return {
    ...base,
    baseSpeed: start,
    speedRamp: end / start - 1,
    runLength,
    items,
    spawn: { firstAt: Math.round(start * 2.4), finishClear: Math.round(end * 2.4), obstacles: s.obstacles, treats: s.treats, mode: s.mode },
    questions: { ...base.questions, perRun, windowStart, windowEnd, minGap, timeLimit: s.questions.timeLimit },
    tiers: s.tiers.map((t) => ({ ...t })),
  };
}

const SHARE_PREFIX = 'VR1-';

function toBase64Url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** A copy/paste code with every setting except the PIN and the leaderboard (each device keeps its own board). */
export function toShareCode(s: Settings): string {
  const copy: Partial<Settings> = { ...s };
  delete copy.pin;
  delete copy.leaderboard;
  return SHARE_PREFIX + toBase64Url(JSON.stringify(copy));
}

/** Settings from a share code (keeping this device's PIN and leaderboard), or null if the code is not valid. */
export function fromShareCode(code: string, current: Settings): Settings | null {
  const c = code.trim();
  if (!c.startsWith(SHARE_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(c.slice(SHARE_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return sanitize({ ...(parsed as object), pin: current.pin, leaderboard: { ...current.leaderboard } });
  } catch {
    return null;
  }
}
