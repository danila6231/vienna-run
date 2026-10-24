// @ts-nocheck
// Placeholder art, ported verbatim from docs/prototypes/style-test.html (option A painters).
// Designer PNGs in src/assets/art replace these one by one (see docs/ASSET_SPEC.md).
const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function silhouette(c, color) {
  const s = cnv(c.width, c.height), g = s.getContext('2d');
  g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return s;
}
function paperEdge(c, r, color = '#fffaf0', shadow = 'rgba(60,35,20,0.32)') {
  const o = cnv(c.width, c.height), og = o.getContext('2d');
  if (shadow) { const d = silhouette(c, shadow); for (let a = 0; a < 12; a++) og.drawImage(d, Math.cos(a / 12 * TAU) * r + r * 0.6, Math.sin(a / 12 * TAU) * r + r * 0.9); }
  const s = silhouette(c, color);
  for (let a = 0; a < 20; a++) og.drawImage(s, Math.cos(a / 20 * TAU) * r, Math.sin(a / 20 * TAU) * r);
  og.drawImage(c, 0, 0);
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(o, 0, 0);
  return c;
}
function emojiCanvas(e, size, fill = 0.6) {
  const c = cnv(size, size), g = c.getContext('2d');
  g.font = Math.round(size * fill) + 'px ' + EMOJI_FONT;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(e, size / 2, size / 2 + size * 0.04);
  return c;
}
const INK = '#3a2a22';
function inkFill(g, fill, lw = 3) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }

function paintWaiterA(frame) {
  const c = cnv(256, 384), g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lift = (left) => (frame === 0) === left ? 26 : 0;
  for (const [x, left] of [[108, true], [148, false]]) {
    const l = lift(left);
    rr(g, x - 17, 252 - l * 0.2, 34, 96 - l, 10); inkFill(g, '#1b1a22');
    rr(g, x - 19, 334 - l * 1.15, 38, 22, 9); inkFill(g, '#4a3227');
  }
  poly(g, [92, 246, 96, 300, 122, 320, 128, 270, 134, 320, 160, 300, 164, 246]); inkFill(g, '#1f1e27');
  g.beginPath(); g.moveTo(84, 150); g.quadraticCurveTo(128, 136, 172, 150); g.lineTo(166, 258); g.quadraticCurveTo(128, 266, 90, 258); g.closePath(); inkFill(g, '#24232c');
  g.strokeStyle = '#3d3c4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 160); g.lineTo(128, 256); g.stroke();
  g.beginPath(); g.moveTo(100, 176); g.quadraticCurveTo(112, 196, 108, 214); g.moveTo(156, 176); g.quadraticCurveTo(144, 196, 148, 214); g.stroke();
  g.lineWidth = 26; g.strokeStyle = INK; g.beginPath(); g.moveTo(166, 160); g.quadraticCurveTo(200, 122, 194, 64); g.stroke();
  g.lineWidth = 20; g.strokeStyle = '#24232c'; g.stroke();
  g.lineWidth = 20; g.strokeStyle = '#f7f3ea'; g.beginPath(); g.moveTo(195, 76); g.lineTo(194, 66); g.stroke();
  g.beginPath(); g.arc(194, 54, 11, 0, TAU); inkFill(g, '#eec3a0');
  const sw = frame === 0 ? 7 : -7;
  g.lineWidth = 26; g.strokeStyle = INK; g.beginPath(); g.moveTo(90, 160); g.quadraticCurveTo(74, 200, 72 + sw, 244); g.stroke();
  g.lineWidth = 20; g.strokeStyle = '#24232c'; g.stroke();
  poly(g, [60 + sw, 206, 88 + sw, 204, 92 + sw, 246, 74 + sw, 262, 58 + sw, 244]); inkFill(g, '#fbfaf5');
  g.beginPath(); g.arc(73 + sw, 262, 10, 0, TAU); inkFill(g, '#eec3a0');
  rr(g, 112, 120, 32, 18, 4); inkFill(g, '#eec3a0');
  rr(g, 106, 132, 44, 14, 5); inkFill(g, '#f7f3ea');
  g.beginPath(); g.ellipse(91, 102, 8, 12, 0, 0, TAU); inkFill(g, '#e4b38f');
  g.beginPath(); g.ellipse(165, 102, 8, 12, 0, 0, TAU); inkFill(g, '#e4b38f');
  g.beginPath(); g.arc(128, 96, 37, 0, TAU); inkFill(g, '#eec3a0');
  g.save(); g.beginPath(); g.arc(128, 96, 37, 0, TAU); g.clip();
  g.beginPath(); g.ellipse(128, 86, 40, 40, 0, 0, TAU); g.fillStyle = '#16131a'; g.fill();
  g.strokeStyle = '#4b4458'; g.lineWidth = 3;
  for (const dx of [-18, -6, 6, 18]) { g.beginPath(); g.moveTo(128 + dx, 58); g.quadraticCurveTo(128 + dx * 1.15, 90, 128 + dx * 0.9, 120); g.stroke(); }
  g.restore();
  g.beginPath(); g.arc(128, 96, 37, 0, TAU); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  const tg = g.createLinearGradient(0, 22, 0, 44); tg.addColorStop(0, '#f3f6f9'); tg.addColorStop(1, '#a9b1ba');
  g.beginPath(); g.ellipse(188, 36, 56, 12, 0, 0, TAU); g.fillStyle = tg; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5e6670'; g.stroke();
  g.beginPath(); g.ellipse(188, 33, 40, 6, 0, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke();
  return paperEdge(c, 6);
}

// Facade colours and shop names, used by the 3D houses (src/render/buildings).
const FACADE_PAL = [
  { base: '#f1cd68', trim: '#fbf3dc', shade: '#d9b04e' },
  { base: '#efe2c6', trim: '#ffffff', shade: '#d6c7a6' },
  { base: '#ebbfac', trim: '#fbefe6', shade: '#d2a08d' },
  { base: '#c7d7cd', trim: '#f5f7f2', shade: '#a8bcaf' },
  { base: '#dad5cd', trim: '#f8f5ef', shade: '#bdb6aa' },
  { base: '#e8d5a2', trim: '#fffaf0', shade: '#ccb67f' },
];
const SIGNS = ['CAFÉ', 'KONDITOREI', 'BÄCKEREI', 'WEINSTUBE', 'APOTHEKE', 'HUTMACHER'];
function paintTramA() {
  const W = 1024, H = 256, c = cnv(W, H), g = c.getContext('2d');
  g.lineJoin = 'round';
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(470, 46); g.lineTo(500, 14); g.lineTo(540, 40); g.moveTo(450, 14); g.lineTo(560, 14); g.stroke();
  rr(g, 70, 36, 884, 18, 6); inkFill(g, '#a2abb5', 3);
  rr(g, 20, 52, 984, 176, 26); inkFill(g, '#cf302d', 4);
  rr(g, 40, 76, 944, 70, 8); inkFill(g, '#2f3b4a', 3);
  g.strokeStyle = '#f4efe4'; g.lineWidth = 6; for (let x = 150; x < 980; x += 118) { g.beginPath(); g.moveTo(x, 76); g.lineTo(x, 146); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 52; x < 970; x += 118) { poly(g, [x, 140, x + 26, 82, x + 50, 82, x + 24, 140]); g.fill(); }
  g.fillStyle = '#f4efe4'; g.fillRect(22, 166, 980, 16);
  for (const x of [190, 480, 770]) { rr(g, x, 150, 72, 76, 4); inkFill(g, '#a8241f', 3); rr(g, x + 8, 158, 24, 52, 3); inkFill(g, '#2f3b4a', 2); rr(g, x + 40, 158, 24, 52, 3); inkFill(g, '#2f3b4a', 2); }
  rr(g, 900, 60, 84, 22, 4); inkFill(g, '#141414', 2);
  g.fillStyle = '#ffb43a'; g.font = '18px "DM Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D Ring', 942, 72);
  for (const x of [110, 734]) { rr(g, x, 220, 180, 26, 8); inkFill(g, '#2b2b30', 3); }
  return paperEdge(c, 6);
}
function paintLampA() {
  const c = cnv(64, 320), g = c.getContext('2d');
  rr(g, 28, 86, 8, 210, 3); inkFill(g, '#2b2b30', 2);
  rr(g, 20, 286, 24, 26, 4); inkFill(g, '#2b2b30', 2);
  poly(g, [16, 40, 48, 40, 54, 88, 10, 88]); inkFill(g, '#f6e3a1', 3);
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 40); g.lineTo(32, 88); g.stroke();
  poly(g, [10, 42, 54, 42, 32, 18]); inkFill(g, '#2b2b30', 2);
  g.beginPath(); g.arc(32, 14, 5, 0, TAU); inkFill(g, '#2b2b30', 2);
  return paperEdge(c, 3, '#fffaf0', null);
}
function paintBannerA() {
  const c = cnv(1024, 200), g = c.getContext('2d');
  rr(g, 12, 12, 1000, 176, 6); inkFill(g, '#fbf3e2', 4);
  g.fillStyle = '#c8102e'; g.fillRect(14, 14, 996, 44); g.fillRect(14, 142, 996, 44);
  g.fillStyle = '#2b1d17'; g.font = '68px Federo, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ZIEL  ·  FINISH', 512, 102);
  return paperEdge(c, 5);
}
function paintCheckerA() {
  const c = cnv(256, 32), g = c.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#2b1d17' : '#fbf3e2'; g.fillRect(x * 16, y * 16, 16, 16); }
  return c;
}
function paintCloudA() {
  const c = cnv(320, 150), g = c.getContext('2d');
  g.fillStyle = '#fffaf2';
  for (const [x, y, r] of [[90, 92, 46], [150, 70, 58], [218, 88, 46], [260, 104, 30], [56, 112, 28], [160, 110, 40]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(160,150,140,.25)'; g.fillRect(20, 120, 280, 30);
  return paperEdge(c, 4, '#efe6d6', null);
}
function paintSkylineA() {
  const W = 2048, H = 256, c = cnv(W, H), g = c.getContext('2d');
  const col = '#a9b8c4', col2 = '#b9c6cf';
  g.fillStyle = col2;
  for (let x = 0; x < W; x += 60) { const h = 60 + hash(x) * 70; g.fillRect(x, H - h, 62, h); }
  g.fillStyle = col;
  for (let x = 30; x < W; x += 90) { const h = 40 + hash(x + 7) * 50; g.fillRect(x, H - h, 64, h); }
  poly(g, [660, H - 100, 720, H - 100, 690, 14]); g.fill(); g.fillRect(640, H - 140, 100, 140);
  g.beginPath(); g.ellipse(1010, H - 110, 54, 60, 0, Math.PI, 0); g.fill(); g.fillRect(950, H - 110, 120, 110); g.fillRect(1004, H - 186, 12, 20);
  g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.arc(1420, H - 118, 82, 0, TAU); g.stroke();
  g.lineWidth = 2; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(1420, H - 118); g.lineTo(1420 + Math.cos(a) * 82, H - 118 + Math.sin(a) * 82); g.stroke(); }
  g.lineWidth = 8; g.beginPath(); g.moveTo(1420, H - 118); g.lineTo(1380, H); g.moveTo(1420, H - 118); g.lineTo(1460, H); g.stroke();
  g.fillRect(1776, 40, 10, H - 40); g.fillRect(1766, 52, 30, 16);
  for (const x of [360, 400, 440]) { g.fillRect(x, H - 150, 22, 150); poly(g, [x - 2, H - 150, x + 24, H - 150, x + 11, H - 200]); g.fill(); }
  return c;
}
function paintRoadA() {
  const S = 512, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#9a8f80'; g.fillRect(0, 0, S, S);
  const cols = ['#c2b7a7', '#b5a998', '#bcb09f', '#ab9f8e', '#c6bcad'];
  let row = 0;
  for (let y = 0; y < S; y += 22, row++) {
    for (let x = -((row % 2) * 16); x < S; x += 32) {
      rr(g, x + 2, y + 2, 28, 18, 6); g.fillStyle = cols[(hash(x * 3.1 + y * 7.7) * cols.length) | 0]; g.fill();
      g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 1.5; g.stroke();
    }
  }
  const sh = g.createLinearGradient(0, 0, S, 0);
  sh.addColorStop(0, 'rgba(60,40,30,.22)'); sh.addColorStop(0.08, 'rgba(60,40,30,0)'); sh.addColorStop(0.92, 'rgba(60,40,30,0)'); sh.addColorStop(1, 'rgba(60,40,30,.22)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S);
  return c;
}
function paintWalkA() {
  const S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#ddd2c1'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#c1b5a2'; g.lineWidth = 3;
  for (let y = 0; y <= S; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  for (let x = 0; x <= S; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 120; i++) g.fillRect(hash(i) * S, hash(i + 99) * S, 2, 2);
  return c;
}
function blobCanvas() {
  const c = cnv(128, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 32, 2, 64, 32, 60); gr.addColorStop(0, 'rgba(50,30,20,.55)'); gr.addColorStop(1, 'rgba(50,30,20,0)');
  g.fillStyle = gr; g.save(); g.scale(1, 0.5); g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.restore(); g.fill();
  return c;
}
function shadowStrip(side) {
  const c = cnv(64, 4), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0);
  const dark = 'rgba(60,40,30,.38)', clear = 'rgba(60,40,30,0)';
  gr.addColorStop(0, side > 0 ? clear : dark); gr.addColorStop(1, side > 0 ? dark : clear);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
  return c;
}
function grainDataUrl() {
  const S = 220, c = cnv(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) { const v = 200 + Math.random() * 55; img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  try { return c.toDataURL(); } catch (_) { return ''; }
}

export {
  TAU, hash, cnv, EMOJI_FONT, silhouette, paperEdge, emojiCanvas, FACADE_PAL, SIGNS,
  paintWaiterA, paintTramA, paintLampA, paintBannerA, paintCheckerA,
  paintCloudA, paintSkylineA, paintRoadA, paintWalkA, blobCanvas, shadowStrip, grainDataUrl,
};
