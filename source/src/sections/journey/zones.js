// Each milestone has its own setting. The road passes through ten places and times of day, blending smoothly from
// one to the next: the sky, light, haze, rain, ground, trees and buildings all change between milestones.
import * as THREE from 'three';
import { canvasTex, buildProp } from './props.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// sky: top, horizon, sun glow, far hills, near hills, sunlight colour; hemi/sun intensity; sun elevation & azimuth (0 = straight down the road)
// cloud: 0..1 cover, over: overcast grey; fog [near, far]; rain 0..1; ground [colour, mix over grass]; trees: density and type weights
export const ZONES = [
  { name: 'Small-town dawn', sky: [0x2f73d8, 0xffc48a, 0xffa04a, 0xc29aa8, 0x5b7d4a, 0xffd9a8], hemi: 0.95, sunI: 2.2, el: 0.14, az: -0.6, cloud: 0.45, over: 0, fog: [18, 260], rain: 0, ground: [0xb9a27a, 0.45], trees: [0.75, { palm: 0.45, broad: 0.5, banana: 0.05 }], petals: 0.15 },
  { name: 'Town relief drive', sky: [0x1f6fdc, 0xbfe0ff, 0xfff0c8, 0x8fb0cc, 0x4f8a52, 0xfff6e8], hemi: 1.1, sunI: 2.8, el: 0.5, az: 2.2, cloud: 0.4, over: 0, fog: [40, 420], rain: 0, ground: [0xb08a62, 0.55], trees: [0.45, { palm: 0.4, broad: 0.6 }], petals: 0.2 },
  { name: 'Chennai, Chepauk', sky: [0x4a86c8, 0xe6dcc8, 0xfff3d0, 0xb8b0a0, 0x8a8a70, 0xfff4e0], hemi: 1.15, sunI: 2.6, el: 1.0, az: 2.6, cloud: 0.2, over: 0.1, fog: [30, 320], rain: 0, ground: [0xa59a88, 0.7], trees: [0.18, { broad: 0.8, palm: 0.2 }], petals: 0.05 },
  { name: 'Nagapattinam coast', sky: [0x0f72d8, 0xaee6ff, 0xfff5d8, 0x9cc6dc, 0x6aa070, 0xffffff], hemi: 1.15, sunI: 3.0, el: 0.8, az: 2.4, cloud: 0.55, over: 0, fog: [50, 460], rain: 0, ground: [0xf0dfb4, 1.0], trees: [0.7, { casuarina: 0.55, palm: 0.45 }], petals: 0.15 },
  { name: 'Ariyalur village', sky: [0x2c78d0, 0xffe0b0, 0xffc070, 0xa8a890, 0x5a8a48, 0xfff0d0], hemi: 1.05, sunI: 2.5, el: 0.45, az: 2.0, cloud: 0.35, over: 0, fog: [40, 400], rain: 0, ground: [0x8f9a50, 0.3], trees: [0.8, { palm: 0.5, broad: 0.4, banana: 0.1 }], petals: 0.1 },
  { name: 'Kerala monsoon', sky: [0x7b97b2, 0xccd8e2, 0xeef2f5, 0x8aa0a8, 0x3f6e48, 0xe6eef5], hemi: 1.3, sunI: 1.1, el: 0.8, az: 2.5, cloud: 1.0, over: 0.85, fog: [22, 230], rain: 1, ground: [0x3d7a35, 0.45], trees: [1.1, { banana: 0.4, palm: 0.5, broad: 0.1 }], petals: 0.0 },
  { name: 'Village election day', sky: [0x1a6ee0, 0xcde9ff, 0xffe8b0, 0x90b4cc, 0x5a8c48, 0xfff8ea], hemi: 1.1, sunI: 2.9, el: 0.6, az: 2.6, cloud: 0.45, over: 0, fog: [40, 420], rain: 0, ground: [0xa6a456, 0.4], trees: [0.75, { palm: 0.45, broad: 0.55 }], petals: 0.25 },
  { name: 'A new party', sky: [0x0e64e0, 0xb8e2ff, 0xfff0c0, 0x86aac8, 0x4f8a50, 0xffffff], hemi: 1.15, sunI: 3.0, el: 0.7, az: 2.8, cloud: 0.3, over: 0, fog: [40, 440], rain: 0, ground: [0x6fa040, 0.0], trees: [0.7, { palm: 0.6, broad: 0.4 }], petals: 0.55 },
  { name: 'Vikravandi twilight', sky: [0x3a3fa8, 0xff8f7a, 0xff7a4a, 0x8a5a8a, 0x3a4a48, 0xffb898], hemi: 0.9, sunI: 1.5, el: 0.05, az: -0.45, cloud: 0.5, over: 0, fog: [30, 360], rain: 0, ground: [0x9c6a48, 0.6], trees: [0.25, { palm: 0.7, broad: 0.3 }], petals: 0.6 },
  { name: 'Parandur, a new dawn', sky: [0x3f7bd8, 0xffc070, 0xff9a3a, 0xc59a7a, 0x5a7a3a, 0xffd9a0], hemi: 1.0, sunI: 2.4, el: 0.12, az: 0.05, cloud: 0.4, over: 0, fog: [36, 400], rain: 0, ground: [0x6fb33a, 0.55], trees: [0.7, { palm: 0.85, broad: 0.15 }], petals: 0.3 },
];

// blend weights at distance s: zone centres sit at each milestone's dwell
export function makeZoneBlend(STONES) {
  const C = STONES.map((m) => m.d - 9);
  return (s) => {
    if (s <= C[0]) return [0, 0, 0];
    if (s >= C[C.length - 1]) return [C.length - 1, C.length - 1, 0];
    let i = 0; while (s > C[i + 1]) i++;
    // hold each setting around its milestone and change over the middle of the drive between them
    const t = sm(C[i] + 8, C[i + 1] - 10, s);
    return [i, i + 1, t];
  };
}

const col = (h) => new THREE.Color(h);
export function zoneParams(blend, s, out) {
  const [a, b, t] = blend(s), A = ZONES[a], B = ZONES[b];
  out.top ||= col(0); out.hor ||= col(0); out.glow ||= col(0); out.far ||= col(0); out.near ||= col(0); out.light ||= col(0);
  ['top', 'hor', 'glow', 'far', 'near', 'light'].forEach((k, i) => out[k].set(A.sky[i]).lerp(col(B.sky[i]), t));
  for (const k of ['hemi', 'sunI', 'el', 'cloud', 'over', 'rain', 'petals']) out[k] = lerp(A[k], B[k], t);
  let da = B.az - A.az; out.az = A.az + da * t;
  out.fogNear = lerp(A.fog[0], B.fog[0], t); out.fogFar = lerp(A.fog[1], B.fog[1], t);
  out.a = a; out.b = b; out.t = t; out.k = t < 0.5 ? a : b;
  return out;
}

/* ---------- textures for the buildings ---------- */
const SHOPS = ['டீ கடை', 'மளிகை ஸ்டோர்ஸ்', 'மெடிக்கல்ஸ்', 'பேக்கரி', 'டெக்ஸ்டைல்ஸ்', 'ஹோட்டல்', 'ஸ்வீட்ஸ்', 'எலக்ட்ரிக்கல்ஸ்', 'பூக்கடை', 'சலூன்'];
const WALLS = ['#f4a3b4', '#8fd3d0', '#ffd36b', '#f6efe2', '#a7d07a', '#f7b267', '#c9b6f2', '#9ec9f5', '#ffffff', '#f28f6b'];
function facadeTex(i, floors) {
  const r = rng(300 + i), wall = WALLS[i % WALLS.length];
  return canvasTex(256, 128 * floors, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(80,60,40,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    // ground floor: shop with rolled-up shutter, goods inside, a painted signboard
    const gy = h - 128;
    g.fillStyle = '#2a211b'; g.fillRect(28, gy + 46, w - 56, 82);
    const r2 = rng(400 + i); for (let k = 0; k < 40; k++) { g.fillStyle = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#f5f5f5'][Math.floor(r2() * 6)]; g.fillRect(34 + r2() * (w - 80), gy + 62 + r2() * 56, 8 + r2() * 14, 6 + r2() * 10); }
    g.fillStyle = '#9aa0a6'; g.fillRect(28, gy + 46, w - 56, 10); for (let x = 30; x < w - 30; x += 4) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, gy + 46, 1, 10); }
    const bc = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#ef6c00'][i % 6];
    g.fillStyle = bc; g.fillRect(14, gy + 8, w - 28, 34); g.fillStyle = '#fff'; g.font = '700 21px StoneTa'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let name = SHOPS[i % SHOPS.length], fs = 21; while (g.measureText(name).width > w - 40 && fs > 12) { fs--; g.font = `700 ${fs}px StoneTa`; }
    g.fillText(name, w / 2, gy + 26);
    // upper floors: windows with shutters, a balcony rail
    for (let f = 0; f < floors - 1; f++) {
      const y = f * 128;
      for (const x of [34, 150]) { g.fillStyle = '#5b7fa6'; g.fillRect(x, y + 34, 72, 58); g.fillStyle = '#e8e2d6'; g.fillRect(x - 4, y + 30, 80, 6); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 4, y + 38, 26, 50); g.fillStyle = '#3d5f86'; g.fillRect(x + 35, y + 34, 3, 58); }
      g.fillStyle = 'rgba(40,40,40,.65)'; for (let x = 20; x < w - 20; x += 10) g.fillRect(x, y + 100, 3, 24); g.fillRect(16, y + 98, w - 32, 4);
    }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, w, 8);
  });
}
function towerTex(i) {
  const r = rng(500 + i), base = ['#d8d2c4', '#b9c3cc', '#e6dfd0', '#9fb3c8', '#cfc6b8'][i % 5];
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 14) { const lit = r(); g.fillStyle = lit < 0.15 ? '#ffe9b0' : lit < 0.6 ? '#4f6b86' : '#6f8aa5'; g.fillRect(x, y, 9, 7); }
  }, { repeat: [1, 1] });
}
function houseWallTex(i) {
  const wall = ['#f6f1e6', '#a9d5f2', '#f7d36b', '#f4b6c2', '#bfe3b4', '#ffffff'][i % 6];
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a4b2a'; g.fillRect(0, h - 18, w, 18);                                 // red-oxide plinth
    g.fillStyle = '#5d3a1e'; g.fillRect(104, 40, 48, 70); g.fillStyle = '#c9a227'; g.fillRect(104, 40, 48, 4);   // door
    for (const x of [34, 184]) { g.fillStyle = '#2e6f9e'; g.fillRect(x, 50, 38, 34); g.fillStyle = '#20384f'; for (let k = 0; k < 5; k++) g.fillRect(x + 4 + k * 7, 50, 2, 34); }
    g.fillStyle = '#c0392b'; g.fillRect(96, 30, 64, 6); g.fillStyle = '#f9a825'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(100 + k * 9, 38, 3, 0, TAU); g.fill(); }   // mango-leaf thoranam
  });
}
function kolamTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(40 + i * 44, 40 + j * 44, 4, 0, TAU); g.fill(); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(62 + i * 44, 62 + j * 44, 24, 0, TAU); g.stroke(); }
    g.strokeStyle = '#e53935'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.stroke();
  });
}
function wallPaintTex() {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1565c0'; g.font = '700 46px StoneTa'; g.textAlign = 'center'; g.fillText('ஊராட்சி மன்றம்', w / 2, 62);
    g.fillStyle = '#8e1418'; g.font = '700 30px StoneTa'; g.fillText('வாக்களிப்பது நமது கடமை', w / 2, 112);
    g.fillStyle = '#f6c32e'; g.fillRect(0, h - 16, w, 8); g.fillStyle = '#8e1418'; g.fillRect(0, h - 8, w, 8);
  });
}
function paddyTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5c8a6a'; g.fillRect(0, 0, w, h);                                          // water between the seedlings
    for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) { g.fillStyle = `rgb(${90 + Math.random() * 40},${160 + Math.random() * 40},${50 + Math.random() * 20})`; g.beginPath(); g.ellipse(x, y, 4, 5, 0, 0, TAU); g.fill(); }
  }, { repeat: [6, 6] });
}

/* ---------- water: sky-reflecting, gently rippled, faded at its edges ---------- */
export function waterMaterial({ deep = 0x13627a, waves = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTop: { value: col(0x2f7fe0) }, uHor: { value: col(0xcfe8ff) }, uDeep: { value: col(deep) }, uSun: { value: new THREE.Vector3(0, 0.5, -1).normalize() }, uTime: { value: 0 },
      uFogColor: { value: col(0xffffff) }, uFog: { value: new THREE.Vector2(40, 420) }, uWaves: { value: waves } },
    vertexShader: `uniform float uTime, uWaves; attribute float edge; varying vec3 vW; varying float vEdge, vDist;
      void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p, 1.0);
        w.y += uWaves * (sin(w.x * 0.18 + uTime * 1.3) * 0.06 + sin(w.z * 0.23 - uTime * 1.1) * 0.05);
        vW = w.xyz; vEdge = edge; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uDeep, uSun, uFogColor; uniform float uTime, uWaves; uniform vec2 uFog; varying vec3 vW; varying float vEdge, vDist;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 q = vW.xz * 0.35; float e = 0.04;
        float a = n2(q + uTime * 0.25) + 0.5 * n2(q * 2.3 - uTime * 0.35), b = n2(q + vec2(e, 0) + uTime * 0.25) + 0.5 * n2((q + vec2(e, 0)) * 2.3 - uTime * 0.35), c = n2(q + vec2(0, e) + uTime * 0.25) + 0.5 * n2((q + vec2(0, e)) * 2.3 - uTime * 0.35);
        vec3 n = normalize(vec3((a - b) * (1.2 + uWaves), 1.0, (a - c) * (1.2 + uWaves)));
        vec3 v = normalize(cameraPosition - vW); vec3 r = reflect(-v, n);
        float fr = 0.12 + 0.88 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 sky = mix(uHor, uTop, smoothstep(0.0, 0.6, r.y));
        vec3 col = mix(uDeep, sky, fr);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, uSun), 0.0), 220.0) * 2.5;
        col = mix(col, uFogColor, smoothstep(uFog.x, uFog.y, vDist));
        gl_FragColor = vec4(col, vEdge);
        #include <colorspace_fragment>
      }`,
  });
}
function waterPatch(points, mat, y = 0.12) {          // a polygonal patch (x,z pairs), its rim faded with an edge attribute
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape, 24); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cx = points.reduce((a, p) => a + p[0], 0) / points.length, cz = points.reduce((a, p) => a + p[1], 0) / points.length;
  const R = Math.max(...points.map(([x, z]) => Math.hypot(x - cx, z - cz)));
  const edge = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) edge[i] = 1;
  g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
  const m = new THREE.Mesh(g, mat); m.position.y = y; m.renderOrder = 1; return m;
}

/* ---------- the set pieces ---------- */
export function buildZones(scene, { frame, at, STONES, ROAD_W, END_S, flagTex }) {
  const r = rng(4242), G = new THREE.Group(); scene.add(G);
  const updates = [], waters = [];
  const facing = (s, side) => { const f = frame(s); return Math.atan2(-side * f.r.x, -side * f.r.z); };
  // keep the milestone and its object clear on the stone's side
  const clearOf = (s, side, off) => STONES.some((m) => m.side === side && s > m.d - 16 && s < m.d + 14 && off < 22) || STONES.some((m) => s > m.d - 14 && s < m.d - 2 && off < 9);
  const facades = Array.from({ length: 10 }, (_, i) => ({ f2: facadeTex(i, 2), f3: facadeTex(i + 3, 3), wall: new THREE.MeshStandardMaterial({ color: WALLS[i % WALLS.length], roughness: 0.9 }) }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.95 });

  function shop(s, side, off, floors, i) {
    const w = 5 + r() * 2.5, h = floors * 3.3, d = 7, F = facades[i % facades.length];
    const front = new THREE.MeshStandardMaterial({ map: floors === 3 ? F.f3 : F.f2, roughness: 0.85 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [F.wall, F.wall, roofMat, roofMat, front, F.wall]);
    b.position.copy(at(s, side, off + d / 2)).setY(h / 2); b.rotation.y = facing(s, side); b.castShadow = b.receiveShadow = true; G.add(b);
    if (r() < 0.6) { // a little awning over the shop
      const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.06, 1.2), new THREE.MeshStandardMaterial({ color: [0xc62828, 0xf9a825, 0x1565c0, 0x2e7d32][Math.floor(r() * 4)], roughness: 0.7 }));
      aw.position.copy(at(s, side, off - 0.5)).setY(2.9); aw.rotation.y = b.rotation.y; aw.rotation.x = 0; aw.castShadow = true; G.add(aw);
    }
    return w;
  }
  // 1992-2001: a small town, quiet tea shops at dawn becoming a busy street
  for (const side of [-1, 1]) {
    let s = -20;
    while (s < STONES[1].d + 26) {
      const busy = sm(STONES[0].d, STONES[1].d - 10, s), off = 10.5 + r() * 1.5;
      if (!clearOf(s, side, off) && r() < 0.55 + busy * 0.4) s += shop(s, side, off, r() < 0.25 + busy * 0.4 ? 3 : 2, Math.floor(r() * 10)) + 0.4 + r() * (2.5 - busy * 2);
      else s += 4 + r() * 4;
    }
  }
  // 2008: Chennai, a city skyline beyond mid-rise streets
  const towerMats = Array.from({ length: 5 }, (_, i) => new THREE.MeshStandardMaterial({ map: towerTex(i), roughness: 0.6, metalness: 0.1 }));
  for (let i = 0; i < 70; i++) {
    const s = STONES[2].d - 25 + r() * 80, side = r() < 0.5 ? -1 : 1, off = 70 + r() * 170, h = 16 + r() * 52, w = 10 + r() * 14;
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.7 + r() * 0.5)), towerMats[i % 5]); t.material.map.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 14)));
    t.position.copy(at(s, side, off)).setY(h / 2); t.rotation.y = facing(s, side) + (r() - 0.5) * 0.3; G.add(t);
  }
  for (const side of [-1, 1]) for (let s = STONES[2].d - 38; s < STONES[2].d + 34; s += 6.5 + r() * 3) { const off = 14 + r() * 3; if (!clearOf(s, side, off)) shop(s, side, off, 3 + (r() < 0.5 ? 1 : 0), Math.floor(r() * 10)); }
  { // the hunger-strike pandal: a striped shamiana on poles, rows of chairs
    const m = STONES[2], f = frame(m.d + 4), c = f.p.clone().addScaledVector(f.r, m.side * 14.5);
    const stripe = canvasTex(256, 256, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#f6f1e6' : '#c62828'; g.fillRect(x, 0, 32, h); } }, { repeat: [3, 1] });
    const P = new THREE.Group(); P.position.copy(c); P.rotation.y = facing(m.d + 4, m.side);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.6, 4, 1, true), new THREE.MeshStandardMaterial({ map: stripe, side: THREE.DoubleSide, roughness: 0.9 }));
    roof.rotation.y = Math.PI / 4; roof.position.y = 3.6; roof.castShadow = true; P.add(roof);
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8), new THREE.MeshStandardMaterial({ color: 0xc8a46a })); pl.position.set(x, 1.45, z); P.add(pl); }
    const chair = new THREE.BoxGeometry(0.45, 0.85, 0.45), cm = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.6 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { const ch = new THREE.Mesh(chair, cm); ch.position.set(-3 + j * 1.2, 0.42, -2.5 + i * 1.3); P.add(ch); }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), new THREE.MeshStandardMaterial({ map: canvasTex(700, 110, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6c32e'; g.font = '700 54px StoneTa'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('உண்ணாவிரதப் போராட்டம்', w / 2, h / 2 + 3); }) }));
    ban.position.set(0, 2.65, 4.05); P.add(ban); G.add(P);
  }
  // 2011: Nagapattinam, the sea on the right, beached boats, thatched fishermen's huts on the left
  const sea = waterMaterial({ deep: 0x0e6f8f, waves: 1 }); waters.push(sea);
  {
    const m = STONES[3];
    const s0 = m.d - 90, s1 = m.d + 70;
    // a grid that follows the shore, faded out at both ends so the sea appears and leaves gently
    const grid = new THREE.PlaneGeometry(1, 1, 60, 60), gp = grid.attributes.position, edge = new Float32Array(gp.count);
    for (let i = 0; i < gp.count; i++) {
      const u = gp.getX(i) + 0.5, v = gp.getY(i) + 0.5, s = lerp(s0, s1, u), off = lerp(24, 420, v * v);
      const p = at(s, m.side, off + Math.sin(s * 0.08) * 3); gp.setXYZ(i, p.x, 0, p.z);
      edge[i] = sm(s0, s0 + 45, s) * (1 - sm(s1 - 40, s1, s)) * sm(24, 30, off);
    }
    grid.setAttribute('edge', new THREE.BufferAttribute(edge, 1)); grid.computeVertexNormals();
    const seaMesh = new THREE.Mesh(grid, sea); seaMesh.position.y = 0.22; seaMesh.renderOrder = 1; G.add(seaMesh);
    // surf: a white line of foam along the shore
    const foamPts = []; for (let s = s0 + 30; s < s1 - 25; s += 1) { const a = at(s, m.side, 25.6 + Math.sin(s * 0.08) * 3), b = at(s + 1, m.side, 25.6 + Math.sin((s + 1) * 0.08) * 3); foamPts.push(a.x, 0.09, a.z, b.x, 0.09, b.z); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(foamPts, 3)); G.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0xffffff })));
    for (let i = 0; i < 4; i++) { const b = buildProp('boat', {}); b.group.position.copy(at(m.d + 14 + i * 9, m.side, 19 + r() * 4)); b.group.rotation.y = r() * TAU; b.group.scale.setScalar(0.9); G.add(b.group); }
    const thatch = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 1 }), mud = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const s = m.d - 30 + i * 8 + r() * 3, off = 12 + r() * 6; if (clearOf(s, -m.side, off)) continue;
      const h = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 2.0, 16), mud); body.position.y = 1; body.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 16), thatch); roof.position.y = 3.0; roof.castShadow = true; h.add(body, roof);
      h.position.copy(at(s, -m.side, off)); G.add(h);
    }
  }
  // 2017 & 2021: villages with tiled roofs, kolam at the doors; the panchayat office at the election
  const tile = new THREE.MeshStandardMaterial({ color: 0xb5482c, roughness: 0.85 }), kolam = new THREE.MeshBasicMaterial({ map: kolamTex(), transparent: true, depthWrite: false });
  function house(s, side, off, i) {
    const w = 6 + r() * 2, d = 5, h = 2.8, H = new THREE.Group();
    const walls = new THREE.MeshStandardMaterial({ map: houseWallTex(i), roughness: 0.9 }), plain = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [plain, plain, plain, plain, walls, plain]); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; H.add(body);
    const roofG = new THREE.CylinderGeometry(0.01, (d / 2) * 1.5, w + 0.8, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(Math.PI / 6);
    const roof = new THREE.Mesh(roofG, tile); roof.scale.set(1, 0.62, 1); roof.position.y = h + 0.7; roof.castShadow = true; H.add(roof);
    const k = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), kolam); k.rotation.x = -Math.PI / 2; k.position.set(0, 0.04, d / 2 + 1.6); H.add(k);
    H.position.copy(at(s, side, off + d / 2)); H.rotation.y = facing(s, side); G.add(H);
  }
  for (const zi of [4, 6]) {
    const m = STONES[zi];
    for (const side of [-1, 1]) for (let s = m.d - 12; s < m.d + (zi === 4 ? 16 : 30); s += 7 + r() * 6) { const off = 11 + r() * 8; if (!clearOf(s, side, off) && r() < 0.8) house(s, side, off, Math.floor(r() * 6)); }
  }
  {
    const m = STONES[6], s = m.d + 16, side = -m.side, off = 13;
    const pg = new THREE.Group(), wp = new THREE.MeshStandardMaterial({ map: wallPaintTex(), roughness: 0.9 }), plain = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(14, 4.2, 7), [plain, plain, roofMat, roofMat, wp, plain]); b.position.y = 2.1; b.castShadow = b.receiveShadow = true; pg.add(b);
    pg.position.copy(at(s, side, off + 3.5)); pg.rotation.y = facing(s, side); G.add(pg);
  }
  // 2020: Kerala in the monsoon: flooded fields reflecting a grey sky, and rain
  const flood = waterMaterial({ deep: 0x4f6b5a, waves: 0.15 }); waters.push(flood);
  {
    const m = STONES[5];
    for (let i = 0; i < 16; i++) {
      const s = m.d - 30 + r() * 70, side = r() < 0.5 ? -1 : 1, off = 18 + r() * 50; if (clearOf(s, side, off - 6)) continue;
      const c = at(s, side, off), R = Math.min(6 + r() * 12, (off - 9) / 1.6), pts = [];
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, rr = R * (0.7 + r() * 0.5); pts.push([c.x + Math.cos(a) * rr * 1.4, c.z + Math.sin(a) * rr]); }
      G.add(waterPatch(pts, flood));
    }
  }
  // 2024 founding: rows of tall party flags on both sides
  {
    const m = STONES[7], list = [];
    for (let s = m.d - 40; s < m.d + 30; s += 7) for (const side of [-1, 1]) if (!clearOf(s, side, 9)) list.push({ s, side });
    const fg = new THREE.PlaneGeometry(2.4, 1.6, 16, 6); fg.translate(1.2, 7.4, 0);
    const pg = new THREE.CylinderGeometry(0.05, 0.07, 8.2, 8); pg.translate(0, 4.1, 0);
    const fm = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.6 }), uT = { value: 0 };
    fm.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].z * 0.4; float q = position.x / 2.4; transformed.z += sin(position.x * 2.6 - uT * 5.0 + ph) * 0.2 * q; transformed.y -= q * q * 0.12;`); };
    const fi = new THREE.InstancedMesh(fg, fm, list.length), pi = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xc89a46, metalness: 1, roughness: 0.3 }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    list.forEach((L, i) => { const f = frame(L.s); m4.compose(at(L.s, L.side, 9), q.setFromEuler(new THREE.Euler(0, Math.atan2(f.r.x, f.r.z) + Math.PI / 2 + 0.5, 0)), one); fi.setMatrixAt(i, m4); pi.setMatrixAt(i, m4); });
    fi.castShadow = pi.castShadow = true; G.add(fi, pi); updates.push((t) => { uT.value = t; });
  }
  // Vikravandi: strings of bulbs glowing over the crowd in the twilight
  const bulbs = [];
  {
    const m = STONES[8], rr = rng(808);
    for (let k = 0; k < 14; k++) {
      const s = m.d - 6 + k * 4.5, A = at(s, m.side, 6), B = at(s + 8, m.side, 36);
      for (let i = 0; i <= 40; i++) { const t = i / 40, p = A.clone().lerp(B, t); p.y = 5.5 - Math.sin(t * Math.PI) * 1.4; bulbs.push(p.x, p.y, p.z, rr()); }
    }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs.filter((_, i) => i % 4 < 3), 3)); bg.setAttribute('phase', new THREE.Float32BufferAttribute(bulbs.filter((_, i) => i % 4 === 3), 1));
  const bulbMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: 1 } },
    vertexShader: 'attribute float phase; uniform float uTime, uPx; varying float vA; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = 0.75 + 0.25 * sin(uTime * 3.0 + phase * 40.0); vC = phase < 0.33 ? vec3(1.0, 0.85, 0.4) : phase < 0.66 ? vec3(1.0, 0.45, 0.3) : vec3(1.0, 0.95, 0.8); gl_PointSize = uPx * 120.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uAmt; varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * a * vA * uAmt, 1.0); }' });
  G.add(new THREE.Points(bg, bulbMat));
  // 2025: Parandur paddy fields and a lake
  const lake = waterMaterial({ deep: 0x2d6f86, waves: 0.25 }); waters.push(lake);
  {
    const m = STONES[9], pm = new THREE.MeshStandardMaterial({ map: paddyTex(), roughness: 0.6 });
    for (let i = 0; i < 22; i++) {
      const s = m.d - 50 + (i % 11) * 11 + r() * 3, side = i < 11 ? -1 : 1, off = 10 + Math.floor(r() * 3) * 11; if (clearOf(s, side, off - 2)) continue;
      const f = frame(s), pl = new THREE.Mesh(new THREE.PlaneGeometry(10, 9.4), pm); pl.rotation.set(-Math.PI / 2, 0, Math.atan2(f.t.x, f.t.z)); pl.position.copy(at(s, side, off + 5)).setY(0.02); pl.receiveShadow = true; G.add(pl);
    }
    const c = at(m.d + 30, -m.side, 70), pts = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, rr = 30 * (0.75 + r() * 0.4); pts.push([c.x + Math.cos(a) * rr * 0.7, c.z + Math.sin(a) * rr * 1.4]); }
    G.add(waterPatch(pts, lake));
  }
  // rain streaks around the camera
  const rainN = 1600, rp = new Float32Array(rainN * 6), rrng = rng(55);
  for (let i = 0; i < rainN; i++) { const x = (rrng() - 0.5) * 40, y = rrng() * 14, z = (rrng() - 0.5) * 40; rp.set([x, y, z, x - 0.05, y - 0.7, z], i * 6); }
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: 'uniform float uTime; varying float vY; void main(){ vec3 p = position; float top = 14.0; p.y = mod(p.y - uTime * 18.0, top); vY = p.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform float uAmt; varying float vY; void main(){ gl_FragColor = vec4(0.85, 0.9, 1.0, 0.35 * uAmt * smoothstep(0.0, 1.0, vY)); }' });
  const rain = new THREE.LineSegments(rgeo, rainMat); rain.frustumCulled = false; scene.add(rain);

  return {
    update(time, s, Z, camera, fog, sunDir, pxScale) {
      updates.forEach((u) => u(time));
      for (const w of waters) { const U = w.uniforms; U.uTime.value = time; U.uTop.value.copy(Z.top); U.uHor.value.copy(Z.hor); U.uSun.value.copy(sunDir); U.uFogColor.value.copy(fog.color); U.uFog.value.set(fog.near, fog.far); }
      bulbMat.uniforms.uTime.value = time; bulbMat.uniforms.uPx.value = pxScale;
      bulbMat.uniforms.uAmt.value = (Z.a === 8 ? 1 - Z.t : Z.b === 8 ? Z.t : 0);
      rain.position.copy(camera.position).setY(0); rainMat.uniforms.uTime.value = time; rainMat.uniforms.uAmt.value = Z.rain;
    },
  };
}

// ground: a 1D lookup along the road of each place's soil colour and how much it covers the grass
export function groundLUT(blend, S_MIN, S_MAX) {
  const N = 512, data = new Uint8Array(N * 4), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const s = lerp(S_MIN, S_MAX, i / (N - 1)), [a, b, t] = blend(s), A = ZONES[a].ground, B = ZONES[b].ground;
    c.set(A[0]).lerp(new THREE.Color(B[0]), t);
    data.set([c.r * 255, c.g * 255, c.b * 255, lerp(A[1], B[1], t) * 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.LinearFilter;
  return tex;
}
