import { describe, expect, it } from 'vitest';
import { reach } from '../../src/render/reach';

const kmh = (v: number) => v / 3.6;

describe('reach', () => {
  it("leaves the view as it always was up to Hard's top speed", () => {
    for (const v of [0, 30, 110, 150, 170]) expect(reach(kmh(v))).toEqual({ fogNear: 60, fogFar: 210, items: 230, scale: 1 });
  });
  it('pushes the fog and the items further out above that', () => {
    const at250 = reach(kmh(250));
    expect(at250.scale).toBeGreaterThan(1.3);
    expect(at250.fogFar).toBeGreaterThan(280);
    expect(at250.items).toBeGreaterThan(300);
  });
  it('draws the items at least 3 s ahead at 400 km/h, the far end of the houses still lost in fog', () => {
    const r = reach(kmh(400));
    expect(r.items / kmh(400)).toBeGreaterThanOrEqual(3);
    // The houses end 300 m ahead (see street.ts): at least 90% fog there.
    expect((300 - r.fogNear) / (r.fogFar - r.fogNear)).toBeGreaterThanOrEqual(0.9);
  });
});
