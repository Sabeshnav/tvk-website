// Kural on an olai chuvadi (palm-leaf manuscript), cinematic "title sequence" style, all in code (three.js).
// A clay lamp flickers on, the camera sweeps down over an old table, an iron ezhuthani (stylus) scratches
// Thirukkural 972 into the leaf letter by letter, soot is rubbed into the grooves, then the leaf rises to
// face the viewer. Every frame is a pure function of time t, so it can be scrubbed, skipped and tested.
import * as THREE from 'three';
import { registerRenderer } from '../../gpu.js';
import { createStudioEnvironment } from './whistle3d.js';

export const LINES = ['பிறப்பொக்கும் எல்லா உயிர்க்கும் சிறப்பொவ்வா', 'செய்தொழில் வேற்றுமை யான்'];
const TW = 4096, TH = 512;                   // leaf texture size (8:1 like a real olai)
const L = 8, WD = 1.0;                       // leaf size in world units
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------------- timeline (seconds) ----------------
export const T = { lamp: 0.2, swoopEnd: 2.4, write: 2.4, inkDur: 1.3, riseDur: 1.9 };

/* ================= textures ================= */
function leafTextures(fontFamily) {
  const r = rng(972);
  // ---- colour: sun-cured palmyra leaf ----
  const base = canvasOf(TW, TH), g = base.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, TH);
  grad.addColorStop(0, '#b98a48'); grad.addColorStop(0.18, '#d3a964'); grad.addColorStop(0.5, '#dcb571'); grad.addColorStop(0.82, '#cfa35d'); grad.addColorStop(1, '#ad7d3e');
  g.fillStyle = grad; g.fillRect(0, 0, TW, TH);
  // broad uneven tone along the length
  for (let i = 0; i < 26; i++) {
    const x = r() * TW, w = 200 + r() * 700, a = 0.05 + r() * 0.09;
    const gg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    const c = r() < 0.5 ? '120,74,28' : '236,200,130';
    gg.addColorStop(0, `rgba(${c},0)`); gg.addColorStop(0.5, `rgba(${c},${a})`); gg.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gg; g.fillRect(x - w / 2, 0, w, TH);
  }
  // lengthwise fibres
  for (let i = 0; i < 900; i++) {
    const y = r() * TH, x0 = r() * TW * 0.9, len = 300 + r() * 2600, a = 0.04 + r() * 0.12;
    g.strokeStyle = r() < 0.55 ? `rgba(110,68,26,${a})` : `rgba(248,222,160,${a * 0.9})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath(); g.moveTo(x0, y);
    for (let x = x0; x < x0 + len; x += 120) g.lineTo(x, y + (r() - 0.5) * 1.6);
    g.stroke();
  }
  // age spots and stains
  for (let i = 0; i < 70; i++) {
    const x = r() * TW, y = r() * TH, rad = 4 + r() * 38, a = 0.05 + r() * 0.16;
    const sg = g.createRadialGradient(x, y, 0, x, y, rad);
    sg.addColorStop(0, `rgba(96,56,22,${a})`); sg.addColorStop(1, 'rgba(96,56,22,0)');
    g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, rad * (1.5 + r() * 2), rad, 0, 0, TAU); g.fill();
  }
  // age: large mottled patches, grey-green mould specks, hairline cracks across the leaf
  for (let i = 0; i < 40; i++) {
    const x = r() * TW, y = r() * TH, rx = 60 + r() * 260, ry = 20 + r() * 90, a = 0.05 + r() * 0.1;
    const mg = g.createRadialGradient(x, y, 0, x, y, rx);
    mg.addColorStop(0, `rgba(88,52,20,${a})`); mg.addColorStop(0.7, `rgba(88,52,20,${a * 0.4})`); mg.addColorStop(1, 'rgba(88,52,20,0)');
    g.fillStyle = mg; g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.4, 0, TAU); g.fill();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${70 + r() * 30},${60 + r() * 25},${40 + r() * 15},${0.12 + r() * 0.25})`; g.beginPath(); g.arc(r() * TW, r() * TH, 0.8 + r() * 2.6, 0, TAU); g.fill(); }
  for (let i = 0; i < 9; i++) {
    let x = TW * (0.05 + r() * 0.9), y = r() < 0.5 ? 0 : TH; const dir = y ? -1 : 1, len = TH * (0.15 + r() * 0.5);
    g.strokeStyle = 'rgba(70,40,14,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 10; y += dir * len / 10; g.lineTo(x, y); }
    g.stroke();
  }
  // darker, slightly burnt edges
  const edge = (y0, y1) => { const eg = g.createLinearGradient(0, y0, 0, y1); eg.addColorStop(0, 'rgba(70,38,12,.75)'); eg.addColorStop(1, 'rgba(84,48,16,0)'); g.fillStyle = eg; g.fillRect(0, Math.min(y0, y1), TW, Math.abs(y1 - y0)); };
  edge(0, 44); edge(TH, TH - 44);
  // ruled line where the scribe folded/creased the leaf (faint)
  g.strokeStyle = 'rgba(120,80,36,.12)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, TH * 0.5 + 6); g.lineTo(TW, TH * 0.5 + 4); g.stroke();
  // shape: rounded, slightly frayed ends and edges; binding holes
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = '#fff';
  g.beginPath();
  const endR = TH * 0.5;
  for (let x = endR; x <= TW - endR; x += 16) g.lineTo(x, 3 + Math.abs(Math.sin(x * 0.013)) * 2 + (r() < 0.04 ? r() * 6 : 0));
  g.arc(TW - endR, TH / 2, TH / 2 - 4, -Math.PI / 2, Math.PI / 2);
  for (let x = TW - endR; x >= endR; x -= 16) g.lineTo(x, TH - 3 - Math.abs(Math.sin(x * 0.011)) * 2 - (r() < 0.04 ? r() * 6 : 0));
  g.arc(endR, TH / 2, TH / 2 - 4, Math.PI / 2, Math.PI * 1.5);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  const holes = [0.075, 0.925];
  for (const hx of holes) { g.beginPath(); g.arc(hx * TW, TH / 2, 17, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  for (const hx of holes) {                                     // worn ring around each hole
    const hg = g.createRadialGradient(hx * TW, TH / 2, 17, hx * TW, TH / 2, 46);
    hg.addColorStop(0, 'rgba(90,52,18,.55)'); hg.addColorStop(1, 'rgba(90,52,18,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(hx * TW, TH / 2, 46, 0, TAU); g.fill();
  }

  // ---- text layout ----
  const tc = canvasOf(TW, TH), t = tc.getContext('2d');
  const fs = 128;
  t.font = `${fs}px ${fontFamily}`;
  const seg = new Intl.Segmenter('ta', { granularity: 'grapheme' });
  const x0 = TW * 0.135;
  const m1 = t.measureText(LINES[0]);
  const asc = m1.actualBoundingBoxAscent, desc = m1.actualBoundingBoxDescent;
  const gap = fs * 0.36, block = (asc + desc) * 2 + gap;
  const base1 = (TH - block) / 2 + asc, base2 = base1 + asc + desc + gap;
  const layout = LINES.map((line, li) => {
    const gs = [...seg.segment(line)].map((s) => s.segment);
    let acc = '', prev = 0;
    const out = [];
    for (const ch of gs) { acc += ch; const w = t.measureText(acc).width; out.push({ ch, x0: x0 + prev, x1: x0 + w, space: ch === ' ' }); prev = w; }
    return { y: li ? base2 : base1, glyphs: out };
  });
  // groove mask: soft halo + crisp core (the stylus cut)
  t.fillStyle = '#000'; t.fillRect(0, 0, TW, TH);
  t.fillStyle = '#fff'; t.font = `${fs}px ${fontFamily}`;
  t.filter = 'blur(2.5px)'; t.globalAlpha = 0.55;
  layout.forEach((ln, i) => t.fillText(LINES[i], x0, ln.y));
  t.filter = 'none'; t.globalAlpha = 1;
  t.lineWidth = 1.2; t.strokeStyle = '#fff';
  layout.forEach((ln, i) => { t.fillText(LINES[i], x0, ln.y); });

  // ---- detail map: R = groove mask, G = fibre height ----
  const fc = canvasOf(TW, TH), f = fc.getContext('2d');
  f.fillStyle = '#808080'; f.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 1400; i++) {
    const y = r() * TH, x = r() * TW, len = 200 + r() * 2000;
    f.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.08 + r() * 0.2})` : `rgba(0,0,0,${0.08 + r() * 0.2})`;
    f.lineWidth = 0.7 + r() * 1.6; f.beginPath(); f.moveTo(x, y); f.lineTo(x + len, y + (r() - 0.5) * 2); f.stroke();
  }
  const T1 = t.getImageData(0, 0, TW, TH).data, F1 = f.getImageData(0, 0, TW, TH).data;
  const det = new ImageData(TW, TH);
  for (let i = 0; i < det.data.length; i += 4) { det.data[i] = T1[i]; det.data[i + 1] = F1[i]; det.data[i + 2] = 0; det.data[i + 3] = 255; }
  const dc = canvasOf(TW, TH); dc.getContext('2d').putImageData(det, 0, 0);

  const map = new THREE.CanvasTexture(base); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const detail = new THREE.CanvasTexture(dc); detail.colorSpace = THREE.NoColorSpace; detail.anisotropy = 8;
  return { map, detail, layout, fs, x0, textEnd: Math.max(...layout.map((l) => l.glyphs.at(-1).x1)), vMid: 1 - (base1 + desc + gap / 2) / TH };
}

function woodTexture() {
  const W = 1024, H = 1024, c = canvasOf(W, H), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = '#8f5a32'; g.fillRect(0, 0, W, H);                 // warm sunlit teak, darker than the pale leaf so it stands out
  for (let i = 0; i < 260; i++) {                     // grain
    const y0 = r() * H, a = 0.05 + r() * 0.12, amp = 4 + r() * 18, fq = 0.004 + r() * 0.01, ph = r() * 9;
    g.strokeStyle = r() < 0.6 ? `rgba(70,36,14,${a})` : `rgba(214,160,100,${a * 0.8})`;
    g.lineWidth = 0.6 + r() * 2.4; g.beginPath();
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 3.1 + ph) * amp * 0.3);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {                       // knots
    const x = r() * W, y = r() * H;
    for (let k = 12; k > 0; k--) { g.strokeStyle = `rgba(104,58,22,${0.08 + k * 0.01})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, k * 5, k * 2.2, 0, 0, TAU); g.stroke(); }
  }
  for (let i = 0; i < 120; i++) {                     // scratches, wax drips
    g.strokeStyle = `rgba(190,140,90,${0.04 + r() * 0.06})`; g.lineWidth = 0.6;
    const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 140, y + (r() - 0.5) * 30); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 8;
  return t;
}

function flameTexture() {
  const c = canvasOf(128, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 170, 4, 64, 150, 110);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.18, 'rgba(255,214,120,1)'); gr.addColorStop(0.45, 'rgba(255,140,40,.75)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(64, 10); g.bezierCurveTo(118, 120, 104, 236, 64, 240); g.bezierCurveTo(24, 236, 10, 120, 64, 10); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function softDot(col = '255,220,160') {
  const c = canvasOf(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.35, `rgba(${col},.45)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ================= scene ================= */
export async function createKuralScene(host, { fontFamily }) {
  const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }), { name: 'kural' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = createStudioEnvironment(renderer);
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff3dc, 0x9a6a3a, 0.9); scene.add(hemi);   // soft morning daylight
  const rake = new THREE.DirectionalLight(0xffd8a0, 0);          // low raking morning sun: makes the cuts read
  rake.position.set(7.5, 2.2, 1.2); rake.castShadow = true;
  rake.shadow.mapSize.set(2048, 2048); Object.assign(rake.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 0.5, far: 30 });
  rake.shadow.bias = -0.0006; rake.shadow.normalBias = 0.06; rake.shadow.radius = 4;
  scene.add(rake);
  const front = new THREE.DirectionalLight(0xffe2b8, 0);         // ramps up when the leaf faces the viewer
  front.position.set(-2, 6, 10); scene.add(front); scene.add(front.target);

  // ---------- table ----------
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.82, metalness: 0, transparent: true });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), woodMat);
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

  // ---------- leaf ----------
  const tex = leafTextures(fontFamily);
  const uniforms = { uDetail: { value: tex.detail }, uL1: { value: 0 }, uL2: { value: 0 }, uInk: { value: 0 }, uVMid: { value: tex.vMid }, uCut: { value: 0 } };
  const leafMat = new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.detail, bumpScale: 1.5, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  leafMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const helpers = /* glsl */`
      uniform sampler2D uDetail; uniform float uL1, uL2, uInk, uVMid, uCut;
      float revealAt(vec2 uv){ float cur = uv.y > uVMid ? uL1 : uL2; return smoothstep(cur + 0.0012, cur - 0.0012, uv.x); }
      float curAt(vec2 uv){ return uv.y > uVMid ? uL1 : uL2; }
    `;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + helpers);
    // engraved height: fibres + the cut grooves revealed so far
    const bump = THREE.ShaderChunk.bumpmap_pars_fragment
      .replace(/texture2D\( bumpMap, (.*?) \)\.x/g, 'bumpH( $1 )')
      .replace('vec2 dHdxy_fwd() {', 'float bumpH(vec2 uv){ vec4 d = texture2D( bumpMap, uv ); return d.g * 0.22 + d.r * revealAt(uv); }\n\tvec2 dHdxy_fwd() {');
    sh.fragmentShader = sh.fragmentShader.replace('#include <bumpmap_pars_fragment>', bump);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      #include <map_fragment>
      {
        vec4 d = texture2D(uDetail, vMapUv);
        float m = d.r * revealAt(vMapUv);
        float ink = smoothstep(uInk, uInk - 0.02, vMapUv.x);
        vec3 groove = diffuseColor.rgb * vec3(0.42, 0.3, 0.2);
        vec3 inked = vec3(0.055, 0.035, 0.022);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(groove, inked, ink), m);
        // freshly cut fibres glint pale right behind the stylus
        float c = curAt(vMapUv);
        float fresh = smoothstep(c - 0.03, c, vMapUv.x) * step(vMapUv.x, c) * d.r * (1.0 - ink) * uCut;
        diffuseColor.rgb += fresh * vec3(0.32, 0.24, 0.12);
      }`);
  };
  const SEG_U = 240, SEG_V = 24;
  const leafGeo = new THREE.PlaneGeometry(L, WD, SEG_U, SEG_V);
  const surf = (u, v, out = new THREE.Vector3()) => {     // leaf-local surface (z = up off the table when lying)
    const x = (u - 0.5) * L, y = (v - 0.5) * WD, k = (v - 0.5) * 2;
    const z = 0.045 + 0.05 * Math.sin(Math.PI * u) + 0.028 * k * k + 0.012 * Math.sin(u * 9.0 + 0.6) + 0.02 * (u - 0.5) * k;
    return out.set(x, y, z);
  };
  { const p = leafGeo.attributes.position, uv = leafGeo.attributes.uv, v3 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { surf(uv.getX(i), uv.getY(i), v3); p.setXYZ(i, v3.x, v3.y, v3.z); }
    leafGeo.computeVertexNormals(); }
  leafMat.envMapIntensity = 0.25;
  const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.castShadow = true; leaf.receiveShadow = true;
  const leafGroup = new THREE.Group(); leafGroup.add(leaf); scene.add(leafGroup);

  // binding cord through the left hole, curling off onto the table
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const hole = surf(0.075, 0.5);
  const cordPts = [new THREE.Vector3(hole.x, hole.y, hole.z + 0.03), new THREE.Vector3(hole.x - 0.05, hole.y - 0.05, hole.z - 0.06), new THREE.Vector3(hole.x - 0.35, hole.y - 0.45, 0.012), new THREE.Vector3(hole.x - 0.9, hole.y - 0.6, 0.01), new THREE.Vector3(hole.x - 1.4, hole.y - 0.35, 0.01)];
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 64, 0.014, 8), cordMat);
  cord.castShadow = true; leafGroup.add(cord);

  // ---------- ezhuthani (iron stylus with a brass head) ----------
  const iron = new THREE.MeshPhysicalMaterial({ color: 0x6d6258, metalness: 1, roughness: 0.42, clearcoat: 0.2 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.28, clearcoat: 0.5 });
  const prof = (pts) => pts.map(([r_, y]) => new THREE.Vector2(r_, y));
  const stylus = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof([[0, 0], [0.006, 0.02], [0.02, 0.16], [0.03, 0.34], [0.032, 1.55], [0.036, 1.6], [0, 1.6]]), 32), iron);
  const head = new THREE.Mesh(new THREE.LatheGeometry(prof([[0, 1.58], [0.046, 1.6], [0.05, 1.66], [0.036, 1.7], [0.06, 1.78], [0.07, 1.86], [0.05, 1.95], [0.028, 2.0], [0.04, 2.05], [0.018, 2.12], [0, 2.15]]), 32), brass);
  shaft.castShadow = head.castShadow = true;
  stylus.add(shaft, head);
  leafGroup.add(stylus);
  const stylusDir = new THREE.Vector3(0.22, -0.5, 1).normalize();
  const upY = new THREE.Vector3(0, 1, 0);

  // ---------- clay lamp (agal) + flame ----------
  const clay = new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: 0.9, transparent: true });
  const lamp = new THREE.Mesh(new THREE.LatheGeometry(prof([[0, 0], [0.3, 0.01], [0.42, 0.08], [0.46, 0.2], [0.44, 0.24], [0.38, 0.16], [0, 0.12]]), 40), clay);
  lamp.position.set(5.2, 0, -1.6); lamp.castShadow = true; lamp.receiveShadow = true; scene.add(lamp);
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 16, 1, true), clay);
  spout.rotation.z = Math.PI / 2; spout.position.set(5.66 - 0.06, 0.19, -1.6); scene.add(spout);
  const flameMat = new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const flame = new THREE.Sprite(flameMat); flame.position.set(5.72, 0.36, -1.6); scene.add(flame);
  const glowMat = new THREE.SpriteMaterial({ map: softDot('255,170,80'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  const glow = new THREE.Sprite(glowMat); glow.position.copy(flame.position); glow.scale.setScalar(2.6); scene.add(glow);
  const lampLight = new THREE.PointLight(0xff9a3c, 0, 0, 2); lampLight.position.set(5.72, 0.5, -1.6); scene.add(lampLight);

  // ---------- manuscript bundle (other leaves between wooden boards) ----------
  const bundle = new THREE.Group(); scene.add(bundle);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.75, map: woodMat.map, transparent: true });
  const stackMat = new THREE.MeshStandardMaterial({ color: 0xc69a58, roughness: 0.85, transparent: true });
  const stack = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.34, 0.95), stackMat); stack.position.y = 0.23;
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.06, 1.05), boardMat); b1.position.y = 0.03;
  const b2 = b1.clone(); b2.position.y = 0.43;
  for (const m of [stack, b1, b2]) { m.castShadow = m.receiveShadow = true; bundle.add(m); }
  bundle.position.set(-1.2, 0, -2.5); bundle.rotation.y = 0.06;

  // ---------- dust in the lamp light + stylus shavings ----------
  const DUST = 420, dpos = new Float32Array(DUST * 3), dseed = [];
  const r = rng(5);
  for (let i = 0; i < DUST; i++) dseed.push([r() * 14 - 7, r() * 5, r() * 8 - 5, r() * 10, 0.2 + r() * 0.5]);
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.035, map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  scene.add(new THREE.Points(dustGeo, dustMat));
  const SH = 90, spos = new Float32Array(SH * 3);
  const shGeo = new THREE.BufferGeometry(); shGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const shMat = new THREE.PointsMaterial({ size: 0.018, color: 0xe8c890, transparent: true, depthWrite: false, opacity: 0.9 });
  const shavings = new THREE.Points(shGeo, shMat); leafGroup.add(shavings);

  /* ---------- writing schedule ---------- */
  const fs = tex.fs, sched = [];
  { // build segments: each grapheme takes time ∝ width, spaces pause, line change travels with a lift
    const totalW = tex.layout.reduce((s, l) => s + l.glyphs.filter((g) => !g.space).reduce((a, g) => a + (g.x1 - g.x0), 0), 0);
    const WRITE_TIME = 4.3, speed = totalW / WRITE_TIME;
    let t = T.write;
    tex.layout.forEach((ln, li) => {
      if (li) { sched.push({ kind: 'move', li, t0: t, t1: t + 0.45, from: tex.layout[li - 1].glyphs.at(-1).x1, to: ln.glyphs[0].x0, y0: tex.layout[li - 1].y, y1: ln.y }); t += 0.45; }
      for (const g of ln.glyphs) {
        if (g.space) { sched.push({ kind: 'space', li, t0: t, t1: t + 0.13, x0: g.x0, x1: g.x1, y: ln.y }); t += 0.13; continue; }
        const d = (g.x1 - g.x0) / speed + 0.02;
        sched.push({ kind: 'glyph', li, t0: t, t1: t + d, x0: g.x0, x1: g.x1, y: ln.y }); t += d;
      }
    });
    T.writeEnd = t;
    T.inkStart = t + 0.35; T.inkEnd = T.inkStart + T.inkDur;
    T.riseStart = T.inkEnd - 0.1; T.riseEnd = T.riseStart + T.riseDur;
    T.copy = T.riseEnd - 0.3; T.done = T.riseEnd + 1.1;
  }
  // stylus state at time t: cursor x per line, tip position (texture px), lift
  function pen(t) {
    const l1Start = tex.layout[0].glyphs[0].x0, l2Start = tex.layout[1].glyphs[0].x0;
    let c1 = l1Start, c2 = l2Start, tipX = l1Start, tipY = tex.layout[0].y - fs * 0.42, lift = 0, cutting = 0;
    if (t < T.write) { lift = 0.9 * (1 - sm(T.write - 1.0, T.write, t)); }
    for (const s of sched) {
      if (t < s.t0) break;
      const p = clamp((t - s.t0) / (s.t1 - s.t0));
      if (s.kind === 'glyph' || s.kind === 'space') {
        const x = lerp(s.x0, s.x1, p);
        if (s.li === 0) c1 = x; else c2 = x;
        if (s.kind === 'glyph') {
          const w = s.x1 - s.x0, ph = p * TAU * Math.max(1.5, w / (fs * 0.42));
          tipX = x + Math.sin(ph + 1.2) * fs * 0.07; tipY = s.y - fs * 0.42 + Math.sin(ph) * fs * 0.3; lift = 0; cutting = p < 1 ? 1 : 0;
        } else { tipX = x; tipY = s.y - fs * 0.42; lift = 0.05 * Math.sin(Math.PI * p); cutting = 0; }
      } else {                                      // travel to the next line
        tipX = lerp(s.from, s.to, ease(p)); tipY = lerp(s.y0, s.y1, ease(p)) - fs * 0.42; lift = 0.22 * Math.sin(Math.PI * p); cutting = 0;
      }
    }
    if (t >= T.writeEnd) { c1 = Math.max(c1, tex.layout[0].glyphs.at(-1).x1); c2 = tex.layout[1].glyphs.at(-1).x1; lift = 1.4 * sm(T.writeEnd, T.writeEnd + 0.9, t); }
    return { c1, c2, tipX, tipY, lift, cutting };
  }
  const uvOf = (px, py) => [px / TW, 1 - py / TH];

  /* ---------- camera ---------- */
  const vTmp = new THREE.Vector3(), vTmp2 = new THREE.Vector3(), look = new THREE.Vector3();
  const lyingPos = new THREE.Vector3(0, 0.0, 0.4), lyingRot = -Math.PI / 2;
  let aspect = 1, finalCam = new THREE.Vector3(), finalLook = new THREE.Vector3(), finalLeaf = new THREE.Vector3(0, 3, 0), phone = false;
  function frameFinal() {
    phone = aspect < 0.8;
    const frac = phone ? 1.55 : 0.62;                  // leaf width as a fraction of the screen (phones pan across it)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = L / (frac * 2 * tanH * aspect);
    const halfH = d * tanH;
    const yShift = (phone ? 0.5 : 0.48) * halfH;       // leaf sits in the upper part, copy goes below
    finalCam.set(0, finalLeaf.y - yShift, d); finalLook.set(0, finalLeaf.y - yShift, 0);
  }
  function leafWorld(u, v, out) { surf(u, v, out); return leafGroup.localToWorld(out); }
  function followCam(t, outPos, outLook) {            // tracks the stylus, smoothed by averaging its recent path
    let ax = 0, ay = 0; const N = 7;
    for (let k = 0; k < N; k++) { const pp = pen(t - k * 0.11); ax += pp.tipX; ay += pp.tipY; }
    const [u, v] = uvOf(ax / N, ay / N);
    leafWorld(u, v, vTmp);
    const prog = clamp((t - T.write) / (T.writeEnd - T.write));
    const orbit = lerp(-0.55, 0.35, prog);             // slow arc around the stylus while it writes
    outPos.set(vTmp.x + Math.sin(orbit) * 2.5 - 0.3, 1.35 + 0.15 * Math.sin(prog * Math.PI), vTmp.z + Math.cos(orbit) * 2.5);
    outLook.set(vTmp.x + 0.45, 0.02, vTmp.z - 0.12);
  }

  /* ---------- render(t) ---------- */
  function render(t) {
    const flick = (k) => 0.82 + 0.1 * Math.sin(t * 11.3 + k) + 0.06 * Math.sin(t * 23.7 + k * 2) + 0.05 * Math.sin(t * 5.1);
    // lamp ignites
    const lampOn = sm(T.lamp, T.lamp + 1.0, t);
    lampLight.intensity = 14 * lampOn * flick(0);
    rake.intensity = 1.7 + 0.7 * lampOn * flick(1.3);
    flame.scale.set(0.16 * lampOn * (0.9 + 0.1 * flick(2)), 0.34 * lampOn * flick(0.7), 1);
    flame.material.opacity = lampOn;
    glowMat.opacity = 0.55 * lampOn * flick(3);
    hemi.intensity = 0.85 + 0.15 * lampOn;
    dustMat.opacity = 0.75 * lampOn;

    // leaf pose: lying on the table -> rises to face the viewer
    const rise = ease(sm(T.riseStart, T.riseEnd, t));
    const float = Math.sin(t * 0.9) * 0.04 * rise;
    leafGroup.position.lerpVectors(lyingPos, finalLeaf, rise); leafGroup.position.y += float + Math.sin(rise * Math.PI) * 0.6;
    leafGroup.rotation.set(lerp(lyingRot, -0.06, rise), Math.sin(rise * Math.PI) * 0.18, Math.sin(rise * Math.PI) * -0.05);
    if (phone) leafGroup.position.x = rise * Math.sin(Math.max(0, t - T.riseEnd) * 0.35) * L * 0.2;   // slow pan so the text is readable
    leafGroup.updateMatrixWorld(true);
    // table, props fade away into the morning light as the leaf rises
    const fade = 1 - sm(T.riseStart, T.riseEnd - 0.4, t);
    for (const m of [woodMat, clay, boardMat, stackMat]) m.opacity = fade;
    cord.visible = rise < 0.25;
    table.visible = lamp.visible = spout.visible = bundle.visible = fade > 0.01;
    flame.visible = glow.visible = fade > 0.01; lampLight.intensity *= fade; rake.intensity = lerp(rake.intensity, 1.2, rise);
    front.intensity = 1.9 * rise; front.target.position.copy(finalLeaf);

    // writing uniforms
    const p = pen(t);
    uniforms.uL1.value = p.c1 / TW; uniforms.uL2.value = p.c2 / TW;
    uniforms.uCut.value = 1 - sm(T.writeEnd, T.writeEnd + 0.6, t);
    const inkU0 = tex.x0 / TW - 0.02, inkU1 = tex.textEnd / TW + 0.03;
    uniforms.uInk.value = lerp(inkU0, inkU1, ease(sm(T.inkStart, T.inkEnd, t)));

    // stylus pose (leaf-local): tip on the surface, leaning toward the writer; exits up and away
    const [u, v] = uvOf(p.tipX, p.tipY);
    surf(u, v, vTmp);
    const exit = sm(T.writeEnd + 0.2, T.writeEnd + 1.2, t);
    stylus.position.set(vTmp.x + exit * 2.5, vTmp.y - exit * 1.5, vTmp.z + 0.004 + p.lift + exit * 2.0);
    stylus.quaternion.setFromUnitVectors(upY, stylusDir);
    stylus.rotateY(t * 0.3);
    stylus.visible = t < T.writeEnd + 1.25;

    // shavings: little curls kicked up from the tip while cutting, settling on the leaf
    for (let i = 0; i < SH; i++) {
      const ti = T.write + (i / SH) * (T.writeEnd - T.write), age = t - ti;
      const rr = rng(i * 7 + 3);
      if (age < 0 || age > 1.6 || t > T.riseStart) { spos[i * 3 + 2] = -99; continue; }
      const pp = pen(ti); const [su, sv] = uvOf(pp.tipX, pp.tipY); surf(su, sv, vTmp2);
      const vx = (rr() - 0.3) * 0.25, vy = (rr() - 0.7) * 0.25, h = Math.max(0, 0.12 * age * (1.4 - age) * 2);
      spos[i * 3] = vTmp2.x + vx * Math.min(age, 0.5); spos[i * 3 + 1] = vTmp2.y + vy * Math.min(age, 0.5); spos[i * 3 + 2] = vTmp2.z + 0.005 + h;
    }
    shGeo.attributes.position.needsUpdate = true;
    // dust drifting through the light
    for (let i = 0; i < DUST; i++) {
      const [x, y, z, ph, sp] = dseed[i];
      dpos[i * 3] = x + Math.sin(t * 0.21 * sp + ph) * 0.6 + rise * 0;
      dpos[i * 3 + 1] = ((y + t * 0.08 * sp) % 5) + rise * (finalLeaf.y - 2.2);
      dpos[i * 3 + 2] = z + Math.cos(t * 0.17 * sp + ph) * 0.5;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // camera: crane swoop -> follow the stylus -> pull back over the leaf -> face the risen leaf
    const A = vTmp2.set(9.5, 7.5, 11);
    const fPos = new THREE.Vector3(), fLook = new THREE.Vector3();
    followCam(Math.max(t, T.write), fPos, fLook);
    let pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    const sw = ease(sm(0, T.swoopEnd, t));
    { // quadratic bezier sweep from high right, round the lamp, down to the stylus
      const C = new THREE.Vector3(-5.5, 4.5, 7.5), q = sw;
      pos.set((1 - q) * (1 - q) * A.x + 2 * (1 - q) * q * C.x + q * q * fPos.x, (1 - q) * (1 - q) * A.y + 2 * (1 - q) * q * C.y + q * q * fPos.y, (1 - q) * (1 - q) * A.z + 2 * (1 - q) * q * C.z + q * q * fPos.z);
      tgt.lerpVectors(new THREE.Vector3(1.5, 0, -0.8), fLook, sw);
    }
    const pull = ease(sm(T.writeEnd - 0.1, T.inkStart + 0.4, t));          // pull back to see the whole leaf as it's inked
    if (pull > 0) {
      const inkP = sm(T.inkStart, T.inkEnd, t);
      const pPos = new THREE.Vector3(lerp(-2.2, 2.2, inkP), 3.1, 5.4), pLook = new THREE.Vector3(lerp(-1.2, 1.2, inkP), 0, -0.1);
      pos.lerp(pPos, pull); tgt.lerp(pLook, pull);
    }
    if (rise > 0) { pos.lerp(finalCam, rise); tgt.lerp(finalLook, rise); }
    camera.position.copy(pos); camera.lookAt(tgt);
    // subtle handheld breathing
    camera.rotation.z += Math.sin(t * 0.7) * 0.004 * (1 - rise);
    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false); aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix(); frameFinal();
  }
  // where the bottom edge of the risen leaf lands on screen (for placing the copy under it)
  function leafBottomPx(hCss) {
    const saved = [leafGroup.position.clone(), leafGroup.rotation.clone(), camera.position.clone(), camera.quaternion.clone()];
    leafGroup.position.copy(finalLeaf); leafGroup.rotation.set(-0.06, 0, 0); leafGroup.updateMatrixWorld(true);
    camera.position.copy(finalCam); camera.lookAt(finalLook); camera.updateMatrixWorld(true);
    let maxY = -1;
    for (const uu of [0.2, 0.5, 0.8]) { leafWorld(uu, 0, vTmp).project(camera); maxY = Math.max(maxY, (1 - vTmp.y) / 2); }
    leafGroup.position.copy(saved[0]); leafGroup.rotation.copy(saved[1]); camera.position.copy(saved[2]); camera.quaternion.copy(saved[3]); leafGroup.updateMatrixWorld(true);
    return maxY * hCss;
  }
  return { render, resize, leafBottomPx, T };
}
