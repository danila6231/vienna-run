import { describe, expect, it } from 'vitest';
import { buildRoute } from '../../src/core/route';

describe('buildRoute', () => {
  it.each([300, 600, 1200])('puts the Riesenrad at the finish of a %i m route', (len) => {
    const r = buildRoute(len);
    expect(r.length).toBe(len);
    expect(r.landmarks.find((l) => l.id === 'riesenrad')?.at).toBe(len);
  });
  it('spaces the stops in proportion to the route length', () => {
    expect(buildRoute(600).landmarks[0].at).toBe(65);
    expect(buildRoute(1200).landmarks[0].at).toBe(130);
  });
  it('opens a plaza only on the landmark side', () => {
    const r = buildRoute(600);
    expect(r.inPlaza(65, 1)).toBe(true);
    expect(r.inPlaza(65, -1)).toBe(false);
    expect(r.inPlaza(150, 1)).toBe(false);
  });
  it('widens plazas by the margin', () => {
    const r = buildRoute(600);
    expect(r.inPlaza(65 + 18, 1)).toBe(false);
    expect(r.inPlaza(65 + 18, 1, 4)).toBe(true);
  });
});
