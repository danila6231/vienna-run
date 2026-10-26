import type { GameConfig } from '../config';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type Lane, type QuestionLevel, type RoadType } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap rewards appear more often than the piano.
const GOOD_WEIGHTED: readonly RoadType[] = ['piano', 'violin', 'violin', 'sheet', 'sheet', 'sheet', 'notes', 'notes', 'notes'];
/** Closest two patterns may sit, in metres, so every obstacle stays readable and dodgeable. */
export const MIN_PATTERN_SPACING = 14;
/** Seconds of road kept free of obstacles and rewards before and after each ❓ row. */
export const ROW_CLEAR = { before: 1.5, after: 2 };

type Pattern = { kind: 'obstacle'; size: 1 | 2; reward: boolean } | { kind: 'line' } | { kind: 'zigzag' } | { kind: 'single' };

const clampLane = (l: number): Lane => Math.max(-1, Math.min(1, l)) as Lane;

/** Where the ❓ rows cross the road: halfway (Level 1) and `lastRowLead` seconds before the finish (Level 2). */
export function questionRows(cfg: GameConfig): Array<{ at: number; level: QuestionLevel }> {
  if (!cfg.questions.enabled) return [];
  const endSpeed = cfg.baseSpeed * (1 + cfg.speedRamp);
  return [
    { at: cfg.runLength / 2, level: 1 },
    { at: cfg.runLength - cfg.questions.lastRowLead * endSpeed, level: 2 },
  ];
}

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * 'fixed' mode places exactly `spawn.obstacles` obstacles and `spawn.treats` treats (run it with `layoutSeed`
 * so their places match too);
 * 'random' mode first draws this round's counts within ±35% of those targets.
 * Never blocks all three lanes, keeps the start and the finish clear, and thins out crowded settings.
 * With questions on, two rows of ❓ cross all three lanes, with a little empty road around each.
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const { firstAt, finishClear, mode } = cfg.spawn;
  const lastAt = cfg.runLength - finishClear;
  const items: Item[] = [];
  let id = 0;
  const add = (at: number, lane: Lane, type: RoadType, level?: QuestionLevel) => {
    items.push({ id: ++id, at, lane, type, state: 'live', t: 0, level });
  };
  const rows = questionRows(cfg);
  for (const r of rows) for (const lane of LANES) add(r.at, lane, 'question', r.level);
  // The playable stretch minus the empty road around the rows: patterns go into these segments.
  const speedAt = (d: number) => cfg.baseSpeed * (1 + cfg.speedRamp * (d / cfg.runLength));
  const segments: Array<readonly [number, number]> = [];
  let from = firstAt;
  for (const r of rows) {
    const gapStart = Math.min(r.at - ROW_CLEAR.before * speedAt(r.at), lastAt);
    if (gapStart > from) segments.push([from, gapStart]);
    from = Math.max(from, r.at + ROW_CLEAR.after * speedAt(r.at));
  }
  if (lastAt > from) segments.push([from, lastAt]);
  const span = segments.reduce((n, [a, b]) => n + b - a, 0);
  if (span <= 0) return items;
  const vary = (n: number) => Math.max(0, mode === 'fixed' ? Math.round(n) : Math.round(n * randRange(rng, 0.65, 1.35)));
  let bad = vary(cfg.spawn.obstacles);
  let good = vary(cfg.spawn.treats);

  // 1. Obstacle patterns: one or two obstacles side by side; a single one may carry a reward treat in a free lane.
  const patterns: Pattern[] = [];
  while (bad > 0) {
    const size: 1 | 2 = bad >= 2 && rng() < 0.3 ? 2 : 1;
    const reward = size === 1 && good > 0 && rng() < 0.5;
    if (reward) good--;
    patterns.push({ kind: 'obstacle', size, reward });
    bad -= size;
  }
  // 2. Treat patterns: lines and zigzags of three, and singles.
  while (good > 0) {
    if (good >= 3 && rng() < 0.6) {
      patterns.push({ kind: rng() < 0.5 ? 'line' : 'zigzag' });
      good -= 3;
    } else {
      patterns.push({ kind: 'single' });
      good--;
    }
  }
  // 3. Too crowded for this route? Drop treat patterns first, then obstacles.
  while (patterns.length > 0 && span / patterns.length < MIN_PATTERN_SPACING) {
    let drop = patterns.length - 1;
    for (let i = patterns.length - 1; i >= 0; i--) {
      if (patterns[i].kind !== 'obstacle') {
        drop = i;
        break;
      }
    }
    patterns.splice(drop, 1);
  }
  shuffle(rng, patterns);

  // 4. Spread the patterns evenly along the segments, with a little jitter; `u` is metres of segment road.
  const spacing = span / Math.max(1, patterns.length);
  const lineStep = Math.min(4, spacing / 4);
  const zigStep = Math.min(5.5, spacing / 4);
  const onRoad = (u: number): { d: number; seg: readonly [number, number] } => {
    let left = Math.max(0, u);
    for (const seg of segments) {
      if (left <= seg[1] - seg[0]) return { d: seg[0] + left, seg };
      left -= seg[1] - seg[0];
    }
    const seg = segments[segments.length - 1];
    return { d: seg[1], seg };
  };
  let lastFree: Lane | null = null;
  patterns.forEach((p, i) => {
    const extent = p.kind === 'line' ? 2 * lineStep : p.kind === 'zigzag' ? 2 * zigStep : p.kind === 'obstacle' && p.reward ? 2 : 0;
    const { d, seg } = onRoad(spacing * (i + 0.5) + randRange(rng, -0.15, 0.15) * spacing);
    const at = Math.min(Math.max(d, seg[0]), seg[1] - extent - 0.5);
    if (p.kind === 'obstacle') {
      // Keep the escape lane within one step of the previous one, so every gap can be reached in time.
      const free: Lane = lastFree === null ? pick(rng, LANES) : clampLane(lastFree + pick(rng, [-1, 0, 1]));
      const blocked = shuffle(rng, LANES.filter((l) => l !== free)).slice(0, p.size);
      for (const l of blocked) add(at, l, pick(rng, BAD_TYPES));
      if (p.reward) add(at + 2, free, pick(rng, GOOD_WEIGHTED));
      lastFree = free;
    } else if (p.kind === 'line') {
      const lane = pick(rng, LANES);
      const type = pick(rng, GOOD_WEIGHTED);
      for (let k = 0; k < 3; k++) add(at + k * lineStep, lane, type);
    } else if (p.kind === 'zigzag') {
      let lane = pick(rng, LANES);
      for (let k = 0; k < 3; k++) {
        add(at + k * zigStep, lane, pick(rng, GOOD_WEIGHTED));
        lane = clampLane(lane + (rng() < 0.5 ? -1 : 1));
      }
    } else {
      add(at, pick(rng, LANES), pick(rng, GOOD_WEIGHTED));
    }
  });
  return items.sort((a, b) => a.at - b.at);
}

/**
 * The seed for 'fixed' mode: a hash of the staff's layout seed and every setting that shapes a run (route length,
 * item counts and clear stretches, the ❓ rows; round length and speeds set these), so every round on every
 * device with the same settings plays the same street. Points and prizes don't move anything, so they leave it alone.
 */
export function layoutSeed(cfg: GameConfig): number {
  const { runLength, spawn: s, questions: q } = cfg;
  const key = JSON.stringify([s.seed, runLength, s.firstAt, s.finishClear, s.obstacles, s.treats, q.enabled]);
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
