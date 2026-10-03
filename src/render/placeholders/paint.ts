// @ts-nocheck
// Placeholder art, ported verbatim from docs/prototypes/style-test.html (option A painters).
// Designer PNGs in src/assets/art replace these one by one (see docs/ASSET_SPEC.md).
const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
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

const FACADE_PAL = [
  { base: '#f1cd68', trim: '#fbf3dc', shade: '#d9b04e' },
  { base: '#efe2c6', trim: '#ffffff', shade: '#d6c7a6' },
  { base: '#ebbfac', trim: '#fbefe6', shade: '#d2a08d' },
  { base: '#c7d7cd', trim: '#f5f7f2', shade: '#a8bcaf' },
  { base: '#dad5cd', trim: '#f8f5ef', shade: '#bdb6aa' },
  { base: '#e8d5a2', trim: '#fffaf0', shade: '#ccb67f' },
];
const SIGNS = ['CAFÉ', 'KONDITOREI', 'BÄCKEREI', 'WEINSTUBE', 'APOTHEKE', 'HUTMACHER'];
function paintFacadeA(i) {
  const W = 512, H = 768, c = cnv(W, H), g = c.getContext('2d');
  const P = FACADE_PAL[i % FACADE_PAL.length];
  const top = [132, 160, 112, 176, 146, 124][i % 6];
  const roof = ['gable', 'dome', 'attic', 'mansard', 'gable', 'attic'][i % 6];
  g.lineJoin = 'round';
  if (roof === 'gable') { poly(g, [140, top + 4, 372, top + 4, 256, top - 78]); inkFill(g, P.trim); g.beginPath(); g.arc(256, top - 26, 18, 0, TAU); inkFill(g, '#50627a'); }
  else if (roof === 'dome') {
    rr(g, 372, top - 34, 120, 40, 2); inkFill(g, P.trim);
    g.beginPath(); g.ellipse(432, top - 32, 58, 70, 0, Math.PI, 0); g.closePath(); inkFill(g, '#6f9f8b');
    g.strokeStyle = '#4f7d6b'; g.lineWidth = 3; for (const dx of [-30, 0, 30]) { g.beginPath(); g.moveTo(432 + dx * 0.4, top - 100); g.quadraticCurveTo(432 + dx * 1.1, top - 70, 432 + dx * 1.6, top - 34); g.stroke(); }
    rr(g, 424, top - 122, 16, 24, 3); inkFill(g, '#6f9f8b'); g.beginPath(); g.arc(432, top - 128, 6, 0, TAU); inkFill(g, '#d9b44a');
  } else if (roof === 'attic') {
    rr(g, 0, top - 34, W, 10, 2); inkFill(g, P.trim);
    for (let x = 14; x < W; x += 26) { rr(g, x, top - 24, 10, 26, 3); inkFill(g, P.trim, 2); }
    for (const x of [96, 256, 416]) { g.beginPath(); g.arc(x, top - 82, 11, 0, TAU); inkFill(g, '#8c8378', 2); poly(g, [x - 14, top - 70, x + 14, top - 70, x + 18, top - 36, x - 18, top - 36]); inkFill(g, '#8c8378', 2); }
  } else if (roof === 'mansard') {
    poly(g, [0, top + 4, W, top + 4, W - 40, top - 70, 40, top - 70]); inkFill(g, '#5c6470');
    for (const x of [110, 256, 402]) { rr(g, x - 22, top - 58, 44, 48, 4); inkFill(g, P.trim); rr(g, x - 13, top - 48, 26, 34, 2); inkFill(g, '#50627a', 2); poly(g, [x - 28, top - 56, x + 28, top - 56, x, top - 80]); inkFill(g, '#5c6470', 2); }
  }
  g.fillStyle = P.base; g.fillRect(0, top, W, H - top);
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(1.5, top, W - 3, H - top);
  g.fillStyle = P.trim; g.fillRect(0, top, W, 30);
  g.fillStyle = 'rgba(60,35,20,.18)'; g.fillRect(0, top + 30, W, 8);
  g.fillStyle = P.shade; for (let x = 8; x < W; x += 16) g.fillRect(x, top + 30, 8, 8);
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, top + 30); g.lineTo(W, top + 30); g.stroke();
  const f0 = top + 52, f1 = 566, fh = (f1 - f0) / 3;
  for (let f = 0; f < 3; f++) {
    const fy = f0 + f * fh;
    if (f > 0) { g.fillStyle = P.trim; g.fillRect(0, fy - 4, W, 6); }
    if (i % 2 === 0 && f < 2) { g.fillStyle = P.shade; for (let k = 0; k < 6; k++) g.fillRect(8 + k * 96, fy + 6, 12, fh - 14); }
    for (let k = 0; k < 5; k++) {
      const x = 64 + k * 96, ww = 42, wh = fh * 0.56, wy = fy + fh * 0.3;
      rr(g, x - ww / 2 - 6, wy - 6, ww + 12, wh + 12, 3); inkFill(g, P.trim, 2);
      rr(g, x - ww / 2, wy, ww, wh, 2); inkFill(g, '#4e607a', 2);
      poly(g, [x - ww / 2 + 4, wy + wh * 0.62, x - ww / 2 + 4, wy + wh * 0.4, x + ww / 2 - 4, wy + 6, x + ww / 2 - 4, wy + wh * 0.22]); g.fillStyle = '#7c92ab'; g.fill();
      g.strokeStyle = P.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(x, wy); g.lineTo(x, wy + wh); g.moveTo(x - ww / 2, wy + wh * 0.38); g.lineTo(x + ww / 2, wy + wh * 0.38); g.stroke();
      rr(g, x - ww / 2 - 10, wy + wh + 6, ww + 20, 7, 2); inkFill(g, P.trim, 2);
      if (f === 0) { poly(g, [x - ww / 2 - 10, wy - 10, x + ww / 2 + 10, wy - 10, x, wy - 34]); inkFill(g, P.trim, 2); }
      else if (f === 1) { g.beginPath(); g.moveTo(x - ww / 2 - 9, wy - 10); g.quadraticCurveTo(x, wy - 34, x + ww / 2 + 9, wy - 10); g.closePath(); inkFill(g, P.trim, 2); }
      else { rr(g, x - ww / 2 - 9, wy - 18, ww + 18, 9, 2); inkFill(g, P.trim, 2); }
    }
  }
  g.fillStyle = P.trim; g.fillRect(0, 566, W, 18); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(0, 566, W, 18);
  g.fillStyle = P.shade; g.fillRect(0, 584, W, H - 584);
  g.strokeStyle = 'rgba(60,35,20,.25)'; g.lineWidth = 2; for (let y = 600; y < H; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  rr(g, 120, 588, 272, 30, 3); inkFill(g, i % 2 ? '#24413a' : '#3a1f1a', 2);
  g.fillStyle = '#e2c06a'; g.font = '24px Federo, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SIGNS[i % SIGNS.length], 256, 604);
  const aw = i % 3 === 0 ? '#2f6b55' : '#c8423b';
  for (const [x0, x1] of [[28, 212], [300, 484]]) {
    rr(g, x0 + 6, 652, x1 - x0 - 12, 116, 3); inkFill(g, '#3b3540', 2);
    const gl = g.createLinearGradient(0, 652, 0, 768); gl.addColorStop(0, 'rgba(255,214,140,0)'); gl.addColorStop(1, 'rgba(255,214,140,.35)'); g.fillStyle = gl; g.fillRect(x0 + 8, 654, x1 - x0 - 16, 112);
    for (let x = x0, k = 0; x < x1; x += 23, k++) {
      g.fillStyle = k % 2 ? '#fbf3dc' : aw;
      g.beginPath(); g.moveTo(x, 626); g.lineTo(x + 23, 626); g.lineTo(x + 23, 652); g.arc(x + 11.5, 652, 11.5, 0, Math.PI); g.closePath(); g.fill();
    }
    g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(x0, 626, x1 - x0, 26);
  }
  rr(g, 228, 640, 56, 128, 4); inkFill(g, '#5a3a2a', 2); rr(g, 238, 650, 36, 50, 3); inkFill(g, '#3b3540', 2);
  return paperEdge(c, 5, '#fffaf0', null);
}
function paintBackA(i) {
  const W = 320, H = 512, c = cnv(W, H), g = c.getContext('2d');
  const base = mixHex(FACADE_PAL[(i + 2) % 6].base, '#c6d2d8', 0.55), win = mixHex(base, '#ffffff', 0.35), dark = mixHex(base, '#56606e', 0.3);
  const top = [110, 70, 140, 90, 120][i % 5];
  g.fillStyle = base; g.fillRect(0, top, W, H - top);
  const kind = i % 5;
  g.fillStyle = dark;
  if (kind === 1) { g.beginPath(); g.ellipse(160, top, 70, 80, 0, Math.PI, 0); g.fill(); g.fillRect(150, top - 120, 20, 44); }
  else if (kind === 2) { poly(g, [60, top, 260, top, 160, top - 70]); g.fill(); }
  else if (kind === 3) { g.fillRect(200, top - 120, 50, 120); poly(g, [196, top - 120, 254, top - 120, 225, top - 220]); g.fill(); }
  else if (kind === 4) { poly(g, [0, top, W, top, W - 26, top - 46, 26, top - 46]); g.fill(); }
  g.fillStyle = win;
  for (let y = top + 30; y < H - 50; y += 56) for (let x = 26; x < W - 20; x += 54) g.fillRect(x, y, 22, 34);
  return c;
}
function paintStephansdomA() {
  const W = 1024, H = 1300, c = cnv(W, H), g = c.getContext('2d');
  g.lineJoin = 'round';
  const stone = '#ded1b4', stoneD = '#c6b796';
  rr(g, 40, 760, 150, 530, 4); inkFill(g, stoneD, 4);
  g.beginPath(); g.ellipse(115, 762, 84, 96, 0, Math.PI, 0); g.closePath(); inkFill(g, '#5e8f80', 4);
  rr(g, 106, 630, 18, 44, 3); inkFill(g, '#5e8f80', 3); g.beginPath(); g.arc(115, 624, 9, 0, TAU); inkFill(g, '#d9b44a', 3);
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(88 + k * 27, 1180); g.lineTo(88 + k * 27, 880); g.quadraticCurveTo(100 + k * 27, 850, 112 + k * 27, 880); g.lineTo(112 + k * 27, 1180); g.closePath(); inkFill(g, '#3d4f6b', 3); }
  rr(g, 176, 900, 620, 390, 2); inkFill(g, stone, 4);
  for (let k = 0; k < 6; k++) { const x = 190 + k * 116; rr(g, x, 880, 28, 410, 2); inkFill(g, stoneD, 3); poly(g, [x - 6, 884, x + 34, 884, x + 14, 826]); inkFill(g, stoneD, 3); }
  for (let k = 0; k < 5; k++) {
    const x = 236 + k * 116;
    g.beginPath(); g.moveTo(x, 1200); g.lineTo(x, 1010); g.quadraticCurveTo(x, 958, x + 31, 936); g.quadraticCurveTo(x + 62, 958, x + 62, 1010); g.lineTo(x + 62, 1200); g.closePath(); inkFill(g, '#3d4f6b', 3);
    g.strokeStyle = '#8fa3bd'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 31, 960); g.lineTo(x + 31, 1200); g.moveTo(x, 1080); g.lineTo(x + 62, 1080); g.stroke();
  }
  const roof = [160, 902, 812, 902, 742, 556, 230, 556];
  g.save(); poly(g, roof); g.clip();
  const cols = ['#2f5d50', '#e2b53c', '#20242a', '#f2efe6'];
  for (let row = 0; row < 14; row++) {
    const y0 = 540 + row * 28; g.fillStyle = cols[row % 4];
    g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 36) g.lineTo(x, y0 + ((x / 36) % 2 ? 18 : 0));
    for (let x = W; x >= 0; x -= 36) g.lineTo(x, y0 + 30 + ((x / 36) % 2 ? 18 : 0));
    g.closePath(); g.fill();
  }
  g.restore(); poly(g, roof); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  rr(g, 780, 620, 180, 670, 2); inkFill(g, stoneD, 4);
  rr(g, 796, 500, 148, 124, 2); inkFill(g, stone, 4);
  poly(g, [792, 504, 870, 34, 948, 504]); inkFill(g, stone, 4);
  g.strokeStyle = INK; g.lineWidth = 3;
  for (let t = 0.1; t < 0.95; t += 0.07) { const y = 504 - (504 - 34) * t, hw = 78 * (1 - t); g.beginPath(); g.moveTo(870 - hw, y); g.lineTo(870 - hw - 12, y - 10); g.moveTo(870 + hw, y); g.lineTo(870 + hw + 12, y - 10); g.stroke(); }
  g.beginPath(); g.moveTo(870, 60); g.lineTo(870, 500); g.stroke();
  for (let k = 0; k < 4; k++) { rr(g, 852, 680 + k * 140, 36, 90, 16); inkFill(g, '#3d4f6b', 3); }
  rr(g, 0, 1286, W, 14, 0); inkFill(g, stoneD, 3);
  return paperEdge(c, 9);
}
function paintKarlskircheA() {
  const W = 1024, H = 800, c = cnv(W, H), g = c.getContext('2d');
  const wall = '#f0e7d3', green = '#79b39d', white = '#f8f3e7';
  g.lineJoin = 'round';
  rr(g, 60, 690, 904, 70, 2); inkFill(g, '#e2d8c2', 4);
  for (const x of [70, 774]) {
    rr(g, x, 440, 180, 250, 2); inkFill(g, wall, 4);
    for (let k = 0; k < 3; k++) { rr(g, x + 24 + k * 52, 500, 30, 60, 14); inkFill(g, '#4e607a', 3); }
    rr(g, x + 40, 360, 100, 84, 2); inkFill(g, wall, 4);
    g.beginPath(); g.ellipse(x + 90, 362, 56, 44, 0, Math.PI, 0); g.closePath(); inkFill(g, green, 4);
    g.beginPath(); g.arc(x + 90, 310, 8, 0, TAU); inkFill(g, '#d9b44a', 3);
  }
  for (const x of [262, 698]) {
    rr(g, x, 200, 64, 490, 4); inkFill(g, white, 4);
    g.save(); rr(g, x, 200, 64, 490, 4); g.clip(); g.strokeStyle = '#b9ae95'; g.lineWidth = 4;
    for (let y = 160; y < 720; y += 34) { g.beginPath(); g.moveTo(x - 10, y + 40); g.lineTo(x + 74, y); g.stroke(); }
    g.restore(); rr(g, x, 200, 64, 490, 4); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    rr(g, x - 12, 176, 88, 28, 3); inkFill(g, wall, 4);
    g.beginPath(); g.ellipse(x + 32, 160, 22, 26, 0, 0, TAU); inkFill(g, '#d9b44a', 3);
  }
  rr(g, 380, 450, 264, 240, 2); inkFill(g, wall, 4);
  for (let k = 0; k < 6; k++) { rr(g, 392 + k * 46, 470, 18, 220, 3); inkFill(g, white, 3); }
  poly(g, [360, 456, 664, 456, 512, 360]); inkFill(g, white, 4);
  rr(g, 400, 250, 224, 112, 2); inkFill(g, wall, 4);
  for (let k = 0; k < 4; k++) { rr(g, 420 + k * 52, 280, 26, 52, 12); inkFill(g, '#4e607a', 3); }
  g.beginPath(); g.ellipse(512, 254, 150, 176, 0, Math.PI, 0); g.closePath(); inkFill(g, green, 4);
  g.strokeStyle = '#5b9783'; g.lineWidth = 4; for (const dx of [-90, -45, 0, 45, 90]) { g.beginPath(); g.moveTo(512 + dx * 0.15, 86); g.quadraticCurveTo(512 + dx * 1.1, 150, 512 + dx * 1.55, 252); g.stroke(); }
  rr(g, 494, 40, 36, 52, 4); inkFill(g, wall, 3);
  g.beginPath(); g.arc(512, 32, 12, 0, TAU); inkFill(g, '#d9b44a', 3);
  return paperEdge(c, 9);
}
function paintHofburgA() {
  const W = 1200, H = 700, c = cnv(W, H), g = c.getContext('2d');
  const wall = '#f2e9d6', green = '#6f9f8b';
  g.lineJoin = 'round';
  rr(g, 20, 356, 1160, 330, 2); inkFill(g, wall, 4);
  g.fillStyle = '#e6dbc4'; g.fillRect(22, 560, 1156, 124);
  g.strokeStyle = 'rgba(60,35,20,.25)'; g.lineWidth = 2; for (let y = 580; y < 684; y += 22) { g.beginPath(); g.moveTo(22, y); g.lineTo(1178, y); g.stroke(); }
  for (let r = 0; r < 2; r++) for (let k = 0; k < 15; k++) { const x = 52 + k * 76; if (x > 430 && x < 770) continue; rr(g, x, 392 + r * 84, 30, 54, 10); inkFill(g, '#4e607a', 3); }
  rr(g, 20, 336, 1160, 24, 2); inkFill(g, '#fbf4e4', 3);
  for (let x = 60; x < 1160; x += 80) { if (x > 430 && x < 770) continue; g.beginPath(); g.arc(x, 300, 10, 0, TAU); inkFill(g, '#8c8378', 2); poly(g, [x - 13, 310, x + 13, 310, x + 16, 338, x - 16, 338]); inkFill(g, '#8c8378', 2); }
  rr(g, 440, 300, 320, 386, 2); inkFill(g, '#f7efe0', 4);
  g.beginPath(); g.moveTo(540, 686); g.lineTo(540, 570); g.arc(600, 570, 60, Math.PI, 0); g.lineTo(660, 686); g.closePath(); inkFill(g, '#3b3540', 4);
  for (const x of [458, 494, 690, 726]) { rr(g, x, 330, 18, 356, 3); inkFill(g, '#fbf6ea', 3); }
  rr(g, 470, 236, 260, 70, 2); inkFill(g, wall, 4);
  g.beginPath(); g.ellipse(600, 240, 150, 150, 0, Math.PI, 0); g.closePath(); inkFill(g, green, 4);
  g.strokeStyle = '#4f7d6b'; g.lineWidth = 4; for (const dx of [-90, -45, 0, 45, 90]) { g.beginPath(); g.moveTo(600 + dx * 0.15, 98); g.quadraticCurveTo(600 + dx * 1.1, 150, 600 + dx * 1.55, 238); g.stroke(); }
  rr(g, 586, 52, 28, 46, 3); inkFill(g, green, 3);
  g.beginPath(); g.arc(600, 42, 12, 0, TAU); inkFill(g, '#d9b44a', 3);
  return paperEdge(c, 9);
}
function paintWheelA() {
  const S = 1024, c = cnv(S, S), g = c.getContext('2d'), m = S / 2;
  g.strokeStyle = '#4a525e'; g.lineWidth = 4;
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; g.beginPath(); g.moveTo(m + Math.cos(a) * 60, m + Math.sin(a) * 60); g.lineTo(m + Math.cos(a) * 466, m + Math.sin(a) * 466); g.stroke(); }
  g.lineWidth = 3;
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, b = (i + 1) / 64 * TAU; g.beginPath(); g.moveTo(m + Math.cos(a) * 440, m + Math.sin(a) * 440); g.lineTo(m + Math.cos(b) * 468, m + Math.sin(b) * 468); g.stroke(); }
  g.strokeStyle = '#363c46'; g.lineWidth = 12;
  for (const r of [470, 440, 120]) { g.beginPath(); g.arc(m, m, r, 0, TAU); g.stroke(); }
  g.beginPath(); g.arc(m, m, 34, 0, TAU); g.fillStyle = '#363c46'; g.fill();
  return paperEdge(c, 5, '#fffaf0', 'rgba(60,35,20,0.22)');
}
function paintWheelSupportA() {
  const W = 1024, H = 730, c = cnv(W, H), g = c.getContext('2d');
  g.lineCap = 'round';
  g.strokeStyle = '#5c6470'; g.lineWidth = 26;
  for (const x of [250, 774]) { g.beginPath(); g.moveTo(512, 20); g.lineTo(x, 640); g.stroke(); }
  g.lineWidth = 10; g.beginPath(); g.moveTo(380, 330); g.lineTo(644, 330); g.moveTo(320, 480); g.lineTo(704, 480); g.stroke();
  rr(g, 360, 600, 304, 120, 3); inkFill(g, '#efe3cf', 4);
  poly(g, [340, 604, 684, 604, 640, 556, 384, 556]); inkFill(g, '#c4302b', 4);
  for (let k = 0; k < 4; k++) { rr(g, 384 + k * 72, 630, 40, 60, 12); inkFill(g, '#4e607a', 3); }
  return paperEdge(c, 5);
}
function paintCabinA() {
  const c = cnv(128, 124), g = c.getContext('2d');
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 10); g.lineTo(64, 30); g.stroke();
  rr(g, 14, 28, 100, 84, 10); inkFill(g, '#c4302b', 4);
  rr(g, 24, 44, 80, 30, 4); inkFill(g, '#f4efe6', 3);
  g.strokeStyle = INK; g.lineWidth = 3; for (const x of [44, 64, 84]) { g.beginPath(); g.moveTo(x, 44); g.lineTo(x, 74); g.stroke(); }
  rr(g, 8, 22, 112, 12, 4); inkFill(g, '#8e2420', 3);
  return paperEdge(c, 4, '#fffaf0', null);
}
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
  TAU, hash, cnv, mixHex, EMOJI_FONT, silhouette, paperEdge, emojiCanvas,
  paintWaiterA, paintFacadeA, paintBackA, paintStephansdomA, paintKarlskircheA, paintHofburgA,
  paintWheelA, paintWheelSupportA, paintCabinA, paintTramA, paintLampA, paintBannerA, paintCheckerA,
  paintCloudA, paintSkylineA, paintRoadA, paintWalkA, blobCanvas, shadowStrip, grainDataUrl,
};
