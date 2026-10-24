import * as THREE from 'three';
import type { LandmarkModels } from '../landmarks';
import type { HouseRows, Variant } from '../street';
import { backGeometry, BACK_VARIANTS, houseGeometry, HOUSE_VARIANTS } from './house';
import { DETAIL, type BuildingStyle } from './kit';
import { hofburg, karlskirche, riesenrad, stephansdom } from './landmarks3d';
import { createMaterials } from './materials';

export { BUILDING_STYLES, type BuildingStyle } from './kit';

/** Everything one 3D look needs: house variants for the street rows, landmark models, its light and material. */
export interface BuildingSet {
  readonly style: BuildingStyle;
  readonly houses: HouseRows;
  readonly landmarks: LandmarkModels;
  /** The one material every building shares (meshes using it cast and receive shadows on the realistic look). */
  readonly material: THREE.Material;
  readonly shadows: boolean;
  /** Adds this look's sun and sky light to the scene. */
  light(scene: THREE.Scene): void;
  dispose(): void;
}

export function createBuildingSet(style: BuildingStyle): BuildingSet {
  const mats = createMaterials(style);
  const detail = DETAIL[style];
  const geos: THREE.BufferGeometry[] = [];
  const keep = (g: THREE.BufferGeometry) => (geos.push(g), g);
  const variant = (g: THREE.BufferGeometry): Variant => ({ geo: keep(g), mat: mats.material, h: 0 });
  const mesh = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(keep(g), mats.material);
    m.castShadow = m.receiveShadow = mats.shadows;
    return m;
  };

  const rr = riesenrad(detail);
  const wheel = mesh(rr.wheel);
  wheel.position.y = rr.hubY;
  const cabins = new THREE.InstancedMesh(keep(rr.cabin), mats.material, rr.cabins);
  cabins.castShadow = mats.shadows;
  cabins.frustumCulled = false; // instances move every frame; the bounding sphere of the base geometry would be wrong
  const wheelGroup = new THREE.Group();
  wheelGroup.add(mesh(rr.support), wheel, cabins);
  const m4 = new THREE.Matrix4();

  return {
    style,
    material: mats.material,
    shadows: mats.shadows,
    houses: {
      front: Array.from({ length: HOUSE_VARIANTS }, (_, i) => variant(houseGeometry(i, detail))),
      back: Array.from({ length: BACK_VARIANTS }, (_, i) => variant(backGeometry(i, detail))),
    },
    landmarks: {
      stephansdom: mesh(stephansdom(detail)),
      karlskirche: mesh(karlskirche(detail)),
      hofburg: mesh(hofburg(detail)),
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
