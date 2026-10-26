import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { scheduleSlots } from '../../src/core/questions';
import { createRng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import {
  applyPreset, buildConfig, defaultSettings, detectPreset, featuresOf, fromShareCode, minRoundSeconds, sanitize, toShareCode, validate, warnings,
} from '../../src/core/settings';

describe('defaults', () => {
  it("are the booth's tuned round", () => {
    const cfg = buildConfig(defaultSettings());
    expect(cfg.baseSpeed).toBeCloseTo(90 / 3.6);
    expect(cfg.baseSpeed * (1 + cfg.speedRamp)).toBeCloseTo(110 / 3.6);
    expect(cfg.runLength).toBe(1250);
    expect(cfg.spawn).toMatchObject({ obstacles: 40, treats: 75, mode: 'fixed' });
    expect(cfg.questions).toMatchObject({ perRun: 0, timeLimit: 10 });
    for (const [k, v] of Object.entries(CONFIG.items)) expect(cfg.items[k as keyof typeof CONFIG.items].points).toBe(v.points);
    expect(warnings(defaultSettings())).toEqual([]);
  });
  it('start Custom with gifts and questions off, leaderboard on, PIN 2468, board "booth"', () => {
    const s = defaultSettings();
    expect(s.preset).toBe('custom');
    expect(featuresOf(s)).toEqual({ showGifts: false, leaderboard: true });
    expect(s.questions.enabled).toBe(false);
    expect(s.pin).toBe('2468');
    expect(s.leaderboard.board).toBe('booth');
    expect(s.street).toBe('3d');
  });
});

describe('presets', () => {
  it('fill the difficulty values', () => {
    const hard = applyPreset(defaultSettings(), 'hard');
    expect(hard).toMatchObject({ preset: 'hard', startSpeedKmh: 58, endSpeedKmh: 76, obstacles: 16, treats: 28 });
  });
  it('turn into Custom once a value is edited', () => {
    const s = { ...applyPreset(defaultSettings(), 'easy'), obstacles: 9 };
    expect(detectPreset(s)).toBe('custom');
  });
});

describe('buildConfig', () => {
  it('switches questions off completely', () => {
    const cfg = buildConfig({ ...defaultSettings(), questions: { enabled: false, perRun: 3, timeLimit: 10 } });
    expect(cfg.questions.perRun).toBe(0);
    expect(scheduleSlots(createRng(1), cfg.questions)).toEqual([]);
  });
  it('scales the run length and question window with the round length', () => {
    const cfg = buildConfig({ ...defaultSettings(), roundSeconds: 60 });
    expect(cfg.runLength).toBeGreaterThan(900);
    expect(cfg.questions.windowEnd).toBe(52);
  });
  it('never builds a round that crashes, even from settings that failed validation', () => {
    const s = { ...defaultSettings(), roundSeconds: 20, questions: { enabled: true, perRun: 5, timeLimit: 10 } };
    expect(validate(s).length).toBeGreaterThan(0);
    expect(() => new Run({ seed: 1, config: buildConfig(s) })).not.toThrow();
  });
});

describe('validate', () => {
  it('explains when the round is too short for the questions', () => {
    const s = { ...defaultSettings(), roundSeconds: 20, questions: { enabled: true, perRun: 5, timeLimit: 10 } };
    expect(validate(s)).toContain(`5 questions need a round of at least ${minRoundSeconds(5)} s.`);
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
    expect(s.roundSeconds).toBe(90);
    expect(s.endSpeedKmh).toBe(80);
    expect(s.obstacles).toBe(0);
  });
  it('re-detects the preset instead of trusting the stored label', () => {
    expect(sanitize({ ...applyPreset(defaultSettings(), 'normal'), preset: 'hard' }).preset).toBe('normal');
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
  it('say nothing for the presets', () => {
    for (const p of ['easy', 'normal', 'hard'] as const) expect(warnings(applyPreset(defaultSettings(), p))).toEqual([]);
  });
  it('explain when a short, slow round cannot fit the rewards', () => {
    const w = warnings({ ...applyPreset(defaultSettings(), 'normal'), roundSeconds: 20, startSpeedKmh: 30, endSpeedKmh: 30 });
    expect(w.join(' ')).toMatch(/about \d+ of 31 rewards fit/);
  });
  it('explain when too many items are asked for', () => {
    const w = warnings({ ...applyPreset(defaultSettings(), 'normal'), obstacles: 40, treats: 80 });
    expect(w.join(' ')).toMatch(/of 80 rewards fit/);
  });
});
