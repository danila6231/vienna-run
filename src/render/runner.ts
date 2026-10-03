import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import type { GoodType } from '../core/types';
import { toTexture } from './canvas';
import type { ItemsLayer } from './items';
import * as P from './placeholders/paint';

export interface Runner {
  /** Draws the waiter for this frame and returns his x position in metres. */
  update(run: Run, frameDt: number): number;
}

/** Tray centre inside a waiter frame: share of width from the left, share of height from the top (docs/ASSET_SPEC.md). */
const TRAY = { u: 0.734, v: 0.094 };
const HEIGHT = 3.0;

export function createRunner(scene: THREE.Scene, art: ArtSet, items: ItemsLayer, laneWidth: number): Runner {
  const runArt = art.group('waiter-run-');
  const runFrames = runArt.map((c) => toTexture(c));
  const stumbleFrames = art.group('waiter-stumble-').map((c) => toTexture(c));
  const celebrateFrames = art.group('waiter-celebrate-').map((c) => toTexture(c));
  const width = (HEIGHT * runArt[0].width) / runArt[0].height;

  const mat = new THREE.SpriteMaterial({ map: runFrames[0], alphaTest: 0.3 });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0);
  sprite.scale.set(width, HEIGHT, 1);
  scene.add(sprite);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.9),
    new THREE.MeshBasicMaterial({ map: toTexture(P.blobCanvas()), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.035;
  scene.add(blob);
  const stack = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(items.material('sacher'));
    s.scale.set(0.72, 0.72, 1);
    s.visible = false;
    scene.add(s);
    return s;
  });
  // The treat knocked off the tray by an obstacle tumbles to the ground. It gets its own material copy,
  // because spinning a shared material would spin every treat of that type on the road too.
  const falling = new THREE.Sprite(items.material('sacher').clone());
  falling.scale.set(0.72, 0.72, 1);
  falling.visible = false;
  scene.add(falling);
  let fallT = -1, fallX = 0, fallY = 0;
  let lastTray: GoodType[] = [];
  let animT = 0;

  return {
    update(run, frameDt) {
      if (!run.paused) animT += frameDt;
      const px = run.x * laneWidth;
      const frames = run.finished && celebrateFrames.length ? celebrateFrames : run.stumble > 0 && stumbleFrames.length ? stumbleFrames : runFrames;
      const fps = frames === runFrames ? 3.75 * runFrames.length : 6;
      mat.map = frames[Math.floor(animT * fps) % frames.length];
      const bob = run.finished ? 0 : Math.abs(Math.sin(animT * 7.5 * Math.PI)) * 0.12;
      const wobble = run.stumble > 0 && !stumbleFrames.length ? Math.sin(animT * 40) * run.stumble * 0.5 : 0;
      const lean = (run.lane - run.x) * 0.35 + wobble;
      mat.rotation = -lean;
      sprite.position.set(px, bob, 0);
      blob.position.x = px;

      const lx = (TRAY.u - 0.5) * width, ly = (1 - TRAY.v) * HEIGHT + 0.25;
      const ca = Math.cos(-lean), sa = Math.sin(-lean);
      stack.forEach((s, i) => {
        const type = run.tray[i];
        if (!type) {
          s.visible = false;
          return;
        }
        s.visible = true;
        s.material = items.material(type);
        const ox = lx + Math.sin(i * 2.3) * 0.05, oy = ly + i * 0.36;
        s.position.set(px + ox * ca - oy * sa, bob + ox * sa + oy * ca, 0.1);
      });

      if (run.tray.length < lastTray.length && run.stumble > 0) {
        falling.material.dispose();
        falling.material = items.material(lastTray[lastTray.length - 1]).clone();
        fallT = 0;
        fallX = px + lx;
        fallY = bob + ly + (lastTray.length - 1) * 0.36;
      }
      lastTray = [...run.tray];
      if (fallT >= 0) {
        fallT += frameDt;
        falling.visible = fallT < 0.6;
        falling.position.set(fallX + fallT * 1.6, fallY + fallT * 1.5 - fallT * fallT * 9, 0.2);
        falling.material.rotation = fallT * 9;
        if (fallT >= 0.6) fallT = -1;
      }
      return px;
    },
  };
}
