import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import {
  applyPreset, buildConfig, defaultSettings, detectPreset, featuresOf, fromShareCode, sanitize, toShareCode, validate, warnings,
} from '../../src/core/settings';
import { generateItems, timeAt } from '../../src/core/spawner';

describe('defaults', () => {
  it("are the booth's tuned round", () => {
    const cfg = buildConfig(defaultSettings());
    expect(cfg.baseSpeed).toBeCloseTo(90 / 3.6);
    expect(cfg.baseSpeed * (1 + cfg.speedRamp)).toBeCloseTo(150 / 3.6);
    expect(cfg.runLength).toBe(1468);
    expect(cfg.spawn).toMatchObject({ obstacles: 80, treats: 65, mode: 'fixed' });
    expect(cfg.questions).toMatchObject({ enabled: true, points: { 1: 15, 2: 20 }, timeLimit: 10 });
    for (const [k, v] of Object.entries(CONFIG.items)) expect(cfg.items[k as keyof typeof CONFIG.items].points).toBe(v.points);
    expect(warnings(defaultSettings())).toEqual([]);
  });
  it('start on Normal with gifts off, questions and leaderboard on, PIN 2468, board "booth"', () => {
    const s = defaultSettings();
    expect(s.preset).toBe('normal');
    expect(detectPreset(s)).toBe('normal');
    expect(featuresOf(s)).toEqual({ showGifts: false, leaderboard: true });
    expect(s.questions).toEqual({ enabled: true, level1Points: 15, level2Points: 20, timeLimit: 10 });
    expect(s.pin).toBe('2468');
    expect(s.leaderboard.board).toBe('booth');
    expect(s.street).toBe('3d');
  });
});

describe('presets', () => {
  it('fill the difficulty values', () => {
    const hard = applyPreset(defaultSettings(), 'hard');
    expect(hard).toMatchObject({ preset: 'hard', roundSeconds: 45, startSpeedKmh: 110, endSpeedKmh: 170, obstacles: 80, treats: 65 });
    expect(applyPreset(defaultSettings(), 'easy')).toMatchObject({ roundSeconds: 45, startSpeedKmh: 70, endSpeedKmh: 110, obstacles: 50, treats: 65 });
  });
  it('add Impossible: 120 → 400 km/h through bomb walls, a swipe needed every 0.3 s at most', () => {
    const s = applyPreset(defaultSettings(), 'impossible');
    expect(s).toMatchObject({ preset: 'impossible', roundSeconds: 45, startSpeedKmh: 120, endSpeedKmh: 400, mode: 'fixed', obstacleStyle: 'walls', fastestMoveMs: 300, treats: 65 });
    expect(s.obstacles).toBeGreaterThan(80);
    expect(detectPreset(s)).toBe('impossible');
    expect(warnings(s)).toEqual([]);
  });
  it('keep the classic obstacles on Easy, Normal and Hard', () => {
    for (const p of ['easy', 'normal', 'hard'] as const) expect(applyPreset(defaultSettings(), p).obstacleStyle).toBe('classic');
  });
  it('turn into Custom once a value is edited', () => {
    const s = { ...applyPreset(defaultSettings(), 'easy'), obstacles: 9 };
    expect(detectPreset(s)).toBe('custom');
  });
});

describe('buildConfig', () => {
  it('passes the obstacle style and the fastest move (in seconds) to the street', () => {
    const cfg = buildConfig({ ...defaultSettings(), obstacleStyle: 'walls', fastestMoveMs: 250 });
    expect(cfg.spawn).toMatchObject({ style: 'walls', fastestMove: 0.25 });
  });
  it('switches questions off completely: no ❓ rows on the road', () => {
    const cfg = buildConfig({ ...defaultSettings(), questions: { ...defaultSettings().questions, enabled: false } });
    expect(cfg.questions.enabled).toBe(false);
    expect(generateItems(createRng(1), cfg).filter((i) => i.type === 'question')).toEqual([]);
  });
  it('passes the points for each question level', () => {
    const cfg = buildConfig({ ...defaultSettings(), questions: { ...defaultSettings().questions, level1Points: 12, level2Points: 30 } });
    expect(cfg.questions.points).toEqual({ 1: 12, 2: 30 });
  });
  it('scales the run length with the round length', () => {
    const cfg = buildConfig({ ...defaultSettings(), roundSeconds: 60 });
    expect(cfg.runLength).toBeGreaterThan(900);
  });
  it('builds a round with both ❓ rows even at the shortest, slowest settings', () => {
    const s = { ...defaultSettings(), roundSeconds: 20, startSpeedKmh: 30, endSpeedKmh: 30 };
    expect(validate(s)).toEqual([]);
    const run = new Run({ seed: 1, config: buildConfig(s) });
    const rows = [...new Set(run.items.filter((i) => i.type === 'question').map((i) => i.at))];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBeGreaterThan(buildConfig(s).spawn.firstAt);
  });
});

describe('validate', () => {
  it('accepts the defaults', () => {
    expect(validate(defaultSettings())).toEqual([]);
  });
  it('rejects a bad PIN, board name or gift ladder', () => {
    expect(validate({ ...defaultSettings(), pin: '12a4' }).length).toBe(1);
    expect(validate({ ...defaultSettings(), leaderboard: { enabled: true, board: 'Booth 1' } }).length).toBe(1);
    expect(validate({ ...defaultSettings(), tiers: [{ name: 'A', min: 0 }, { name: 'B', min: 0 }] }).length).toBe(1);
    expect(validate({ ...defaultSettings(), tiers: [{ name: 'A', min: 0 }, { name: 'B', min: 1500 }] }).length).toBe(1);
  });
});

describe('sanitize', () => {
  it('turns garbage into defaults', () => {
    expect(sanitize(null)).toEqual(defaultSettings());
    expect(sanitize('nope')).toEqual(defaultSettings());
    expect(sanitize({ roundSeconds: 'x', tiers: 7, pin: 1234, leaderboard: { board: '!!' } })).toEqual(defaultSettings());
  });
  it('clamps values into range and keeps end speed ≥ start speed', () => {
    const s = sanitize({ ...defaultSettings(), roundSeconds: 500, startSpeedKmh: 80, endSpeedKmh: 40, obstacles: -3 });
    expect(s.roundSeconds).toBe(180);
    expect(s.endSpeedKmh).toBe(80);
    expect(s.obstacles).toBe(0);
  });
  it('lets a round go up to 400 km/h with 600 obstacles and 300 rewards, and no further', () => {
    const top = sanitize({ ...defaultSettings(), roundSeconds: 10, startSpeedKmh: 400, endSpeedKmh: 400, obstacles: 600, treats: 0 });
    expect(top).toMatchObject({ roundSeconds: 10, startSpeedKmh: 400, endSpeedKmh: 400, obstacles: 600, treats: 0 });
    const over = sanitize({ ...defaultSettings(), roundSeconds: 9, startSpeedKmh: 900, endSpeedKmh: 900, obstacles: 9999, treats: 9999 });
    expect(over).toMatchObject({ roundSeconds: 10, startSpeedKmh: 400, endSpeedKmh: 400, obstacles: 600, treats: 300 });
  });
  it('keeps the fastest move between 150 ms and 1 s and the obstacle style known', () => {
    expect(sanitize({ ...defaultSettings(), fastestMoveMs: 20 }).fastestMoveMs).toBe(150);
    expect(sanitize({ ...defaultSettings(), fastestMoveMs: 5000 }).fastestMoveMs).toBe(1000);
    expect(sanitize({ ...defaultSettings(), obstacleStyle: 'walls' }).obstacleStyle).toBe('walls');
    expect(sanitize({ ...defaultSettings(), obstacleStyle: 'maze' }).obstacleStyle).toBe('classic');
  });
  it('reads settings saved before Impossible came as they were', () => {
    const { obstacleStyle: _style, fastestMoveMs: _move, ...old } = applyPreset(defaultSettings(), 'hard');
    expect(sanitize(old)).toMatchObject({ preset: 'hard', obstacleStyle: 'classic', fastestMoveMs: 300 });
  });
  it('re-detects the preset instead of trusting the stored label', () => {
    expect(sanitize({ ...applyPreset(defaultSettings(), 'normal'), preset: 'hard' }).preset).toBe('normal');
  });
  it('keeps question points in range and drops the old questions-per-round setting', () => {
    const s = sanitize({ ...defaultSettings(), questions: { enabled: false, perRun: 3, level1Points: 500, level2Points: 'x', timeLimit: 10 } });
    expect(s.questions).toEqual({ enabled: false, level1Points: 100, level2Points: 20, timeLimit: 10 });
  });
  it('keeps sound on unless it was switched off', () => {
    expect(defaultSettings().sound).toBe(true);
    expect(sanitize({ ...defaultSettings(), sound: false }).sound).toBe(false);
    expect(sanitize({ ...defaultSettings(), sound: 'off' }).sound).toBe(true);
  });
  it('keeps a known street look and falls back to 3D for anything else', () => {
    expect(sanitize({ ...defaultSettings(), street: 'paper' }).street).toBe('paper');
    expect(sanitize({ ...defaultSettings(), street: 'vr' }).street).toBe('3d');
  });
  it('keeps the default item layout when the stored one is missing or unknown', () => {
    expect(sanitize({ ...defaultSettings(), mode: 'zigzag' }).mode).toBe('fixed');
    expect(sanitize({ ...defaultSettings(), mode: 'random' }).mode).toBe('random');
  });
  it('keeps a whole-number layout seed in range, starting at 1', () => {
    expect(defaultSettings().seed).toBe(1);
    expect(sanitize({ ...defaultSettings(), seed: 42.4 }).seed).toBe(42);
    expect(sanitize({ ...defaultSettings(), seed: 1e9 }).seed).toBe(9999);
    expect(sanitize({ ...defaultSettings(), seed: 'x' }).seed).toBe(1);
    expect(buildConfig({ ...defaultSettings(), seed: 7 }).spawn.seed).toBe(7);
  });
  it('keeps the layout seed when a preset is picked', () => {
    expect(applyPreset({ ...defaultSettings(), seed: 5 }, 'hard').seed).toBe(5);
  });
  it('carries points saved under the old treat names over to the music rewards', () => {
    const old = { ...defaultSettings(), points: { sacher: 30, kipferl: 20, melange: 8, mozart: 4, krampus: -20, bomb: -25 } };
    expect(sanitize(old).points).toEqual({ piano: 30, violin: 20, sheet: 8, notes: 4, krampus: -20, bomb: -25 });
    expect(sanitize({ ...defaultSettings(), points: { ...defaultSettings().points, piano: 12, sacher: 30 } }).points.piano).toBe(12);
  });
});

describe('share codes', () => {
  it('round-trip every setting except the PIN', () => {
    const tuned = { ...applyPreset(defaultSettings(), 'hard'), obstacles: 20, pin: '9999', tiers: [{ name: 'Bánh quy', min: 0 }, { name: 'Gấu bông', min: 150 }] };
    const code = toShareCode(tuned);
    expect(code.startsWith('VR1-')).toBe(true);
    expect(code).not.toContain('9999');
    const loaded = fromShareCode(code, defaultSettings());
    expect(loaded).toEqual({ ...tuned, preset: 'custom', pin: '2468' });
  });
  it("never mute or unmute a device from another device's code", () => {
    const quiet = { ...defaultSettings(), sound: false };
    expect(toShareCode(quiet)).not.toContain('sound');
    expect(fromShareCode(toShareCode(quiet), defaultSettings())?.sound).toBe(true);
    expect(fromShareCode(toShareCode(defaultSettings()), quiet)?.sound).toBe(false);
  });
  it("never move a device to another device's street look", () => {
    const booth = { ...defaultSettings(), street: 'paper' as const };
    const laptop = defaultSettings();
    expect(fromShareCode(toShareCode(booth), laptop)?.street).toBe('3d');
    expect(fromShareCode(toShareCode(laptop), booth)?.street).toBe('paper');
  });
  it("never move a device to another device's board", () => {
    const booth = { ...defaultSettings(), obstacles: 18, leaderboard: { enabled: true, board: 'booth' } };
    const laptop = { ...defaultSettings(), leaderboard: { enabled: false, board: 'test' } };
    const loaded = fromShareCode(toShareCode(booth), laptop);
    expect(loaded?.obstacles).toBe(18);
    expect(loaded?.leaderboard).toEqual({ enabled: false, board: 'test' });
    expect(atob(toShareCode(booth).slice(4).replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('leaderboard');
  });
  it('reject codes that are not ours', () => {
    expect(fromShareCode('hello', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-!!!', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-NDI', defaultSettings())).toBeNull();
  });
});

describe('warnings', () => {
  it('say nothing for the presets, and every preset lasts its 45 s', () => {
    for (const p of ['easy', 'normal', 'hard'] as const) {
      const s = applyPreset(defaultSettings(), p);
      expect(warnings(s)).toEqual([]);
      expect(timeAt(buildConfig(s), buildConfig(s).runLength)).toBeCloseTo(45, 1);
    }
  });
  it('explain when a short, slow round cannot fit the rewards', () => {
    const w = warnings({ ...applyPreset(defaultSettings(), 'normal'), roundSeconds: 20, startSpeedKmh: 30, endSpeedKmh: 30 });
    expect(w.join(' ')).toMatch(/about \d+ of 65 rewards fit/);
  });
  it('explain when too many items are asked for', () => {
    const w = warnings({ ...applyPreset(defaultSettings(), 'normal'), roundSeconds: 10, obstacles: 600, treats: 300 });
    expect(w.join(' ')).toMatch(/of 600 obstacles fit/);
    expect(w.join(' ')).toMatch(/of 300 rewards fit/);
  });
});
