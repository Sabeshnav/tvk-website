// The ten roadside objects of the Journey, one per milestone, all built in code.
// Each builder returns { group, update?(time) }. Origin = ground centre; the "front" faces +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, col, rmax, seed) {
  const r = rng(seed); g.fillStyle = col;
  for (let i = 0; i < n; i++) { g.globalAlpha = 0.15 + r() * 0.5; g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * rmax, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
const std = (o) => new THREE.MeshStandardMaterial(o);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function glowTex() {
  return canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
}
let _glow;
export function glowSprite(color, size, opacity = 1) {
  _glow ||= glowTex();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(size, size, 1); return s;
}
const metal = (color, rough = 0.35) => std({ color, metalness: 1, roughness: rough });
const wood = () => std({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6b4526'; g.fillRect(0, 0, w, h); const r = rng(7); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${40 + r() * 30},${22 + r() * 15},${10},${0.25 + r() * 0.4})`; g.lineWidth = 0.5 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 12, w * 0.6, y + (r() - 0.5) * 12, w, y + (r() - 0.5) * 8); g.stroke(); } }, { repeat: [1, 1] }), roughness: 0.8 });

/* 1992: the fan club's painted tin name board on two poles, with a tube light */
function board() {
  const G = new THREE.Group();
  const tex = canvasTex(1024, 420, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1f4fa8'); gr.addColorStop(1, '#173a80'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2d24b'; g.lineWidth = 12; g.strokeRect(18, 18, w - 36, h - 36); g.lineWidth = 3; g.strokeRect(36, 36, w - 72, h - 72);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 54px StoneTa'; g.fillText('இளைய தளபதி விஜய்', w / 2, 145);
    g.fillStyle = '#ffe36b'; g.font = '700 92px StoneTa'; g.fillText('நற்பணி மன்றம்', w / 2, 255);
    g.fillStyle = '#fff'; g.font = '700 30px StoneEn'; g.fillText('EST. 1992', w / 2, 345);
    speckle(g, w, h, 260, '#7a3b16', 5, 3); speckle(g, w, h, 500, '#000', 1.5, 4);       // rust and grime
    const v = g.createLinearGradient(0, h * 0.6, 0, h); v.addColorStop(0, 'rgba(60,30,10,0)'); v.addColorStop(1, 'rgba(60,30,10,.45)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const bw = 2.6, bh = bw * 420 / 1024;
  const faceMat = std({ map: tex, roughness: 0.55, metalness: 0.2 }), edge = std({ color: 0x2a2f38, metalness: 0.6, roughness: 0.6 });
  const bd = mesh(new THREE.BoxGeometry(bw, bh, 0.04), [edge, edge, edge, edge, faceMat, edge], 0, 2.15, 0); G.add(bd);
  const pole = metal(0x3a3d42, 0.6);
  for (const x of [-bw * 0.42, bw * 0.42]) G.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.9, 10), pole, x, 1.45, -0.05));
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), new THREE.MeshBasicMaterial({ color: 0xe8fbff }));
  tube.rotation.z = Math.PI / 2; tube.position.set(0, 2.15 + bh / 2 + 0.12, 0.18); G.add(tube);
  G.add(mesh(new THREE.BoxGeometry(1.4, 0.05, 0.06), edge, 0, 2.15 + bh / 2 + 0.07, 0.15));
  const gl = glowSprite(0xbfefff, 2.2, 0.55); gl.position.copy(tube.position); G.add(gl);
  const light = new THREE.PointLight(0xd8f4ff, 3.5, 7, 2); light.position.set(0, 2.15 + bh / 2 + 0.1, 0.6); G.add(light);
  return { group: G, update: (t) => { const f = 0.9 + 0.1 * Math.sin(t * 37) * Math.sin(t * 13); tube.material.color.setScalar(f); light.intensity = 3.5 * f; } };
}

/* 2001: the உண்டியல், a sealed relief tin on a stool, coins dropping in */
function tin() {
  const G = new THREE.Group();
  const label = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#b3241f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f7d046'; g.fillRect(0, 20, w, 10); g.fillRect(0, h - 30, w, 10);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 70px StoneTa';
    for (const x of [w * 0.25, w * 0.75]) g.fillText('நிவாரண நிதி', x, h / 2 + 4);
    speckle(g, w, h, 300, '#3a0d0b', 2, 9);
  });
  const tinMat = std({ map: label, metalness: 0.55, roughness: 0.35 }), rim = metal(0xc9ccd2, 0.25);
  G.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 40, 1, true), tinMat, 0, 1.02, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.03, 40), rim, 0, 1.27, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.03, 40), rim, 0, 0.775, 0));
  const slot = mesh(new THREE.BoxGeometry(0.16, 0.012, 0.025), std({ color: 0x050505 }), 0, 1.287, 0); G.add(slot);
  const w = wood();
  G.add(mesh(new THREE.BoxGeometry(0.8, 0.06, 0.6), w, 0, 0.73, 0));
  for (const [x, z] of [[-0.34, -0.24], [0.34, -0.24], [-0.34, 0.24], [0.34, 0.24]]) G.add(mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), w, x, 0.35, z));
  const gold = metal(0xe7b85a, 0.3), coinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20);
  const coins = [];
  for (let i = 0; i < 4; i++) { const c = mesh(coinGeo, gold); G.add(c); coins.push(c); }
  const r = rng(11);
  for (let i = 0; i < 7; i++) { const c = mesh(coinGeo, gold, (r() - 0.5) * 0.6, 0.765, (r() - 0.5) * 0.45); c.rotation.set((r() - 0.5) * 0.1, r() * 3, 0); G.add(c); }
  return { group: G, update: (t) => coins.forEach((c, i) => {
    const q = ((t * 0.55 + i / coins.length) % 1);                 // each coin falls from a hand height into the slot, spinning
    c.position.set(0, 1.95 - q * q * 0.68, 0); c.rotation.set(Math.PI / 2, 0, t * 9 + i); c.visible = q < 0.97;
  }) };
}

/* 2008: an empty banana leaf on a reed mat (fasting), with a black protest flag */
function leaf() {
  const G = new THREE.Group();
  const mat = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#a8864f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { g.fillStyle = (y / 6) % 2 ? '#977743' : '#b7955c'; g.fillRect(0, y, w, 4); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = '#6b3a1d'; g.fillRect(x, 0, 6, h); }
    speckle(g, w, h, 400, '#3b2a12', 1.5, 21);
  });
  G.add(mesh(new THREE.BoxGeometry(1.9, 0.02, 1.05), std({ map: mat, roughness: 0.95 }), 0, 0.01, 0));
  // banana leaf: an elongated, slightly cupped sheet with a midrib and parallel veins
  const lt = canvasTex(1024, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath(); g.moveTo(10, h / 2); g.bezierCurveTo(w * 0.2, 6, w * 0.8, 10, w - 6, h * 0.45); g.lineTo(w - 6, h * 0.55); g.bezierCurveTo(w * 0.8, h - 10, w * 0.2, h - 6, 10, h / 2); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f7a2a'); gr.addColorStop(0.5, '#4f9d38'); gr.addColorStop(1, '#2c6f27'); g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(20,60,15,.35)'; g.lineWidth = 2; for (let x = 20; x < w; x += 14) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 40, 0); g.moveTo(x, h / 2); g.lineTo(x + 40, h); g.stroke(); }
    g.fillStyle = '#b9cf7a'; g.fillRect(0, h / 2 - 5, w, 10);
    g.fillStyle = 'rgba(120,90,30,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(w * (0.15 + i * 0.14), h * (0.15 + (i % 2) * 0.7), 20, 8, 0.3, 0, TAU); g.fill(); }
    g.restore();
  });
  const lg = new THREE.PlaneGeometry(1.3, 0.48, 24, 8); lg.rotateX(-Math.PI / 2);
  const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, 0.035 + z * z * 0.25); }
  lg.computeVertexNormals();
  const lm = mesh(lg, std({ map: lt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.45 }), 0, 0.02, 0.05); lm.rotation.y = 0.12; G.add(lm);
  // black flag on a stick
  const stick = mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.7, 8), wood(), 0.9, 0.85, -0.45); G.add(stick);
  const fg = new THREE.PlaneGeometry(0.55, 0.36, 12, 4); fg.translate(0.275, 0, 0);
  const fl = mesh(fg, std({ color: 0x0b0b0c, side: THREE.DoubleSide, roughness: 0.9 }), 0.9, 1.5, -0.45); G.add(fl);
  const base = fg.attributes.position.array.slice();
  return { group: G, update: (t) => { const a = fl.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x = base[i * 3]; a.setZ(i, Math.sin(x * 9 - t * 6) * 0.05 * x / 0.55); } a.needsUpdate = true; fl.geometry.computeVertexNormals(); } };
}

/* 2011: a kattumaram (log boat) pulled up on sand, with its paddle and a heap of net */
function boat() {
  const G = new THREE.Group();
  const sand = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#b89d72'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, '#6e5a3c', 1.2, 31); speckle(g, w, h, 1200, '#e8d6ad', 1, 32); });
  const sd = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), std({ map: sand, roughness: 1, transparent: true, opacity: 0.95 }));
  sd.rotation.x = -Math.PI / 2; sd.position.y = 0.012; sd.receiveShadow = true; G.add(sd);
  const logMat = std({ map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#5a3a20'; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, '#2a170a', 2, 33); for (let y = 4; y < h; y += 7) { g.fillStyle = 'rgba(30,15,5,.4)'; g.fillRect(0, y, w, 1.5); } }), roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 0.24, len = 4.6 - Math.abs(i - 2) * 0.35;
    const geo = new THREE.CylinderGeometry(0.12, 0.13, len, 14, 24); geo.rotateX(Math.PI / 2);
    const a = geo.attributes.position;
    for (let k = 0; k < a.count; k++) { const z = a.getZ(k), q = Math.max(0, z / (len / 2) - 0.25); a.setY(k, a.getY(k) + q * q * 0.75); }
    geo.computeVertexNormals();
    const m = mesh(geo, logMat, off, 0.14 - Math.abs(i - 2) * 0.03, 0); G.add(m);
  }
  const rope = std({ color: 0xbfa77a, roughness: 1 });
  for (const z of [-1.4, 0, 1.2]) { const r = mesh(new THREE.TorusGeometry(0.7, 0.025, 6, 32), rope, 0, 0.12, z); r.scale.set(0.95, 0.32, 1); G.add(r); }
  const paddle = new THREE.Group(); paddle.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), logMat));
  const blade = mesh(new THREE.BoxGeometry(0.22, 0.6, 0.03), logMat, 0, 1.2, 0); paddle.add(blade);
  paddle.position.set(0.9, 0.35, -0.6); paddle.rotation.set(0.1, 0.3, 1.25); G.add(paddle);
  // net heap: a lumpy dome with an open-mesh texture
  const nt = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#d8d0b8'; g.lineWidth = 2; for (let i = 0; i < w; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 40, h); g.stroke(); g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 40, h); g.stroke(); } }, { repeat: [4, 2] });
  const ng = new THREE.SphereGeometry(0.6, 24, 12, 0, TAU, 0, Math.PI / 2), na = ng.attributes.position, r = rng(34);
  for (let k = 0; k < na.count; k++) { const s = 1 + (r() - 0.5) * 0.18; na.setXYZ(k, na.getX(k) * s * 1.3, na.getY(k) * s * 0.55, na.getZ(k) * s); }
  ng.computeVertexNormals();
  G.add(mesh(ng, std({ map: nt, color: 0x9a8f78, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }), -1.4, 0, 1.0));
  G.rotation.y = 0.5;
  return { group: G };
}

/* 2017: a stack of school books, the 1176/1200 mark sheet and a stethoscope (her dream of being a doctor) */
function books() {
  const G = new THREE.Group(), w = wood();
  G.add(mesh(new THREE.BoxGeometry(1.4, 0.07, 0.7), w, 0, 0.78, 0));
  for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) G.add(mesh(new THREE.BoxGeometry(0.06, 0.76, 0.06), w, x, 0.38, z));
  const pages = std({ color: 0xece3cc, roughness: 0.9 }), cols = [0x7b1d1d, 0x1d3f7b, 0x2c5a2a, 0x6b4d12, 0x3a2350];
  let y = 0.815; const r = rng(41);
  for (let i = 0; i < 5; i++) {
    const h = 0.05 + r() * 0.03, cov = std({ color: cols[i], roughness: 0.7 });
    const b = mesh(new THREE.BoxGeometry(0.52 - i * 0.02, h, 0.38), [pages, cov, cov, cov, pages, cov], -0.25, y + h / 2, 0); b.rotation.y = (r() - 0.5) * 0.3; G.add(b); y += h;
  }
  const sheet = canvasTex(512, 700, (g, W, H) => {
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, W, H); g.fillStyle = '#233'; g.textAlign = 'center';
    g.font = '700 34px StoneEn'; g.fillText('HIGHER SECONDARY', W / 2, 70); g.font = '400 26px StoneEn'; g.fillText('STATEMENT OF MARKS', W / 2, 110);
    g.strokeStyle = '#99a'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(40, 160 + i * 52); g.lineTo(W - 40, 160 + i * 52); g.stroke(); }
    g.font = '700 46px StoneEn'; g.fillStyle = '#9b1c1c'; g.fillText('1176 / 1200', W / 2, 600);
  });
  const sh = mesh(new THREE.PlaneGeometry(0.42, 0.56), std({ map: sheet, roughness: 0.9 }), 0.33, 0.817, 0.02); sh.rotation.set(-Math.PI / 2, 0, -0.2); G.add(sh);
  // stethoscope: tubing as a tube along a curve, metal ear tubes and a chest piece
  const tube = std({ color: 0x111316, roughness: 0.35 }), steel = metal(0xd0d4da, 0.2);
  const top = y + 0.012;
  const path = new THREE.CatmullRomCurve3([[-0.38, top, -0.1], [-0.2, top + 0.01, -0.16], [0.0, 0.83, -0.18], [0.18, 0.83, -0.05], [0.12, 0.83, 0.18], [-0.05, 0.83, 0.25], [-0.1, 0.83, 0.1]].map((p) => new THREE.Vector3(...p)));
  G.add(mesh(new THREE.TubeGeometry(path, 60, 0.012, 8), tube));
  for (const s of [-1, 1]) { const ep = new THREE.CatmullRomCurve3([[-0.38, top, -0.1], [-0.42 + s * 0.06, top + 0.005, -0.02], [-0.47 + s * 0.11, top + 0.005, 0.12]].map((p) => new THREE.Vector3(...p))); G.add(mesh(new THREE.TubeGeometry(ep, 20, 0.007, 6), steel)); }
  const cp = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 28), steel, -0.1, 0.825, 0.1); G.add(cp);
  return { group: G };
}

/* 2020: a relief lorry, loaded with sacks, headlights on */
function truck() {
  const G = new THREE.Group();
  const paint = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#c9541b'; g.fillRect(0, 0, w, h);
    const st = ['#1c4e9e', '#f2c230', '#1d7a3a', '#d91f4a']; st.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 150 + i * 18, w, 12); });
    g.fillStyle = '#fff'; g.font = '700 46px StoneTa'; g.textAlign = 'center'; g.fillText('நிவாரணப் பொருட்கள்', w / 2, 90); speckle(g, w, h, 200, '#3a1405', 2, 51);
  });
  const body = std({ map: paint, roughness: 0.5, metalness: 0.3 }), dark = std({ color: 0x111215, roughness: 0.7 }), glass = std({ color: 0x0b1420, metalness: 0.9, roughness: 0.08 });
  const cab = mesh(new RoundedBoxGeometry(2.3, 1.7, 1.6, 3, 0.12), body, 0, 1.55, 2.4); G.add(cab);
  G.add(mesh(new THREE.BoxGeometry(2.0, 0.65, 0.05), glass, 0, 1.95, 3.21));
  G.add(mesh(new THREE.BoxGeometry(2.35, 0.3, 0.2), metal(0xb8bcc2, 0.3), 0, 0.65, 3.25));
  const plank = std({ map: canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#7a5532'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 21) { g.fillStyle = '#4a2f18'; g.fillRect(0, y, w, 3); } speckle(g, w, h, 200, '#2a170a', 1.5, 52); }), roughness: 0.85 });
  G.add(mesh(new THREE.BoxGeometry(2.4, 0.18, 4.2), dark, 0, 0.88, -0.45));
  for (const [x, z, sx, sz] of [[-1.17, -0.45, 0.06, 4.2], [1.17, -0.45, 0.06, 4.2], [0, -2.52, 2.4, 0.06], [0, 1.62, 2.4, 0.06]]) G.add(mesh(new THREE.BoxGeometry(sx, 0.9, sz), plank, x, 1.42, z));
  const sack = std({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#d9c9a0'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { g.fillStyle = 'rgba(120,100,60,.25)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } }), roughness: 1 });
  const sg = new RoundedBoxGeometry(0.62, 0.32, 0.95, 3, 0.14), r = rng(53);
  for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - (l === 2 ? 1 : 0); i++) for (let j = 0; j < 4; j++) {
    const s = mesh(sg, sack, (i - 1) * 0.68 + (l === 2 ? 0.34 : 0) + (r() - 0.5) * 0.06, 1.15 + l * 0.31, -2.0 + j * 1.0 + (r() - 0.5) * 0.08); s.rotation.y = (r() - 0.5) * 0.15; G.add(s);
  }
  const tyre = std({ color: 0x0c0c0d, roughness: 0.9 }), hub = metal(0x9aa0a8, 0.4), wg = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 24); wg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1.1, 2.3], [1.1, 2.3], [-1.1, -1.4], [1.1, -1.4], [-1.1, -2.1], [1.1, -2.1]]) { G.add(mesh(wg, tyre, x, 0.48, z)); G.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 16).rotateZ(Math.PI / 2), hub, x, 0.48, z)); }
  const beam = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,200,.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  for (const x of [-0.85, 0.85]) {
    G.add(mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ color: 0xfff1cc }), x, 0.95, 3.205));
    const gs = glowSprite(0xffe6b0, 1.5, 0.8); gs.position.set(x, 0.95, 3.3); G.add(gs);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 24, 1, true), new THREE.MeshBasicMaterial({ map: beam, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, opacity: 0.16, fog: false }));
    cone.rotation.x = -Math.PI / 2 - 0.06; cone.position.set(x, 0.75, 3.25 + 4.5); G.add(cone);
  }
  const hl = new THREE.SpotLight(0xffe7b8, 40, 22, 0.5, 0.6, 1.6); hl.position.set(0, 1, 3.4); hl.target.position.set(0, 0, 12); G.add(hl, hl.target);
  return { group: G };
}

/* 2021: a steel ballot box with its seal, garlanded with marigold */
function ballot() {
  const G = new THREE.Group();
  const label = canvasTex(512, 384, (g, w, h) => { g.fillStyle = '#8f969e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, '#3d4248', 1.5, 61); g.fillStyle = '#f4f1e8'; g.fillRect(70, 90, w - 140, 200); g.fillStyle = '#1c1c1c'; g.textAlign = 'center'; g.font = '700 54px StoneTa'; g.fillText('வாக்குப் பெட்டி', w / 2, 175); g.font = '700 36px StoneEn'; g.fillText('BALLOT BOX', w / 2, 250); });
  const steel = std({ color: 0xaab0b7, metalness: 0.85, roughness: 0.35 }), front = std({ map: label, metalness: 0.6, roughness: 0.4 });
  G.add(mesh(new THREE.BoxGeometry(0.9, 0.72, 0.6), [steel, steel, steel, steel, front, steel], 0, 0.36 + 0.5, 0));
  G.add(mesh(new THREE.BoxGeometry(0.96, 0.06, 0.66), steel, 0, 1.25, 0));
  G.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), std({ color: 0x050505 }), 0, 1.285, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20).rotateX(Math.PI / 2), std({ color: 0x8e1414, roughness: 0.6 }), 0.3, 1.0, 0.31));   // wax seal
  const w = wood(); G.add(mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), w, 0, 0.25, 0));
  // marigold garland: two strands of flower balls draped over the box
  const ball = new THREE.SphereGeometry(0.045, 10, 8), orange = std({ color: 0xff8a12, roughness: 0.8 }), yellow = std({ color: 0xffc21a, roughness: 0.8 });
  const n = 46, inst = [new THREE.InstancedMesh(ball, orange, n * 2), new THREE.InstancedMesh(ball, yellow, n * 2)], m4 = new THREE.Matrix4(), cnt = [0, 0];
  for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
    const q = i / (n - 1), x = (q - 0.5) * 1.05, z = side * 0.34;
    const y = 1.29 - 0.26 * Math.sin(q * Math.PI);                       // the strand sags across the front and back faces
    const which = i % 3 === 0 ? 1 : 0; m4.makeTranslation(x, y, z + side * 0.02 * Math.sin(q * Math.PI)); inst[which].setMatrixAt(cnt[which]++, m4);
  }
  inst.forEach((im, i) => { im.count = cnt[i]; im.castShadow = true; G.add(im); });
  return { group: G };
}

/* 2024: the TVK flag on a brass pole, waving */
function flag(flagTex) {
  const G = new THREE.Group();
  const brass = std({ color: 0xc89a46, metalness: 1, roughness: 0.25 });
  G.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 7, 16), brass, 0, 3.5, 0));
  G.add(mesh(new THREE.SphereGeometry(0.12, 20, 14), brass, 0, 7.08, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 24), std({ color: 0x8b8173, roughness: 0.9 }), 0, 0.15, 0));
  const W = 3.0, H = 2.0, geo = new THREE.PlaneGeometry(W, H, 40, 20); geo.translate(W / 2, 0, 0);
  const mat = std({ map: flagTex, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.15 });
  const uni = { uT: { value: 0 } };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uT = uni.uT;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float q = position.x / ${W.toFixed(1)};
        float ph = position.x * 2.2 - uT * 5.0 + position.y * 0.6;
        float dz = cos(ph) * 2.2 * 0.16 * q;
        objectNormal = normalize(vec3(-dz, 0.0, 1.0));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.z += sin(ph) * 0.16 * q + sin(position.x * 4.1 - uT * 7.3) * 0.03 * q;
        transformed.y -= q * q * 0.12;`);
  };
  const f = new THREE.Mesh(geo, mat); f.position.set(0.05, 6.0, 0); f.castShadow = true; G.add(f);
  G.rotation.y = -0.9;
  return { group: G, update: (t) => { uni.uT.value = t; } };
}

/* Vikravandi 2024: a conference stage with an LED wall and sweeping beams */
function stage() {
  const G = new THREE.Group();
  const screen = canvasTex(1600, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7a0f12'); gr.addColorStop(0.5, '#b8181c'); gr.addColorStop(1, '#6b0b10'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6c736'; g.fillRect(0, h * 0.34, w, h * 0.32);
    g.fillStyle = '#7a0f12'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 120px StoneTa'; g.fillText('வெற்றிக் கொள்கைத் திருவிழா', w / 2, h / 2 + 6);
    g.fillStyle = '#fff3c4'; g.font = '700 64px StoneTa'; g.fillText('விக்கிரவாண்டி · 27.10.2024', w / 2, h * 0.17); g.font = '700 54px StoneEn'; g.fillText('TAMILAGA VETTRI KAZHAGAM', w / 2, h * 0.84);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);           // LED rows
  });
  const truss = std({ color: 0x8a8f96, metalness: 0.9, roughness: 0.4 });
  G.add(mesh(new THREE.BoxGeometry(22, 1.6, 8), std({ color: 0x1a1214, roughness: 0.8 }), 0, 0.8, 0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(18, 7.2), new THREE.MeshBasicMaterial({ map: screen, fog: false, toneMapped: false, color: 0xbbbbbb }));
  scr.position.set(0, 6.0, -2.5); G.add(scr);
  const sGlow = glowSprite(0xff5a2a, 30, 0.35); sGlow.position.set(0, 6, -2.2); G.add(sGlow);
  for (const x of [-10.5, 10.5]) G.add(mesh(new THREE.BoxGeometry(0.6, 11, 0.6), truss, x, 5.5, -2.5));
  G.add(mesh(new THREE.BoxGeometry(21.6, 0.6, 0.6), truss, 0, 10.8, -2.5));
  const beamTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const beams = [], cols = [0xffd27a, 0xff6a3a, 0xfff1d0, 0xffb347, 0xff6a3a, 0xffd27a];
  cols.forEach((c, i) => {
    const geo = new THREE.ConeGeometry(2.4, 42, 20, 1, true); geo.translate(0, -21, 0);   // apex at origin, opening upward after the flip
    const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: beamTex, color: c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    b.position.set((i - 2.5) * 3.8, 10.8, -2.5); b.rotation.x = Math.PI; G.add(b); beams.push(b);
    const lamp = glowSprite(c, 2.2, 0.9); lamp.position.copy(b.position); G.add(lamp);
  });
  return { group: G, update: (t, near = 1) => beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.5; b.rotation.x = Math.PI + Math.sin(t * 0.5 + i) * 0.25 - 0.15; b.material.opacity = 0.2 * near; }) };
}

/* Parandur 2025: a paddy field and its water, with a lone microphone: the voice of the voiceless */
function paddy() {
  const G = new THREE.Group();
  const W = 14, D = 9;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std({ color: 0x1d2b34, metalness: 0.9, roughness: 0.12 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.04; G.add(water);
  const bund = std({ color: 0x5a3a24, roughness: 1 });
  for (const [x, z, sx, sz] of [[0, D / 2, W + 0.6, 0.6], [0, -D / 2, W + 0.6, 0.6], [W / 2, 0, 0.6, D], [-W / 2, 0, 0.6, D]]) G.add(mesh(new THREE.BoxGeometry(sx, 0.25, sz), bund, x, 0.1, z));
  // paddy clumps: each a little fan of blades, instanced in neat transplanted rows
  const blade = new THREE.ConeGeometry(0.02, 0.55, 3); blade.translate(0, 0.275, 0);
  const parts = [];
  for (let k = 0; k < 7; k++) { const g = blade.clone(); g.rotateZ((k - 3) * 0.16); g.rotateY(k * 0.9); parts.push(g); }
  const clump = mergeGeos(parts);
  const rows = 15, colsN = 24, n = rows * colsN, im = new THREE.InstancedMesh(clump, std({ color: 0x6fae3a, roughness: 0.7 }), n), m4 = new THREE.Matrix4(), r = rng(71);
  const colr = new THREE.Color(); let i = 0;
  for (let a = 0; a < rows; a++) for (let b = 0; b < colsN; b++) {
    const x = -W / 2 + 0.5 + (b / (colsN - 1)) * (W - 1), z = -D / 2 + 0.5 + (a / (rows - 1)) * (D - 1), s = 0.8 + r() * 0.5;
    m4.compose(new THREE.Vector3(x + (r() - 0.5) * 0.06, 0.02, z + (r() - 0.5) * 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s, s));
    im.setMatrixAt(i, m4); im.setColorAt(i, colr.setHSL(0.2 + r() * 0.05, 0.5, 0.26 + r() * 0.1)); i++;
  }
  G.add(im);
  // the microphone on its stand at the near edge of the field
  const steel = metal(0x25272b, 0.35), chrome = metal(0xcfd3d8, 0.15);
  const mic = new THREE.Group();
  mic.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 28), steel, 0, 0.02, 0));
  mic.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.55, 10), chrome, 0, 0.8, 0));
  const head = new THREE.Group(); head.position.set(0, 1.6, 0); head.rotation.x = 0.5;
  head.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.18, 14), steel, 0, 0.0, 0));
  head.add(mesh(new THREE.SphereGeometry(0.055, 18, 14), std({ color: 0x55585e, metalness: 0.8, roughness: 0.5, wireframe: false }), 0, 0.12, 0));
  mic.add(head); mic.scale.setScalar(1.15); mic.position.set(-3.2, 0, D / 2 + 1.6); G.add(mic);
  return { group: G };
}

function mergeGeos(list) {
  let pos = [], nor = [];
  for (const g of list) { const n = g.toNonIndexed(); n.computeVertexNormals(); pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g;
}

export function buildProp(kind, assets) {
  return { board, tin, leaf, boat, books, truck, ballot, flag: () => flag(assets.flagTex), stage, paddy }[kind]();
}
