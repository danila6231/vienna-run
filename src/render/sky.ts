import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { gradientTexture, toTexture } from './canvas';
import type { Reach } from './reach';

export interface Sky {
  update(dt: number): void;
  /** Moves the fog, and the skyline and clouds with it, out to how far ahead the player should see. */
  setReach(r: Reach): void;
}

export function createSky(scene: THREE.Scene, art: ArtSet): Sky {
  scene.background = art.has('sky') ? toTexture(art.get('sky')) : gradientTexture(['#97bdd6', '#cbdcdf', '#f3e4c7']);
  const fog = new THREE.Fog(0xf2e3c6, 60, 210);
  scene.fog = fog;
  // The skyline and the clouds hang from the camera's resting spot (see world.ts), so scaling them moves them
  // further back without changing their size on screen.
  const backdrop = new THREE.Group();
  backdrop.position.set(0, 4.4, 8.2);
  scene.add(backdrop);

  const sk = art.get('skyline');
  const skyW = 560, skyH = (skyW * sk.height) / sk.width;
  const skyline = new THREE.Mesh(
    new THREE.PlaneGeometry(skyW, skyH),
    new THREE.MeshBasicMaterial({ map: toTexture(sk), transparent: true, fog: false, depthWrite: false }),
  );
  skyline.position.set(0, skyH / 2 - 13 - backdrop.position.y, -250 - backdrop.position.z);
  backdrop.add(skyline);

  const cloudArt = art.group('cloud-');
  const cloudMats = cloudArt.map((c) => new THREE.SpriteMaterial({ map: toTexture(c), fog: false }));
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const c = cloudArt[i % cloudArt.length];
    const s = new THREE.Sprite(cloudMats[i % cloudMats.length]);
    s.scale.set(34, (34 * c.height) / c.width, 1);
    s.position.set(-130 + i * 44 + (i % 3) * 7, 36 + ((i * 37) % 22) - backdrop.position.y, -240 - backdrop.position.z);
    backdrop.add(s);
    return s;
  });

  return {
    update(dt) {
      clouds.forEach((s, i) => {
        s.position.x += dt * (0.6 + i * 0.1);
        if (s.position.x > 170) s.position.x = -170;
      });
    },
    setReach(r) {
      fog.near = r.fogNear;
      fog.far = r.fogFar;
      backdrop.scale.setScalar(r.scale);
    },
  };
}
