import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { createLandmarks } from './landmarks';
import { createSky } from './sky';
import { createStreet } from './street';

export interface World {
  readonly renderer: THREE.WebGLRenderer;
  reset(): void;
  render(run: Run, frameDt: number): void;
  resize(w: number, h: number): void;
  shake(): void;
  playerScreen(): { x: number; y: number };
}

export function createWorld(canvas: HTMLCanvasElement, art: ArtSet, laneWidth: number): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const sky = createSky(scene, art);
  const street = createStreet(scene, art);
  const landmarks = createLandmarks(scene, art);
  const v = new THREE.Vector3();
  let time = 0, shakeT = 0, px = 0;
  return {
    renderer,
    reset() {
      street.reset();
    },
    render(run, frameDt) {
      time += frameDt;
      shakeT = Math.max(0, shakeT - frameDt);
      px = run.x * laneWidth;
      sky.update(frameDt);
      street.update(run.dist);
      landmarks.update(run.dist, time);
      const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.4 : 0;
      const sy = shakeT > 0 ? (Math.random() - 0.5) * shakeT : 0;
      camera.position.set(px * 0.35 + sx, 4.4 + sy, 8.2);
      camera.lookAt(px * 0.3, 1.9, -14);
      renderer.render(scene, camera);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    shake() {
      shakeT = 0.32;
    },
    playerScreen() {
      v.set(px, 3.4, 0).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    },
  };
}
