import * as THREE from 'three';
import { archRing, ATLAS, extrude, lancet, Parts, prismX, roundArch, type Detail, type Vec3 } from './kit';

// The landmarks as 3D models, in the frame the landmark cards use: front facing +z (towards the runner, before the
// placement turns it a little towards the street), centred on x, base at y = 0. Sizes follow the paper cards so
// the street keeps its proportions; every model stays clear of the facade rows outside its plaza (tested).

const STONE = '#ded1b4';
const STONE_D = '#c6b796';
const WALL = '#f0e7d3';
const WHITE = '#f8f3e7';
const COPPER = '#6f9f8b';
const COPPER_K = '#79b39d';
const COPPER_DARK = '#5b9783';
const GOLD = '#d9b44a';
const DARK = '#3b3540';
const STATUE = '#8c8378';

const segs = (detail: Detail, base: number) => [Math.max(4, Math.round(base / 2)), base, Math.round(base * 1.5)][detail];

/** A square beam from a to b. */
function beam(p: Parts, a: Vec3, b: Vec3, t: number, color: string): void {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.BoxGeometry(t, dir.length(), t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  p.add(g, color);
}

/** A window glass shape in the atlas glass, facing +z, its base centred at `at`. */
function glassShape(p: Parts, pts: Array<[number, number]>, at: Vec3, rotY = 0): void {
  p.add(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))), '#ffffff', { at, rot: [0, rotY, 0], uv: ATLAS.glass });
}

/** A stone frame around an arch: the outer arch with the window cut out, `t` thick. */
function archFrame(p: Parts, outer: Array<[number, number]>, inner: Array<[number, number]>, t: number, at: Vec3, color: string): void {
  p.add(extrude(outer, t, [inner]), color, { at });
}

/** A copper dome (half sphere) with optional ribs, a lantern and a gold ball; returns the height of its top. */
function dome(p: Parts, detail: Detail, at: Vec3, r: number, squash: number, color: string, ribColor: string): number {
  const [x, y, z] = at;
  p.add(new THREE.SphereGeometry(r, segs(detail, 20), segs(detail, 10), 0, Math.PI * 2, 0, Math.PI / 2), color, { at, scale: [1, squash, 1] });
  if (detail > 0) {
    const ribs = detail === 2 ? 12 : 8;
    for (let k = 0; k < ribs; k++) {
      const th = (k / ribs) * Math.PI * 2;
      const pts = Array.from({ length: 9 }, (_, i) => {
        const ph = (i / 8) * (Math.PI / 2);
        return new THREE.Vector3(x + Math.sin(th) * Math.cos(ph) * (r + 0.04), y + Math.sin(ph) * r * squash + 0.02, z + Math.cos(th) * Math.cos(ph) * (r + 0.04));
      });
      p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r * 0.025, 4), ribColor);
    }
  }
  return y + r * squash;
}

/** Lantern and gold ball on top of a dome. */
function lantern(p: Parts, detail: Detail, x: number, y: number, z: number, r: number, h: number, wall: string, cap: string): void {
  p.add(new THREE.CylinderGeometry(r, r, h, segs(detail, 12)), wall, { at: [x, y + h / 2, z] });
  p.add(new THREE.SphereGeometry(r * 1.05, segs(detail, 12), segs(detail, 6), 0, Math.PI * 2, 0, Math.PI / 2), cap, { at: [x, y + h, z] });
  p.add(new THREE.SphereGeometry(r * 0.38, segs(detail, 10), segs(detail, 6)), GOLD, { at: [x, y + h + r * 1.05 + r * 0.3, z] });
}

/** Balustrade with statues along the top of a wall, between x0 and x1. */
function balustrade(p: Parts, detail: Detail, x0: number, x1: number, y: number, z: number, color: string, statues: number[]): void {
  p.span(x0, x1, y, y + 0.15, z - 0.35, z + 0.25, color);
  if (detail === 0) p.span(x0, x1, y + 0.15, y + 0.75, z - 0.25, z + 0.15, color);
  else for (let x = x0 + 0.2; x < x1; x += 0.5) {
    const post = detail === 2 ? new THREE.CylinderGeometry(0.07, 0.1, 0.6, 6) : new THREE.BoxGeometry(0.15, 0.6, 0.15);
    p.add(post, color, { at: [x, y + 0.45, z - 0.05] });
  }
  p.span(x0, x1, y + 0.75, y + 0.9, z - 0.3, z + 0.22, color);
  for (const x of statues) {
    p.box(0.6, 0.6, 0.6, x, y + 1.2, z - 0.05, STATUE);
    if (detail === 0) p.add(new THREE.ConeGeometry(0.32, 1.5, 5), STATUE, { at: [x, y + 2.25, z - 0.05] });
    else {
      p.add(new THREE.CylinderGeometry(0.22, 0.3, 1.3, segs(detail, 8)), STATUE, { at: [x, y + 2.15, z - 0.05] });
      p.add(new THREE.SphereGeometry(0.2, segs(detail, 8), segs(detail, 6)), STATUE, { at: [x, y + 2.98, z - 0.05] });
    }
  }
}

/** Centres a finished geometry on x. */
function centreX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, 0, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Stephansdom: the long nave with its zigzag tiled roof, the south tower's spire (33 m), the domed north tower. */
export function stephansdom(detail: Detail): THREE.BufferGeometry {
  const p = new Parts();
  p.span(-12.9, 7.4, 0, 0.5, -9.6, 0.4, STONE_D);
  p.span(-12.5, 7, 0, 10, -9, -1, STONE);
  for (const x of [-12.2, -8.6, -5, -1.4, 2.2, 5.8]) {
    p.span(x - 0.4, x + 0.4, 0, 10.6, -1, 0.15, STONE_D);
    if (detail > 0) {
      p.span(x - 0.46, x + 0.46, 5.5, 5.8, -1, 0.3, STONE_D);
      p.add(new THREE.ConeGeometry(0.42, 1.8, detail === 2 ? 8 : 4), STONE_D, { at: [x, 11.5, -0.42] });
    }
  }
  for (const x of [-10.4, -6.8, -3.2, 0.4, 4.0]) {
    glassShape(p, lancet(1.7, 5.6), [x, 2.6, -0.98]);
    if (detail > 0) archFrame(p, lancet(2.1, 6.0), lancet(1.7, 5.6).map(([a, b]) => [a, b + 0.2]), 0.12, [x, 2.4, -1], STONE_D);
    if (detail === 2) p.box(0.06, 4.2, 0.04, x, 4.7, -0.95, STONE_D);
  }
  // The famous roof: two steep slopes (eaves 10 m, ridge 19 m) wearing the tile pattern from the atlas.
  const slope = Math.atan2(4.6, 9), len = Math.hypot(4.6, 9);
  p.add(new THREE.PlaneGeometry(20.6, len), '#ffffff', { at: [-2.75, 14.5, -2.7], rot: [-slope, 0, 0], uv: ATLAS.tiles });
  p.add(new THREE.PlaneGeometry(20.6, len), '#ffffff', { at: [-2.75, 14.5, -7.3], rot: [slope, Math.PI, 0], uv: ATLAS.tiles });
  for (const x of [-12.85, 7.05]) p.add(extrude([[-4.6, 0], [4.6, 0], [0, 9]], 0.3), STONE, { at: [x, 10, -5], rot: [0, Math.PI / 2, 0] });
  if (detail > 0) p.span(-12.9, 7.4, 18.9, 19.15, -5.12, -4.88, '#20242a');

  // South tower and spire.
  p.span(7, 13, 0, 16, -8, -2, STONE_D);
  for (const x of [8.8, 11.2]) glassShape(p, lancet(0.9, 4), [x, 5, -1.98]);
  glassShape(p, lancet(1.1, 3.2), [10, 11.5, -1.98]);
  p.span(7.6, 12.4, 16, 21.5, -7.4, -2.6, STONE);
  glassShape(p, lancet(0.8, 3.2), [10, 17.4, -2.58]);
  if (detail > 0) {
    for (const [x, z] of [[7.3, -2.3], [12.7, -2.3], [7.3, -7.7], [12.7, -7.7]]) p.add(new THREE.ConeGeometry(0.45, 2.2, detail === 2 ? 8 : 4), STONE_D, { at: [x, 17.1, z] });
    p.add(extrude([[-2.4, 0], [2.4, 0], [0, 2.2]], 0.2), STONE, { at: [10, 21.5, -2.6] });
  }
  const spireH = 11.5, base = 2.3, tip = 0.15;
  p.add(new THREE.CylinderGeometry(tip, base, spireH, 8, 1), STONE, { at: [10, 21.5 + spireH / 2, -5] });
  if (detail > 0) {
    const levels = detail === 2 ? 9 : 5;
    for (let l = 1; l <= levels; l++) {
      const t = l / (levels + 1), r = base - (base - tip) * t, y = 21.5 + spireH * t;
      for (let k = 0; k < 8; k++) {
        const th = (k / 8) * Math.PI * 2;
        p.box(0.22, 0.12, 0.3, 10 + Math.sin(th) * (r + 0.08), y, -5 + Math.cos(th) * (r + 0.08), STONE_D, { rot: [0, th, 0] });
      }
    }
  }
  p.add(new THREE.SphereGeometry(0.25, segs(detail, 8), segs(detail, 6)), GOLD, { at: [10, 33.05, -5] });

  // North tower, unfinished and capped with a small copper dome.
  p.span(-15, -12.5, 0, 13, -6, -2.5, STONE_D);
  for (const y of [3.5, 8]) glassShape(p, lancet(0.8, 2.8), [-13.75, y, -2.48]);
  const top = dome(p, detail, [-13.75, 13, -4.25], 1.7, 1.2, '#5e8f80', COPPER_DARK);
  lantern(p, detail, -13.75, top, -4.25, 0.32, 0.9, '#5e8f80', '#5e8f80');
  return centreX(p.build({ ground: 0.15 }));
}

/** Karlskirche: portico, drum and green dome between the two spiral columns, bell pavilions at both ends. */
export function karlskirche(detail: Detail): THREE.BufferGeometry {
  const p = new Parts();
  p.span(-11, 11, 0, 0.6, -9.5, 1.6, '#e2d8c2');
  p.span(-6.5, 6.5, 0, 12, -12, -2.5, WALL);
  p.add(new THREE.ShapeGeometry(new THREE.Shape(roundArch(2.2, 4.2).map(([x, y]) => new THREE.Vector2(x, y)))), DARK, { at: [0, 0.6, -2.48] });
  for (const x of [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5]) {
    p.add(new THREE.CylinderGeometry(0.4, 0.44, 8.4, segs(detail, 12)), WHITE, { at: [x, 0.6 + 4.2, 0.8] });
    if (detail > 0) {
      p.box(1.0, 0.3, 1.0, x, 0.75, 0.8, WHITE);
      p.box(1.0, 0.35, 1.0, x, 8.85, 0.8, WHITE);
    }
  }
  p.span(-5.4, 5.4, 9, 10, -2.5, 1.4, WHITE);
  p.add(extrude([[-5.6, 0], [5.6, 0], [0, 2.6]], 3.9), WHITE, { at: [0, 10, -2.5] });
  // Drum, dome, lantern.
  p.add(new THREE.CylinderGeometry(5, 5, 3, segs(detail, 20)), WALL, { at: [0, 13.5, -7.2] });
  if (detail > 0) for (const deg of [-60, -30, 0, 30, 60]) {
    const th = (deg * Math.PI) / 180;
    glassShape(p, roundArch(0.8, 1.7), [Math.sin(th) * 5.02, 12.6, -7.2 + Math.cos(th) * 5.02], th);
  }
  const top = dome(p, detail, [0, 15, -7.2], 5, 1.1, COPPER_K, COPPER_DARK);
  lantern(p, detail, 0, top - 0.1, -7.2, 0.85, 1.4, WALL, COPPER_K);
  // The two columns with their spiral reliefs.
  for (const x of [-8.6, 8.6]) {
    p.box(2.8, 1.2, 2.8, x, 1.2, -0.5, WALL);
    p.add(new THREE.CylinderGeometry(1.1, 1.15, 15, segs(detail, 16)), WHITE, { at: [x, 1.8 + 7.5, -0.5] });
    if (detail > 0) {
      const turns = 3.5, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64, a = t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(x + Math.sin(a) * 1.18, 2.6 + t * 13.4, -0.5 + Math.cos(a) * 1.18));
      }
      p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), detail === 2 ? 140 : 80, 0.13, detail === 2 ? 6 : 4), '#b9ae95');
    }
    p.box(2.6, 0.7, 2.6, x, 17.15, -0.5, WALL);
    p.add(new THREE.CylinderGeometry(0.7, 0.8, 1.0, segs(detail, 12)), WALL, { at: [x, 18, -0.5] });
    p.add(new THREE.SphereGeometry(0.55, segs(detail, 10), segs(detail, 8)), GOLD, { at: [x, 19, -0.5] });
  }
  // Wings and bell pavilions (kept shallow at the street end: they must clear the facade row beyond the plaza).
  for (const s of [-1, 1]) {
    p.span(Math.min(s * 6.5, s * 10.5), Math.max(s * 6.5, s * 10.5), 0, 8, -9, -3, WALL);
    const x0 = Math.min(s * 10.5, s * 15), x1 = Math.max(s * 10.5, s * 15), cx = s * 12.75;
    p.span(x0, x1, 0, 9, -5.6, -1.5, WALL);
    for (const dx of [-1.3, 0, 1.3]) glassShape(p, roundArch(0.8, 1.9), [cx + dx, 2.6, -1.48]);
    p.span(cx - 1.25, cx + 1.25, 9, 12, -5, -2.1, WALL);
    if (detail > 0) p.span(x0, x1, 9, 9.3, -5.8, -1.3, WHITE);
    const t = dome(p, detail, [cx, 12, -3.55], 1.3, 1.1, COPPER_K, COPPER_DARK);
    p.add(new THREE.SphereGeometry(0.28, segs(detail, 8), segs(detail, 6)), GOLD, { at: [cx, t + 0.3, -3.55] });
  }
  return centreX(p.build({ ground: 0.15 }));
}

/** Hofburg (Michaelertrakt): a long palace wing with balustrade and statues, the domed central pavilion. */
export function hofburg(detail: Detail): THREE.BufferGeometry {
  const p = new Parts(), wall = '#f2e9d6', rust = '#e6dbc4', trim = '#fbf4e4';
  const WD = 5.2; // wing depth: the wing's street end must clear the facade row beyond the plaza
  p.span(-16, 16, 0, 3.6, -WD, 0.12, rust);
  p.span(-16, 16, 3.6, 11, -WD, 0, wall);
  p.span(-16, 16, 3.6, 3.85, -WD, 0.22, trim);
  if (detail === 2) for (const y of [1.0, 1.9, 2.8]) p.span(-16, 16, y, y + 0.05, 0.12, 0.13, '#cdbfa5');
  const xs = [-14.8, -12.4, -10, -7.6, 7.6, 10, 12.4, 14.8];
  for (const x of xs) {
    glassShape(p, roundArch(1.0, 2.0), [x, 0.8, 0.13]);
    for (const [y0, h, row] of [[4.8, 2.0, 0], [8.2, 1.8, 1]] as const) {
      if (detail === 0) {
        p.box(0.95, h, 0.06, x, y0 + h / 2, 0.03, '#4e607a');
        continue;
      }
      p.add(new THREE.PlaneGeometry(0.95, h), '#ffffff', { at: [x, y0 + h / 2, 0.01], uv: ATLAS.glass });
      p.span(x - 0.6, x - 0.48, y0 - 0.1, y0 + h + 0.1, 0, 0.06, trim);
      p.span(x + 0.48, x + 0.6, y0 - 0.1, y0 + h + 0.1, 0, 0.06, trim);
      p.box(1.4, 0.12, 0.22, x, y0 - 0.12, 0.1, trim);
      if (row === 0) p.add(extrude([[-0.8, 0], [0.8, 0], [0, 0.42]], 0.14), trim, { at: [x, y0 + h + 0.12, 0] });
      else p.box(1.35, 0.14, 0.16, x, y0 + h + 0.18, 0.08, trim);
    }
  }
  p.span(-16, 16, 11, 11.35, -WD, 0.35, trim);
  balustrade(p, detail, -16, -6, 11.35, 0, trim, [-14, -10.8, -7.6]);
  balustrade(p, detail, 6, 16, 11.35, 0, trim, [7.6, 10.8, 14]);
  // Central pavilion with its gate, columns, drum and dome.
  p.span(-6, 6, 0, 12.4, -8, 1.2, '#f7efe0');
  p.span(-6.1, 6.1, 0, 3.6, -8, 1.32, rust);
  p.add(new THREE.ShapeGeometry(new THREE.Shape(roundArch(3.6, 5.6).map(([x, y]) => new THREE.Vector2(x, y)))), DARK, { at: [0, 0, 1.34] });
  if (detail > 0) p.add(extrude(archRing(4.4, 6.0, 3.6, 5.6), 0.15), trim, { at: [0, 0, 1.32] });
  for (const x of [-1.5, 1.5]) glassShape(p, roundArch(0.9, 2.0), [x, 7.2, 1.21]);
  for (const x of [-4.7, -2.9, 2.9, 4.7]) {
    p.box(0.9, 1.2, 0.9, x, 0.6, 2.1, trim);
    p.add(detail === 0 ? new THREE.BoxGeometry(0.7, 8.6, 0.7) : new THREE.CylinderGeometry(0.34, 0.38, 8.6, segs(detail, 12)), '#fbf6ea', { at: [x, 1.2 + 4.3, 2.1] });
    if (detail > 0) p.box(0.9, 0.5, 0.9, x, 10.05, 2.1, trim);
  }
  p.span(-5.4, 5.4, 10.3, 11.1, 1.2, 2.6, '#fbf6ea');
  p.span(-6.2, 6.2, 12.4, 12.75, -8.2, 1.5, trim);
  p.add(new THREE.CylinderGeometry(4.6, 4.6, 2.4, segs(detail, 20)), wall, { at: [0, 13.95, -3.4] });
  if (detail > 0) for (const deg of [-60, -30, 0, 30, 60]) {
    const th = (deg * Math.PI) / 180;
    glassShape(p, roundArch(0.7, 1.4), [Math.sin(th) * 4.62, 13.3, -3.4 + Math.cos(th) * 4.62], th);
  }
  const top = dome(p, detail, [0, 15.15, -3.4], 4.8, 0.95, COPPER, '#4f7d6b');
  lantern(p, detail, 0, top - 0.1, -3.4, 0.7, 1.1, COPPER, COPPER);
  return centreX(p.build({ ground: 0.15 }));
}

export interface RiesenradParts {
  /** Rims, spokes, ties and hub, centred on the hub: spins around z. */
  wheel: THREE.BufferGeometry;
  /** A-frame legs and the base building, from the ground. */
  support: THREE.BufferGeometry;
  /** One cabin, centred on itself; hangs `cabinDrop` below its point on the inner rim. */
  cabin: THREE.BufferGeometry;
  hubY: number;
  cabinRadius: number;
  cabinDrop: number;
  cabins: number;
}

/** Riesenrad: the 29 m wheel with its 15 red cabins, on the A-frame over the little base house. */
export function riesenrad(detail: Detail): RiesenradParts {
  const R = 14.5, RI = 13.6, hubY = 20.7, rim = '#3d4552', dark = '#363c46';
  const w = new Parts(), spokes = detail === 0 ? 16 : 32;
  const tub = segs(detail, 64), rad = segs(detail, 6);
  for (const z of [-0.95, 0.95]) {
    w.add(new THREE.TorusGeometry(R, 0.2, rad, tub), rim, { at: [0, 0, z] });
    w.add(new THREE.TorusGeometry(RI, 0.12, Math.max(3, rad - 2), tub), rim, { at: [0, 0, z] });
    for (let k = 0; k < spokes; k++) {
      const th = (k / spokes) * Math.PI * 2, mid = (1.1 + RI) / 2;
      w.box(0.08, RI - 1.1, 0.08, Math.cos(th) * mid, Math.sin(th) * mid, z, rim, { rot: [0, 0, th - Math.PI / 2] });
    }
    if (detail > 0) for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2, b = ((k + 1) / 64) * Math.PI * 2;
      const [r0, r1] = k % 2 ? [RI, R] : [R, RI];
      beam(w, [Math.cos(a) * r0, Math.sin(a) * r0, z], [Math.cos(b) * r1, Math.sin(b) * r1, z], 0.06, rim);
    }
  }
  for (let k = 0; k < spokes; k++) {
    const th = (k / spokes) * Math.PI * 2, r = (R + RI) / 2;
    w.box(0.08, 0.08, 1.9, Math.cos(th) * r, Math.sin(th) * r, 0, rim);
  }
  w.add(new THREE.CylinderGeometry(1.1, 1.1, 2.3, segs(detail, 16)), dark, { rot: [Math.PI / 2, 0, 0] });

  const s = new Parts();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(s, [0, hubY, sz * 1.25], [sx * 7.4, 0, sz * 2.6], 0.5, '#5c6470');
  for (const [y, half] of [[11, 4.2], [6.5, 5.1]] as const) for (const sz of [-1, 1]) {
    const z = sz * (1.25 + (2.6 - 1.25) * (1 - y / hubY));
    beam(s, [-half, y, z], [half, y, z], 0.28, '#5c6470');
  }
  for (const sz of [-1, 1]) s.box(1.2, 1.2, 0.4, 0, hubY, sz * 1.4, dark);
  s.span(-4.6, 4.6, 0, 3.4, -2.2, 2.2, '#efe3cf');
  s.add(prismX([[2.5, 0], [-2.5, 0], [-1.6, 1.1], [1.6, 1.1]], 9.6), '#c4302b', { at: [0, 3.4, 0] });
  for (const x of [-3, -1, 1, 3]) {
    const pts = roundArch(0.9, 1.6);
    s.add(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)))), '#ffffff', { at: [x, 0.9, 2.21], uv: ATLAS.glass });
    if (detail > 0) s.add(extrude(archRing(1.1, 1.7, 0.9, 1.6), 0.06), '#fbf6ea', { at: [x, 0.9, 2.2] });
  }

  const c = new Parts();
  c.box(2.2, 1.5, 1.5, 0, 0, 0, '#c4302b');
  c.box(2.26, 0.45, 1.56, 0, 0.2, 0, '#f4efe6');
  if (detail > 0) for (const z of [-0.79, 0.79]) for (const x of [-0.7, 0, 0.7]) {
    c.add(new THREE.PlaneGeometry(0.55, 0.36), '#ffffff', { at: [x, 0.2, z], rot: [0, z < 0 ? Math.PI : 0, 0], uv: ATLAS.glass });
  }
  c.box(2.4, 0.18, 1.7, 0, 0.84, 0, '#8e2420');
  c.box(0.1, 0.35, 0.1, 0, 1.1, 0, dark);

  return { wheel: w.build(), support: s.build({ ground: 0.15 }), cabin: c.build(), hubY, cabinRadius: RI, cabinDrop: 1.1, cabins: 15 };
}
