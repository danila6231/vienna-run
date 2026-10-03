import * as THREE from 'three';
import type { ArtSet } from '../assets/manifest';
import type { Run } from '../core/run';
import { createItems } from './items';
import { createLandmarks } from './landmarks';
import { createRunner } from './runner';
import { createSky } from './sky';
import { createStreet } from './street';

export type QualityLevel = 'high' | 'med' | 'low';

export interface World {
  readonly renderer: THREE.WebGLRenderer;
  reset(): void;
  render(run: Run, frameDt: number): void;
  resize(w: number, h: number): void;
  shake(): void;
  playerScreen(): { x: number; y: number };
  setQuality(level: QualityLevel): void;
}

const PIXEL_RATIO: Record<QualityLevel, number> = { high: 2, med: 1.25, low: 1 };

export function createWorld(canvas: HTMLCanvasElement, art: ArtSet, laneWidth: number): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO.high));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const sky = createSky(scene, art);
  const street = createStreet(scene, art);
  const landmarks = createLandmarks(scene, art);
  const items = createItems(scene, art, laneWidth);
  const runner = createRunner(scene, art, items, laneWidth);
  const v = new THREE.Vector3();
  let time = 0, shakeT = 0, px = 0, w = 1, h = 1;

  return {
    renderer,
    reset() {
      street.reset();
      items.reset();
    },
    render(run, frameDt) {
      time += frameDt;
      shakeT = Math.max(0, shakeT - frameDt);
      sky.update(frameDt);
      street.update(run.dist);
      landmarks.update(run.dist, time);
      px = runner.update(run, frameDt);
      items.sync(run, px);
      const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.4 : 0;
      const sy = shakeT > 0 ? (Math.random() - 0.5) * shakeT : 0;
      camera.position.set(px * 0.35 + sx, 4.4 + sy, 8.2);
      camera.lookAt(px * 0.3, 1.9, -14);
      renderer.render(scene, camera);
    },
    resize(width, height) {
      w = width;
      h = height;
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
    setQuality(level) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[level]));
      renderer.setSize(w, h, false);
      street.setDetail(level !== 'low');
      sky.setDetail(level !== 'low');
    },
  };
}
