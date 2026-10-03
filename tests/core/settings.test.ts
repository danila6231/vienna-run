import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { scheduleSlots } from '../../src/core/questions';
import { createRng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import {
  applyPreset, buildConfig, defaultSettings, detectPreset, featuresOf, fromShareCode, minRoundSeconds, sanitize, toShareCode, validate,
} from '../../src/core/settings';

describe('defaults', () => {
  it('reproduce today\'s game', () => {
    const cfg = buildConfig(defaultSettings());
    expect(cfg.baseSpeed).toBeCloseTo(50 / 3.6);
    expect(cfg.baseSpeed * (1 + cfg.speedRamp)).toBeCloseTo(63 / 3.6);
    expect(cfg.runLength).toBeGreaterThan(590);
    expect(cfg.runLength).toBeLessThan(605);
    expect(cfg.spawn).toMatchObject({ obstacles: 11, treats: 31, mode: 'random' });
    expect(cfg.questions).toMatchObject({ perRun: 3, timeLimit: 10 });
    for (const [k, v] of Object.entries(CONFIG.items)) expect(cfg.items[k as keyof typeof CONFIG.items].points).toBe(v.points);
  });
  it('start in Normal with gifts hidden, questions and leaderboard on, PIN 2468, board "booth"', () => {
    const s = defaultSettings();
    expect(s.preset).toBe('normal');
    expect(featuresOf(s)).toEqual({ showGifts: false, leaderboard: true });
    expect(s.questions.enabled).toBe(true);
    expect(s.pin).toBe('2468');
    expect(s.leaderboard.board).toBe('booth');
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
    expect(sanitize({ ...defaultSettings(), preset: 'hard' }).preset).toBe('normal');
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
  it('reject codes that are not ours', () => {
    expect(fromShareCode('hello', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-!!!', defaultSettings())).toBeNull();
    expect(fromShareCode('VR1-NDI', defaultSettings())).toBeNull();
  });
});
