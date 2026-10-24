import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometry helpers for the 3D buildings. Nothing here touches the DOM, so the builders run in unit tests.

export type BuildingStyle = 'stylized' | 'lowpoly' | 'realistic';
export const BUILDING_STYLES: readonly BuildingStyle[] = ['stylized', 'lowpoly', 'realistic'];

/** How much geometry a style spends: 0 keeps the massing only, 1 adds frames and mouldings, 2 the small details. */
export type Detail = 0 | 1 | 2;
export const DETAIL: Record<BuildingStyle, Detail> = { lowpoly: 0, stylized: 1, realistic: 2 };

/** A rectangle of the shared texture atlas, in UV units (v up). */
export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const A = 1024;
/** Atlas rectangle from canvas pixels (y down, as the canvas is painted). */
const px = (x: number, y: number, w: number, h: number): UvRect => ({ u0: x / A, v0: 1 - (y + h) / A, u1: (x + w) / A, v1: 1 - y / A });

/** Where things live in the atlas (painted by `paintAtlas` in materials.ts). Everything not listed is white. */
export const ATLAS = {
  size: A,
  white: px(8, 8, 48, 48),
  glass: px(64, 0, 128, 128),
  shop: px(192, 0, 128, 128),
  tiles: px(640, 128, 384, 384),
  /** Shop sign `i`: board and lettering. Signs are 8:1. */
  sign: (i: number): UvRect => px(0, 128 + (i % SIGN_COUNT) * 80, 640, 80),
} as const;
export const SIGN_COUNT = 6;

export type Vec3 = readonly [number, number, number];

export interface PartOptions {
  at?: Vec3;
  /** Euler angles (XYZ order), radians. */
  rot?: Vec3;
  scale?: Vec3;
  /** Map the part's own UVs into this atlas rectangle; without it the part samples plain white. */
  uv?: UvRect;
  /** Multiplies the colour: below 1 for recesses and undersides. */
  shade?: number;
}

const KEEP = new Set(['position', 'normal', 'uv']);

/**
 * Collects coloured parts and merges them into one geometry, so a whole building is one mesh, one material and
 * one draw call. Colours go into vertex colours; `uv` points into the atlas; `uv1` is a box projection in metres
 * for tiling detail maps (plaster) on the realistic look.
 */
export class Parts {
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly color = new THREE.Color();
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();

  get size(): number {
    return this.geos.length;
  }

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOptions = {}): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
    g.clearGroups();
    this.matrix.compose(
      this.pos.set(...(o.at ?? [0, 0, 0])),
      this.quat.setFromEuler(this.euler.set(...(o.rot ?? [0, 0, 0]))),
      this.scl.set(...(o.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(this.matrix);
    const n = g.attributes.position.count;
    this.color.set(color).multiplyScalar(o.shade ?? 1);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([this.color.r, this.color.g, this.color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(atlasUvs(g.attributes.uv as THREE.BufferAttribute | undefined, n, o.uv), 2));
    this.geos.push(g);
    return this;
  }

  /** A box centred on (x, y, z). */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, o: PartOptions = {}): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, { ...o, at: [x, y, z] });
  }

  /** A box spanning the given ranges (min..max on each axis): easier to read for walls and bands. */
  span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.ColorRepresentation, o: PartOptions = {}): this {
    return this.box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, color, o);
  }

  /**
   * Merges everything. `ground` darkens the bottom metres a little (light bouncing off the street never quite
   * reaches the plinth), and every downward face is darker too: a cheap stand-in for ambient occlusion.
   */
  build(o: { ground?: number } = {}): THREE.BufferGeometry {
    const g = mergeGeometries(this.geos);
    if (!g) throw new Error('Parts.build: parts have different attributes');
    for (const part of this.geos) part.dispose();
    this.geos.length = 0;
    const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color;
    const n = pos.count;
    const uv1 = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (o.ground) k *= 1 - o.ground * (1 - THREE.MathUtils.smoothstep(pos.getY(i), 0, 3));
      if (nor.getY(i) < -0.6) k *= 0.72;
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)] : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
      uv1[i * 2] = u * 0.5;
      uv1[i * 2 + 1] = v * 0.5;
    }
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** The part's own UVs squeezed into `rect` (normalised to their own range first), or the white texel everywhere. */
function atlasUvs(uv: THREE.BufferAttribute | undefined, n: number, rect?: UvRect): Float32Array {
  const out = new Float32Array(n * 2);
  if (!rect || !uv) {
    const w = ATLAS.white, cu = (w.u0 + w.u1) / 2, cv = (w.v0 + w.v1) / 2;
    for (let i = 0; i < n; i++) out.set([cu, cv], i * 2);
    return out;
  }
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < n; i++) {
    u0 = Math.min(u0, uv.getX(i));
    u1 = Math.max(u1, uv.getX(i));
    v0 = Math.min(v0, uv.getY(i));
    v1 = Math.max(v1, uv.getY(i));
  }
  const du = u1 - u0 || 1, dv = v1 - v0 || 1;
  for (let i = 0; i < n; i++) {
    out[i * 2] = rect.u0 + ((uv.getX(i) - u0) / du) * (rect.u1 - rect.u0);
    out[i * 2 + 1] = rect.v0 + ((uv.getY(i) - v0) / dv) * (rect.v1 - rect.v0);
  }
  return out;
}

/** A flat shape (in the XY plane) extruded `depth` towards +z, starting at z = 0. */
export function extrude(points: ReadonlyArray<readonly [number, number]>, depth: number, holes: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [], curveSegments = 6): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
}

/** A profile drawn in the (z, y) plane, extruded along x over `length`, centred on x = 0: roofs and prisms. */
export function prismX(profile: ReadonlyArray<readonly [number, number]>, length: number): THREE.BufferGeometry {
  const g = extrude(profile, length);
  // Shape (u, v) extruded along w → (x, y, z) = (length/2 - w, v, u). A proper rotation, so faces keep their winding.
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, length / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return g;
}

/** Points of a pointed (Gothic) arch window, base centred on the origin. */
export function lancet(w: number, h: number, steps = 6): Array<[number, number]> {
  const r = w, spring = h - w * 0.87;
  const pts: Array<[number, number]> = [[-w / 2, 0], [w / 2, 0], [w / 2, spring]];
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 3);
    pts.push([w / 2 - r + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  for (let i = steps - 1; i >= 1; i--) {
    const a = (i / steps) * (Math.PI / 3);
    pts.push([-w / 2 + r - r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  pts.push([-w / 2, spring]);
  return pts;
}

/** Points of a round-headed arch, base centred on the origin. */
export function roundArch(w: number, h: number, steps = 8): Array<[number, number]> {
  const r = w / 2, spring = h - r;
  const pts: Array<[number, number]> = [[-r, 0], [r, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push([r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  return pts;
}

/** An arch-shaped frame band (outer W×H around an inner w×h opening, open at the bottom), base centred on the origin. */
export function archRing(W: number, H: number, w: number, h: number, steps = 8): Array<[number, number]> {
  const R = W / 2, r = w / 2, so = H - R, si = h - r;
  const pts: Array<[number, number]> = [[-R, 0], [-r, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    pts.push([r * Math.cos(a), si + r * Math.sin(a)]);
  }
  pts.push([r, 0], [R, 0]);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push([R * Math.cos(a), so + R * Math.sin(a)]);
  }
  return pts;
}

/** Deterministic 0..1 noise for small per-building variation. */
export const hash01 = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Mixes two hex colours (`t` = share of `b`). */
export function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
