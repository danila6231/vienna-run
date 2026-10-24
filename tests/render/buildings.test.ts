import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildRoute, type LandmarkId } from '../../src/core/route';
import { backGeometry, BACK_VARIANTS, BACK_WIDTH, houseGeometry, HOUSE_DEPTH, HOUSE_VARIANTS, HOUSE_WIDTH, SIDE } from '../../src/render/buildings/house';
import { hofburg, karlskirche, riesenrad, stephansdom } from '../../src/render/buildings/landmarks3d';
import { PLACEMENTS, RIESENRAD } from '../../src/render/landmarks';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

// Street layout (src/render/street.ts): front facades stand at |x| = 7.9 and go back HOUSE_DEPTH; the back row starts
// at |x| = 13.5 and is BACK_WIDTH wide along the street. The sidewalk ends at |x| = 7.9.
const FRONT_X = 7.9, BACK_X = 13.5;

/**
 * Vertices of a placed landmark that would show through a house: rows hide houses whose centre is inside the plaza
 * (the back row with a 4 m margin), so outside it a landmark must keep half a house width clear of both rows.
 */
function overlaps(g: THREE.BufferGeometry, x0: number, rotY: number, plaza: readonly [number, number], past = 0): string[] {
  const pos = g.attributes.position, c = Math.cos(rotY), s = Math.sin(rotY), out: string[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ax = Math.abs(x0 + x * c + z * s), d = past - (-x * s + z * c);
    if (ax < FRONT_X + 0.3) out.push(`on the sidewalk at |x| ${ax.toFixed(2)}`);
    else if (ax < FRONT_X + HOUSE_DEPTH && (d < plaza[0] + HOUSE_WIDTH / 2 || d > plaza[1] - HOUSE_WIDTH / 2)) out.push(`in the front row at d ${d.toFixed(2)}`);
    else if (ax >= BACK_X && ax < BACK_X + 8 && (d < plaza[0] - 4 + BACK_WIDTH / 2 || d > plaza[1] + 4 - BACK_WIDTH / 2)) out.push(`in the back row at d ${d.toFixed(2)}`);
    if (out.length > 3) break;
  }
  return out;
}

const plazaOf = (id: LandmarkId) => buildRoute(600).landmarks.find((l) => l.id === id)!.plaza!;

describe('3D buildings', () => {
  it('builds every house to fit its 8 m slot, standing on the ground and facing the street', () => {
    for (let i = 0; i < HOUSE_VARIANTS; i++) {
      const g = houseGeometry(i), b = g.boundingBox!;
      // Side detail may reach SIDE into the neighbour's slot, where the neighbour's walls hide it.
      expect(b.min.x).toBeGreaterThanOrEqual(-HOUSE_WIDTH / 2 - SIDE - 1e-6);
      expect(b.max.x).toBeLessThanOrEqual(HOUSE_WIDTH / 2 + SIDE + 1e-6);
      expect(b.min.y).toBeCloseTo(0, 5);
      expect(b.max.y).toBeGreaterThan(9);
      expect(b.max.y).toBeLessThan(16);
      expect(b.min.z).toBeGreaterThanOrEqual(-HOUSE_DEPTH - 0.2);
      expect(b.max.z).toBeLessThan(1.2); // awnings reach furthest over the sidewalk
      expect(tris(g)).toBeLessThan(6000);
    }
  });

  it('puts windows on both side walls of every house', () => {
    for (let i = 0; i < HOUSE_VARIANTS; i++) {
      const pos = houseGeometry(i).attributes.position;
      let left = 0, right = 0;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k);
        if (x < -HOUSE_WIDTH / 2 - 0.005) left++;
        if (x > HOUSE_WIDTH / 2 + 0.005) right++;
      }
      expect(left).toBeGreaterThan(300);
      expect(right).toBeGreaterThan(300);
    }
  });

  it('builds a lite version of every house and back block, in the same slot, for far away and the low graphics level', () => {
    for (let i = 0; i < HOUSE_VARIANTS; i++) {
      const full = houseGeometry(i), lite = houseGeometry(i, true), b = lite.boundingBox!;
      expect(tris(lite)).toBeLessThan(tris(full) / 5);
      expect(b.max.x - b.min.x).toBeLessThanOrEqual(HOUSE_WIDTH + 1e-6);
      expect(b.max.y).toBeCloseTo(full.boundingBox!.max.y, 0); // same silhouette against the sky
    }
    for (let i = 0; i < BACK_VARIANTS; i++) expect(tris(backGeometry(i, true))).toBeLessThan(tris(backGeometry(i)) / 2);
  });

  it('builds the same house from the same variant number', () => {
    expect(Array.from(houseGeometry(5).attributes.position.array)).toEqual(Array.from(houseGeometry(5).attributes.position.array));
  });

  it('builds back-row blocks within their 10 m slot', () => {
    for (let i = 0; i < BACK_VARIANTS; i++) {
      const b = backGeometry(i).boundingBox!;
      expect(b.max.x - b.min.x).toBeLessThanOrEqual(BACK_WIDTH + 2 * SIDE + 0.01);
      expect(b.min.y).toBeCloseTo(0, 5);
    }
  });

  it.each([
    ['stephansdom', stephansdom, 32, 34],
    ['karlskirche', karlskirche, 21, 24],
    ['hofburg', hofburg, 19, 22.5],
  ] as const)('keeps %s inside its plaza and about as tall as the paper card was', (id, build, minH, maxH) => {
    const g = build();
    expect(g.boundingBox!.max.y).toBeGreaterThan(minH);
    expect(g.boundingBox!.max.y).toBeLessThan(maxH);
    expect(tris(g)).toBeLessThan(12000);
    const pl = PLACEMENTS[id];
    expect(overlaps(g, pl.x, pl.rotY, plazaOf(id))).toEqual([]);
  });

  it('keeps the Riesenrad and its cabins clear of the street', () => {
    const r = riesenrad();
    expect(overlaps(r.support, RIESENRAD.x, RIESENRAD.rotY, plazaOf('riesenrad'), RIESENRAD.past)).toEqual([]);
    // The wheel turns, so check its full circle (plus a hanging cabin) at the hub height.
    const reach = r.wheel.boundingSphere!.radius + 1.6;
    for (const z of [-1, 1]) {
      const ax = Math.abs(RIESENRAD.x + -reach * Math.cos(RIESENRAD.rotY) + z * Math.sin(RIESENRAD.rotY));
      expect(ax).toBeGreaterThan(FRONT_X + 0.3);
    }
    expect(r.hubY - r.cabinRadius - r.cabinDrop - 0.75).toBeGreaterThan(4.6); // cabins clear the base house roof
  });
});
