// TVK hero POC: the flag is hoisted up a brass pole as you scroll.
// It rises furled and bunched, unfurls at the top, waves in gusting wind,
// then the pole glides to the right and the title comes in on the left.
// Cloth is a real Verlet simulation; everything is built in code (three.js).
import * as THREE from 'three';
import { registerRenderer } from '../../gpu.js';
import { createStudioEnvironment } from './whistle3d.js';
import { createSilhouettes } from './silhouettes.js';
import { setFence } from '../../fence.js';

const FLAG_B64 = '__FLAG_B64__';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const host = document.getElementById('stage');
const isPhone = () => innerWidth / innerHeight < 0.9;

/* ---------------- renderer, scene, camera ---------------- */
const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }), { name: 'hero' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;     // keeps the flag's red and yellow true
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.8;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
key.position.set(-5, 7, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffc56b, 1.6);
rim.position.set(6, 3, -6);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffe7c2, 0x2a0508, 0.55));

const world = new THREE.Group();     // pole + flag; glides right at the end
scene.add(world);

/* ---------------- brass pole ---------------- */
const brass = new THREE.MeshPhysicalMaterial({ color: '#e4bb63', metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.06 });
const POLE_TOP = 3.35, POLE_BOTTOM = -9;
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, POLE_TOP - POLE_BOTTOM, 48, 1), brass);
pole.position.y = (POLE_TOP + POLE_BOTTOM) / 2;
world.add(pole);
const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 48), brass);
collar.position.y = POLE_TOP + 0.02;
world.add(collar);
const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 32), brass);
finial.position.y = POLE_TOP + 0.2;
world.add(finial);
const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 32), brass);
spike.position.y = POLE_TOP + 0.47;
world.add(spike);

/* ---------------- flag cloth (Verlet) ---------------- */
const FW = 3.6, FH = 2.4;
const COLS = isPhone() ? 30 : 42, ROWS = isPhone() ? 20 : 28;
const n = (COLS + 1) * (ROWS + 1);
const idx = (i, j) => j * (COLS + 1) + i;     // i: across (0 = pole side), j: down (0 = top)
const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), F = new Float32Array(n * 3), V = new Float32Array(n * 3);
const SMOOTH = 0.7;
const dx = FW / COLS, dy = FH / ROWS;

const cons = [];
const link = (a, b, r) => cons.push(a, b, r);
for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) {
  if (i < COLS) link(idx(i, j), idx(i + 1, j), dx);
  if (j < ROWS) link(idx(i, j), idx(i, j + 1), dy);
  if (i < COLS && j < ROWS) { const d = Math.hypot(dx, dy); link(idx(i, j), idx(i + 1, j + 1), d); link(idx(i + 1, j), idx(i, j + 1), d); }
  if (i < COLS - 1) link(idx(i, j), idx(i + 2, j), dx * 2);      // light bending stiffness
  if (j < ROWS - 1) link(idx(i, j), idx(i, j + 2), dy * 2);
}
// stitched fly hem: the free end is a little stiffer so its corners don't roll over
for (const s of [3, 4]) {
  for (const i of [COLS - 1, COLS]) for (let j = 0; j + s <= ROWS; j++) link(idx(i, j), idx(i, j + s), dy * s);
}
const C = new Float32Array(cons);

const tex = new THREE.TextureLoader().load('data:image/webp;base64,' + FLAG_B64);
tex.colorSpace = THREE.SRGBColorSpace;
tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
// woven-fabric normal map, made in code
const weave = (() => {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const cell = 4, over = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
    const fx = (x % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5, k = (y * s + x) * 4;
    img.data[k] = 128 + (over ? -fx * 200 : 0); img.data[k + 1] = 128 + (over ? 0 : -fy * 200); img.data[k + 2] = 240; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 40); t.colorSpace = THREE.NoColorSpace;
  return t;
})();
const clothMat = new THREE.MeshPhysicalMaterial({
  map: tex, normalMap: weave, normalScale: new THREE.Vector2(0.18, 0.18),
  roughness: 0.36, metalness: 0.22,                 // satin with a metallic lustre
  sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color('#ffe3b0'),
  clearcoat: 0.35, clearcoatRoughness: 0.18,
  side: THREE.DoubleSide,
});
const clothGeo = new THREE.PlaneGeometry(FW, FH, COLS, ROWS);
const cloth = new THREE.Mesh(clothGeo, clothMat);
cloth.frustumCulled = false;
world.add(cloth);
const cpos = clothGeo.attributes.position, cnorm = clothGeo.attributes.normal;

// halyard (the rope) from the pulley at the top down to the flag's hoist corners
const ropeMat = new THREE.LineBasicMaterial({ color: '#d9c8a4', transparent: true, opacity: 0.75 });
const ropeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
const rope = new THREE.Line(ropeGeo, ropeMat);
world.add(rope);

/* hoist state, driven by scroll */
const POLE_X = 0.075;
const HOIST_LOW = -3.0, HOIST_HIGH = POLE_TOP - 0.12;
let pinTop = HOIST_LOW, spread = 0.1, wind = 0.15;

function pinTarget(j, out) {
  out[0] = POLE_X;
  out[1] = pinTop - (j / ROWS) * FH * spread;
  out[2] = 0;
  return out;
}

// start: furled cloth hanging from a short bunch
for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) {
  const k = idx(i, j) * 3;
  P[k] = POLE_X + 0.02 + Math.sin(i * 1.7 + j) * 0.03;
  P[k + 1] = pinTop - (j / ROWS) * FH * spread - i * dx * 0.97;
  P[k + 2] = Math.sin(i * 0.9 + j * 0.4) * 0.06;
  Q[k] = P[k]; Q[k + 1] = P[k + 1]; Q[k + 2] = P[k + 2];
}

const tmp = [0, 0, 0];
const WIND_DIR = new THREE.Vector3(1, 0.05, 0.12).normalize();
// shape memory: while the flag opens, a soft pull toward a clean "flown" pose irons out
// folds trapped from the scrunched stage; afterwards a faint pull keeps the waves tidy
let guide = 0, droop = 1.3, flying = 0;
function step(dt, t) {
  const g = -9.8;
  const gust = wind * (0.82 + 0.12 * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 2.1 + 1.1));
  const W = 40 * gust;
  const cosD = Math.cos(droop), sinD = Math.sin(droop);
  const L = FW * 0.6, w = Math.PI * 2 * 0.95;          // ripple wavelength (m) and speed
  for (let v = 0; v < n; v++) {
    const k = v * 3;
    const nx = cnorm.array[k], ny = cnorm.array[k + 1], nz = cnorm.array[k + 2];
    const i = v % (COLS + 1), j = (v / (COLS + 1)) | 0;
    const u = i / COLS;                            // 0 at the pole, 1 at the fly end
    // smooth pressure (no high-frequency noise, which is what crinkled the cloth)
    const d = (nx * WIND_DIR.x + ny * WIND_DIR.y + nz * WIND_DIR.z) * W * (0.9 + 0.1 * Math.sin(t * 1.4 - u * 2.0));
    // clean travelling wave from the pole to the tip, growing toward the fly end
    const phase = (i * dx) / L * Math.PI * 2 - t * w + j * dy * 0.2;
    const ripple = W * 0.34 * (0.25 + 0.75 * u) * Math.sin(phase);
    F[k] = nx * d + WIND_DIR.x * W * 0.3;
    F[k + 1] = ny * d + g + WIND_DIR.y * W * 0.3;
    F[k + 2] = nz * d + WIND_DIR.z * W * 0.3 + ripple;
    if (guide > 0) {
      const py = pinTop - (j / ROWS) * FH * spread;
      const tx = POLE_X + i * dx * cosD, ty = py - i * dx * sinD;
      // gentle for normal ripples, firmer only when a part strays far (a fold starting)
      const ex = tx - P[k], ey = ty - P[k + 1], kk = guide * (1 + 5 * Math.min(1, (ex * ex + ey * ey) / 0.3));
      F[k] += ex * kk;
      F[k + 1] += ey * kk;
      F[k + 2] += (0 - P[k + 2]) * guide * 0.35;
    }
  }
  const damp = 0.982, dt2 = dt * dt;
  for (let v = 0; v < n; v++) {
    const k = v * 3;
    for (let a = 0; a < 3; a++) {
      const cur = P[k + a];
      P[k + a] = cur + (cur - Q[k + a]) * damp + F[k + a] * dt2;
      Q[k + a] = cur;
    }
  }
  // internal (cloth) damping: high-frequency wobble between neighbours dies out, big waves don't
  for (let v = 0; v < n * 3; v++) V[v] = P[v] - Q[v];
  for (let j = 0; j <= ROWS; j++) for (let i = 1; i <= COLS; i++) {
    const k = idx(i, j) * 3;
    const l = idx(i - 1, j) * 3, r2 = idx(Math.min(COLS, i + 1), j) * 3, u2 = idx(i, Math.max(0, j - 1)) * 3, d2 = idx(i, Math.min(ROWS, j + 1)) * 3;
    for (let a = 0; a < 3; a++) {
      const avg = (V[l + a] + V[r2 + a] + V[u2 + a] + V[d2 + a]) * 0.25;
      P[k + a] = Q[k + a] + V[k + a] + (avg - V[k + a]) * SMOOTH;
    }
  }
  // constraints
  for (let it = 0; it < (isPhone() ? 10 : 14); it++) {
    for (let c = 0; c < C.length; c += 3) {
      const a = C[c] * 3, b = C[c + 1] * 3, r = C[c + 2];
      const ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2];
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
      const diff = (d - r) / d * 0.5;
      P[a] += ex * diff; P[a + 1] += ey * diff; P[a + 2] += ez * diff;
      P[b] -= ex * diff; P[b + 1] -= ey * diff; P[b + 2] -= ez * diff;
    }
    // pins: the hoist edge rides the pole
    for (let j = 0; j <= ROWS; j++) {
      const k = idx(0, j) * 3;
      pinTarget(j, tmp);
      P[k] = tmp[0]; P[k + 1] = tmp[1]; P[k + 2] = tmp[2];
      Q[k] = tmp[0]; Q[k + 1] = tmp[1]; Q[k + 2] = tmp[2];
    }
    // no fold-backs while flying: each column stays outboard of the one before it, each row below the one above
    if (flying > 0) {
      for (let j = 0; j <= ROWS; j++) for (let i = 1; i <= COLS; i++) {
        const a = idx(i - 1, j) * 3, b = idx(i, j) * 3, gap = P[b] - P[a] - dx * 0.25;
        if (gap < 0) P[b] -= gap * flying * 0.25;
      }
      for (let i = 1; i <= COLS; i++) for (let j = 1; j <= ROWS; j++) {
        const a = idx(i, j - 1) * 3 + 1, b = idx(i, j) * 3 + 1, gap = P[a] - P[b] - dy * 0.25;
        if (gap < 0) P[b] += gap * flying * 0.25;
      }
    }
    // keep cloth out of the pole
    for (let v = 0; v < n; v++) {
      const k = v * 3;
      if (P[k + 1] < POLE_TOP && P[k + 1] > POLE_BOTTOM) {
        const rx = P[k], rz = P[k + 2], rr = Math.hypot(rx, rz);
        if (rr < 0.085 && v % (COLS + 1) !== 0) { const s = 0.085 / (rr || 1e-4); P[k] = rx * s || 0.085; P[k + 2] = rz * s; }
      }
    }
  }
}

function syncCloth(alpha = 1) {
  if (alpha >= 1) cpos.array.set(P);
  else { const a = cpos.array; for (let v = 0; v < n * 3; v++) a[v] = Q[v] + (P[v] - Q[v]) * alpha; }
  cpos.needsUpdate = true;
  clothGeo.computeVertexNormals();
  clothGeo.computeBoundingSphere();
  const top = idx(0, 0) * 3, bot = idx(0, ROWS) * 3;
  const r = ropeGeo.attributes.position.array;
  r[0] = POLE_X; r[1] = POLE_TOP - 0.02; r[2] = 0.0;
  r[3] = P[top]; r[4] = P[top + 1]; r[5] = P[top + 2] + 0.01;
  r[6] = P[bot]; r[7] = P[bot + 1] - 0.15; r[8] = P[bot + 2] + 0.01;
  ropeGeo.attributes.position.needsUpdate = true;
}

/* ---------------- gold dust ---------------- */
const DUST = isPhone() ? 220 : 420;
const dustGeo = new THREE.BufferGeometry();
const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  dpos[i * 3] = (Math.random() - 0.5) * 22; dpos[i * 3 + 1] = (Math.random() - 0.5) * 12; dpos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
  dseed[i] = Math.random() * 100;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,236,170,1)'); r.addColorStop(0.35, 'rgba(255,200,80,.5)'); r.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.07, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
scene.add(dust);

/* ---------------- layout + scroll ---------------- */
let vis = { halfW: 6, halfH: 3.4 };
function layout() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  vis.halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 11.5;
  vis.halfW = vis.halfH * camera.aspect;
}
addEventListener('resize', layout);
layout();

const titleEl = document.getElementById('title');
const cueEl = document.getElementById('cue');
let target = 0, prog = 0;
const track = document.getElementById('track');
function readScroll() {
  const max = track.offsetHeight - innerHeight;
  target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

const mouse = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9 };
addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; mouse.last = performance.now(); });
// silhouette layers (TN skyline + crowds) around the 3D flag
const sil = createSilhouettes(document.querySelector('.sticky'), { phone: isPhone() });

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// let the furled cloth settle before the first frame
for (let i = 0; i < 240; i++) { step(1 / 120, i / 120); if (i % 4 === 0) syncCloth(); }
syncCloth();

// scroll story -> sim parameters
let iron = 1, openT = 0;                                        // ironing energy, spent each time the flag opens
function storyAt(p, dt) {
  const hoist = sm(0.02, 0.6, p);                    // climbing the pole
  spread = 0.1 + 0.9 * sm(0.48, 0.72, p);            // bunch opens out at the top
  wind = 0.12 + 0.95 * sm(0.5, 0.78, p);             // wind picks up to unfurl it
  pinTop = HOIST_LOW + (HOIST_HIGH - HOIST_LOW) * hoist;
  droop = 1.35 - 1.2 * sm(0.5, 0.8, p);              // flown pose: hanging -> nearly level
  if (spread < 0.45) iron = 1; else if (spread > 0.6) iron = Math.max(0, iron - dt / 1.6);
  guide = 22 * iron * sm(0.5, 0.6, p) + 2.5 * sm(0.6, 0.8, p);
  // the no-fold rule only engages once the cloth has been fully open for a moment,
  // so a fast scroll can't lock a still-tangled flag in place
  if (spread > 0.9) openT += dt; else openT = 0;
  flying = 0.5 * sm(0.62, 0.8, p) * sm(0.8, 1.8, openT);
  return hoist;
}

const clock = new THREE.Clock();
let acc = 0, simT = 2, titleHeld = 0;
const __tick = () => {
  requestAnimationFrame(__tick);
  const dtReal = Math.min(clock.getDelta(), 1 / 20);
  prog += (target - prog) * (reduceMotion ? 1 : 0.08);
  const phone = isPhone();

  // scroll story
  const hoist = storyAt(prog, dtReal);
  const glide = sm(0.78, 0.96, prog);                // pole moves aside for the title

  // fixed-step simulation
  acc += reduceMotion ? 0 : dtReal;
  while (acc >= 1 / 120) { step(1 / 120, simT); simT += 1 / 120; acc -= 1 / 120; }
  syncCloth(reduceMotion ? 1 : acc * 120);   // smooth at any refresh rate (60/90/120/144 Hz)

  // camera: low heroic angle that rises with the flag, plus cursor parallax
  // no cursor (phones, or mouse idle): a slow drift keeps the parallax alive
  if (performance.now() - mouse.last > 4000 && !reduceMotion) { const tt0 = clock.elapsedTime; mouse.tx = Math.sin(tt0 * 0.23) * (phone ? 0.8 : 0.35); mouse.ty = Math.sin(tt0 * 0.17 + 1) * 0.25; }
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  sil.update({ prog, hoist, mx: mouse.x, my: mouse.y, t: reduceMotion ? 0 : clock.elapsedTime });
  if (phone) {
    // portrait: the whole climb happens in frame; pole on the left edge, flag flies across,
    // title sits in the lower part of the screen
    const lookY = -0.9 + 0.25 * hoist;
    camera.position.set(mouse.x * 0.15, lookY - 0.7 - mouse.y * 0.15, 12 - 0.5 * glide);
    camera.lookAt(0, lookY, 0);
    const s = Math.min(0.66, (vis.halfW * 1.42) / FW);
    world.scale.setScalar(s);
    world.position.set(-vis.halfW + 0.32, 0.15 * glide, 0);
  } else {
    const lookY = -0.6 + 1.7 * hoist;
    camera.position.set(1.4 + mouse.x * 0.45 - glide * 0.4, -1.6 + 1.4 * hoist - mouse.y * 0.3, 12.5 - 1.0 * hoist);
    camera.lookAt(1.6 * (1 - glide * 0.6), lookY, 0);
    world.position.set(-1.4 + glide * vis.halfW * 0.42, 0, 0);
    world.scale.setScalar(1);
  }

  // drifting dust
  const dp = dustGeo.attributes.position.array, tt = clock.elapsedTime;
  for (let i = 0; i < DUST; i++) {
    dp[i * 3 + 1] += 0.0035 + Math.sin(tt * 0.6 + dseed[i]) * 0.0015;
    dp[i * 3] += 0.002 * (0.5 + wind) + Math.cos(tt * 0.5 + dseed[i]) * 0.001;
    if (dp[i * 3 + 1] > 6) dp[i * 3 + 1] = -6;
    if (dp[i * 3] > 11) dp[i * 3] = -11;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // key light sweeps a little so the satin catches light as it moves
  key.position.x = -5 + Math.sin(tt * 0.25) * 2.5;

  titleEl.style.setProperty('--p', sm(0.84, 0.98, prog).toFixed(3));
  // hold the page at the end of the hero until the title has fully come in
  if (prog > 0.975) titleHeld += dtReal; else if (prog < 0.6) titleHeld = 0;
  setFence('hero', titleHeld > 0.7 ? null : track.getBoundingClientRect().top + scrollY + track.offsetHeight - innerHeight);
  cueEl.style.opacity = String(1 - sm(0.02, 0.08, prog));
  renderer.render(scene, camera);
};
requestAnimationFrame(__tick);
// test hooks: run the story at a fixed scroll position for some sim-seconds, and count sharp creases
window.__flag = {
  get prog() { return prog; }, set target(v) { target = v; },
  advance(p, sec) { target = prog = p; const N = Math.round(sec * 120); for (let s = 0; s < N; s++) { storyAt(p, 1 / 120); step(1 / 120, simT); simT += 1 / 120; if (s % 2 === 0) syncCloth(); } syncCloth(); },
  jitter(sec) {
    // mean second difference of every vertex, sampled at 60 fps: higher = twitchier motion
    target = prog = 1; const N = Math.round(sec * 60); let prev = null, prev2 = null, sum = 0, cnt = 0, peak = 0;
    for (let f = 0; f < N; f++) {
      for (let s2 = 0; s2 < 2; s2++) { storyAt(1, 1 / 120); step(1 / 120, simT); simT += 1 / 120; }
      syncCloth();
      const cur = Float32Array.from(P);
      if (prev2) { let fs = 0; for (let v = 0; v < n; v++) { const k = v * 3; const ax = cur[k] - 2 * prev[k] + prev2[k], ay = cur[k + 1] - 2 * prev[k + 1] + prev2[k + 1], az = cur[k + 2] - 2 * prev[k + 2] + prev2[k + 2]; fs += Math.hypot(ax, ay, az); } fs /= n; sum += fs; cnt++; peak = Math.max(peak, fs); }
      prev2 = prev; prev = cur;
    }
    return [+(sum / cnt * 1000).toFixed(3), +(peak * 1000).toFixed(3)];
  },
  folds() {
    // fold-backs: cloth that runs back toward the pole (horizontal edges) or back up (vertical edges)
    let f = 0;
    for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) { if (P[idx(i + 1, j) * 3] - P[idx(i, j) * 3] < -0.02 * dx) f++; }
    for (let j = 0; j < ROWS; j++) for (let i = 1; i <= COLS; i++) { if (P[idx(i, j + 1) * 3 + 1] - P[idx(i, j) * 3 + 1] > 0.02 * dy) f++; }
    return f;
  },
  creases() {
    // a crease/knot = neighbouring vertex normals more than ~70 degrees apart
    let c = 0; const a = cnorm.array;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const k = idx(i, j) * 3, r = idx(i + 1, j) * 3, d = idx(i, j + 1) * 3;
      if (a[k] * a[r] + a[k + 1] * a[r + 1] + a[k + 2] * a[r + 2] < 0.35) c++;
      if (a[k] * a[d] + a[k + 1] * a[d + 1] + a[k + 2] * a[d + 2] < 0.35) c++;
    }
    return c;
  },
};
