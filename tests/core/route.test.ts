import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { inPlaza, LANDMARKS } from '../../src/core/route';

describe('route', () => {
  it('puts the Riesenrad at the finish line', () => {
    expect(LANDMARKS.find((l) => l.id === 'riesenrad')?.at).toBe(CONFIG.runLength);
  });
  it('opens a plaza only on the landmark side', () => {
    expect(inPlaza(65, 1)).toBe(true);
    expect(inPlaza(65, -1)).toBe(false);
    expect(inPlaza(150, 1)).toBe(false);
  });
  it('widens plazas by the margin', () => {
    expect(inPlaza(65 + 18, 1)).toBe(false);
    expect(inPlaza(65 + 18, 1, 4)).toBe(true);
  });
});
