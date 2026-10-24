import * as THREE from 'three';
import { archRing, ATLAS, extrude, lancet, Parts, prismX, roundArch, type Vec3 } from './kit';

// The landmarks as 3D models, in the frame the landmark cards used: front facing +z (towards the runner, before the
// placement turns it a little towards the street), centred on x, base at y = 0. Sizes follow the paper cards so
// the street keeps its proportions; every model stays clear of the facade rows outside its plaza (tested).
// Side walls get windows too: the placements turn every landmark so one end faces the street.

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

/** Turns that make a +z-facing shape face +x (s = 1) or -x (s = -1). */
const sideRot = (s: number) => (s * Math.PI) / 2;

/** A square beam from a to b. */
function beam(p: Parts, a: Vec3, b: Vec3, t: number, color: string): void {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.BoxGeometry(t, dir.length(), t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  p.add(g, color);
}

const shape = (pts: Array<[number, number]>) => new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));

/** Window glass in the atlas glass, facing +z turned by rotY, its base centred at `at`. */
function glassShape(p: Parts, pts: Array<[number, number]>, at: Vec3, rotY = 0): void {
  p.add(shape(pts), '#ffffff', { at, rot: [0, rotY, 0], uv: ATLAS.glass });
}

/** A round-headed window with its frame band and sill on a wall, facing +z turned by rotY, its base centred at `at`. */
function archWindow(p: Parts, w: number, h: number, at: Vec3, rotY: number, frame: string): void {
  const [x, y, z] = at, ox = Math.sin(rotY) * 0.01, oz = Math.cos(rotY) * 0.01;
  glassShape(p, roundArch(w, h), [x + ox, y, z + oz], rotY);
  p.add(extrude(archRing(w + 0.24, h + 0.12, w, h), 0.06), frame, { at: [x, y, z], rot: [0, rotY, 0] });
  const sill = new THREE.BoxGeometry(w + 0.36, 0.1, 0.14);
  sill.translate(0, -0.05, 0.07);
  p.add(sill, frame, { at: [x, y, z], rot: [0, rotY, 0] });
}

/** A Gothic lancet with its stone frame, facing +z turned by rotY. */
function lancetWindow(p: Parts, w: number, h: number, at: Vec3, rotY: number): void {
  const [x, y, z] = at, ox = Math.sin(rotY) * 0.02, oz = Math.cos(rotY) * 0.02;
  glassShape(p, lancet(w, h), [x + ox, y + 0.2, z + oz], rotY);
  p.add(extrude(lancet(w + 0.4, h + 0.4), 0.12, [lancet(w, h).map(([a, b]) => [a, b + 0.2])]), STONE_D, { at: [x, y, z], rot: [0, rotY, 0] });
}

/** A copper dome (half sphere) with ribs; returns the height of its top. */
function dome(p: Parts, at: Vec3, r: number, squash: number, color: string, ribColor: string): number {
  const [x, y, z] = at;
  p.add(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), color, { at, scale: [1, squash, 1] });
  for (let k = 0; k < 8; k++) {
    const th = (k / 8) * Math.PI * 2;
    const pts = Array.from({ length: 9 }, (_, i) => {
      const ph = (i / 8) * (Math.PI / 2);
      return new THREE.Vector3(x + Math.sin(th) * Math.cos(ph) * (r + 0.04), y + Math.sin(ph) * r * squash + 0.02, z + Math.cos(th) * Math.cos(ph) * (r + 0.04));
    });
    p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r * 0.025, 4), ribColor);
  }
  return y + r * squash;
}

/** Lantern and gold ball on top of a dome. */
function lantern(p: Parts, x: number, y: number, z: number, r: number, h: number, wall: string, cap: string): void {
  p.add(new THREE.CylinderGeometry(r, r, h, 12), wall, { at: [x, y + h / 2, z] });
  p.add(new THREE.SphereGeometry(r * 1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, { at: [x, y + h, z] });
  p.add(new THREE.SphereGeometry(r * 0.38, 10, 6), GOLD, { at: [x, y + h + r * 1.05 + r * 0.3, z] });
}

/** Windows all round a drum of radius r centred at (x, z). */
function drumWindows(p: Parts, x: number, y: number, z: number, r: number, w: number, h: number): void {
  for (let k = 0; k < 8; k++) {
    const th = (k / 8) * Math.PI * 2;
    glassShape(p, roundArch(w, h), [x + Math.sin(th) * (r + 0.02), y, z + Math.cos(th) * (r + 0.02)], th);
  }
}

/** Balustrade with statues along the top of a wall, between x0 and x1. */
function balustrade(p: Parts, x0: number, x1: number, y: number, z: number, color: string, statues: number[]): void {
  p.span(x0, x1, y, y + 0.15, z - 0.35, z + 0.25, color);
  for (let x = x0 + 0.2; x < x1; x += 0.5) p.box(0.15, 0.6, 0.15, x, y + 0.45, z - 0.05, color);
  p.span(x0, x1, y + 0.75, y + 0.9, z - 0.3, z + 0.22, color);
  for (const x of statues) {
    p.box(0.6, 0.6, 0.6, x, y + 1.2, z - 0.05, STATUE);
    p.add(new THREE.CylinderGeometry(0.22, 0.3, 1.3, 8), STATUE, { at: [x, y + 2.15, z - 0.05] });
    p.add(new THREE.SphereGeometry(0.2, 8, 6), STATUE, { at: [x, y + 2.98, z - 0.05] });
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
export function stephansdom(): THREE.BufferGeometry {
  const p = new Parts();
  p.span(-12.9, 7.4, 0, 0.5, -9.6, 0.4, STONE_D);
  p.span(-12.5, 7, 0, 10, -9, -1, STONE);
  p.span(-12.6, 7.1, 9.6, 10.1, -9.1, -0.9, STONE_D);
  for (const x of [-12.2, -8.6, -5, -1.4, 2.2, 5.8]) {
    p.span(x - 0.4, x + 0.4, 0, 10.6, -1, 0.15, STONE_D);
    p.span(x - 0.46, x + 0.46, 5.5, 5.8, -1, 0.3, STONE_D);
    p.add(new THREE.ConeGeometry(0.42, 1.8, 4), STONE_D, { at: [x, 11.5, -0.42] });
  }
  for (const x of [-10.4, -6.8, -3.2, 0.4, 4.0]) lancetWindow(p, 1.7, 5.6, [x, 2.4, -1], 0);
  // The west end: a lancet beside the north tower, and a rose window in the roof's gable above it.
  lancetWindow(p, 1.6, 5.4, [-12.5, 2.4, -7.6], sideRot(-1));
  p.add(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 20), '#ffffff', { at: [-12.92, 15.4, -5], rot: [0, 0, Math.PI / 2], uv: ATLAS.glass });
  p.add(new THREE.TorusGeometry(1.05, 0.12, 6, 24), STONE_D, { at: [-12.9, 15.4, -5], rot: [0, Math.PI / 2, 0] });
  // The famous roof: two steep slopes (eaves 10 m, ridge 19 m) wearing the tile pattern from the atlas.
  const slope = Math.atan2(4.6, 9), len = Math.hypot(4.6, 9);
  p.add(new THREE.PlaneGeometry(20.6, len), '#ffffff', { at: [-2.75, 14.5, -2.7], rot: [-slope, 0, 0], uv: ATLAS.tiles });
  p.add(new THREE.PlaneGeometry(20.6, len), '#ffffff', { at: [-2.75, 14.5, -7.3], rot: [slope, Math.PI, 0], uv: ATLAS.tiles });
  for (const x of [-12.85, 7.05]) p.add(extrude([[-4.6, 0], [4.6, 0], [0, 9]], 0.3), STONE, { at: [x, 10, -5], rot: [0, Math.PI / 2, 0] });
  p.span(-12.9, 7.4, 18.9, 19.15, -5.12, -4.88, '#20242a');

  // South tower and spire, with windows on every face that shows.
  p.span(7, 13, 0, 16, -8, -2, STONE_D);
  for (const x of [8.8, 11.2]) lancetWindow(p, 0.9, 4, [x, 4.8, -2], 0);
  lancetWindow(p, 1.1, 3.2, [10, 11.3, -2], 0);
  for (const z of [-3.8, -6.2]) lancetWindow(p, 0.9, 4, [13, 4.8, z], sideRot(1));
  lancetWindow(p, 1.1, 3.2, [13, 11.3, -5], sideRot(1));
  for (const y of [7, 13.6]) p.span(6.95, 13.05, y, y + 0.25, -8.05, -1.95, STONE);
  p.span(7.6, 12.4, 16, 21.5, -7.4, -2.6, STONE);
  lancetWindow(p, 0.8, 3.2, [10, 17.2, -2.6], 0);
  lancetWindow(p, 0.8, 3.2, [12.4, 17.2, -5], sideRot(1));
  for (const [x, z] of [[7.3, -2.3], [12.7, -2.3], [7.3, -7.7], [12.7, -7.7]]) p.add(new THREE.ConeGeometry(0.45, 2.2, 4), STONE_D, { at: [x, 17.1, z] });
  p.add(extrude([[-2.4, 0], [2.4, 0], [0, 2.2]], 0.2), STONE, { at: [10, 21.5, -2.6] });
  p.add(extrude([[-2.4, 0], [2.4, 0], [0, 2.2]], 0.2), STONE, { at: [12.4, 21.5, -5], rot: [0, sideRot(1), 0] });
  const spireH = 11.5, base = 2.3, tip = 0.15;
  p.add(new THREE.CylinderGeometry(tip, base, spireH, 8, 1), STONE, { at: [10, 21.5 + spireH / 2, -5] });
  for (let l = 1; l <= 5; l++) {
    const t = l / 6, r = base - (base - tip) * t, y = 21.5 + spireH * t;
    for (let k = 0; k < 8; k++) {
      const th = (k / 8) * Math.PI * 2;
      p.box(0.22, 0.12, 0.3, 10 + Math.sin(th) * (r + 0.08), y, -5 + Math.cos(th) * (r + 0.08), STONE_D, { rot: [0, th, 0] });
    }
  }
  p.add(new THREE.SphereGeometry(0.25, 8, 6), GOLD, { at: [10, 33.05, -5] });

  // North tower, unfinished and capped with a small copper dome.
  p.span(-15, -12.5, 0, 13, -6, -2.5, STONE_D);
  for (const y of [3.3, 7.8]) lancetWindow(p, 0.8, 2.8, [-13.75, y, -2.5], 0);
  for (const y of [3.3, 7.8]) lancetWindow(p, 0.8, 2.8, [-15, y, -4.25], sideRot(-1));
  p.span(-15.05, -12.45, 12.6, 13, -6.05, -2.45, STONE);
  const top = dome(p, [-13.75, 13, -4.25], 1.7, 1.2, '#5e8f80', COPPER_DARK);
  lantern(p, -13.75, top, -4.25, 0.32, 0.9, '#5e8f80', '#5e8f80');
  return centreX(p.build({ ground: 0.15 }));
}

/** Karlskirche: portico, drum and green dome between the two spiral columns, bell pavilions at both ends. */
export function karlskirche(): THREE.BufferGeometry {
  const p = new Parts();
  p.span(-11, 11, 0, 0.6, -9.5, 1.6, '#e2d8c2');
  p.span(-6.5, 6.5, 0, 12, -12, -2.5, WALL);
  p.add(shape(roundArch(2.2, 4.2)), DARK, { at: [0, 0.6, -2.48] });
  for (const x of [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5]) {
    p.add(new THREE.CylinderGeometry(0.4, 0.44, 8.4, 12), WHITE, { at: [x, 0.6 + 4.2, 0.8] });
    p.box(1.0, 0.3, 1.0, x, 0.75, 0.8, WHITE);
    p.box(1.0, 0.35, 1.0, x, 8.85, 0.8, WHITE);
  }
  p.span(-5.4, 5.4, 9, 10, -2.5, 1.4, WHITE);
  p.add(extrude([[-5.6, 0], [5.6, 0], [0, 2.6]], 3.9), WHITE, { at: [0, 10, -2.5] });
  // The nave's sides show above the wings: a row of windows and a cornice on each.
  for (const s of [-1, 1]) {
    for (const z of [-5, -8, -11]) archWindow(p, 0.9, 1.9, [s * 6.5, 8.6, z], sideRot(s), WHITE);
    p.span(Math.min(s * 6.5, s * 6.75), Math.max(s * 6.5, s * 6.75), 11.6, 12, -12, -2.5, WHITE);
  }
  // Drum, dome, lantern.
  p.add(new THREE.CylinderGeometry(5, 5, 3, 20), WALL, { at: [0, 13.5, -7.2] });
  drumWindows(p, 0, 12.6, -7.2, 5, 0.8, 1.7);
  const top = dome(p, [0, 15, -7.2], 5, 1.1, COPPER_K, COPPER_DARK);
  lantern(p, 0, top - 0.1, -7.2, 0.85, 1.4, WALL, COPPER_K);
  // The two columns with their spiral reliefs.
  for (const x of [-8.6, 8.6]) {
    p.box(2.8, 1.2, 2.8, x, 1.2, -0.5, WALL);
    p.add(new THREE.CylinderGeometry(1.1, 1.15, 15, 16), WHITE, { at: [x, 1.8 + 7.5, -0.5] });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, a = t * 3.5 * Math.PI * 2;
      pts.push(new THREE.Vector3(x + Math.sin(a) * 1.18, 2.6 + t * 13.4, -0.5 + Math.cos(a) * 1.18));
    }
    p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.13, 4), '#b9ae95');
    p.box(2.6, 0.7, 2.6, x, 17.15, -0.5, WALL);
    p.add(new THREE.CylinderGeometry(0.7, 0.8, 1.0, 12), WALL, { at: [x, 18, -0.5] });
    p.add(new THREE.SphereGeometry(0.55, 10, 8), GOLD, { at: [x, 19, -0.5] });
  }
  // Wings and bell pavilions (kept shallow at the street end: they must clear the facade row beyond the plaza).
  for (const s of [-1, 1]) {
    p.span(Math.min(s * 6.5, s * 10.5), Math.max(s * 6.5, s * 10.5), 0, 8, -9, -3, WALL);
    archWindow(p, 0.8, 1.8, [s * 8.5, 3, -3], 0, WHITE);
    const x0 = Math.min(s * 10.5, s * 15), x1 = Math.max(s * 10.5, s * 15), cx = s * 12.75;
    p.span(x0, x1, 0, 9, -5.6, -1.5, WALL);
    for (const dx of [-1.3, 0, 1.3]) archWindow(p, 0.8, 1.9, [cx + dx, 2.6, -1.5], 0, WHITE);
    for (const z of [-2.6, -4.5]) archWindow(p, 0.8, 1.9, [s * 15, 2.6, z], sideRot(s), WHITE);
    p.span(cx - 1.25, cx + 1.25, 9, 12, -5, -2.1, WALL);
    archWindow(p, 0.7, 1.6, [cx, 9.7, -2.1], 0, WHITE);
    archWindow(p, 0.7, 1.6, [s * (12.75 + 1.25), 9.7, -3.55], sideRot(s), WHITE);
    p.span(x0, x1, 9, 9.3, -5.8, -1.3, WHITE);
    const t = dome(p, [cx, 12, -3.55], 1.3, 1.1, COPPER_K, COPPER_DARK);
    p.add(new THREE.SphereGeometry(0.28, 8, 6), GOLD, { at: [cx, t + 0.3, -3.55] });
  }
  return centreX(p.build({ ground: 0.15 }));
}

/** Hofburg (Michaelertrakt): a long palace wing with balustrade and statues, the domed central pavilion. */
export function hofburg(): THREE.BufferGeometry {
  const p = new Parts(), wall = '#f2e9d6', rust = '#e6dbc4', trim = '#fbf4e4';
  const WD = 5.2; // wing depth: the wing's street end must clear the facade row beyond the plaza
  p.span(-16, 16, 0, 3.6, -WD, 0.12, rust);
  p.span(-16, 16, 3.6, 11, -WD, 0, wall);
  p.span(-16, 16, 3.6, 3.85, -WD, 0.22, trim);
  /** A palace window (row 0 with a pediment, row 1 with a hood), its glass centred on x = 0 of the given frame. */
  const palaceWindow = (y0: number, h: number, row: number) => {
    p.add(new THREE.PlaneGeometry(0.95, h), '#ffffff', { at: [0, y0 + h / 2, 0.01], uv: ATLAS.glass });
    p.span(-0.6, -0.48, y0 - 0.1, y0 + h + 0.1, 0, 0.06, trim);
    p.span(0.48, 0.6, y0 - 0.1, y0 + h + 0.1, 0, 0.06, trim);
    p.box(1.4, 0.12, 0.22, 0, y0 - 0.12, 0.1, trim);
    if (row === 0) p.add(extrude([[-0.8, 0], [0.8, 0], [0, 0.42]], 0.14), trim, { at: [0, y0 + h + 0.12, 0] });
    else p.box(1.35, 0.14, 0.16, 0, y0 + h + 0.18, 0.08, trim);
  };
  const windowPair = () => {
    palaceWindow(4.8, 2.0, 0);
    palaceWindow(8.2, 1.8, 1);
  };
  for (const x of [-14.8, -12.4, -10, -7.6, 7.6, 10, 12.4, 14.8]) {
    glassShape(p, roundArch(1.0, 2.0), [x, 0.8, 0.13]);
    p.transformed([x, 0, 0], 0, windowPair);
  }
  // Both wing ends: the same windows round the corner, and quoins up the corners.
  for (const s of [-1, 1]) {
    for (const z of [-1.4, -3.8]) {
      glassShape(p, roundArch(1.0, 2.0), [s * 16.01, 0.8, z], sideRot(s));
      p.transformed([s * 16, 0, z], sideRot(s), windowPair);
    }
    for (let y = 3.85, k = 0; y + 0.5 <= 11; y += 0.55, k++) {
      const w = k % 2 ? 0.35 : 0.6;
      p.span(Math.min(s * 16, s * (16 - w)), Math.max(s * 16, s * (16 - w)), y, y + 0.5, 0, 0.05, trim);
      p.span(Math.min(s * 16, s * 16.05), Math.max(s * 16, s * 16.05), y, y + 0.5, -w, 0.05, trim);
    }
  }
  p.span(-16, 16, 11, 11.35, -WD, 0.35, trim);
  balustrade(p, -16, -6, 11.35, 0, trim, [-14, -10.8, -7.6]);
  balustrade(p, 6, 16, 11.35, 0, trim, [7.6, 10.8, 14]);
  // Central pavilion with its gate, columns, drum and dome.
  p.span(-6, 6, 0, 12.4, -8, 1.2, '#f7efe0');
  p.span(-6.1, 6.1, 0, 3.6, -8, 1.32, rust);
  p.add(shape(roundArch(3.6, 5.6)), DARK, { at: [0, 0, 1.34] });
  p.add(extrude(archRing(4.4, 6.0, 3.6, 5.6), 0.15), trim, { at: [0, 0, 1.32] });
  for (const x of [-1.5, 1.5]) archWindow(p, 0.9, 2.0, [x, 7.2, 1.2], 0, trim);
  // The pavilion stands 1.2 m proud of the wing: room for one window on each side.
  for (const s of [-1, 1]) archWindow(p, 0.8, 2.0, [s * 6, 7.2, 0.6], sideRot(s), trim);
  for (const x of [-4.7, -2.9, 2.9, 4.7]) {
    p.box(0.9, 1.2, 0.9, x, 0.6, 2.1, trim);
    p.add(new THREE.CylinderGeometry(0.34, 0.38, 8.6, 12), '#fbf6ea', { at: [x, 1.2 + 4.3, 2.1] });
    p.box(0.9, 0.5, 0.9, x, 10.05, 2.1, trim);
  }
  p.span(-5.4, 5.4, 10.3, 11.1, 1.2, 2.6, '#fbf6ea');
  p.span(-6.2, 6.2, 12.4, 12.75, -8.2, 1.5, trim);
  p.add(new THREE.CylinderGeometry(4.6, 4.6, 2.4, 20), wall, { at: [0, 13.95, -3.4] });
  drumWindows(p, 0, 13.3, -3.4, 4.6, 0.7, 1.4);
  const top = dome(p, [0, 15.15, -3.4], 4.8, 0.95, COPPER, '#4f7d6b');
  lantern(p, 0, top - 0.1, -3.4, 0.7, 1.1, COPPER, COPPER);
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
export function riesenrad(): RiesenradParts {
  const R = 14.5, RI = 13.6, hubY = 20.7, rim = '#3d4552', dark = '#363c46', spokes = 32;
  const w = new Parts();
  for (const z of [-0.95, 0.95]) {
    w.add(new THREE.TorusGeometry(R, 0.2, 6, 64), rim, { at: [0, 0, z] });
    w.add(new THREE.TorusGeometry(RI, 0.12, 4, 64), rim, { at: [0, 0, z] });
    for (let k = 0; k < spokes; k++) {
      const th = (k / spokes) * Math.PI * 2, mid = (1.1 + RI) / 2;
      w.box(0.08, RI - 1.1, 0.08, Math.cos(th) * mid, Math.sin(th) * mid, z, rim, { rot: [0, 0, th - Math.PI / 2] });
    }
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2, b = ((k + 1) / 64) * Math.PI * 2;
      const [r0, r1] = k % 2 ? [RI, R] : [R, RI];
      beam(w, [Math.cos(a) * r0, Math.sin(a) * r0, z], [Math.cos(b) * r1, Math.sin(b) * r1, z], 0.06, rim);
    }
  }
  for (let k = 0; k < spokes; k++) {
    const th = (k / spokes) * Math.PI * 2, r = (R + RI) / 2;
    w.box(0.08, 0.08, 1.9, Math.cos(th) * r, Math.sin(th) * r, 0, rim);
  }
  w.add(new THREE.CylinderGeometry(1.1, 1.1, 2.3, 16), dark, { rot: [Math.PI / 2, 0, 0] });

  const s = new Parts();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(s, [0, hubY, sz * 1.25], [sx * 7.4, 0, sz * 2.6], 0.5, '#5c6470');
  for (const [y, half] of [[11, 4.2], [6.5, 5.1]] as const) for (const sz of [-1, 1]) {
    const z = sz * (1.25 + (2.6 - 1.25) * (1 - y / hubY));
    beam(s, [-half, y, z], [half, y, z], 0.28, '#5c6470');
  }
  for (const sz of [-1, 1]) s.box(1.2, 1.2, 0.4, 0, hubY, sz * 1.4, dark);
  // The base house: windows on the front and both ends, a door, corner pilasters.
  const cream = '#efe3cf', trim = '#fbf6ea';
  s.span(-4.6, 4.6, 0, 3.4, -2.2, 2.2, cream);
  s.span(-4.7, 4.7, 0, 0.35, -2.3, 2.3, '#ded1b8');
  s.span(-4.7, 4.7, 3.1, 3.4, -2.3, 2.3, trim);
  for (const x of [-3, -1, 1, 3]) archWindow(s, 0.9, 1.6, [x, 0.9, 2.2], 0, trim);
  for (const sd of [-1, 1]) {
    archWindow(s, 0.9, 1.6, [sd * 4.6, 0.9, -0.9], sideRot(sd), trim);
    s.span(Math.min(sd * 4.6, sd * 4.62), Math.max(sd * 4.6, sd * 4.62), 0.35, 2.75, 0.55, 1.65, '#5a3a2a');
    s.span(Math.min(sd * 4.6, sd * 4.66), Math.max(sd * 4.6, sd * 4.66), 2.75, 2.87, 0.45, 1.75, trim);
    for (const z of [-2.2, 2.2]) s.span(Math.min(sd * 4.3, sd * 4.7), Math.max(sd * 4.3, sd * 4.7), 0.35, 3.1, z - 0.2, z + 0.2, trim);
  }
  s.add(prismX([[2.5, 0], [-2.5, 0], [-1.6, 1.1], [1.6, 1.1]], 9.6), '#c4302b', { at: [0, 3.4, 0] });

  const c = new Parts();
  c.box(2.2, 1.5, 1.5, 0, 0, 0, '#c4302b');
  c.box(2.26, 0.45, 1.56, 0, 0.2, 0, '#f4efe6');
  for (const z of [-0.79, 0.79]) for (const x of [-0.7, 0, 0.7]) {
    c.add(new THREE.PlaneGeometry(0.55, 0.36), '#ffffff', { at: [x, 0.2, z], rot: [0, z < 0 ? Math.PI : 0, 0], uv: ATLAS.glass });
  }
  for (const x of [-1.14, 1.14]) c.add(new THREE.PlaneGeometry(1.1, 0.36), '#ffffff', { at: [x, 0.2, 0], rot: [0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0], uv: ATLAS.glass });
  c.box(2.4, 0.18, 1.7, 0, 0.84, 0, '#8e2420');
  c.box(0.1, 0.35, 0.1, 0, 1.1, 0, dark);

  return { wheel: w.build(), support: s.build({ ground: 0.15 }), cabin: c.build(), hubY, cabinRadius: RI, cabinDrop: 1.1, cabins: 15 };
}
