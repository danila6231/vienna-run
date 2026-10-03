import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import { gradientTexture, toTexture } from './canvas';

export interface Sky {
  update(dt: number): void;
  setDetail(high: boolean): void;
}

export function createSky(scene: THREE.Scene, art: ArtSet): Sky {
  scene.background = art.has('sky') ? toTexture(art.get('sky')) : gradientTexture(['#97bdd6', '#cbdcdf', '#f3e4c7']);
  scene.fog = new THREE.Fog(0xf2e3c6, 60, 210);

  const sk = art.get('skyline');
  const skyW = 560, skyH = (skyW * sk.height) / sk.width;
  const skyline = new THREE.Mesh(
    new THREE.PlaneGeometry(skyW, skyH),
    new THREE.MeshBasicMaterial({ map: toTexture(sk), transparent: true, fog: false, depthWrite: false }),
  );
  skyline.position.set(0, skyH / 2 - 13, -250);
  scene.add(skyline);

  const cloudArt = art.group('cloud-');
  const cloudMats = cloudArt.map((c) => new THREE.SpriteMaterial({ map: toTexture(c), fog: false }));
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const c = cloudArt[i % cloudArt.length];
    const s = new THREE.Sprite(cloudMats[i % cloudMats.length]);
    s.scale.set(34, (34 * c.height) / c.width, 1);
    s.position.set(-130 + i * 44 + (i % 3) * 7, 36 + ((i * 37) % 22), -240);
    scene.add(s);
    return s;
  });

  return {
    update(dt) {
      clouds.forEach((s, i) => {
        s.position.x += dt * (0.6 + i * 0.1);
        if (s.position.x > 170) s.position.x = -170;
      });
    },
    setDetail(high) {
      clouds.forEach((s) => (s.visible = high));
    },
  };
}
