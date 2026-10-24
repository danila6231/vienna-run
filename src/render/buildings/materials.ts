import * as THREE from 'three';
import { cnv, SIGNS } from '../placeholders/paint';
import { ATLAS, SIGN_COUNT, type UvRect } from './kit';

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

function atlasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // No mipmaps: distant buildings would otherwise blend the white texel with its neighbours and change colour.
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

export interface BuildingMaterials {
  /** The one material every building shares: vertex colours times the atlas. */
  readonly material: THREE.Material;
  /** Adds the sun and the sky light the buildings are lit by. */
  light(scene: THREE.Scene): void;
  dispose(): void;
}

/** Sun direction: upper left and a little towards the camera, like the light painted on the items. */
export const SUN = new THREE.Vector3(-0.55, 0.75, 0.37).normalize();

export function createMaterials(): BuildingMaterials {
  const map = atlasTexture(paintAtlas());
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map });
  return {
    material,
    light(scene) {
      const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
      sun.position.copy(SUN).multiplyScalar(80);
      sun.target.position.set(0, 0, -30);
      scene.add(sun, sun.target, new THREE.HemisphereLight(0xf2f0ea, 0x9c8a74, 1.7));
    },
    dispose() {
      material.dispose();
      map.dispose();
    },
  };
}
