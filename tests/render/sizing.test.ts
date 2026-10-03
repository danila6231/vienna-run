import { describe, expect, it } from 'vitest';
import { fitSquare, heightForWidth } from '../../src/render/sizing';

describe('art sizing', () => {
  it('fits any image inside a square box without stretching it', () => {
    expect(fitSquare(1, 1.7)).toEqual({ w: 1.7, h: 1.7 });
    expect(fitSquare(2, 1.7)).toEqual({ w: 1.7, h: 0.85 });
    expect(fitSquare(0.5, 1.7)).toEqual({ w: 0.85, h: 1.7 });
  });
  it('derives a card height from its fixed width and the image shape', () => {
    expect(heightForWidth(8, 2 / 3)).toBeCloseTo(12);
    expect(heightForWidth(8, 1)).toBe(8);
  });
  it('treats a broken zero-size image as square instead of producing Infinity', () => {
    expect(fitSquare(0, 1.7)).toEqual({ w: 1.7, h: 1.7 });
    expect(heightForWidth(8, 0)).toBe(8);
  });
});
