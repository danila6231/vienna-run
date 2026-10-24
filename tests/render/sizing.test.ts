import { describe, expect, it } from 'vitest';
import { fitSquare } from '../../src/render/sizing';

describe('art sizing', () => {
  it('fits any image inside a square box without stretching it', () => {
    expect(fitSquare(1, 1.7)).toEqual({ w: 1.7, h: 1.7 });
    expect(fitSquare(2, 1.7)).toEqual({ w: 1.7, h: 0.85 });
    expect(fitSquare(0.5, 1.7)).toEqual({ w: 0.85, h: 1.7 });
  });
  it('treats a broken zero-size image as square instead of producing Infinity', () => {
    expect(fitSquare(0, 1.7)).toEqual({ w: 1.7, h: 1.7 });
  });
});
