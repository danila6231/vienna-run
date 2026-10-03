import { describe, expect, it } from 'vitest';
import { createRng, pick, randRange, shuffle } from '../../src/core/rng';

describe('createRng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng(42), b = createRng(42);
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()));
  });
  it('differs between seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
  it('stays within [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('helpers', () => {
  it('shuffle keeps every element', () => {
    expect(shuffle(createRng(3), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('pick returns a member', () => {
    expect(['a', 'b', 'c']).toContain(pick(createRng(9), ['a', 'b', 'c']));
  });
  it('randRange stays inside the range', () => {
    const r = createRng(5);
    for (let i = 0; i < 500; i++) {
      const v = randRange(r, 3, 4);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(4);
    }
  });
});
