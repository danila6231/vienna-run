import * as THREE from 'three';
import { FACADE_PAL } from '../placeholders/paint';
import { ATLAS, extrude, hash01, mix, Parts, prismX, SIGN_COUNT } from './kit';

// Viennese row houses for the street, in the local frame the facade rows use: the front is the plane z = 0 facing
// +z, the 8 m width runs along x (centred), the base is y = 0 and the house goes back towards -z.
// Side walls carry windows and the returns of the cornices and bands: neighbours hide them, but they show above a
// lower neighbour and at the plazas. Side detail stands at most SIDE out of the 8 m slot, inside the neighbour.

export const HOUSE_WIDTH = 8;
export const HOUSE_DEPTH = 5.4;
export const BACK_WIDTH = 10;
export const BACK_DEPTH = 8;
export const HOUSE_VARIANTS = 12;
export const BACK_VARIANTS = 5;
/** How far side-wall detail may stand out of a house's slot. */
export const SIDE = 0.12;

const W = HOUSE_WIDTH, D = HOUSE_DEPTH;
const R = 0.16; // how deep windows sit behind the facade
const G = 3.4; // ground floor (shops) height
const FLOOR = 2.4; // upper floor height
const WIN_X = [-3.2, -1.6, 0, 1.6, 3.2];
const WIN_W = 0.78;
const WIN_H = 1.35;
const SILL = 0.55; // window bottom above the floor line
const SIDE_WIN_Z = [-1.75, -3.85];

const ROOFS = ['gable', 'dome', 'attic', 'mansard', 'gable', 'attic'] as const;
type Roof = (typeof ROOFS)[number];
const FRIEZE = [0.45, 0.85, 0.3, 1.0, 0.6, 0.4];

const GLASS = '#4e607a';
const WOOD = '#5a3a2a';
const FRAME_DARK = '#3b3540';
const IRON = '#2b2b30';
const TILE = '#9a5b48';
const SLATE = '#5c6470';
const COPPER = '#6f9f8b';
const GOLD = '#d9b44a';
const STONE = '#8c8378';
const BRICK = '#9c6b5a';
const STRIPE = '#fbf3dc';
const PIPE = '#6b6f74';

export interface HouseSpec {
  pal: { base: string; trim: string; shade: string };
  roof: Roof;
  frieze: number;
  pilasters: boolean;
  balcony: boolean;
  awning: string;
  sign: number;
}

/** Variant `i`: the first six match the paper facades (palette, roof, sign); the next six recombine them. */
export function houseSpec(i: number): HouseSpec {
  const second = Math.floor(i / 6) % 2 === 1;
  return {
    pal: FACADE_PAL[i % 6],
    roof: ROOFS[(i + (second ? 3 : 0)) % 6],
    frieze: FRIEZE[(i + (second ? 2 : 0)) % 6],
    pilasters: (i % 2 === 0) !== second,
    balcony: i % 3 === 1,
    awning: i % 3 === 0 ? '#2f6b55' : '#c8423b',
    sign: (i + (second ? 3 : 0)) % SIGN_COUNT,
  };
}

/**
 * A window on a side wall (s = -1 left, 1 right), its glass centred at depth z and height cy. `base` lifts it off
 * whatever band already covers the wall there.
 */
function sideWindow(p: Parts, s: number, z: number, cy: number, w: number, h: number, trim: string, glassRect = ATLAS.glass, base = 0): void {
  const x = s * (W / 2), t = 0.08, out = (d: number) => x + s * (base + d), sill = SIDE - 0.02 - base;
  p.add(new THREE.PlaneGeometry(w, h), '#ffffff', { at: [out(0.012), cy, z], rot: [0, (s * Math.PI) / 2, 0], uv: glassRect });
  p.box(0.03, h, 0.05, out(0.025), cy, z, trim);
  p.box(0.03, 0.05, w, out(0.025), cy + h * 0.12, z, trim);
  p.box(0.05, h + 2 * t, t, out(0.035), cy, z - w / 2 - t / 2, trim);
  p.box(0.05, h + 2 * t, t, out(0.035), cy, z + w / 2 + t / 2, trim);
  p.box(0.05, t, w + 2 * t, out(0.035), cy + h / 2 + t / 2, z, trim);
  p.box(sill, 0.08, w + 0.24, out(sill / 2), cy - h / 2 - 0.04, z, trim);
}

/**
 * House variant `i`. `lite` is the same house with the small parts left out (window frames, side walls, balconies,
 * awning stripes, statues): the street uses it for houses far ahead and on the low graphics level, where a weak or
 * software-rendered GPU pays for every triangle.
 */
export function houseGeometry(i: number, lite = false): THREE.BufferGeometry {
  const s = houseSpec(i), P = s.pal, p = new Parts();
  const wallTop = G + 3 * FLOOR + s.frieze;

  // The wall stands R behind the facade; the facade skin in front of it frames the window openings.
  // The lite house has no skin: its windows are drawn on the wall face.
  p.span(-W / 2, W / 2, 0, wallTop, -D, lite ? 0 : -R, P.base);
  groundFloor(p, s, lite);
  for (let f = 0; f < 3; f++) upperFloor(p, s, f, lite);
  if (!lite) p.span(-W / 2, W / 2, G + 3 * FLOOR, wallTop, -R, 0, P.base);
  p.span(-W / 2, W / 2, wallTop - 0.28, wallTop, lite ? 0 : -R, 0.04, P.trim);
  if (!lite) {
    if (s.pilasters) {
      for (const x of [-3.83, -2.4, -0.8, 0.8, 2.4, 3.83]) {
        p.span(x - 0.15, x + 0.15, G + 0.22, G + 2 * FLOOR, 0, 0.07, P.shade);
        p.box(0.34, 0.12, 0.12, x, G + 2 * FLOOR + 0.06, 0.06, P.trim);
      }
    } else quoins(p, s, wallTop);
    if (s.balcony) balcony(p, s);
    sides(p, s, wallTop, i);
  }

  // Cornice in two steps, wrapping round both sides.
  p.span(-W / 2, W / 2, wallTop, wallTop + 0.18, lite ? 0 : -R, 0.32, P.trim);
  p.span(-W / 2, W / 2, wallTop + 0.18, wallTop + 0.3, lite ? 0 : -R, 0.42, P.trim);
  if (!lite) for (const sd of [-1, 1]) {
    const x0 = sd * (W / 2), x1 = sd * (W / 2 + SIDE);
    p.span(Math.min(x0, x1), Math.max(x0, x1), wallTop, wallTop + 0.3, -D, 0.42, P.trim);
  }
  roof(p, s, wallTop + 0.3, i, lite);
  return p.build({ ground: 0.22 });
}

function groundFloor(p: Parts, s: HouseSpec, lite: boolean): void {
  const P = s.pal;
  const shops: Array<[number, number]> = [[-3.6, -1.0], [1.0, 3.6]];
  const doorW = 1.1, shopTop = 2.7, shopBottom = 0.45, doorTop = 2.6;
  const tilt = 0.45, len = 1.0, y0 = 2.78, dy = -Math.sin(tilt), dz = Math.cos(tilt);
  if (lite) {
    p.span(-W / 2, W / 2, 0, G, 0, 0.06, P.shade);
    for (const [x0, x1] of shops) {
      p.add(new THREE.PlaneGeometry(x1 - x0, shopTop - shopBottom), '#ffffff', { at: [(x0 + x1) / 2, (shopTop + shopBottom) / 2, 0.065], uv: ATLAS.shop });
      p.box(x1 - x0 + 0.1, 0.04, len, (x0 + x1) / 2, y0 + (dy * len) / 2, 0.06 + (dz * len) / 2, s.awning, { rot: [tilt, 0, 0] });
    }
    p.span(-doorW / 2, doorW / 2, 0, doorTop, 0.06, 0.1, WOOD);
    p.span(-W / 2, W / 2, G, G + 0.22, 0, 0.12, P.trim);
    p.add(new THREE.BoxGeometry(3.2, 0.4, 0.06), '#ffffff', { at: [0, 3.05, 0.09], uv: ATLAS.sign(s.sign) });
    return;
  }
  for (const [x0, x1] of [[-4, -3.6], [-1.0, -doorW / 2], [doorW / 2, 1.0], [3.6, 4]]) p.span(x0, x1, 0, shopTop, -R, 0, P.shade);
  for (const [x0, x1] of shops) p.span(x0, x1, 0, shopBottom, -R, 0, P.shade);
  p.span(-W / 2, W / 2, shopTop, G, -R, 0, P.shade);
  p.span(-doorW / 2, doorW / 2, doorTop, shopTop, -R, 0, P.shade);
  for (const [x0, x1] of shops) {
    const w = x1 - x0, cx = (x0 + x1) / 2, h = shopTop - shopBottom;
    p.add(new THREE.PlaneGeometry(w, h), '#ffffff', { at: [cx, shopBottom + h / 2, -R + 0.015], uv: ATLAS.shop });
    for (const t of [1 / 3, 2 / 3]) p.box(0.06, h, 0.04, x0 + w * t, shopBottom + h / 2, -R + 0.04, FRAME_DARK);
    p.box(w, 0.05, 0.04, cx, 2.2, -R + 0.04, FRAME_DARK);
    p.span(x0 - 0.06, x0, shopBottom, shopTop, 0, 0.04, FRAME_DARK);
    p.span(x1, x1 + 0.06, shopBottom, shopTop, 0, 0.04, FRAME_DARK);
    p.span(x0 - 0.06, x1 + 0.06, shopTop, shopTop + 0.06, 0, 0.04, FRAME_DARK);
  }
  p.span(-doorW / 2 + 0.05, doorW / 2 - 0.05, 0, doorTop - 0.05, -R + 0.01, -R + 0.07, WOOD);
  p.add(new THREE.PlaneGeometry(0.6, 0.55), '#ffffff', { at: [0, 1.9, -R + 0.075], uv: ATLAS.glass });
  // String course over the shops, and the shop sign on it.
  p.span(-W / 2, W / 2, G, G + 0.22, -R, 0.12, P.trim);
  p.add(new THREE.BoxGeometry(3.2, 0.4, 0.06), '#ffffff', { at: [0, 3.05, 0.03], uv: ATLAS.sign(s.sign) });

  // Striped awnings over both shop windows.
  const n = 7;
  for (const [x0, x1] of shops) {
    const w = x1 - x0 + 0.1, cx = (x0 + x1) / 2, sw = w / n;
    for (let k = 0; k < n; k++) {
      const x = cx - w / 2 + sw * (k + 0.5), col = k % 2 ? STRIPE : s.awning;
      p.box(sw, 0.03, len, x, y0 + (dy * len) / 2, (dz * len) / 2, col, { rot: [tilt, 0, 0] });
      p.box(sw, 0.2, 0.025, x, y0 + dy * len - 0.1, dz * len, col);
    }
  }
}

function upperFloor(p: Parts, s: HouseSpec, f: number, lite: boolean): void {
  const P = s.pal, yb = G + f * FLOOR, w0 = yb + SILL, w1 = w0 + WIN_H, cy = (w0 + w1) / 2, t = 0.09;
  if (lite) {
    for (const x of WIN_X) {
      p.add(new THREE.PlaneGeometry(WIN_W, WIN_H), '#ffffff', { at: [x, cy, 0.01], uv: ATLAS.glass });
      p.box(WIN_W + 0.3, 0.09, 0.2, x, w0 - 0.06, 0.08, P.trim);
    }
    return;
  }
  p.span(-W / 2, W / 2, yb, w0, -R, 0, P.base);
  p.span(-W / 2, W / 2, w1, yb + FLOOR, -R, 0, P.base);
  const edges = [-W / 2, ...WIN_X.flatMap((x) => [x - WIN_W / 2, x + WIN_W / 2]), W / 2];
  for (let k = 0; k < edges.length; k += 2) p.span(edges[k], edges[k + 1], w0, w1, -R, 0, P.base);
  for (const x of WIN_X) {
    p.add(new THREE.PlaneGeometry(WIN_W, WIN_H), '#ffffff', { at: [x, cy, -R + 0.015], uv: ATLAS.glass });
    p.box(0.05, WIN_H, 0.03, x, cy, -R + 0.035, P.trim);
    p.box(WIN_W, 0.05, 0.03, x, w0 + WIN_H * 0.62, -R + 0.035, P.trim);
    p.span(x - WIN_W / 2 - t, x - WIN_W / 2, w0 - t, w1 + t, 0, 0.05, P.trim);
    p.span(x + WIN_W / 2, x + WIN_W / 2 + t, w0 - t, w1 + t, 0, 0.05, P.trim);
    p.span(x - WIN_W / 2 - t, x + WIN_W / 2 + t, w1, w1 + t, 0, 0.05, P.trim);
    p.box(WIN_W + 0.3, 0.09, 0.2, x, w0 - 0.06, 0.08, P.trim);
    const head = w1 + t + 0.02;
    if (f === 0) p.add(extrude([[-0.62, 0], [0.62, 0], [0, 0.34]], 0.12), P.trim, { at: [x, head, 0] });
    else if (f === 1) {
      const arc: Array<[number, number]> = [];
      for (let k = 0; k <= 8; k++) arc.push([0.6 * Math.cos((k / 8) * Math.PI), 0.24 * Math.sin((k / 8) * Math.PI)]);
      p.add(extrude(arc, 0.12), P.trim, { at: [x, head, 0] });
    } else p.box(WIN_W + 0.3, 0.12, 0.14, x, head + 0.04, 0.07, P.trim);
  }
}

/** Alternating corner stones up both front corners, on the facade and round the side. */
function quoins(p: Parts, s: HouseSpec, wallTop: number): void {
  const col = mix(s.pal.trim, s.pal.shade, 0.35);
  let k = 0;
  for (let y = G + 0.22; y + 0.42 <= wallTop - 0.28; y += 0.46, k++) {
    const wide = k % 2 === 0;
    for (const sd of [-1, 1]) {
      const xIn = sd * (W / 2 - (wide ? 0.3 : 0.16)), xOut = sd * (W / 2);
      p.span(Math.min(xIn, xOut), Math.max(xIn, xOut), y, y + 0.42, 0, 0.04, col);
      const zIn = -(wide ? 0.16 : 0.3);
      p.span(Math.min(xOut, xOut + sd * 0.04), Math.max(xOut, xOut + sd * 0.04), y, y + 0.42, zIn, 0.04, col);
    }
  }
}

/** Both side walls: windows on the upper floors, the bands and the shop plinth returning round the corner, a drainpipe. */
function sides(p: Parts, s: HouseSpec, wallTop: number, i: number): void {
  const P = s.pal;
  for (const sd of [-1, 1]) {
    const x = sd * (W / 2), band = (d: number) => [Math.min(x, x + sd * d), Math.max(x, x + sd * d)] as const;
    const [p0, p1] = band(0.02);
    p.span(p0, p1, 0, G, -D, 0, P.shade);
    const [s0, s1] = band(0.08);
    p.span(s0, s1, G, G + 0.22, -D, 0.12, P.trim);
    const [f0, f1] = band(0.04);
    p.span(f0, f1, wallTop - 0.28, wallTop, -D, 0.04, P.trim);
    for (let f = 0; f < 3; f++) {
      const cy = G + f * FLOOR + SILL + WIN_H / 2;
      for (const z of SIDE_WIN_Z) sideWindow(p, sd, z, cy, 0.7, WIN_H, P.trim);
      if (f < 2) {
        const [b0, b1] = band(0.03);
        p.span(b0, b1, G + (f + 1) * FLOOR - 0.06, G + (f + 1) * FLOOR + 0.06, -D, 0, P.trim);
      }
    }
    // A small barred window lights the back of the shop.
    sideWindow(p, sd, -3.4, 1.9, 0.6, 0.8, FRAME_DARK, ATLAS.shop, 0.02);
    // Drainpipe down the back corner, on one side only (varies by house).
    if ((sd > 0) === (hash01(i * 3.1) > 0.5)) p.add(new THREE.CylinderGeometry(0.05, 0.05, wallTop, 6), PIPE, { at: [x + sd * 0.065, wallTop / 2, -D + 0.25] });
  }
}

function balcony(p: Parts, s: HouseSpec): void {
  const y = G + 0.5, w = 2.4, depth = 0.55;
  p.box(w, 0.14, depth, 0, y - 0.07, depth / 2, s.pal.trim);
  for (const x of [-0.9, 0.9]) p.box(0.14, 0.3, 0.4, x, y - 0.29, 0.2, s.pal.trim);
  const n = 11, rail = 0.62;
  for (let k = 0; k < n; k++) p.box(0.05, rail, 0.05, -w / 2 + 0.06 + (k * (w - 0.12)) / (n - 1), y + rail / 2, depth - 0.05, IRON);
  p.box(w, 0.06, 0.08, 0, y + rail, depth - 0.05, IRON);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) p.box(0.05, 0.06, depth, x, y + rail, depth / 2, IRON);
}

function roof(p: Parts, s: HouseSpec, y: number, i: number, lite: boolean): void {
  const P = s.pal, segs = lite ? 8 : 16;
  const chimney = (h: number, z: number) => {
    const x = -2.9 + hash01(i * 7.3) * 1.6;
    p.span(x - 0.25, x + 0.25, y, y + h, z - 0.25, z + 0.25, BRICK);
    p.span(x - 0.32, x + 0.32, y + h, y + h + 0.12, z - 0.32, z + 0.32, mix(BRICK, '#3a2a22', 0.4));
  };
  if (s.roof === 'gable') {
    p.add(prismX([[0.15, 0], [-D - 0.1, 0], [-D / 2, 2.2]], W), TILE, { at: [0, y, 0] });
    p.add(extrude([[-1.8, 0], [1.8, 0], [0, 1.25]], 0.3), P.trim, { at: [0, y - 0.02, -0.05] });
    if (!lite) p.add(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16), GLASS, { at: [0, y + 0.45, 0.26], rot: [Math.PI / 2, 0, 0] });
    chimney(2.4, -3.8);
  } else if (s.roof === 'dome') {
    const cx = 2.4, cz = -1.15, r = 1.05;
    p.span(cx - 1.1, cx + 1.1, y, y + 0.8, cz - 1.25, cz + 1.25, P.trim);
    p.add(new THREE.SphereGeometry(r, segs, segs / 2, 0, Math.PI * 2, 0, Math.PI / 2), COPPER, { at: [cx, y + 0.8, cz], scale: [1, 1.25, 1] });
    p.add(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8), COPPER, { at: [cx, y + 0.8 + r * 1.25 + 0.2, cz] });
    p.add(new THREE.SphereGeometry(0.14, 8, 6), GOLD, { at: [cx, y + 0.8 + r * 1.25 + 0.55, cz] });
    p.span(-W / 2, cx - 1.1, y, y + 0.35, -0.3, 0.15, P.trim);
    chimney(1.1, -3.6);
  } else if (s.roof === 'attic') {
    p.span(-W / 2, W / 2, y, y + 0.12, -0.25, 0.2, P.trim);
    if (lite) p.span(-W / 2, W / 2, y + 0.12, y + 0.54, -0.15, 0.1, P.trim);
    else for (let x = -3.82; x < W / 2; x += 0.364) p.box(0.12, 0.42, 0.12, x, y + 0.33, 0, P.trim);
    p.span(-W / 2, W / 2, y + 0.54, y + 0.66, -0.2, 0.18, P.trim);
    for (const x of [-2.6, 0, 2.6]) {
      p.box(0.4, 0.4, 0.4, x, y + 0.86, 0, STONE);
      if (lite) p.add(new THREE.ConeGeometry(0.22, 1.1, 5), STONE, { at: [x, y + 1.61, 0] });
      else {
        p.add(new THREE.CylinderGeometry(0.15, 0.2, 0.9, 8), STONE, { at: [x, y + 1.51, 0] });
        p.add(new THREE.SphereGeometry(0.13, 8, 6), STONE, { at: [x, y + 2.08, 0] });
      }
    }
    chimney(1.1, -3.4);
  } else {
    p.add(prismX([[0.2, 0], [-D + 0.05, 0], [-D + 0.6, 1.9], [-0.6, 1.9]], W), SLATE, { at: [0, y, 0] });
    for (const x of [-2.4, 0, 2.4]) {
      // The front slope leans back 0.8 m over its height, so dormers stand forward enough to clear it.
      p.span(x - 0.45, x + 0.45, y + 0.3, y + 1.2, -1.0, 0.1, P.trim);
      p.add(new THREE.PlaneGeometry(0.5, 0.6), '#ffffff', { at: [x, y + 0.75, 0.11], uv: ATLAS.glass });
      p.add(extrude([[-0.55, 0], [0.55, 0], [0, 0.4]], 1.12), SLATE, { at: [x, y + 1.2, -1.0] });
    }
    chimney(2.3, -3.6);
  }
}

/** The taller, hazier blocks behind the front row: they fill the sky line over the roofs and the plazas. */
export function backGeometry(i: number, lite = false): THREE.BufferGeometry {
  const base = mix(FACADE_PAL[(i + 2) % 6].base, '#c6d2d8', 0.45);
  const win = mix(base, '#56606e', 0.45), light = mix(base, '#ffffff', 0.3);
  const roofCol = mix(SLATE, '#c6d2d8', 0.35), dome = mix(COPPER, '#c6d2d8', 0.35);
  const h = [16, 18.5, 15, 17.5, 20][i % 5], p = new Parts(), BW = BACK_WIDTH, BD = BACK_DEPTH;
  p.span(-BW / 2, BW / 2, 0, h, -BD, 0, base);
  for (let y = 4; y < h - 2; y += 2.6) {
    for (const x of [-4, -2.4, -0.8, 0.8, 2.4, 4]) {
      p.box(0.7, 1.2, 0.05, x, y, 0.025, win);
      if (!lite) p.box(0.9, 0.08, 0.1, x, y - 0.64, 0.05, light);
    }
    // The same window grid on both sides, for the gaps over lower neighbours and at the plazas.
    if (!lite) for (const sd of [-1, 1]) for (const z of [-1.6, -4, -6.4]) {
      p.box(0.05, 1.2, 0.7, sd * (BW / 2 + 0.025), y, z, win);
      p.box(0.1, 0.08, 0.9, sd * (BW / 2 + 0.05), y - 0.64, z, light);
    }
  }
  if (!lite) for (let y = 6.6; y < h - 2; y += 5.2) p.span(-BW / 2 - 0.04, BW / 2 + 0.04, y - 1.36, y - 1.22, -BD, 0.06, light);
  p.span(-BW / 2 - 0.12, BW / 2 + 0.12, h, h + 0.25, -BD, 0.25, light);
  const top = h + 0.25, kind = i % 5;
  if (kind === 1) {
    p.add(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome, { at: [0, top, -4] });
    p.box(0.4, 1.4, 0.4, 0, top + 3.6, -4, dome);
  } else if (kind === 2) p.add(prismX([[0.1, 0], [-BD - 0.1, 0], [-BD / 2, 2.6]], BW), roofCol, { at: [0, top, 0] });
  else if (kind === 3) {
    p.span(1.5, 4.5, top, top + 5, -6, -3, base);
    for (const x of [2.3, 3.7]) p.box(0.5, 1.4, 0.05, x, top + 3, -2.975, win);
    p.add(new THREE.ConeGeometry(2.1, 4.5, 4), roofCol, { at: [3, top + 7.25, -4.5], rot: [0, Math.PI / 4, 0] });
  } else if (kind === 4) p.add(prismX([[0.1, 0], [-BD - 0.1, 0], [-BD + 0.6, 2], [-0.6, 2]], BW), roofCol, { at: [0, top, 0] });
  return p.build();
}
