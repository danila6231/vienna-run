import type { GameConfig } from '../config';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type ItemType, type Lane } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap treats appear more often than the Sachertorte.
const GOOD_WEIGHTED: readonly ItemType[] = ['sacher', 'kipferl', 'kipferl', 'melange', 'melange', 'melange', 'mozart', 'mozart', 'mozart'];
/** Closest two patterns may sit, in metres, so every obstacle stays readable and dodgeable. */
export const MIN_PATTERN_SPACING = 14;

type Pattern = { kind: 'obstacle'; size: 1 | 2; reward: boolean } | { kind: 'line' } | { kind: 'zigzag' } | { kind: 'single' };

const clampLane = (l: number): Lane => Math.max(-1, Math.min(1, l)) as Lane;

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * 'fixed' mode places exactly `spawn.obstacles` obstacles and `spawn.treats` treats (only positions vary);
 * 'random' mode first draws this round's counts within ±35% of those targets.
 * Never blocks all three lanes, keeps the start and the finish clear, and thins out crowded settings.
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const { firstAt, finishClear, mode } = cfg.spawn;
  const lastAt = cfg.runLength - finishClear;
  const span = lastAt - firstAt;
  if (span <= 0) return [];
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

  // 4. Spread the patterns evenly along the playable stretch, with a little jitter.
  const spacing = span / Math.max(1, patterns.length);
  const lineStep = Math.min(4, spacing / 4);
  const zigStep = Math.min(5.5, spacing / 4);
  const items: Item[] = [];
  let id = 0;
  const add = (at: number, lane: Lane, type: ItemType) => {
    items.push({ id: ++id, at, lane, type, state: 'live', t: 0, question: false });
  };
  let lastFree: Lane | null = null;
  patterns.forEach((p, i) => {
    const extent = p.kind === 'line' ? 2 * lineStep : p.kind === 'zigzag' ? 2 * zigStep : p.kind === 'obstacle' && p.reward ? 2 : 0;
    const centre = firstAt + spacing * (i + 0.5) + randRange(rng, -0.15, 0.15) * spacing;
    const at = Math.min(Math.max(centre, firstAt), lastAt - extent - 0.5);
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
