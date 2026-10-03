import { describe, expect, it } from 'vitest';
import { resolveGesture } from '../../src/input/gestures';

const C = 500, MIN = 35;

describe('resolveGesture', () => {
  it('treats a tap by screen half', () => {
    expect(resolveGesture({ x: 100, y: 300 }, { x: 102, y: 301 }, C, MIN)).toBe(-1);
    expect(resolveGesture({ x: 900, y: 300 }, { x: 899, y: 300 }, C, MIN)).toBe(1);
  });
  it('follows a horizontal swipe even when it starts on the other half', () => {
    expect(resolveGesture({ x: 100, y: 300 }, { x: 220, y: 310 }, C, MIN)).toBe(1);
    expect(resolveGesture({ x: 900, y: 300 }, { x: 780, y: 290 }, C, MIN)).toBe(-1);
  });
  it('treats a mostly vertical drag as a tap', () => {
    expect(resolveGesture({ x: 900, y: 100 }, { x: 860, y: 400 }, C, MIN)).toBe(1);
  });
  it('falls back to the press position when the screen lost the release', () => {
    expect(resolveGesture({ x: 100, y: 300 }, null, C, MIN)).toBe(-1);
  });
});
