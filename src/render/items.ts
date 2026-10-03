import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { BAD_TYPES, GOOD_TYPES, type Item, type ItemType } from '../core/types';
import { toTexture } from './canvas';
import * as P from './placeholders/paint';

export interface ItemsLayer {
  sync(run: Run, px: number): void;
  reset(): void;
  material(type: ItemType): THREE.SpriteMaterial;
}

interface Obj {
  sp: THREE.Sprite;
  sh: THREE.Mesh;
}

const SIZE = 1.7;

export function createItems(scene: THREE.Scene, art: ArtSet, laneWidth: number): ItemsLayer {
  const mats = Object.fromEntries(
    [...GOOD_TYPES, ...BAD_TYPES].map((t) => [t, new THREE.SpriteMaterial({ map: toTexture(art.get(`item-${t}`)), alphaTest: 0.3 })]),
  ) as Record<ItemType, THREE.SpriteMaterial>;
  const blobMat = new THREE.MeshBasicMaterial({ map: toTexture(P.blobCanvas()), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(1.5, 0.75);
  const pool: Obj[] = [];
  const live = new Map<number, Obj>();

  const take = (type: ItemType): Obj => {
    let o = pool.pop();
    if (!o) {
      const sh = new THREE.Mesh(blobGeo, blobMat);
      sh.rotation.x = -Math.PI / 2;
      o = { sp: new THREE.Sprite(mats[type]), sh };
    }
    o.sp.material = mats[type];
    o.sp.visible = true;
    o.sh.visible = true;
    scene.add(o.sp, o.sh);
    return o;
  };
  const give = (id: number) => {
    const o = live.get(id);
    if (!o) return;
    scene.remove(o.sp, o.sh);
    pool.push(o);
    live.delete(id);
  };
  const place = (o: Obj, it: Item, r: number, px: number, t: number) => {
    const x = it.lane * laneWidth;
    if (it.state === 'live') {
      o.sp.position.set(x, 1.3 + Math.sin(t * 3 + it.id) * 0.16, -r);
      o.sp.scale.set(SIZE, SIZE, 1);
      o.sh.visible = true;
      o.sh.position.set(x, 0.045, -r);
    } else if (it.state === 'taken') {
      // Flies up onto the waiter's tray.
      const k = Math.min(1, it.t / 0.3);
      o.sp.position.set(x + (px + 0.5 - x) * k, 1.3 + 1.9 * k, -r * (1 - k));
      o.sp.scale.set(SIZE - k, SIZE - k, 1);
      o.sh.visible = false;
      o.sp.visible = k < 1;
    } else {
      // Obstacle: puffs up and vanishes.
      const k = Math.min(1, it.t / 0.25);
      o.sp.scale.set(SIZE * (1 + k * 0.8), SIZE * (1 + k * 0.8), 1);
      o.sp.position.set(x, 1.3 + k, -r);
      o.sh.visible = false;
      o.sp.visible = k < 1;
    }
  };

  return {
    material: (t) => mats[t],
    reset() {
      for (const id of [...live.keys()]) give(id);
    },
    sync(run, px) {
      for (const it of run.items) {
        const r = it.at - run.dist;
        const done = it.state !== 'live' && it.t > 0.35;
        if (r > 230 || r < -12 || done) {
          give(it.id);
          continue;
        }
        let o = live.get(it.id);
        if (!o) {
          o = take(it.type);
          live.set(it.id, o);
        }
        place(o, it, r, px, run.time);
      }
    },
  };
}
