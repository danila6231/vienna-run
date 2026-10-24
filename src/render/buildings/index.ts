import * as THREE from 'three';
import type { LandmarkModels } from '../landmarks';
import type { HouseRows, Variant } from '../street';
import { backGeometry, BACK_VARIANTS, houseGeometry, HOUSE_VARIANTS } from './house';
import { hofburg, karlskirche, riesenrad, stephansdom } from './landmarks3d';
import { createMaterials } from './materials';

/** The 3D street: house variants for the facade rows, the landmark models, and the light they share. */
export interface BuildingSet {
  readonly houses: HouseRows;
  readonly landmarks: LandmarkModels;
  /** Adds the sun and sky light the buildings are lit by. */
  light(scene: THREE.Scene): void;
  dispose(): void;
}

export function createBuildingSet(): BuildingSet {
  const mats = createMaterials();
  const geos: THREE.BufferGeometry[] = [];
  const keep = (g: THREE.BufferGeometry) => (geos.push(g), g);
  const variant = (g: THREE.BufferGeometry, lite: THREE.BufferGeometry): Variant => ({ geo: keep(g), lite: keep(lite), mat: mats.material, h: 0 });
  const mesh = (g: THREE.BufferGeometry) => new THREE.Mesh(keep(g), mats.material);

  const rr = riesenrad();
  const wheel = mesh(rr.wheel);
  wheel.position.y = rr.hubY;
  const cabins = new THREE.InstancedMesh(keep(rr.cabin), mats.material, rr.cabins);
  cabins.frustumCulled = false; // instances move every frame; the bounding sphere of the base geometry would be wrong
  const wheelGroup = new THREE.Group();
  wheelGroup.add(mesh(rr.support), wheel, cabins);
  const m4 = new THREE.Matrix4();

  return {
    houses: {
      front: Array.from({ length: HOUSE_VARIANTS }, (_, i) => variant(houseGeometry(i), houseGeometry(i, true))),
      back: Array.from({ length: BACK_VARIANTS }, (_, i) => variant(backGeometry(i), backGeometry(i, true))),
    },
    landmarks: {
      stephansdom: mesh(stephansdom()),
      karlskirche: mesh(karlskirche()),
      hofburg: mesh(hofburg()),
      riesenrad: {
        object: wheelGroup,
        update(time) {
          const angle = time * 0.12;
          wheel.rotation.z = angle;
          for (let i = 0; i < rr.cabins; i++) {
            const a = angle + (i * Math.PI * 2) / rr.cabins;
            m4.makeTranslation(Math.cos(a) * rr.cabinRadius, rr.hubY + Math.sin(a) * rr.cabinRadius - rr.cabinDrop, 0);
            cabins.setMatrixAt(i, m4);
          }
          cabins.instanceMatrix.needsUpdate = true;
        },
      },
    },
    light(scene) {
      mats.light(scene);
    },
    dispose() {
      for (const g of geos) g.dispose();
      cabins.dispose();
      mats.dispose();
    },
  };
}
