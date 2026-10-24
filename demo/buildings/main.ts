import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadArt, type ArtSet } from '../../src/assets/manifest';
import { buildRoute, type LandmarkId } from '../../src/core/route';
import { buildConfig, defaultSettings } from '../../src/core/settings';
import { createBuildingSet, type BuildingSet, type BuildingStyle } from '../../src/render/buildings';
import { createLandmarks, RIESENRAD, type Landmarks } from '../../src/render/landmarks';
import { createSky, type Sky } from '../../src/render/sky';
import { createStreet, type Street } from '../../src/render/street';

// Street looks demo: the booth game's street, camera and speed, with the facade rows and landmarks switchable
// between today's paper cards and the three 3D looks. Built into one HTML file by scripts/build-demo.ts.

type Look = 'paper' | BuildingStyle;
const LOOKS: Look[] = ['paper', 'stylized', 'lowpoly', 'realistic'];

interface Stage {
  scene: THREE.Scene;
  street: Street;
  landmarks: Landmarks;
  sky: Sky;
  set: BuildingSet | null;
}

interface Stats {
  look: Look;
  fps: number;
  calls: number;
  triangles: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function start(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; // only the realistic look has a light that casts shadows
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 600);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enabled = false;
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI * 0.49;

  const art: ArtSet = await loadArt();
  const cfg = buildConfig(defaultSettings());
  const route = buildRoute(cfg.runLength);
  const speedAt = (d: number) => cfg.baseSpeed * (1 + cfg.speedRamp * Math.min(1, d / cfg.runLength));

  const stages = new Map<Look, Stage>();
  const stageFor = (look: Look): Stage => {
    let st = stages.get(look);
    if (st) return st;
    const scene = new THREE.Scene();
    const sky = createSky(scene, art);
    const set = look === 'paper' ? null : createBuildingSet(look);
    const street = createStreet(scene, art, set?.houses);
    const landmarks = createLandmarks(scene, art, set?.landmarks);
    if (set) {
      set.light(scene);
      if (set.shadows) {
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material === set.material) o.castShadow = o.receiveShadow = true;
        });
        // The road and sidewalks are unlit paper textures, so a shadow-only layer above them shows the buildings' shade.
        const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 320), new THREE.ShadowMaterial({ opacity: 0.3 }));
        catcher.rotation.x = -Math.PI / 2;
        catcher.position.set(0, 0.05, -140);
        catcher.receiveShadow = true;
        scene.add(catcher);
      }
    }
    st = { scene, street, landmarks, sky, set };
    stages.set(look, st);
    return st;
  };

  let look: Look = 'stylized';
  let stage = stageFor(look);
  let dist = 0, time = 0, driving = true, last = performance.now(), fps = 60;

  const lookButtons = LOOKS.map((l) => document.querySelector<HTMLButtonElement>(`[data-look="${l}"]`)!);
  const notes = LOOKS.map((l) => document.querySelector<HTMLElement>(`[data-note="${l}"]`)!);
  const driveBtn = $<HTMLButtonElement>('drive');
  const orbitBtn = $<HTMLButtonElement>('orbit');
  const hud = $('hud');

  const setLook = (l: Look) => {
    look = l;
    stage = stageFor(l);
    stage.street.reset();
    lookButtons.forEach((b, i) => b.setAttribute('aria-checked', String(LOOKS[i] === l)));
    notes.forEach((n, i) => (n.hidden = LOOKS[i] !== l));
  };
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
    stage.street.reset();
    setOrbit(false);
    setDriving(true);
  };

  lookButtons.forEach((b, i) => b.addEventListener('click', () => setLook(LOOKS[i])));
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

  const stats: Stats = { look, fps: 0, calls: 0, triangles: 0 };
  let hudAt = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (driving) {
      dist += speedAt(dist) * dt;
      if (dist > route.length + 14) {
        dist = 0;
        stage.street.reset();
      }
    }
    time += dt;
    stage.sky.update(dt);
    stage.street.update(dist, route);
    stage.landmarks.update(dist, time, route);
    if (orbit.enabled) orbit.update();
    else {
      camera.position.set(0, 4.4, 8.2);
      camera.lookAt(0, 1.9, -14);
    }
    renderer.render(stage.scene, camera);
    Object.assign(stats, { look, fps, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
    if (now - hudAt > 250) {
      hudAt = now;
      const t = stats.triangles < 10_000 ? String(stats.triangles) : `${Math.round(stats.triangles / 1000)}k`;
      hud.textContent = `${Math.round(fps)} fps · ${stats.calls} draws · ${t} triangles`;
    }
    requestAnimationFrame(frame);
  };

  setLook(look);
  setDriving(true);
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  // For scripts/demo-perf.ts.
  const restart = () => {
    dist = 0;
    stage.street.reset();
  };
  (window as unknown as { __demo: unknown }).__demo = { ready: true, setLook, setDriving, jump, restart, stats: () => ({ ...stats }) };
}

start().catch((err: unknown) => {
  const box = $('loading');
  box.hidden = false;
  box.textContent = `The street could not be drawn: ${String(err)}`;
  console.error(err);
});
