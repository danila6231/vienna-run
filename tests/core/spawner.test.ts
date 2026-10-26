import { describe, expect, it } from 'vitest';
import { CONFIG, type GameConfig } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { buildConfig, defaultSettings } from '../../src/core/settings';
import { generateItems, layoutSeed, PACE, ROW_CLEAR, timeAt } from '../../src/core/spawner';
import { isGood, type Item } from '../../src/core/types';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const withSpawn = (spawn: Partial<GameConfig['spawn']>, extra: Partial<GameConfig> = {}): GameConfig => ({ ...CONFIG, ...extra, spawn: { ...CONFIG.spawn, ...spawn } });
const run = (seed: number, cfg: GameConfig = CONFIG) => generateItems(createRng(seed), cfg);
const good = (items: Item[]) => items.filter((i) => i.type !== 'question' && isGood(i.type));
const bad = (items: Item[]) => items.filter((i) => i.type !== 'question' && !isGood(i.type));
const asks = (items: Item[]) => items.filter((i) => i.type === 'question');
const noQuestions = (cfg: GameConfig): GameConfig => ({ ...cfg, questions: { ...cfg.questions, enabled: false } });
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
  it.each(['random', 'fixed'] as const)('keeps items inside the playable stretch with questions off (%s mode)', (mode) => {
    const cfg = noQuestions(withSpawn({ mode }));
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
});

describe('pace', () => {
  const booth = buildConfig(defaultSettings());
  const boothRun = (seed: number) => generateItems(createRng(seed), booth);

  it.each([['booth', booth], ['default', CONFIG], ['busy', withSpawn({ mode: 'fixed', obstacles: 30, treats: 80 })]])('never puts more than three rewards in a row in one lane (%s)', (_name, cfg) => {
    for (const s of seeds.slice(0, 60)) {
      const rewards = good(generateItems(createRng(s), cfg));
      let streak = 1;
      for (let i = 1; i < rewards.length; i++) {
        streak = rewards[i].lane === rewards[i - 1].lane ? streak + 1 : 1;
        expect(streak).toBeLessThanOrEqual(PACE.maxLine);
      }
    }
  });
  it('starts gently: only single obstacles in the first seconds', () => {
    for (const s of seeds.slice(0, 40)) {
      for (const g of obstacleGroups(boothRun(s))) if (timeAt(booth, g[0].at) < PACE.gentleSeconds) expect(g).toHaveLength(1);
    }
  });
  it('blocks two lanes in about half the obstacle patterns', () => {
    const groups = seeds.slice(0, 40).flatMap((s) => obstacleGroups(boothRun(s)));
    const share = groups.filter((g) => g.length === 2).length / groups.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });
  it('never asks for a lane change between obstacles too close to change lanes in time', () => {
    for (const s of seeds.slice(0, 60)) {
      const groups = obstacleGroups(boothRun(s));
      for (let i = 1; i < groups.length; i++) {
        if (timeAt(booth, groups[i][0].at) - timeAt(booth, groups[i - 1][0].at) >= PACE.moveSeconds) continue;
        const open = [-1, 0, 1].filter((l) => !groups[i].some((o) => o.lane === l) && !groups[i - 1].some((o) => o.lane === l));
        expect(open.length).toBeGreaterThan(0);
      }
    }
  });
  it('keeps a player who only dodges on the move, with breathers only around the ❓ rows', () => {
    for (const s of seeds.slice(0, 30)) {
      const items = boothRun(s);
      const rows = [...new Set(asks(items).map((i) => timeAt(booth, i.at)))];
      let lane = 0, moves = 0, since = 0, longest = 0;
      for (const g of obstacleGroups(items)) {
        if (!g.some((o) => o.lane === lane)) continue;
        const t = timeAt(booth, g[0].at);
        if (since > PACE.gentleSeconds && !rows.some((r) => r > since && r < t)) longest = Math.max(longest, t - since);
        lane = [-1, 0, 1].filter((l) => !g.some((o) => o.lane === l)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))[0];
        since = t;
        moves++;
      }
      expect(moves).toBeGreaterThanOrEqual(20);
      expect(longest).toBeLessThan(5);
    }
  });
});

describe('question rows', () => {
  const speedAt = (cfg: GameConfig, d: number) => cfg.baseSpeed * (1 + cfg.speedRamp * (d / cfg.runLength));
  it('cross the road twice, one ❓ per lane: halfway (Level 1) and right before the finish line (Level 2)', () => {
    const endSpeed = CONFIG.baseSpeed * (1 + CONFIG.speedRamp);
    const lastRow = CONFIG.runLength - CONFIG.questions.lastRowLead * endSpeed;
    expect(CONFIG.runLength - lastRow).toBeLessThanOrEqual(endSpeed);
    for (const s of seeds.slice(0, 20)) {
      const q = asks(run(s));
      expect(q).toHaveLength(6);
      for (const [level, at] of [[1, CONFIG.runLength / 2], [2, lastRow]] as const) {
        const row = q.filter((i) => i.level === level);
        expect(row.map((i) => i.lane).sort()).toEqual([-1, 0, 1]);
        for (const i of row) expect(i.at).toBeCloseTo(at, 6);
      }
    }
  });
  it.each([['default', CONFIG], ['crowded', withSpawn({ mode: 'fixed', obstacles: 40, treats: 80 })]])('keep obstacles and rewards clear of both rows (%s)', (_name, cfg) => {
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      const rows = [...new Set(asks(items).map((i) => i.at))];
      for (const it of items) {
        if (it.type === 'question') continue;
        for (const r of rows) {
          const v = speedAt(cfg, r);
          if (it.at < r) expect(r - it.at).toBeGreaterThanOrEqual(ROW_CLEAR.before * v - 1e-6);
          else expect(it.at - r).toBeGreaterThanOrEqual(ROW_CLEAR.after * v - 1e-6);
        }
      }
    }
  });
  it('let rewards and obstacles run on into the old finish stretch, up to the last row\'s run-up', () => {
    const oldEnd = CONFIG.runLength - CONFIG.spawn.finishClear;
    const lastRow = CONFIG.runLength - CONFIG.questions.lastRowLead * CONFIG.baseSpeed * (1 + CONFIG.speedRamp);
    const runUp = lastRow - ROW_CLEAR.before * speedAt(CONFIG, lastRow);
    const latest = seeds.map((s) => Math.max(...run(s).filter((i) => i.type !== 'question').map((i) => i.at)));
    expect(latest.some((at) => at > oldEnd)).toBe(true);
    for (const at of latest) expect(at).toBeLessThan(runUp);
  });
  it('still place exactly the asked counts in fixed mode', () => {
    const cfg = withSpawn({ mode: 'fixed', obstacles: 11, treats: 31 });
    for (const s of seeds.slice(0, 50)) {
      const items = run(s, cfg);
      expect(bad(items)).toHaveLength(11);
      expect(good(items)).toHaveLength(31);
    }
  });
  it('are left out when questions are off', () => {
    for (const s of seeds.slice(0, 20)) expect(asks(run(s, noQuestions(CONFIG)))).toEqual([]);
  });
});

describe('timeAt', () => {
  it('matches the run: speed ramping up evenly with distance', () => {
    const cfg = buildConfig(defaultSettings());
    expect(timeAt(cfg, cfg.runLength)).toBeCloseTo(45, 1);
    expect(timeAt({ ...cfg, speedRamp: 0 }, 100)).toBeCloseTo(100 / cfg.baseSpeed, 6);
  });
});

describe('layoutSeed', () => {
  it('changes only with the layout seed and the settings that shape the street', () => {
    const s = defaultSettings();
    const seed = layoutSeed(buildConfig(s));
    expect(layoutSeed(buildConfig({ ...s, points: { ...s.points, piano: 40 }, tiers: [{ min: 0, name: 'Pen' }] }))).toBe(seed);
    expect(layoutSeed(buildConfig({ ...s, seed: s.seed + 1 }))).not.toBe(seed);
    expect(layoutSeed(buildConfig({ ...s, treats: s.treats - 1 }))).not.toBe(seed);
    expect(layoutSeed(buildConfig({ ...s, roundSeconds: s.roundSeconds + 1 }))).not.toBe(seed);
    expect(layoutSeed(buildConfig({ ...s, startSpeedKmh: s.startSpeedKmh - 10 }))).not.toBe(seed);
  });
});
