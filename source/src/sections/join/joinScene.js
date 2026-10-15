// Join Us: "Find your place". Tamil Nadu as a sculpted 3D diorama: a thick earthen slab with the Western Ghats
// rising along its west, peopled by thousands of small figurines dressed in the flag's bands (maroon, yellow,
// maroon). The camera starts at eye level beside one empty, glowing place and pulls back in a long arc until the
// whole state is in view; tapping the place brings a newcomer down into it and a cheer ripples across the crowd.
// Golden-hour light, soft shadows, a tilt-shift lens and a gentle bloom give it the feel of a miniature.
// render(p, time, join) is a pure function of scroll progress p, time, and seconds since joining (or -1).
import * as THREE from 'three';
import { registerRenderer } from '../../gpu.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TN } from './tn.js';

const TAU = Math.PI * 2;
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- the map: lon/lat to the ground plane (north = -z) ---------- */
const LON0 = 78.3, LAT0 = 10.8, K = 30, KX = K * Math.cos(LAT0 * Math.PI / 180);
const toXZ = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * K];
const POLY = TN.map(toXZ);
const LAT_MIN = Math.min(...TN.map((p) => p[1])), LAT_MAX = Math.max(...TN.map((p) => p[1]));
export const SPOT = toXZ([78.69, 10.8]);                      // Tiruchirappalli: the heart of the state
function inside(x, z) {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, zi] = POLY[i], [xj, zj] = POLY[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function edgeDist(x, z) {                                     // distance to the outline (to taper hills and keep people off the rim)
  let d = 1e9;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [ax, az] = POLY[j], [bx, bz] = POLY[i], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return d;
}
const bounds = POLY.reduce((b, [x, z]) => [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], z), Math.max(b[3], z)], [1e9, -1e9, 1e9, -1e9]);
export const MAP_C = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2];

// relief: the Western Ghats and the Eastern Ghats' hill ranges, exaggerated like a museum model
const HILLS = [[76.72, 11.42, 7.5, 0.22], [76.95, 10.35, 6.0, 0.2], [77.45, 10.25, 5.5, 0.2], [77.25, 9.55, 3.6, 0.2], [77.3, 8.65, 4.2, 0.2], [77.1, 11.1, 3.2, 0.25],
  [78.2, 11.8, 2.6, 0.13], [78.38, 11.27, 2.4, 0.11], [78.85, 12.6, 2.3, 0.17], [78.6, 11.9, 1.8, 0.14], [77.8, 12.4, 1.6, 0.2]];
function vnoise(x, z) { return Math.sin(x * 0.37 + z * 0.21) * 0.5 + Math.sin(x * 0.13 - z * 0.29 + 1.7) * 0.5 + Math.sin(x * 0.71 + z * 0.53 + 0.4) * 0.25; }
function heightAt(x, z, ed) {
  const lon = x / KX + LON0, lat = LAT0 - z / K;
  let h = 0;
  for (const [hl, ht, H, s] of HILLS) { const d2 = ((lon - hl) ** 2 + (lat - ht) ** 2) / (s * s); h += H * Math.exp(-d2) * (0.85 + 0.15 * vnoise(x * 2, z * 2)); }
  h += Math.max(0, 0.3 + 0.15 * vnoise(x, z));                              // gentle plains
  return h * sm(0, 2.5, ed);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* ---------- a figurine: robe, head, hair and arms; three poses (arms down, both raised, a flag) ---------- */
function figurine(pose, lod = 0) {
  const seg = lod ? 5 : 10;
  const parts = [];
  const tag = (g, part) => { if (g.index) g = g.toNonIndexed(); g.setAttribute('part', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(part), 1)); return g; };
  parts.push(tag(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.21, 0.04], [0.17, 0.55], [0.15, 0.95], [0.19, 1.2], [0.2, 1.28], [0.12, 1.36], [0.06, 1.4], [0, 1.4]].filter((_, i) => !lod || [0, 1, 3, 5, 7, 9].includes(i)).map(([r, y]) => new THREE.Vector2(r, y)), seg), 0));
  const head = new THREE.SphereGeometry(0.105, lod ? 5 : 10, lod ? 4 : 7); head.translate(0, 1.53, 0); parts.push(tag(head, 1));
  const hair = new THREE.SphereGeometry(0.112, lod ? 5 : 10, lod ? 2 : 4, 0, TAU, 0, Math.PI * 0.55); hair.translate(0, 1.545, 0.006); parts.push(tag(hair, 2));
  const arm = (side, out, fwd) => {             // out: angle away from straight up (0 = raised high, ~PI = hanging down)
    const g = lod ? new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4, 1) : new THREE.CapsuleGeometry(0.038, 0.52, 2, 5); g.translate(0, 0.3, 0); g.rotateX(fwd); g.rotateZ(-side * out); g.translate(side * 0.19, 1.27, 0); return tag(g, 1);
  };
  if (pose === 0) parts.push(arm(-1, Math.PI - 0.15, 0.05), arm(1, Math.PI - 0.15, 0.05));
  else if (pose === 1) parts.push(arm(-1, 0.45, -0.15), arm(1, 0.45, -0.15));
  else {
    parts.push(arm(-1, 0.25, -0.2), arm(1, Math.PI - 0.15, 0.05));
    const stick = new THREE.CylinderGeometry(0.012, 0.012, 0.95, 5); stick.translate(-0.34, 2.1, -0.1); parts.push(tag(stick, 3));
    const flag = new THREE.PlaneGeometry(0.34, 0.22, 3, 1); flag.translate(-0.34 - 0.17, 2.45, -0.1); parts.push(tag(flag, 4));
  }
  const merged = mergeGeometries(parts.map((g) => { const c = g.clone(); c.deleteAttribute('uv'); return c; }));
  return merged;                                  // each part keeps its own smooth normals
}

export function createJoinScene(host) {
  const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }), { name: 'join', cap: 1.25, adaptive: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);

  // sky: a soft golden-hour gradient, peach at the horizon to pale blue above
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: 'varying vec3 vD; void main(){ float e = vD.y; vec3 c = mix(vec3(1.0, 0.86, 0.7), vec3(0.72, 0.84, 0.98), smoothstep(0.0, 0.55, e)); c = mix(c, vec3(1.0, 0.93, 0.82), smoothstep(0.02, -0.25, e)); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.Fog(0xf8e4cc, 300, 1200);

  scene.add(new THREE.HemisphereLight(0xfff2e0, 0xc9a37a, 0.95));
  const sun = new THREE.DirectionalLight(0xffd9a6, 3.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 900 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  const SUN_DIR = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();       // low, from the south-west: long, sculpting shadows
  scene.add(sun, sun.target);

  // the ground: a pale sand floor that fades into the haze
  const SLAB = 6;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ color: 0xf2dcc0, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -SLAB - 0.02; floor.receiveShadow = true; scene.add(floor);

  // the slab: earthen strata on the sides and a fine gold lip
  const shape = new THREE.Shape(POLY.map(([x, z]) => new THREE.Vector2(x, -z)));
  const strata = canvasTex(64, 512, (g, w, h) => {
    const bands = ['#b07a4a', '#c9945e', '#8e5a34', '#d7a874', '#9c6a40', '#c08552', '#7a4a2a'];
    let y = 0, i = 0; const r = rng(3);
    while (y < h) { const bh = 20 + r() * 60; g.fillStyle = bands[i++ % bands.length]; g.fillRect(0, y, w, bh); y += bh; }
    for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(60,30,10,${r() * 0.15})`; g.fillRect(0, r() * h, w, 1 + r() * 2); }
  });
  strata.wrapS = strata.wrapT = THREE.RepeatWrapping; strata.repeat.set(1 / 30, 1 / SLAB);
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false, curveSegments: 2 });
  slabGeo.rotateX(-Math.PI / 2); slabGeo.translate(0, -SLAB, 0);
  const slab = new THREE.Mesh(slabGeo, [new THREE.MeshStandardMaterial({ color: 0x8a5a34 }), new THREE.MeshStandardMaterial({ map: strata, roughness: 0.95 })]);
  slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  const lipPts = POLY.map(([x, z]) => new THREE.Vector3(x, 0.05, z));
  const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true, 'catmullrom', 0.1), 1600, 0.2, 6, true), new THREE.MeshStandardMaterial({ color: 0xd9a830, metalness: 1, roughness: 0.28 }));
  scene.add(lip);

  // the relief: a grid clipped to the outline, coloured by height (the crowd's ground in the flag bands, forested hills above)
  const STEP = 0.75, gx = Math.ceil((bounds[1] - bounds[0]) / STEP) + 1, gz = Math.ceil((bounds[3] - bounds[2]) / STEP) + 1;
  const vpos = new Float32Array(gx * gz * 3), vcol = new Float32Array(gx * gz * 3), ins = new Uint8Array(gx * gz), H = new Float32Array(gx * gz);
  const cMaroon = new THREE.Color(0x6e0f13), cYellow = new THREE.Color(0xc8961c), cForest = new THREE.Color(0x3f6b34), cRock = new THREE.Color(0x8c7a5a), tc = new THREE.Color();
  const bandAt = (z) => { const q = (LAT0 - z / K - LAT_MIN) / (LAT_MAX - LAT_MIN); return sm(0.325, 0.345, q) * (1 - sm(0.655, 0.675, q)); };
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
    const x = bounds[0] + i * STEP, z = bounds[2] + j * STEP, k = j * gx + i;
    const isIn = inside(x, z), ed = edgeDist(x, z), keep = isIn || ed < STEP * 1.2;
    const h = keep && isIn ? heightAt(x, z, ed) : 0; H[k] = h; ins[k] = keep ? 1 : 0;
    vpos.set([x, h, z], k * 3);
    tc.copy(cMaroon).lerp(cYellow, bandAt(z)).lerp(cForest, sm(1.4, 2.4, h)).lerp(cRock, sm(5.5, 7.5, h) * 0.6);
    tc.multiplyScalar(0.9 + 0.1 * vnoise(x * 3, z * 3)); tc.toArray(vcol, k * 3);
  }
  const idx = [];
  for (let j = 0; j < gz - 1; j++) for (let i = 0; i < gx - 1; i++) {
    const a = j * gx + i, b = a + 1, c = a + gx, d = c + 1;
    if (ins[a] && ins[b] && ins[c] && ins[d] && inside(bounds[0] + (i + 0.5) * STEP, bounds[2] + (j + 0.5) * STEP)) idx.push(a, c, b, b, c, d);
  }
  const relief = new THREE.BufferGeometry(); relief.setAttribute('position', new THREE.BufferAttribute(vpos, 3)); relief.setAttribute('color', new THREE.BufferAttribute(vcol, 3)); relief.setIndex(idx); relief.computeVertexNormals();
  const top = new THREE.Mesh(relief, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); top.castShadow = top.receiveShadow = true; scene.add(top);
  // a flat cap just under the relief so its jagged grid edge never shows a gap against the slab
  const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a1a14, roughness: 1 })); cap.position.y = -0.02; cap.receiveShadow = true; scene.add(cap);
  const groundH = (x, z) => {
    const fx = (x - bounds[0]) / STEP, fz = (z - bounds[2]) / STEP, i = Math.max(0, Math.min(gx - 2, Math.floor(fx))), j = Math.max(0, Math.min(gz - 2, Math.floor(fz))), u = fx - i, v = fz - j;
    return lerp(lerp(H[j * gx + i], H[j * gx + i + 1], u), lerp(H[(j + 1) * gx + i], H[(j + 1) * gx + i + 1], u), v);
  };

  // the crowd: three figurine poses, instanced; each dressed in the flag band it stands in
  const r = rng(2026), SP = 1.1, slots = [[], [], []];
  const MAROON = [0x9b1218, 0xb3141b, 0x84101a].map((h) => new THREE.Color(h)), YELLOW = [0xf6c32e, 0xffd23f, 0xeab01b].map((h) => new THREE.Color(h));
  for (let z = bounds[2]; z < bounds[3]; z += SP * 0.87) for (let x = bounds[0]; x < bounds[1]; x += SP) {
    const px = x + (Math.round(z / SP) % 2 ? SP / 2 : 0) + (r() - 0.5) * 0.45, pz = z + (r() - 0.5) * 0.4;
    if (!inside(px, pz) || edgeDist(px, pz) < 0.7) continue;
    const h = groundH(px, pz); if (h > 1.7 + r() * 0.6) continue;                // the hills stay green
    if (Math.hypot(px - SPOT[0], pz - SPOT[1]) < 1.3) continue;                  // the empty place
    const band = bandAt(pz) > 0.5 ? YELLOW : MAROON;
    const pz2 = r(), pose = pz2 < 0.45 ? 1 : pz2 < 0.7 ? 2 : 0;
    slots[pose].push({ x: px, y: h, z: pz, s: 0.92 + r() * 0.18, rot: (r() - 0.5) * 1.4 + Math.PI, c: band[Math.floor(r() * 3)] });
  }
  const joinU = { value: -1 }, timeU = { value: 0 }, spotU = { value: new THREE.Vector2(...SPOT) };
  const figMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  figMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uJoin: joinU, uTime: timeU, uSpot: spotU });
    sh.vertexShader = 'attribute float part; varying float vPart; varying float vHash; uniform float uJoin, uTime; uniform vec2 uSpot;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPart = part;
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        vHash = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);
        float d = distance(ip, uSpot), t = uJoin < 0.0 ? -100.0 : uJoin, front = t * 30.0;
        float wave = exp(-pow((d - front) / 5.0, 2.0)) * step(0.0, t);
        float after = smoothstep(0.0, 8.0, front - d) * step(0.0, t);
        float hop = wave * 0.7 + after * 0.22 * pow(max(0.0, sin(uTime * 6.0 + vHash * 40.0)), 3.0);
        transformed.y += hop;
        transformed.x += sin(uTime * 1.3 + vHash * 30.0) * 0.02 * position.y;
        if (part > 3.5) transformed.z += sin(position.x * 9.0 - uTime * 7.0 + vHash * 20.0) * 0.05 * (-position.x - 0.34);`);
    sh.fragmentShader = 'varying float vPart; varying float vHash;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 skin = mix(vec3(0.34, 0.19, 0.1), vec3(0.6, 0.38, 0.24), vHash);
        if (vPart > 0.5 && vPart < 1.5) diffuseColor.rgb = skin;
        else if (vPart > 1.5 && vPart < 2.5) diffuseColor.rgb = vec3(0.03, 0.025, 0.02);
        else if (vPart > 2.5 && vPart < 3.5) diffuseColor.rgb = vec3(0.45, 0.32, 0.2);`);
  };
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  let N = 0; const lods = [[], []];
  slots.forEach((list, pose) => {
    if (!list.length) return;
    for (const lod of [0, 1]) {                              // detailed figurines up close, simple ones from afar
      const im = new THREE.InstancedMesh(figurine(pose, lod), figMat, list.length);
      list.forEach((f, i) => { m4.compose(pv.set(f.x, f.y, f.z), qq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, f.rot), sv.setScalar(f.s)); im.setMatrixAt(i, m4); im.setColorAt(i, f.c); });
      im.castShadow = true; im.receiveShadow = !lod; im.frustumCulled = false; scene.add(im); lods[lod].push(im);
    }
    N += list.length;
  });

  // the empty place: a gold ring on the ground, a soft column of light rising from it, slow pulses
  const SY = groundH(...SPOT);
  const ringTex = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 70, 128, 128, 128); gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(0.6, 'rgba(255,225,130,1)'); gr.addColorStop(0.72, 'rgba(255,245,200,1)'); gr.addColorStop(1, 'rgba(255,215,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
  const addMat = (map, o = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2), addMat(ringTex)); ring.position.set(SPOT[0], SY + 0.04, SPOT[1]); scene.add(ring);
  const pulses = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), addMat(ringTex)); m.position.copy(ring.position); scene.add(m); return m; });
  const beamTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,236,170,0)'); gr.addColorStop(0.7, 'rgba(255,236,170,.5)'); gr.addColorStop(1, 'rgba(255,246,210,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1, 32, 1, true).translate(0, 0.5, 0), addMat(beamTex, 0.7)); column.position.set(SPOT[0], SY, SPOT[1]); scene.add(column);
  const glowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.35, 'rgba(255,225,140,.45)'); gr.addColorStop(1, 'rgba(255,210,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(SPOT[0], SY + 0.9, SPOT[1]); scene.add(halo);
  const spotLight = new THREE.PointLight(0xffd88a, 6, 9, 1.6); spotLight.position.set(SPOT[0], SY + 2.2, SPOT[1]); scene.add(spotLight);

  // the newcomer: a figurine in white and gold that comes down the light into the place
  const youMat = new THREE.MeshStandardMaterial({ color: 0xfff8ea, roughness: 0.35, metalness: 0.1, emissive: 0xffc860, emissiveIntensity: 1 });
  const you = new THREE.Mesh(figurine(1), youMat); you.castShadow = true; you.visible = false; you.rotation.y = Math.PI; scene.add(you);

  // confetti: maroon, yellow and gold flakes
  const CN = 700, cg = new THREE.BufferGeometry(), cv = new Float32Array(CN * 3), cc = new Float32Array(CN * 3), cp = new Float32Array(CN), cr = rng(9);
  const ccols = [0x9b1218, 0xf6c32e, 0xfff4dc, 0xc8161d, 0xffd23f, 0xd9a830].map((h) => new THREE.Color(h));
  for (let i = 0; i < CN; i++) { const a = cr() * TAU, sp = 2 + cr() * 9; cv.set([Math.cos(a) * sp, 8 + cr() * 14, Math.sin(a) * sp], i * 3); ccols[Math.floor(cr() * 6)].toArray(cc, i * 3); cp[i] = cr(); }
  cg.setAttribute('position', new THREE.BufferAttribute(cv, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); cg.setAttribute('phase', new THREE.BufferAttribute(cp, 1));
  const confMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: { value: -1 }, uPx: { value: 1 } },
    vertexShader: `attribute vec3 color; attribute float phase; uniform float uT, uPx; varying vec3 vC; varying float vA, vR;
      void main(){ float t = max(uT, 0.0); vec3 v = position;
        vec3 p = vec3(v.x * (1.0 - exp(-t * 1.6)) / 1.6 * 2.0, v.y * (1.0 - exp(-t * 1.3)) / 1.3 - 1.4 * t * t * 0.5, v.z * (1.0 - exp(-t * 1.6)) / 1.6 * 2.0);
        p.x += sin(t * 3.0 + phase * 20.0) * 0.5; p.y = max(p.y, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vC = color; vR = t * 6.0 + phase * 10.0; vA = step(0.0, uT) * (1.0 - smoothstep(6.0, 9.0, t));
        gl_PointSize = uPx * 120.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA, vR; void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), k = cos(vR); c = vec2(c.x * k - c.y * s, c.x * s + c.y * k);
      if (abs(c.x) > 0.42 || abs(c.y) > 0.18 || vA < 0.01) discard; gl_FragColor = vec4(vC * (0.8 + 0.5 * abs(sin(vR))), vA); }`,
  });
  const confetti = new THREE.Points(cg, confMat); confetti.position.set(SPOT[0], SY, SPOT[1]); confetti.frustumCulled = false; scene.add(confetti);

  // the lens: render, a gentle bloom on the light, then a tilt-shift blur that makes it read as a miniature
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.6, 0.9); composer.addPass(bloom);
  const hTilt = new ShaderPass(HorizontalTiltShiftShader), vTilt = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(hTilt); composer.addPass(vTilt);
  composer.addPass(new OutputPass());

  /* ---------- camera: eye level at the empty place, then a long rising arc to the whole state ---------- */
  const view = { aspect: 16 / 9, phone: false, h: 800, w: 1280 };
  const target = new THREE.Vector3(), pos = new THREE.Vector3(), tmp = new THREE.Vector3();
  const mapW = bounds[1] - bounds[0], mapH = bounds[3] - bounds[2];
  function pose(p, time) {
    const k = sm(0.05, 0.84, p), e = k * k * (3 - 2 * k);
    const tanF = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const farD = view.phone ? Math.max(mapH * 0.95, mapW / view.aspect * 1.1) / tanF : Math.max(mapH * 0.8, mapW / view.aspect * 1.4) / tanF;
    const dist = 8.5 * Math.pow(farD / 8.5, e);
    const tilt = lerp(0.66, view.phone ? 0.95 : 0.7, e);                    // radians above the horizon
    const yaw = lerp(0.75, view.phone ? 0.05 : -0.22, e) + Math.sin(time * 0.06) * 0.035 * e;
    const cx = MAP_C[0] + (view.phone ? 0 : mapW * -0.2), cz = MAP_C[1] + (view.phone ? -mapH * 0.12 : mapH * 0.04);
    target.set(lerp(SPOT[0], cx, e), lerp(SY + 0.3, 0, e), lerp(SPOT[1], cz, e));
    pos.set(target.x + Math.sin(yaw) * Math.cos(tilt) * dist, target.y + Math.sin(tilt) * dist, target.z + Math.cos(yaw) * Math.cos(tilt) * dist);
    view.pitch = lerp(view.phone ? -0.16 : -0.12, 0, sm(0, 0.25, e));     // up close, look a touch lower so the place sits above the title
    return e;
  }
  function celebrate(j) {                                            // swoop in on the newcomer, then drift back as the cheer spreads
    const o = sm(1.6, 10, j), d = lerp(view.phone ? 13 : 11, view.phone ? 120 : 95, o * o), tilt = lerp(0.42, 0.8, o), yaw = lerp(0.5, 0.1, o);
    target.set(SPOT[0] + (view.phone ? 0 : -0.2 * d), SY + lerp(1.1, 0, o), SPOT[1] + (view.phone ? 0.1 * d : 0));
    pos.set(target.x + Math.sin(yaw) * Math.cos(tilt) * d, target.y + Math.sin(tilt) * d, target.z + Math.cos(yaw) * Math.cos(tilt) * d);
  }
  const A = { p: new THREE.Vector3(), t: new THREE.Vector3() };

  function render(p, time = 0, j = -1, mouse = { x: 0, y: 0 }) {
    const e = pose(p, time); A.p.copy(pos); A.t.copy(target);
    if (j >= 0) {
      celebrate(j);
      const jk = sm(0, 2.4, j) * (1 - sm(0.35, 0.05, p));
      pos.lerpVectors(A.p, pos, jk); target.lerpVectors(A.t, target, jk);
    }
    const dist = pos.distanceTo(target);
    lods[0].forEach((m) => { m.visible = dist < 30; }); lods[1].forEach((m) => { m.visible = dist >= 30; });
    camera.position.copy(pos).add(tmp.set(mouse.x * 0.03, -mouse.y * 0.02, 0).multiplyScalar(dist));
    camera.lookAt(target); if (j < 0 || p < 0.35) camera.rotateX(view.pitch || 0);
    camera.near = Math.max(0.05, dist * 0.01); camera.far = dist * 10 + 400; camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    scene.fog.near = dist * 2.2 + 30; scene.fog.far = dist * 6 + 300;
    sun.target.position.copy(target); sun.position.copy(target).addScaledVector(SUN_DIR, 400);
    const sc = Math.min(115, Math.max(14, dist * 0.75)); Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc }); sun.shadow.camera.updateProjectionMatrix();

    timeU.value = time; joinU.value = j;
    const taken = j >= 0 ? sm(0.9, 1.6, j) : 0, grow = Math.max(1, dist / 28);
    column.scale.set(grow * 0.7, 6 + dist * 0.35, grow * 0.7); column.material.opacity = (0.5 + 0.15 * Math.sin(time * 2.4)) * (1 - taken) * lerp(0.35, 1, e);
    ring.scale.setScalar(1 + 0.06 * Math.sin(time * 3)); ring.material.opacity = 1 - taken * 0.85;
    pulses.forEach((m, i) => { const q = (time * 0.5 + i / 3) % 1; m.scale.setScalar(2.6 + q * (2 + grow * 5)); m.material.opacity = (1 - q) * lerp(0.4, 0.9, e) * (1 - taken); });
    halo.scale.setScalar(2.2 + grow * 3.2 + Math.sin(time * 2.4) * 0.2); halo.material.opacity = lerp(0.5, 0.95, e) * (1 - taken * 0.7);
    spotLight.intensity = 6 * (1 - taken * 0.6);
    you.visible = j >= 0;
    if (j >= 0) {
      const d = sm(0, 1.2, j);
      you.position.set(SPOT[0], SY + (1 - d) * (1 - d) * 14, SPOT[1]);
      youMat.emissiveIntensity = 1.4 * (1 - sm(1.0, 2.6, j)) + 0.12;
    }
    confMat.uniforms.uT.value = j >= 0 ? j - 1.0 : -1; confMat.uniforms.uPx.value = renderer.getPixelRatio() * view.h / 800;
    // the lens: blur away from a band through the focus point; stronger when far (miniature), lighter up close
    tmp.copy(target).project(camera);
    const focusY = tmp.y * 0.5 + 0.5, amt = lerp(0.45, 2.4, sm(10, 160, dist)) / Math.max(400, view.h);
    hTilt.uniforms.h.value = amt * view.h / view.w; hTilt.uniforms.r.value = focusY;
    vTilt.uniforms.v.value = amt; vTilt.uniforms.r.value = focusY;
    composer.render();
    return e;
  }
  function spotScreen() { tmp.set(SPOT[0], SY + 1.2, SPOT[1]).project(camera); return { x: tmp.x * 0.5 + 0.5, y: -tmp.y * 0.5 + 0.5, visible: tmp.z < 1 }; }
  function resize(w, h) {
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / h; view.aspect = w / h; view.phone = w / h < 0.8; view.h = h; view.w = w;
    camera.fov = view.phone ? 50 : 38; camera.updateProjectionMatrix();
  }
  return { render, resize, spotScreen, count: N };
}
