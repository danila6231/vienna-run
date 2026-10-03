import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { LANDMARKS, type LandmarkId } from '../core/route';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface Landmarks {
  update(dist: number, time: number): void;
}

interface Placement {
  art: string;
  x: number;
  rotY: number;
  /** World size: give the height (width follows the image aspect) or the width. */
  height?: number;
  width?: number;
  lift?: number;
}

const PLACEMENTS: Record<Exclude<LandmarkId, 'riesenrad'>, Placement> = {
  stephansdom: { art: 'landmark-stephansdom', x: 21.5, rotY: -0.45, height: 33 },
  karlskirche: { art: 'landmark-karlskirche', x: -22.5, rotY: 0.45, height: 23.4 },
  hofburg: { art: 'landmark-hofburg', x: 24, rotY: -0.45, height: 21 },
  tram: { art: 'landmark-tram', x: -6.3, rotY: Math.PI / 2, width: 14, lift: 0.1 },
};

function card(c: HTMLCanvasElement, size: { height?: number; width?: number }): { mesh: THREE.Mesh; w: number; h: number } {
  const aspect = c.width / c.height;
  const h = size.height ?? (size.width ?? 10) / aspect;
  const w = size.width ?? h * aspect;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: toTexture(c), alphaTest: 0.5, side: THREE.DoubleSide }));
  return { mesh, w, h };
}

export function createLandmarks(scene: THREE.Scene, art: ArtSet): Landmarks {
  const objects = new Map<LandmarkId, THREE.Object3D>();
  for (const [id, pl] of Object.entries(PLACEMENTS) as Array<[LandmarkId, Placement]>) {
    const { mesh, h } = card(art.get(pl.art), pl);
    mesh.position.set(pl.x, h / 2 + (pl.lift ?? 0), 0);
    mesh.rotation.y = pl.rotY;
    scene.add(mesh);
    objects.set(id, mesh);
  }

  // Riesenrad: rotating wheel, cabins that stay upright, static support hanging from the hub.
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
  wheelGroup.position.set(24, support.h, 0);
  wheelGroup.rotation.y = -0.35;
  scene.add(wheelGroup);
  objects.set('riesenrad', wheelGroup);

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
  const finishAt = LANDMARKS.find((l) => l.id === 'riesenrad')?.at ?? 600;

  return {
    update(dist, time) {
      for (const lm of LANDMARKS) {
        const o = objects.get(lm.id);
        if (!o) continue;
        const r = lm.at - dist + (lm.id === 'riesenrad' ? 8 : 0);
        o.position.z = -r;
        o.visible = r > -60 && r < 280;
      }
      const fr = finishAt - dist;
      finish.position.z = -fr;
      finish.visible = fr > -60 && fr < 280;
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
