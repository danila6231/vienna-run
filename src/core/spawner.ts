import type { GameConfig } from '../config';
import { pick, randRange, shuffle, type Rng } from './rng';
import { BAD_TYPES, type Item, type ItemType, type Lane } from './types';

const LANES: readonly Lane[] = [-1, 0, 1];
// Cheap treats appear more often than the Sachertorte.
const GOOD_WEIGHTED: readonly ItemType[] = ['sacher', 'kipferl', 'kipferl', 'melange', 'melange', 'melange', 'mozart', 'mozart', 'mozart'];

/**
 * Lays out every item for one run, front to back. Same seed, same layout.
 * Pattern gaps target the spec's density: roughly 25–35 treats and about 10 obstacles per run.
 */
export function generateItems(rng: Rng, cfg: GameConfig): Item[] {
  const items: Item[] = [];
  let id = 0;
  const lastAt = cfg.runLength - cfg.spawn.finishClear;
  const add = (at: number, lane: Lane, type: ItemType) => {
    if (at < lastAt) items.push({ id: ++id, at, lane, type, state: 'live', t: 0, question: false });
  };
  let at = cfg.spawn.firstAt;
  while (at < lastAt) {
    const r = rng();
    if (r < 0.2) {
      // A line of three of the same treat.
      const lane = pick(rng, LANES);
      const type = pick(rng, GOOD_WEIGHTED);
      for (let i = 0; i < 3; i++) add(at + i * 4, lane, type);
      at += randRange(rng, 30, 36);
    } else if (r < 0.6) {
      // Obstacles with at least one open lane.
      const [a, b] = shuffle(rng, [...LANES]);
      add(at, a, pick(rng, BAD_TYPES));
      if (rng() < 0.4) add(at, b, pick(rng, BAD_TYPES));
      else add(at + 2, b, pick(rng, GOOD_WEIGHTED));
      at += randRange(rng, 22, 28);
    } else if (r < 0.75) {
      // A zigzag of treats.
      let lane = pick(rng, LANES);
      for (let i = 0; i < 3; i++) {
        add(at + i * 5.5, lane, pick(rng, GOOD_WEIGHTED));
        lane = Math.max(-1, Math.min(1, lane + (rng() < 0.5 ? -1 : 1))) as Lane;
      }
      at += randRange(rng, 32, 38);
    } else {
      add(at, pick(rng, LANES), pick(rng, GOOD_WEIGHTED));
      at += randRange(rng, 16, 20);
    }
  }
  return items;
}
