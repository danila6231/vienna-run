import { describe, expect, it } from 'vitest';
import { CONFIG, type GameConfig } from '../../src/config';
import { dodgeable, findDodge, makeDodgeable, type Swipe } from '../../src/core/dodge';
import { createRng, pick, randRange } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { applyPreset, buildConfig, defaultSettings } from '../../src/core/settings';
import { generateItems, layoutSeed } from '../../src/core/spawner';
import { isGood, type Item, type Lane, type RoadType } from '../../src/core/types';

/** 20 m/s all the way (a third of a metre per step), no ❓ rows. */
const road: GameConfig = { ...CONFIG, baseSpeed: 20, speedRamp: 0, runLength: 400, questions: { ...CONFIG.questions, enabled: false } };
let nextId = 1;
const mk = (at: number, lane: Lane, type: RoadType = 'bomb'): Item => ({ id: nextId++, at, lane, type, state: 'live', t: 0 });
/** Obstacles in every lane but `free`. */
const wall = (at: number, free: Lane): Item[] => ([-1, 0, 1] as Lane[]).filter((l) => l !== free).map((l) => mk(at, l));
const obstacles = (items: Item[]) => items.filter((i) => i.type !== 'question' && !isGood(i.type));

/** Plays the swipes in the real game and counts the obstacles hit. */
function replay(cfg: GameConfig, items: Item[], swipes: Swipe[]): number {
  const run = new Run({ seed: 1, config: cfg, items: items.map((i) => ({ ...i })) });
  let hits = 0;
  let next = 0;
  for (let step = 1; step <= 60 * 300 && !run.finished; step++) {
    while (next < swipes.length && swipes[next].step === step) run.move(swipes[next++].dir);
    for (const e of run.update(1 / 60)) {
      if (e.kind === 'hit') hits++;
      if (e.kind === 'question') run.answer(true);
    }
  }
  return hits;
}

describe('dodgeable', () => {
  it('finds a way down an empty road', () => {
    expect(dodgeable(road, [], 0.3)).toBe(true);
  });
  it('finds none through obstacles across all three lanes', () => {
    expect(dodgeable(road, [mk(100, -1), mk(100, 0), mk(100, 1)], 0.3)).toBe(false);
  });
  it('steps around an obstacle in the starting lane', () => {
    expect(dodgeable(road, [mk(100, 0)], 0.3)).toBe(true);
    expect(dodgeable(road, wall(100, 1), 0.3)).toBe(true);
  });
  it('needs time for two lane changes to cross from one side to the other', () => {
    // Out of the gap at -1 just after 101 m, two swipes 0.3 s (6 m) apart: in lane 1 by about 108 m.
    expect(dodgeable(road, [...wall(100, -1), ...wall(120, 1)], 0.3)).toBe(true);
    expect(dodgeable(road, [...wall(100, -1), ...wall(106, 1)], 0.3)).toBe(false);
  });
  it('never asks for two swipes closer together than the fastest move', () => {
    // 12 m (0.6 s) between the walls: room for swipes 0.3 s apart, not 0.6 s apart.
    const items = [...wall(100, -1), ...wall(112, 1)];
    expect(dodgeable(road, items, 0.3)).toBe(true);
    expect(dodgeable(road, items, 0.6)).toBe(false);
  });
  it('lets the runner keep going through a long corridor without moving', () => {
    const corridor = Array.from({ length: 40 }, (_, i) => wall(60 + i * 3, 0)).flat();
    expect(dodgeable(road, corridor, 1)).toBe(true);
  });
});

describe('findDodge', () => {
  it('gives swipes that hit nothing in the real game', () => {
    const rng = createRng(3);
    const speeds = [[14, 0.25], [25, 0.67], [33, 2.33], [111, 0]] as const;
    let found = 0;
    for (let n = 0; n < 120; n++) {
      const [base, ramp] = speeds[n % speeds.length];
      const cfg: GameConfig = { ...road, baseSpeed: base, speedRamp: ramp, runLength: base * 20 };
      const items: Item[] = [];
      for (let at = 30; at < cfg.runLength - 10; at += randRange(rng, 4, 30)) {
        if (rng() < 0.4) items.push(...wall(at, pick(rng, [-1, 0, 1] as const)));
        else items.push(mk(at, pick(rng, [-1, 0, 1] as const), pick(rng, ['bomb', 'krampus', 'piano'] as const)));
      }
      items.sort((a, b) => a.at - b.at);
      const fastest = pick(rng, [0.15, 0.3, 0.5]);
      const swipes = findDodge(cfg, items, fastest);
      expect(swipes !== null).toBe(dodgeable(cfg, items, fastest));
      if (!swipes) continue;
      found++;
      for (let i = 1; i < swipes.length; i++) expect(swipes[i].step - swipes[i - 1].step).toBeGreaterThanOrEqual(Math.round(fastest * 60));
      expect(replay(cfg, items, swipes)).toBe(0);
    }
    expect(found).toBeGreaterThan(50);
  });
  it('gives no swipes when there is no way through', () => {
    expect(findDodge(road, [mk(100, -1), mk(100, 0), mk(100, 1)], 0.3)).toBeNull();
  });
});

describe('makeDodgeable', () => {
  it('leaves a street with a way through as it is', () => {
    const items = [...wall(100, -1), ...wall(120, 1), mk(130, 0, 'piano')];
    expect(makeDodgeable(road, items, 0.3)).toEqual(items);
  });
  it('takes obstacles away until there is a way through, and no more', () => {
    const items = [mk(50, 1, 'piano'), ...wall(100, -1), ...wall(106, 1), mk(100, -1, 'violin')];
    const fixed = makeDodgeable(road, items, 0.3);
    expect(dodgeable(road, fixed, 0.3)).toBe(true);
    expect(obstacles(fixed)).toHaveLength(3);
    expect(fixed.filter((i) => i.type === 'piano' || i.type === 'violin')).toHaveLength(2);
  });
});

describe('the classic streets', () => {
  it.each(['easy', 'normal', 'hard'] as const)('can be dodged with a swipe every 0.3 s (%s)', (preset) => {
    const cfg = buildConfig(applyPreset(defaultSettings(), preset));
    expect(dodgeable(cfg, generateItems(createRng(layoutSeed(cfg)), cfg), 0.3)).toBe(true);
  });
  it('can be dodged in random mode too', () => {
    const cfg = buildConfig({ ...applyPreset(defaultSettings(), 'hard'), mode: 'random' });
    for (let s = 1; s <= 60; s++) expect(dodgeable(cfg, generateItems(createRng(s), cfg), 0.3)).toBe(true);
  });
});
