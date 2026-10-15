// The pledge: four carved stones (caste, religion, gender, birthplace) are smashed by a sledgehammer,
// one per scroll step, then the pledge text appears. Built entirely in code (three.js).
// Each stone is pre-split into Voronoi chunks (extruded convex cells) that fit together seamlessly with one
// continuous carved texture, so the word itself breaks apart. Every frame is a pure function of each stone's
// local time, so the sequence can be played forward, rewound and tested.
import * as THREE from 'three';
import { registerRenderer } from '../../gpu.js';
import { createStudioEnvironment } from './whistle3d.js';

export const WORDS = [
  { ta: 'சாதி', en: 'CASTE' },
  { ta: 'மதம்', en: 'RELIGION' },
  { ta: 'பாலினம்', en: 'GENDER' },
  { ta: 'பிறப்பிடம்', en: 'BIRTHPLACE' },
];
// per-stone timeline (seconds)
export const S = { swingStart: 0.3, impact: 0.42, end: 2.0 };
const W = 1.5, H = 2.25, ARCH = 0.28, D = 0.42;        // stone tablet size (world units)
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- stone outline: a tablet with an arched top (convex), lightly chipped ---------- */
function outline(r) {
  const pts = [], hw = W / 2, hh = H / 2;
  pts.push([-hw, -hh], [hw, -hh]);
  for (let i = 0; i <= 18; i++) {                     // right side up, arch across, left side down
    const a = (i / 18) * Math.PI;
    pts.push([Math.cos(a) * hw, hh + Math.sin(a) * ARCH]);
  }
  return pts.map(([x, y], i) => (i > 1 ? [x + (r() - 0.5) * 0.015, y + (r() - 0.5) * 0.015] : [x, y]));
}
// clip polygon by half-plane: keep points where (p - m)·n <= 0
function clip(poly, m, n) {
  const out = [], side = (p) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function voronoiCells(seed, impact) {
  const r = rng(seed), base = outline(r), seeds = [];
  // denser near the impact point at the top, so it shatters most where the hammer lands
  for (let i = 0; i < 17; i++) {
    const near = i < 9, rad = near ? Math.sqrt(r()) * 0.75 : Math.sqrt(r()) * 1.6, a = r() * TAU;
    let x = impact[0] + Math.cos(a) * rad * 0.8, y = impact[1] - Math.abs(Math.sin(a)) * rad * 1.3;
    x = clamp(x, -W / 2 + 0.05, W / 2 - 0.05); y = clamp(y, -H / 2 + 0.05, H / 2 + ARCH - 0.05);
    seeds.push([x, y]);
  }
  return seeds.map((s, i) => {
    let poly = base;
    seeds.forEach((o, j) => { if (j !== i && poly.length) poly = clip(poly, [(s[0] + o[0]) / 2, (s[1] + o[1]) / 2], [o[0] - s[0], o[1] - s[1]]); });
    return poly;
  }).filter((p) => p.length >= 3);
}

/* ---------- carved granite texture with the word ---------- */
function stoneTextures(word, idx, fonts) {
  const TWp = 1024, THp = Math.round(TWp * (H + ARCH) / W);
  const r = rng(101 + idx * 31);
  const c = canvasOf(TWp, THp), g = c.getContext('2d');
  const tint = [[98, 92, 86], [92, 88, 84], [102, 94, 86], [90, 87, 82]][idx];
  g.fillStyle = `rgb(${tint})`; g.fillRect(0, 0, TWp, THp);
  for (let i = 0; i < 30; i++) {                         // mottling
    const x = r() * TWp, y = r() * THp, rad = 80 + r() * 260, a = 0.05 + r() * 0.1, dark = r() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, dark ? `rgba(40,34,28,${a})` : `rgba(190,176,156,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 26000; i++) {                      // granite speckle
    const v = r(); g.fillStyle = v < 0.45 ? `rgba(30,26,22,${0.25 + r() * 0.4})` : v < 0.85 ? `rgba(200,190,175,${0.15 + r() * 0.35})` : `rgba(150,110,80,${0.3})`;
    g.fillRect(r() * TWp, r() * THp, 1 + r() * 2.4, 1 + r() * 2.4);
  }
  for (let i = 0; i < 40; i++) {                         // chisel marks
    g.strokeStyle = `rgba(40,34,28,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 2;
    const x = r() * TWp, y = r() * THp, a = (r() - 0.5) * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (20 + r() * 60), y + Math.sin(a) * (20 + r() * 60)); g.stroke();
  }
  const edge = g.createRadialGradient(TWp / 2, THp * 0.55, TWp * 0.3, TWp / 2, THp * 0.55, THp * 0.75);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(20,16,12,.45)');
  g.fillStyle = edge; g.fillRect(0, 0, TWp, THp);
  // bump base: granite grain
  const b = canvasOf(TWp, THp), bg = b.getContext('2d');
  bg.fillStyle = '#9a9a9a'; bg.fillRect(0, 0, TWp, THp);
  for (let i = 0; i < 18000; i++) { const v = r(); bg.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.2 + r() * 0.3})` : `rgba(255,255,255,${0.2 + r() * 0.3})`; bg.fillRect(r() * TWp, r() * THp, 1 + r() * 3, 1 + r() * 3); }
  // the carved word: Tamil large, English inscription capitals below, a carved rule between
  const cy = THp * 0.47;
  const fitFont = (txt, family, weight, maxW, maxPx) => { let px = maxPx; for (;;) { g.font = `${weight} ${px}px ${family}`; if (g.measureText(txt).width <= maxW || px < 20) return px; px -= 4; } };
  const pxTa = fitFont(word.ta, fonts.ta, 700, TWp * 0.84, 330);
  const pxEn = Math.min(fitFont(word.en, fonts.en, 700, TWp * 0.72, 104), 104);
  const carve = (ctx, mode) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const draw = (txt, font, y, spacing = 0) => { ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`; ctx.fillText(txt, TWp / 2, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; };
    const fTa = `700 ${pxTa}px ${fonts.ta}`, fEn = `700 ${pxEn}px ${fonts.en}`;
    if (mode === 'colour') {
      ctx.fillStyle = 'rgba(235,225,205,.35)'; draw(word.ta, fTa, cy + 4); draw(word.en, fEn, cy + pxTa * 0.62 + 4, 10);   // lit lower lip
      ctx.fillStyle = 'rgba(28,22,18,.92)'; draw(word.ta, fTa, cy); draw(word.en, fEn, cy + pxTa * 0.62, 10);
      ctx.fillStyle = 'rgba(28,22,18,.75)'; ctx.fillRect(TWp * 0.32, cy + pxTa * 0.2, TWp * 0.36, 5);
    } else {
      ctx.fillStyle = '#000'; ctx.filter = 'blur(2px)'; draw(word.ta, fTa, cy); draw(word.en, fEn, cy + pxTa * 0.62, 10); ctx.fillRect(TWp * 0.32, cy + pxTa * 0.2, TWp * 0.36, 5); ctx.filter = 'none';
    }
  };
  carve(g, 'colour'); carve(bg, 'bump');
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(b); bump.colorSpace = THREE.NoColorSpace; bump.anisotropy = 8;
  return { map, bump };
}

/* ---------- the sledgehammer ---------- */
function makeHammer() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.7 });
  const iron = new THREE.MeshPhysicalMaterial({ color: 0x3c3a38, metalness: 1, roughness: 0.38, clearcoat: 0.2 });
  const LH = 1.62;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, LH + 0.1, 20), wood);
  handle.position.y = (LH + 0.1) / 2 - 0.1;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 20), new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.9 }));
  grip.position.y = 0.06;
  const head = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.36), iron);
  const faceL = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.12, 8), iron); faceL.rotation.z = Math.PI / 2; faceL.position.x = -0.36;
  const faceR = faceL.clone(); faceR.rotation.z = -Math.PI / 2; faceR.position.x = 0.36;
  head.add(body, faceL, faceR); head.position.y = LH;
  for (const m of [handle, grip, body, faceL, faceR]) m.castShadow = true;
  g.add(handle, grip, head);
  const SC = 1.25; g.scale.setScalar(SC);
  return { group: g, LH: LH * SC, faceOffset: 0.42 * SC };
}

function dotTexture(col) {
  const c = canvasOf(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.4, `rgba(${col},.5)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createPledgeScene(host, fonts) {
  const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }), { name: 'pledge' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = createStudioEnvironment(renderer); scene.environmentIntensity = 0.25;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0x5a4a3a, 0x0a0604, 0.6); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffc787, 2.6); key.position.set(-4, 6, 6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a50, 1.4); rim.position.set(5, 3, -5); scene.add(rim);

  const insideMat = new THREE.MeshStandardMaterial({ color: 0x9c9284, roughness: 0.95 });
  const stones = WORDS.map((word, idx) => {
    const tex = stoneTextures(word, idx, fonts);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: 3.2, roughness: 0.9 });
    const impact = [0.05 * (idx % 2 ? 1 : -1), H / 2 + ARCH * 0.6];
    const cells = voronoiCells(77 + idx * 13, impact);
    const r = rng(500 + idx * 7);
    const uvGen = {
      generateTopUV(geo, v, a, b, c) { return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / W + 0.5, (v[i * 3 + 1] + H / 2) / (H + ARCH))); },
      generateSideWallUV() { return [new THREE.Vector2(0.02, 0.02), new THREE.Vector2(0.06, 0.02), new THREE.Vector2(0.06, 0.06), new THREE.Vector2(0.02, 0.06)]; },
    };
    const group = new THREE.Group(); scene.add(group);
    const chunks = cells.map((poly) => {
      const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, UVGenerator: uvGen });
      // centre each chunk on its own centroid so it can tumble about itself
      let cx = 0, cy = 0; poly.forEach(([x, y]) => { cx += x; cy += y; }); cx /= poly.length; cy /= poly.length;
      geo.translate(-cx, -cy, -D / 2);
      const mesh = new THREE.Mesh(geo, [faceMat, insideMat]);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      const dx = cx - impact[0], dy = cy - impact[1], dist = Math.hypot(dx, dy) || 0.01;
      const power = 2.8 * Math.max(0.25, 1.35 - dist / 1.9);
      return {
        mesh, rest: new THREE.Vector3(cx, cy, 0),
        vel: new THREE.Vector3((dx / dist) * power + (r() - 0.5) * 0.8, (dy / dist) * power * 0.6 + 1.2 + r() * 1.4, 0.8 + r() * 2.2),
        spin: new THREE.Vector3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9),
      };
    });
    // dust burst + sparks
    const NDUST = 110, NSP = 34, r2 = rng(900 + idx);
    const dust = [], sparks = [];
    for (let i = 0; i < NDUST; i++) { const a = r2() * TAU, el = r2() * Math.PI * 0.9; dust.push([Math.cos(a) * Math.cos(el), Math.abs(Math.sin(el)) * 0.9 + 0.1, Math.sin(a) * Math.cos(el) * 0.6 + 0.4, 0.8 + r2() * 2.4]); }
    for (let i = 0; i < NSP; i++) { const a = r2() * TAU; sparks.push([Math.cos(a), Math.abs(Math.sin(a)) + 0.2, (r2() - 0.2), 4 + r2() * 6]); }
    const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NDUST * 3), 3));
    const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSP * 3), 3));
    const dMat = new THREE.PointsMaterial({ size: 0.16, map: dotTexture('200,186,160'), transparent: true, depthWrite: false, opacity: 0 });
    const sMat = new THREE.PointsMaterial({ size: 0.06, map: dotTexture('255,200,110'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const dPts = new THREE.Points(dGeo, dMat), sPts = new THREE.Points(sGeo, sMat);
    group.add(dPts, sPts);
    const flash = new THREE.PointLight(0xffd7a0, 0, 6, 2); flash.position.set(impact[0], impact[1], 0.6); group.add(flash);
    const hammer = makeHammer(); scene.add(hammer.group);
    return { group, chunks, impact, dust, sparks, dGeo, sGeo, dMat, sMat, flash, hammer };
  });

  // ground shadow under the stones (soft, no visible floor)
  const shadowTex = (() => { const c = canvasOf(256, 64), g = c.getContext('2d'), gr = g.createRadialGradient(128, 32, 0, 128, 32, 128); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); return new THREE.CanvasTexture(c); })();
  const blobs = stones.map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });

  /* ---------- layout: a row on wide screens, 2×2 on phones ---------- */
  let aspect = 1, phone = false, slots = [];
  function layout() {
    phone = aspect < 0.8;
    const gap = 0.45;
    slots = phone
      ? [[-(W + gap) / 2, H / 2 + 0.55], [(W + gap) / 2, H / 2 + 0.55], [-(W + gap) / 2, -H / 2 - 0.55], [(W + gap) / 2, -H / 2 - 0.55]]
      : WORDS.map((_, i) => [(i - 1.5) * (W + gap), 0]);
    const spanW = phone ? 2 * W + gap + 0.6 : 4 * W + 3 * gap + 0.9, spanH = phone ? 2 * (H + ARCH) + 2.4 : H + ARCH + 2.6;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(spanW / (2 * tanH * aspect), spanH / (2 * tanH)) * 1.04;
    camera.position.set(0, phone ? 0.2 : 0.35, dist); camera.lookAt(0, phone ? 0.2 : 0.25, 0);
    base.copy(camera.position);
    stones.forEach((s, i) => { s.group.position.set(slots[i][0], slots[i][1], 0); blobs[i].position.set(slots[i][0], slots[i][1] - H / 2 - 0.01, 0.1); });
  }
  const base = new THREE.Vector3();

  /* ---------- per-stone pose at local time ts ---------- */
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  function poseStone(s, ts, i) {
    const dt = ts - S.impact;
    // hammer: enters from top right, winds up, swings down onto the top of the stone, recoils, leaves
    const sx = slots[i][0], sy = slots[i][1];
    const target = new THREE.Vector2(sx + s.impact[0], sy + s.impact[1] + 0.02);
    const phiS = 2.29, LH = s.hammer.LH, fo = s.hammer.faceOffset;
    const xDir = new THREE.Vector2(Math.cos(phiS), Math.sin(phiS));
    const tip = target.clone().addScaledVector(xDir, fo);                 // the striking face is at local -x
    const P = tip.clone().sub(new THREE.Vector2(-Math.sin(phiS), Math.cos(phiS)).multiplyScalar(LH));
    let px, py, phi, vis = true;
    if (ts <= 0) vis = false;
    else if (ts < S.swingStart) { const k = sm(0, S.swingStart, ts); px = lerp(P.x + 3, P.x + 0.3, k); py = lerp(P.y + 2.5, P.y + 0.45, k); phi = lerp(-0.2, -0.6, k); }
    else if (ts < S.impact) { const k = (ts - S.swingStart) / (S.impact - S.swingStart), kk = k * k; px = lerp(P.x + 0.3, P.x, kk); py = lerp(P.y + 0.45, P.y, kk); phi = lerp(-0.6, phiS, kk); }
    else if (ts < S.impact + 0.22) { const k = (ts - S.impact) / 0.22; phi = phiS - 0.4 * Math.sin(k * Math.PI * 0.8); px = P.x + 0.05 * k; py = P.y + 0.12 * Math.sin(k * Math.PI); }
    else if (ts < S.impact + 0.75) { const k = sm(S.impact + 0.22, S.impact + 0.75, ts); phi = lerp(phiS - 0.25, -0.1, k); px = lerp(P.x + 0.05, P.x + 3.5, k); py = lerp(P.y, P.y + 3, k); }
    else vis = false;
    s.hammer.group.visible = vis;
    if (vis) { s.hammer.group.position.set(px, py, 0.55); s.hammer.group.rotation.set(0, 0, phi); }

    // chunks: hairline cracks first, then the burst
    const g = -9.5;
    for (const c of s.chunks) {
      if (dt <= 0) { c.mesh.position.copy(c.rest); c.mesh.quaternion.identity(); c.mesh.visible = true; continue; }
      const crack = Math.min(dt, 0.05) / 0.05;
      const t = Math.max(0, dt - 0.05);
      const out = new THREE.Vector3(c.rest.x - s.impact[0], c.rest.y - s.impact[1], 0).normalize().multiplyScalar(0.012 * crack);
      c.mesh.position.set(c.rest.x + out.x + c.vel.x * t, c.rest.y + out.y + c.vel.y * t + 0.5 * g * t * t, c.vel.z * t);
      e.set(c.spin.x * t, c.spin.y * t, c.spin.z * t); c.mesh.quaternion.setFromEuler(e);
      c.mesh.visible = c.mesh.position.y > -9;
    }
    // dust and sparks
    const dp = s.dGeo.attributes.position.array, spa = s.sGeo.attributes.position.array;
    const dLife = clamp(dt / 1.4), sLife = clamp(dt / 0.4);
    s.dust.forEach((d, k) => { const sp = d[3] * (1 - Math.exp(-dt * 3)) / 3; dp[k * 3] = s.impact[0] + d[0] * sp; dp[k * 3 + 1] = s.impact[1] + d[1] * sp + dt * 0.15 - 0.3 * dt * dt; dp[k * 3 + 2] = 0.25 + d[2] * sp; });
    s.sparks.forEach((d, k) => { const tt = Math.max(0, dt); dp; spa[k * 3] = s.impact[0] + d[0] * d[3] * tt; spa[k * 3 + 1] = s.impact[1] + d[1] * d[3] * tt - 4.5 * tt * tt; spa[k * 3 + 2] = 0.3 + d[2] * d[3] * tt * 0.5; });
    s.dGeo.attributes.position.needsUpdate = true; s.sGeo.attributes.position.needsUpdate = true;
    s.dMat.opacity = dt > 0 ? 0.7 * (1 - dLife) * sm(0, 0.05, dt) : 0;
    s.sMat.opacity = dt > 0 ? (1 - sLife) : 0;
    s.dMat.size = 0.12 + 0.35 * dLife;
    s.flash.intensity = dt > 0 ? 12 * Math.exp(-dt * 14) : 0;
    blobs[i].material.opacity = 1 - sm(0, 0.3, dt);
    return dt;
  }

  const mouse = { x: 0, y: 0 };
  function render(times, time = 0) {
    let shake = 0;
    stones.forEach((s, i) => { const dt = poseStone(s, times[i], i); if (dt > 0 && dt < 0.5) shake += Math.exp(-dt * 9); });
    shake = Math.min(1.6, shake);                          // four strikes land together: one big jolt, not four
    camera.position.set(base.x + mouse.x * 0.25 + Math.sin(time * 61) * 0.05 * shake, base.y - mouse.y * 0.15 + Math.cos(time * 53) * 0.05 * shake, base.z);
    camera.lookAt(0, phone ? 0.2 : 0.25, 0);
    key.position.x = -4 + Math.sin(time * 0.3) * 0.6;
    renderer.render(scene, camera);
  }
  function resize(w, h) { renderer.setSize(w, h, false); aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); layout(); }
  return { render, resize, mouse };
}
