import { describe, expect, it } from 'vitest';
import { CONFIG, type GameConfig } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { generateItems } from '../../src/core/spawner';
import type { Item } from '../../src/core/types';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const withSpawn = (spawn: Partial<GameConfig['spawn']>, extra: Partial<GameConfig> = {}): GameConfig => ({ ...CONFIG, ...extra, spawn: { ...CONFIG.spawn, ...spawn } });
const run = (seed: number, cfg: GameConfig = CONFIG) => generateItems(createRng(seed), cfg);
const good = (items: Item[]) => items.filter((i) => CONFIG.items[i.type].good);
const bad = (items: Item[]) => items.filter((i) => !CONFIG.items[i.type].good);
/** Obstacles grouped by position: each group is one obstacle pattern. */
const obstacleGroups = (items: Item[]) => {
  const groups: Item[][] = [];
  for (const o of bad(items)) {
    const g = groups.find((x) => Math.abs(x[0].at - o.at) < 0.5);
    if (g) g.push(o);
    else groups.push([o]);
  }
  return groups.sort((a, b) => a[0].at - b[0].at);
};

describe('generateItems', () => {
  it('is deterministic for a seed', () => {
    expect(run(11)).toEqual(run(11));
  });
  it.each(['random', 'fixed'] as const)('keeps items inside the playable stretch (%s mode)', (mode) => {
    const cfg = withSpawn({ mode });
    for (const s of seeds) for (const it of run(s, cfg)) {
      expect(it.at).toBeGreaterThanOrEqual(cfg.spawn.firstAt);
      expect(it.at).toBeLessThan(cfg.runLength - cfg.spawn.finishClear);
    }
  });
  it('returns items sorted by distance', () => {
    for (const s of seeds) {
      const items = run(s);
      for (let i = 1; i < items.length; i++) expect(items[i].at).toBeGreaterThanOrEqual(items[i - 1].at);
    }
  });
  it('never blocks all three lanes with obstacles', () => {
    for (const mode of ['random', 'fixed'] as const) for (const s of seeds) {
      const items = bad(run(s, withSpawn({ mode, obstacles: 30 })));
      for (const b of items) {
        const lanes = new Set(items.filter((o) => Math.abs(o.at - b.at) < 3).map((o) => o.lane));
        expect(lanes.size).toBeLessThan(3);
      }
    }
  });
  it('keeps the next escape lane within one step of the previous one', () => {
    for (const s of seeds) {
      const groups = obstacleGroups(run(s, withSpawn({ mode: 'fixed', obstacles: 20 })));
      const free = groups.map((g) => [-1, 0, 1].filter((l) => !g.some((o) => o.lane === l)));
      for (let i = 1; i < free.length; i++) {
        expect(free[i].some((f) => free[i - 1].some((p) => Math.abs(f - p) <= 1))).toBe(true);
      }
    }
  });
  it.each([[10, 30], [0, 20], [20, 5], [11, 31]])('fixed mode places exactly %i obstacles and %i treats', (o, t) => {
    const cfg = withSpawn({ mode: 'fixed', obstacles: o, treats: t });
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      expect(bad(items)).toHaveLength(o);
      expect(good(items)).toHaveLength(t);
    }
  });
  it('random mode varies each round around the targets', () => {
    const counts = seeds.map((s) => run(s)).map((items) => [bad(items).length, good(items).length]);
    const avgBad = counts.reduce((a, [b]) => a + b, 0) / counts.length;
    const avgGood = counts.reduce((a, [, g]) => a + g, 0) / counts.length;
    expect(avgBad).toBeGreaterThan(CONFIG.spawn.obstacles * 0.9);
    expect(avgBad).toBeLessThan(CONFIG.spawn.obstacles * 1.1);
    expect(avgGood).toBeGreaterThan(CONFIG.spawn.treats * 0.9);
    expect(avgGood).toBeLessThan(CONFIG.spawn.treats * 1.1);
    const bads = counts.map(([b]) => b);
    expect(Math.max(...bads) - Math.min(...bads)).toBeGreaterThanOrEqual(4);
  });
  it('thins out settings too crowded for a short route so obstacles stay readable', () => {
    const cfg = withSpawn({ mode: 'fixed', obstacles: 40, treats: 80 }, { runLength: 300 });
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      expect(bad(items).length).toBeLessThanOrEqual(40);
      const groups = obstacleGroups(items);
      for (let i = 1; i < groups.length; i++) expect(groups[i][0].at - groups[i - 1][0].at).toBeGreaterThan(9);
    }
  });
  it('places enough treats for every question slot', () => {
    for (const s of seeds) expect(good(run(s)).length).toBeGreaterThanOrEqual(14);
  });
});
