import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/app/loop';

const count = (s: FixedStepper, frames: number, frameSeconds: number) => {
  let n = 0;
  for (let i = 0; i < frames; i++) n += s.advance(frameSeconds, () => undefined);
  return n;
};

describe('FixedStepper', () => {
  it('runs one step per 60 Hz frame', () => {
    const n = count(new FixedStepper(), 60, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(59);
    expect(n).toBeLessThanOrEqual(60);
  });
  it('runs proportionally more steps at a higher speed', () => {
    const n = count(new FixedStepper(1 / 60, 4, 5), 60, 1 / 60);
    expect(n).toBeGreaterThanOrEqual(238);
    expect(n).toBeLessThanOrEqual(240);
  });
  it('caps the catch-up after a long stall instead of spiralling', () => {
    expect(new FixedStepper(1 / 60, 1, 5).advance(2, () => undefined)).toBe(5);
  });
  it('passes the fixed step to the callback', () => {
    const seen: number[] = [];
    new FixedStepper(1 / 60).advance(1 / 30, (dt) => seen.push(dt));
    expect(seen.every((dt) => dt === 1 / 60)).toBe(true);
  });
});
