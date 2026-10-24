import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { LandmarkId, Route } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface Landmarks {
  update(dist: number, time: number, route: Route): void;
}

/** 3D landmarks instead of the paper cards: each model's base at y = 0, front facing +z (placed and turned here). */
export interface LandmarkModels {
  stephansdom: THREE.Object3D;
  karlskirche: THREE.Object3D;
  hofburg: THREE.Object3D;
  riesenrad: { object: THREE.Object3D; update(time: number): void };
}

export interface Placement {
  art: string;
  x: number;
  rotY: number;
  /** World size: give the height (width follows the image aspect) or the width. */
  height?: number;
  width?: number;
  lift?: number;
}

export const PLACEMENTS: Record<Exclude<LandmarkId, 'riesenrad'>, Placement> = {
  stephansdom: { art: 'landmark-stephansdom', x: 21.5, rotY: -0.45, height: 33 },
  karlskirche: { art: 'landmark-karlskirche', x: -22.5, rotY: 0.45, height: 23.4 },
  hofburg: { art: 'landmark-hofburg', x: 24, rotY: -0.45, height: 21 },
  tram: { art: 'landmark-tram', x: -6.3, rotY: Math.PI / 2, width: 14, lift: 0.1 },
};
/** The Riesenrad stands 8 m past its route position (the finish line), at x = 24, turned a little to the street. */
export const RIESENRAD = { x: 24, rotY: -0.35, past: 8 };

function card(c: HTMLCanvasElement, size: { height?: number; width?: number }): { mesh: THREE.Mesh; w: number; h: number } {
  const aspect = c.width / c.height;
  const h = size.height ?? (size.width ?? 10) / aspect;
  const w = size.width ?? h * aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: toTexture(c), alphaTest: 0.5, side: THREE.DoubleSide }));
  return { mesh, w, h };
}

/** The paper Riesenrad: rotating wheel card, cabins that stay upright, static support hanging from the hub. */
function cardWheel(art: ArtSet): { object: THREE.Object3D; update(time: number): void } {
  const D = 29;
  const wheelGroup = new THREE.Group();
  const wheel = card(art.get('riesenrad-wheel'), { width: D }).mesh;
  wheelGroup.add(wheel);
  const support = card(art.get('riesenrad-support'), { width: D });
  support.mesh.position.set(0, -support.h / 2, -0.4);
  wheelGroup.add(support.mesh);
  const cabinArt = art.get('riesenrad-cabin');
  const cabinMat = new THREE.MeshBasicMaterial({ map: toTexture(cabinArt), alphaTest: 0.5, side: THREE.DoubleSide });
  const cabinGeo = new THREE.PlaneGeometry(2.2, (2.2 * cabinArt.height) / cabinArt.width);
  const cabins = Array.from({ length: 15 }, () => {
    const m = new THREE.Mesh(cabinGeo, cabinMat);
    m.position.z = 0.4;
    wheelGroup.add(m);
    return m;
  });
  wheelGroup.position.y = support.h;
  const object = new THREE.Group();
  object.add(wheelGroup);
  return {
    object,
    update(time) {
      const angle = time * 0.12;
      wheel.rotation.z = angle;
      cabins.forEach((m, i) => {
        const a = angle + (i * Math.PI * 2) / 15;
        m.position.x = Math.cos(a) * D * 0.469;
        m.position.y = Math.sin(a) * D * 0.469 - 1.1;
      });
    },
  };
}

export function createLandmarks(scene: THREE.Scene, art: ArtSet, models?: LandmarkModels): Landmarks {
  const objects = new Map<LandmarkId, THREE.Object3D>();
  for (const [id, pl] of Object.entries(PLACEMENTS) as Array<[Exclude<LandmarkId, 'riesenrad'>, Placement]>) {
    const model = id === 'tram' ? undefined : models?.[id];
    let o: THREE.Object3D, y = pl.lift ?? 0;
    if (model) o = model;
    else {
      const c = card(art.get(pl.art), pl);
      o = c.mesh;
      y += c.h / 2;
    }
    o.position.set(pl.x, y, 0);
    o.rotation.y = pl.rotY;
    scene.add(o);
    objects.set(id, o);
  }

  const wheel = models?.riesenrad ?? cardWheel(art);
  wheel.object.position.x = RIESENRAD.x;
  wheel.object.rotation.y = RIESENRAD.rotY;
  scene.add(wheel.object);
  objects.set('riesenrad', wheel.object);

  const finish = new THREE.Group();
  const banner = card(art.get('banner-finish'), { width: 10.4 }).mesh;
  banner.position.y = 6.2;
  finish.add(banner);
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 0.28), new THREE.MeshBasicMaterial({ color: 0x3a2a22 }));
    pole.position.set(s * 5.25, 3.6, 0);
    finish.add(pole);
  }
  const checker = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: toTexture(P.paintCheckerA()) }));
  checker.rotation.x = -Math.PI / 2;
  checker.position.y = 0.04;
  finish.add(checker);
  scene.add(finish);

  return {
    update(dist, time, route) {
      for (const lm of route.landmarks) {
        const o = objects.get(lm.id);
        if (!o) continue;
        const r = lm.at - dist + (lm.id === 'riesenrad' ? RIESENRAD.past : 0);
        o.position.z = -r;
        o.visible = r > -60 && r < 280;
      }
      const fr = route.length - dist;
      finish.position.z = -fr;
      finish.visible = fr > -60 && fr < 280;
      wheel.update(time);
    },
  };
}
