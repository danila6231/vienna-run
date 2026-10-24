import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadArt, type ArtSet } from '../../src/assets/manifest';
import { buildRoute, type LandmarkId } from '../../src/core/route';
import { buildConfig, defaultSettings } from '../../src/core/settings';
import { createBuildingSet } from '../../src/render/buildings';
import { createLandmarks, RIESENRAD } from '../../src/render/landmarks';
import { createSky } from '../../src/render/sky';
import { createStreet } from '../../src/render/street';

// 3D street viewer: the booth game's street, camera and speed, with jumps to the landmarks and a free camera for
// looking at the buildings from any side. Built into one HTML file by scripts/build-demo.ts.

interface Stats {
  fps: number;
  calls: number;
  triangles: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function start(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false;
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.49;

  const art: ArtSet = await loadArt();
  const cfg = buildConfig(defaultSettings());
  const route = buildRoute(cfg.runLength);
  const speedAt = (d: number) => cfg.baseSpeed * (1 + cfg.speedRamp * Math.min(1, d / cfg.runLength));

  const scene = new THREE.Scene();
  const sky = createSky(scene, art);
  const buildings = createBuildingSet();
  buildings.light(scene);
  const street = createStreet(scene, art, buildings.houses);
  const landmarks = createLandmarks(scene, art, buildings.landmarks);
  let dist = 0, time = 0, driving = true, last = performance.now(), fps = 60;

  const driveBtn = $<HTMLButtonElement>('drive');
  const orbitBtn = $<HTMLButtonElement>('orbit');
  const hud = $('hud');

  const setDriving = (on: boolean) => {
    driving = on;
    driveBtn.textContent = on ? 'Pause' : 'Drive';
    driveBtn.setAttribute('aria-pressed', String(!on));
  };
  const setOrbit = (on: boolean) => {
    orbit.enabled = on;
    orbitBtn.setAttribute('aria-pressed', String(on));
    canvas.classList.toggle('orbiting', on);
    if (on) {
      setDriving(false);
      orbit.target.set(0, 5, -26);
      orbit.update();
    }
  };
  const jump = (id: LandmarkId) => {
    const lm = route.landmarks.find((l) => l.id === id)!;
    dist = Math.max(0, lm.at + (id === 'riesenrad' ? RIESENRAD.past : 0) - 70);
    street.reset();
    setOrbit(false);
    setDriving(true);
  };

  driveBtn.addEventListener('click', () => setDriving(!driving));
  orbitBtn.addEventListener('click', () => setOrbit(!orbit.enabled));
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-jump]')) b.addEventListener('click', () => jump(b.dataset.jump as LandmarkId));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const stats: Stats = { fps: 0, calls: 0, triangles: 0 };
  let hudAt = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (driving) {
      dist += speedAt(dist) * dt;
      if (dist > route.length + 14) {
        dist = 0;
        street.reset();
      }
    }
    time += dt;
    sky.update(dt);
    street.update(dist, route);
    landmarks.update(dist, time, route);
    if (orbit.enabled) orbit.update();
    else {
      camera.position.set(0, 4.4, 8.2);
      camera.lookAt(0, 1.9, -14);
    }
    renderer.render(scene, camera);
    Object.assign(stats, { fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
    if (now - hudAt > 250) {
      hudAt = now;
      const t = stats.triangles < 10_000 ? String(stats.triangles) : `${Math.round(stats.triangles / 1000)}k`;
      hud.textContent = `${Math.round(fps)} fps · ${stats.calls} draws · ${t} triangles`;
    }
    requestAnimationFrame(frame);
  };

  setDriving(true);
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  // For scripted screenshots.
  const restart = () => {
    dist = 0;
    street.reset();
  };
  (window as unknown as { __demo: unknown }).__demo = { ready: true, setDriving, setOrbit, jump, restart, stats: () => ({ ...stats }) };
}

start().catch((err: unknown) => {
  const box = $('loading');
  box.hidden = false;
  box.textContent = `The street could not be drawn: ${String(err)}`;
  console.error(err);
});
