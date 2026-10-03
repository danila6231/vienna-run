import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { inPlaza } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';
import { initialPositions, recycle, type RowSpec } from './rows';
import { heightForWidth } from './sizing';

export interface Street {
  update(dist: number): void;
  reset(): void;
  setDetail(high: boolean): void;
}

/** One look a pooled card can take: its own geometry (sized by its image shape), material and height. */
interface Variant {
  geo: THREE.PlaneGeometry;
  mat: THREE.Material;
  h: number;
}

interface Row extends RowSpec {
  kind: 'front' | 'back' | 'lamp';
  side: -1 | 1;
  meshes: THREE.Mesh[];
  variants: Variant[];
  p: number[];
}

const LEN = 320; // length of the road strip, metres
const MID = -140; // its centre: from 20 m behind the runner to 300 m ahead
const DASHES = 40; // lane dashes per line, one every 8 m

export function createStreet(scene: THREE.Scene, art: ArtSet): Street {
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial(o);
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  };

  const ground = flat(new THREE.PlaneGeometry(700, 700), basic({ color: 0xd8c9ad }));
  ground.position.set(0, -0.05, -200);
  scene.add(ground);
  const roadTex = toTexture(art.get('texture-road'), [1, LEN / 9]);
  const road = flat(new THREE.PlaneGeometry(9, LEN), basic({ map: roadTex }));
  road.position.set(0, 0, MID);
  scene.add(road);
  const walkTex = toTexture(art.get('texture-sidewalk'), [1, LEN / 3.4]);
  for (const s of [-1, 1] as const) {
    const walk = flat(new THREE.PlaneGeometry(3.4, LEN), basic({ map: walkTex }));
    walk.position.set(s * 6.2, 0.02, MID);
    scene.add(walk);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, LEN), basic({ color: 0xf3ece0 }));
    curb.position.set(s * 4.55, 0.1, MID);
    scene.add(curb);
    const shade = flat(new THREE.PlaneGeometry(1.8, LEN), basic({ map: toTexture(P.shadowStrip(s)), transparent: true, depthWrite: false }));
    shade.position.set(s * 7.0, 0.04, MID);
    scene.add(shade);
  }

  // Lane dashes are drawn here so designer road textures stay plain cobbles.
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 3), basic({ color: 0xfbf6ea }), DASHES * 2);
  scene.add(dashes);
  const dm = new THREE.Matrix4();
  const flatRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const updateDashes = (dist: number) => {
    const span = DASHES * 8;
    for (let i = 0; i < DASHES; i++) {
      const z = 14 - ((((i * 8 - dist) % span) + span) % span);
      dm.copy(flatRot).setPosition(-1.3, 0.015, z);
      dashes.setMatrixAt(i, dm);
      dm.copy(flatRot).setPosition(1.3, 0.015, z);
      dashes.setMatrixAt(i + DASHES, dm);
    }
    dashes.instanceMatrix.needsUpdate = true;
  };

  const rows: Row[] = [];
  const place = (m: THREE.Mesh, v: Variant) => {
    m.geometry = v.geo;
    m.material = v.mat;
    m.position.y = v.h / 2; // bottom edge on the ground, whatever the image's height
  };
  const addRow = (kind: Row['kind'], side: -1 | 1, spec: RowSpec, variants: Variant[], x: number, rotY: number) => {
    const meshes = Array.from({ length: spec.count }, (_, i) => {
      const m = new THREE.Mesh();
      place(m, variants[i % variants.length]);
      m.position.x = x;
      m.rotation.y = rotY;
      scene.add(m);
      return m;
    });
    rows.push({ ...spec, kind, side, meshes, variants, p: initialPositions(spec) });
  };
  /** Cards of a fixed width (they tile along the street); each image keeps its own shape. */
  const cards = (canvases: HTMLCanvasElement[], width: number, tint?: number): Variant[] =>
    canvases.map((c) => {
      const h = heightForWidth(width, c.width / c.height);
      return { geo: new THREE.PlaneGeometry(width, h), mat: basic({ map: toTexture(c), alphaTest: 0.5, ...(tint ? { color: tint } : {}) }), h };
    });

  const facades = art.group('facade-');
  // The left side faces away from the light, so it is tinted a little darker.
  addRow('front', -1, { count: 27, spacing: 8, offset: 0 }, cards(facades, 8, 0xe7dfd4), -7.9, Math.PI / 2);
  addRow('front', 1, { count: 27, spacing: 8, offset: 4 }, cards(facades, 8), 7.9, -Math.PI / 2);
  const backs = cards(art.group('back-'), 10);
  addRow('back', -1, { count: 24, spacing: 10, offset: 3 }, backs, -13.5, Math.PI / 2);
  addRow('back', 1, { count: 24, spacing: 10, offset: 8 }, backs, 13.5, -Math.PI / 2);
  const lampArt = art.get('prop-lamp');
  const lampH = 4.5;
  const lamps: Variant[] = [{ geo: new THREE.PlaneGeometry((lampH * lampArt.width) / lampArt.height, lampH), mat: basic({ map: toTexture(lampArt), alphaTest: 0.5 }), h: lampH }];
  addRow('lamp', -1, { count: 15, spacing: 16, offset: 2 }, lamps, -5.05, 0);
  addRow('lamp', 1, { count: 15, spacing: 16, offset: 10 }, lamps, 5.05, 0);

  let showBack = true;
  return {
    update(dist) {
      roadTex.offset.y = (dist / 9) % 1;
      walkTex.offset.y = (dist / 3.4) % 1;
      updateDashes(dist);
      for (const row of rows) {
        const span = row.count * row.spacing;
        row.meshes.forEach((m, i) => {
          const p = recycle(row.p[i], dist, span);
          if (p !== row.p[i] && row.kind !== 'lamp') place(m, row.variants[Math.floor(Math.random() * row.variants.length)]);
          row.p[i] = p;
          m.position.z = dist - p;
          m.visible = row.kind === 'lamp' || ((row.kind === 'front' || showBack) && !inPlaza(p, row.side, row.kind === 'back' ? 4 : 0));
        });
      }
    },
    reset() {
      for (const row of rows) row.p = initialPositions(row);
    },
    setDetail(high) {
      showBack = high;
    },
  };
}
