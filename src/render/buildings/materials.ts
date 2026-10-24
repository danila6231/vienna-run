import * as THREE from 'three';
import { cnv, SIGNS } from '../placeholders/paint';
import { ATLAS, SIGN_COUNT, type BuildingStyle, type UvRect } from './kit';

/** Canvas pixels of an atlas rectangle. */
function rectPx(r: UvRect): [number, number, number, number] {
  const S = ATLAS.size;
  return [r.u0 * S, (1 - r.v1) * S, (r.u1 - r.u0) * S, (r.v1 - r.v0) * S];
}

/** The shared atlas: white (multiplied by vertex colours), window glass, lit shop windows, signs, cathedral tiles. */
function paintAtlas(): HTMLCanvasElement {
  const S = ATLAS.size, c = cnv(S, S), g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);

  const [gx, gy, gw, gh] = rectPx(ATLAS.glass);
  const sky = g.createLinearGradient(gx, gy, gx + gw * 0.6, gy + gh);
  sky.addColorStop(0, '#a9bfd3');
  sky.addColorStop(0.45, '#5d728d');
  sky.addColorStop(1, '#34435a');
  g.fillStyle = sky;
  g.fillRect(gx, gy, gw, gh);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.moveTo(gx, gy + gh * 0.7);
  g.lineTo(gx + gw * 0.55, gy);
  g.lineTo(gx + gw * 0.8, gy);
  g.lineTo(gx, gy + gh);
  g.closePath();
  g.fill();

  const [sx, sy, sw, sh] = rectPx(ATLAS.shop);
  const warm = g.createLinearGradient(0, sy, 0, sy + sh);
  warm.addColorStop(0, '#4a3b36');
  warm.addColorStop(0.55, '#8a5f3f');
  warm.addColorStop(1, '#e0aa62');
  g.fillStyle = warm;
  g.fillRect(sx, sy, sw, sh);
  g.fillStyle = 'rgba(255,240,210,0.18)';
  for (let k = 0; k < 4; k++) g.fillRect(sx + 10 + k * 30, sy + sh * 0.55, 18, sh * 0.3);

  for (let i = 0; i < SIGN_COUNT; i++) {
    const [x, y, w, h] = rectPx(ATLAS.sign(i));
    g.fillStyle = i % 2 ? '#24413a' : '#3a1f1a';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#c9a24e';
    g.lineWidth = 4;
    g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    g.fillStyle = '#e8c870';
    g.font = `${Math.round(h * 0.56)}px Federo, Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(SIGNS[i], x + w / 2, y + h / 2 + 2);
  }

  // Stephansdom's glazed roof: zigzag bands in green, gold, black and white.
  const [tx, ty, tw, th] = rectPx(ATLAS.tiles);
  const cols = ['#2f5d50', '#e2b53c', '#20242a', '#f2efe6'];
  g.save();
  g.beginPath();
  g.rect(tx, ty, tw, th);
  g.clip();
  const rows = 16, rh = th / rows, step = tw / 24;
  for (let r = -1; r <= rows; r++) {
    g.fillStyle = cols[(r + 4) % 4];
    const y0 = ty + r * rh;
    g.beginPath();
    g.moveTo(tx, y0);
    for (let k = 0; k <= 24; k++) g.lineTo(tx + k * step, y0 + (k % 2 ? rh * 0.6 : 0));
    for (let k = 24; k >= 0; k--) g.lineTo(tx + k * step, y0 + rh + 1 + (k % 2 ? rh * 0.6 : 0));
    g.closePath();
    g.fill();
  }
  g.restore();
  return c;
}

/** Roughness in the atlas layout: glass is smooth, plaster rough (read from the green channel). */
function paintRoughness(): HTMLCanvasElement {
  const S = ATLAS.size, c = cnv(S, S), g = c.getContext('2d')!;
  const fill = (r: UvRect, v: number) => {
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(...rectPx(r));
  };
  g.fillStyle = 'rgb(235,235,235)';
  g.fillRect(0, 0, S, S);
  fill(ATLAS.glass, 28);
  fill(ATLAS.shop, 50);
  fill(ATLAS.tiles, 90);
  for (let i = 0; i < SIGN_COUNT; i++) fill(ATLAS.sign(i), 140);
  return c;
}

/** A tiling normal map of rough plaster, from smoothed noise. */
function paintPlasterNormal(): HTMLCanvasElement {
  const S = 256, c = cnv(S, S), g = c.getContext('2d')!;
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  // Two box blurs (wrapping) turn white noise into soft bumps.
  const blur = (r: number) => {
    const t = new Float32Array(h.length);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += h[y * S + ((x + k + S) % S)];
      t[y * S + x] = s / (2 * r + 1);
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += t[((y + k + S) % S) * S + x];
      h[y * S + x] = s / (2 * r + 1);
    }
  };
  blur(2);
  blur(1);
  const img = g.createImageData(S, S);
  const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6, dy = (at(x, y + 1) - at(x, y - 1)) * 6;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * S + x) * 4;
    img.data[i] = (-dx / len) * 127 + 128;
    img.data[i + 1] = (dy / len) * 127 + 128;
    img.data[i + 2] = (1 / len) * 127 + 128;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function atlasTexture(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  // No mipmaps: distant buildings would otherwise blend the white texel with its neighbours and change colour.
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

export interface BuildingMaterials {
  readonly material: THREE.Material;
  /** Sun and sky for this look; returns what it added so it can be removed again. */
  light(scene: THREE.Scene): THREE.Object3D[];
  readonly shadows: boolean;
  dispose(): void;
}

/** Sun direction: upper left and a little towards the camera, like the light painted on the items. */
export const SUN = new THREE.Vector3(-0.55, 0.75, 0.37).normalize();

export function createMaterials(style: BuildingStyle): BuildingMaterials {
  const map = atlasTexture(paintAtlas(), true);
  const textures: THREE.Texture[] = [map];
  let material: THREE.Material;
  if (style === 'realistic') {
    const roughnessMap = atlasTexture(paintRoughness(), false);
    const normalMap = new THREE.CanvasTexture(paintPlasterNormal());
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.channel = 1; // tiles in metres via the `uv1` box projection
    textures.push(roughnessMap, normalMap);
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map,
      roughnessMap,
      roughness: 1,
      metalness: 0,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
  } else {
    material = new THREE.MeshLambertMaterial({ vertexColors: true, map, flatShading: style === 'lowpoly' });
  }

  return {
    material,
    shadows: style === 'realistic',
    light(scene) {
      const added: THREE.Object3D[] = [];
      const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
      sun.position.copy(SUN).multiplyScalar(80);
      sun.target.position.set(0, 0, -30);
      if (style === 'realistic') {
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        // The camera never moves (the world does), so one fixed box covers everything near enough to matter.
        sun.position.set(SUN.x * 80, SUN.y * 80, SUN.z * 80 - 30);
        Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
        sun.shadow.camera.updateProjectionMatrix();
      }
      const sky = new THREE.HemisphereLight(0xf2f0ea, 0x9c8a74, 1.7);
      added.push(sun, sun.target, sky);
      for (const o of added) scene.add(o);
      return added;
    },
    dispose() {
      material.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
