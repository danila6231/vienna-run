import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { generateItems } from '../../src/core/spawner';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const run = (seed: number) => generateItems(createRng(seed), CONFIG);

describe('generateItems', () => {
  it('is deterministic for a seed', () => {
    expect(run(11)).toEqual(run(11));
  });
  it('keeps items between the first spawn point and the finish clearing', () => {
    for (const s of seeds) for (const it of run(s)) {
      expect(it.at).toBeGreaterThanOrEqual(CONFIG.spawn.firstAt);
      expect(it.at).toBeLessThan(CONFIG.runLength - CONFIG.spawn.finishClear);
    }
  });
  it('returns items sorted by distance', () => {
    for (const s of seeds) {
      const items = run(s);
      for (let i = 1; i < items.length; i++) expect(items[i].at).toBeGreaterThanOrEqual(items[i - 1].at);
    }
  });
  it('never blocks all three lanes with obstacles', () => {
    for (const s of seeds) {
      const bad = run(s).filter((i) => !CONFIG.items[i.type].good);
      for (const b of bad) {
        const lanes = new Set(bad.filter((o) => Math.abs(o.at - b.at) < 3).map((o) => o.lane));
        expect(lanes.size).toBeLessThan(3);
      }
    }
  });
  it('places enough treats for every question slot, plus some obstacles', () => {
    for (const s of seeds) {
      const items = run(s);
      expect(items.filter((i) => CONFIG.items[i.type].good).length).toBeGreaterThanOrEqual(14);
      expect(items.filter((i) => !CONFIG.items[i.type].good).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('averages near the spec density (about 24 treats and 10 obstacles)', () => {
    const all = seeds.map(run);
    const avg = (f: (n: ReturnType<typeof run>) => number) => all.reduce((a, items) => a + f(items), 0) / all.length;
    const good = avg((items) => items.filter((i) => CONFIG.items[i.type].good).length);
    const bad = avg((items) => items.filter((i) => !CONFIG.items[i.type].good).length);
    expect(good).toBeGreaterThan(20);
    expect(good).toBeLessThan(40);
    expect(bad).toBeGreaterThan(6);
    expect(bad).toBeLessThan(16);
  });
});
