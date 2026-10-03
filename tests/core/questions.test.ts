import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { pickQuestions, scheduleSlots, shuffleOptions, updateRecent, validateBank } from '../../src/core/questions';
import { createRng } from '../../src/core/rng';
import bankJson from '../../src/data/questions.json';

const bank = validateBank(bankJson);

describe('scheduleSlots', () => {
  it.each([3, 4])('places exactly %i slots inside the window with the minimum gap', (perRun) => {
    const q = { ...CONFIG.questions, perRun };
    for (let s = 1; s <= 500; s++) {
      const slots = scheduleSlots(createRng(s), q);
      expect(slots).toHaveLength(perRun);
      expect(slots[0]).toBeGreaterThanOrEqual(q.windowStart);
      expect(slots[slots.length - 1]).toBeLessThanOrEqual(q.windowEnd);
      for (let i = 1; i < slots.length; i++) expect(slots[i] - slots[i - 1]).toBeGreaterThanOrEqual(q.minGap - 1e-9);
    }
  });
  it('refuses a window too small for the slots', () => {
    expect(() => scheduleSlots(createRng(1), { ...CONFIG.questions, perRun: 6, windowStart: 4, windowEnd: 20 })).toThrow(/window/);
  });
});

describe('pickQuestions', () => {
  it('picks distinct questions', () => {
    const picked = pickQuestions(createRng(4), bank, 3, []);
    expect(new Set(picked.map((q) => q.id)).size).toBe(3);
  });
  it('skips recently used questions when enough remain', () => {
    const recent = bank.slice(0, bank.length - 3).map((q) => q.id);
    const picked = pickQuestions(createRng(4), bank, 3, recent);
    for (const q of picked) expect(recent).not.toContain(q.id);
  });
  it('falls back to the whole bank when too few fresh questions remain', () => {
    const recent = bank.map((q) => q.id);
    expect(pickQuestions(createRng(4), bank, 3, recent)).toHaveLength(3);
  });
  it('shuffles the options the same way in both languages and keeps the right answer right', () => {
    const original = bank[0];
    for (let s = 1; s < 30; s++) {
      const q = shuffleOptions(createRng(s), original);
      for (const lang of ['vi', 'en'] as const) {
        expect(q[lang].options[q.answer]).toBe(original[lang].options[original.answer]);
        expect([...q[lang].options].sort()).toEqual([...original[lang].options].sort());
      }
      expect(q.vi.options.map((o) => original.vi.options.indexOf(o))).toEqual(q.en.options.map((o) => original.en.options.indexOf(o)));
    }
  });
});

describe('updateRecent', () => {
  it('keeps only the last N runs', () => {
    expect(updateRecent([['a'], ['b'], ['c']], ['d'], 3)).toEqual([['b'], ['c'], ['d']]);
  });
});

describe('question bank', () => {
  it('has at least 30 valid questions, each in Vietnamese and English', () => {
    expect(bank.length).toBeGreaterThanOrEqual(30);
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length);
    for (const q of bank) {
      expect(q.vi.q).not.toBe(q.en.q);
      expect(q.vi.options).toHaveLength(3);
    }
  });
  it('rejects malformed entries with a readable message', () => {
    const good = { id: 'x', answer: 0, en: { q: 'Q?', options: ['a', 'b', 'c'] }, vi: { q: 'H?', options: ['a', 'b', 'c'] } };
    expect(validateBank([good])).toHaveLength(1);
    expect(() => validateBank([{ ...good, vi: { q: 'H?', options: ['a', 'a', 'b'] } }])).toThrow(/x \(vi\): options must differ/);
    expect(() => validateBank([{ ...good, en: { q: 'Q?', options: ['a', 'b'] } }])).toThrow(/x \(en\): needs exactly 3 options/);
    expect(() => validateBank([{ ...good, en: { q: ' ', options: ['a', 'b', 'c'] } }])).toThrow(/x \(en\): empty text/);
    expect(() => validateBank([{ id: 'y', answer: 0, en: good.en }])).toThrow(/y \(vi\)/);
    expect(() => validateBank([{ ...good, answer: 3 }])).toThrow(/answer must be 0, 1 or 2/);
  });
});
