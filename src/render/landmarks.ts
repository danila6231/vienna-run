import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { LandmarkId, Route } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface Landmarks {
  update(dist: number, time: number, route: Route): void;
}

/** The 3D landmark models: each one's base at y = 0, front facing +z (placed and turned here). */
export interface LandmarkModels {
  stephansdom: THREE.Object3D;
  karlskirche: THREE.Object3D;
  hofburg: THREE.Object3D;
  riesenrad: { object: THREE.Object3D; update(time: number): void };
}

type Building = Exclude<LandmarkId, 'riesenrad' | 'tram'>;

/** Where each landmark stands beside the street, turned a little towards it (positive x = right side). */
export const PLACEMENTS: Record<Building, { x: number; rotY: number }> = {
  stephansdom: { x: 21.5, rotY: -0.45 },
  karlskirche: { x: -22.5, rotY: 0.45 },
  hofburg: { x: 24, rotY: -0.45 },
};
/** The Riesenrad stands 8 m past its route position (the finish line), at x = 24, turned a little to the street. */
export const RIESENRAD = { x: 24, rotY: -0.35, past: 8 };
/** The tram is a paper card parked along the left curb. */
const TRAM = { x: -6.3, rotY: Math.PI / 2, width: 14, lift: 0.1 };

function card(c: HTMLCanvasElement, width: number): { mesh: THREE.Mesh; h: number } {
  const h = width / (c.width / c.height);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: toTexture(c), alphaTest: 0.5, side: THREE.DoubleSide }));
  return { mesh, h };
}

export function createLandmarks(scene: THREE.Scene, art: ArtSet, models: LandmarkModels): Landmarks {
  const objects = new Map<LandmarkId, THREE.Object3D>();
  for (const [id, pl] of Object.entries(PLACEMENTS) as Array<[Building, { x: number; rotY: number }]>) {
    const o = models[id];
    o.position.set(pl.x, 0, 0);
    o.rotation.y = pl.rotY;
    scene.add(o);
    objects.set(id, o);
  }
  const tram = card(art.get('landmark-tram'), TRAM.width);
  tram.mesh.position.set(TRAM.x, tram.h / 2 + TRAM.lift, 0);
  tram.mesh.rotation.y = TRAM.rotY;
  scene.add(tram.mesh);
  objects.set('tram', tram.mesh);

  const wheel = models.riesenrad;
  wheel.object.position.x = RIESENRAD.x;
  wheel.object.rotation.y = RIESENRAD.rotY;
  scene.add(wheel.object);
  objects.set('riesenrad', wheel.object);

  const finish = new THREE.Group();
  const banner = card(art.get('banner-finish'), 10.4).mesh;
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
