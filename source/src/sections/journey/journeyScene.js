// Our Journey: the Milestone Road. A camera drives down a festive Tamil Nadu road, lined with party flags, buntings
// and a growing crowd. Each milestone has its own place and time of day (see zones.js), blending into the next.
// Ten yellow-capped highway milestones carry the years; beside each stands an object for that moment, and the
// roadside crowd grows from a handful of people to a sea at Vikravandi.
// render(s, time) is a pure function of the distance travelled `s` (metres along the road) and `time` (animations).
import * as THREE from 'three';
import { registerRenderer } from '../../gpu.js';
import { MILESTONES } from './content.js';
import { buildProp, canvasTex, glowSprite } from './props.js';
import { peopleAtlas, treeAtlas } from './silhouettes2d.js';
import { ZONES, makeZoneBlend, zoneParams, buildZones, groundLUT } from './zones.js';

const TAU = Math.PI * 2;
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- the road's path ---------- */
const CTRL = [[0, 40], [0, 0], [-1, -40], [4, -80], [9, -120], [6, -160], [-3, -200], [-9, -240], [-6, -280], [2, -320], [8, -360], [7, -400], [1, -440], [0, -480], [0, -540], [0, -600]];
const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
export const LEN = curve.getLength();
const S0 = 40;                                                // s = 0 is the road at z = 0
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
export function frame(s, out = {}) {
  const u = Math.min(1, Math.max(0, (s + S0) / LEN));
  out.p = curve.getPointAt(u, out.p || new THREE.Vector3());
  out.t = curve.getTangentAt(u, out.t || new THREE.Vector3()); out.t.y = 0; out.t.normalize();
  out.r = (out.r || new THREE.Vector3()).set(-out.t.z, 0, out.t.x);           // right-hand side of the road
  return out;
}
const at = (s, side, off, y = 0) => { const f = frame(s); return f.p.clone().addScaledVector(f.r, side * off).setY(y); };

export const ROAD_W = 7.2, LANE = -1.8;                      // driving on the left
export const STONES = MILESTONES.map((m, k) => ({ ...m, k, d: 34 + k * 40, side: k % 2 ? 1 : -1 }));
export const END_S = STONES[9].d + 70;

/* ---------- textures ---------- */
function roadTex() {
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#1f1f22'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 9000; i++) { const v = 30 + r() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.4})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(20,20,22,.35)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, TAU); g.fill(); }   // patches
    g.fillStyle = 'rgba(15,15,16,.45)'; g.fillRect(w * 0.22, 0, w * 0.1, h); g.fillRect(w * 0.68, 0, w * 0.1, h);   // tyre tracks
    g.fillStyle = '#f2efe6'; g.fillRect(w * 0.035, 0, 12, h); g.fillRect(w * 0.965 - 12, 0, 12, h);                     // edge lines
    for (let y = 0; y < h; y += 256) g.fillRect(w / 2 - 7, y + 40, 14, 110);                                          // dashed centre line
  }, { repeat: [1, 1] });
}
function earthTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5f8f34'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 3200; i++) {
      const k = r(); g.fillStyle = k < 0.45 ? `rgba(120,170,60,${0.25 + r() * 0.35})` : k < 0.8 ? `rgba(60,105,35,${0.25 + r() * 0.35})` : `rgba(150,110,60,${0.2 + r() * 0.3})`;
      g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 6, 0, TAU); g.fill();
    }
  }, { repeat: [260, 260] });
}
function shoulderTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b5683c'; g.fillRect(0, 0, w, h);
    const r = rng(19);
    for (let i = 0; i < 1500; i++) { g.fillStyle = r() < 0.5 ? `rgba(220,140,85,${0.3 + r() * 0.3})` : `rgba(120,60,30,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 2.5, 0, TAU); g.fill(); }
  }, { repeat: [3, 1] });
}

/* ---------- the milestone stone: white body, yellow semicircular cap, carved year ---------- */
const SW = 0.66, SB = 0.82, SR = SW / 2, SH = SB + SR, SD = 0.24;
function stoneShape() {
  const s = new THREE.Shape();
  s.moveTo(-SR, 0); s.lineTo(SR, 0); s.lineTo(SR, SB); s.absarc(0, SB, SR, 0, Math.PI, false); s.lineTo(-SR, 0);
  return s;
}
function stoneFace(m) {
  const W = 512, H = Math.round(W * SH / SW);
  return canvasTex(W, H, (g) => {
    const cap = H - (SB / SH) * H;                                   // cap/body boundary (from the top)
    g.fillStyle = '#ece8dc'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2bd1d'; g.fillRect(0, 0, W, cap + 4);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 70px StoneEn'; g.fillText(String(m.k + 1).padStart(2, '0'), W / 2, cap * 0.62);
    g.fillRect(40, cap + 2, W - 80, 6);
    g.font = '700 150px StoneEn'; g.fillText(m.year, W / 2, cap + (H - cap) * 0.3);
    let fs = 64; g.font = `700 ${fs}px StoneTa`; while (g.measureText(m.stone).width > W - 70) { fs -= 2; g.font = `700 ${fs}px StoneTa`; }
    g.fillText(m.stone, W / 2, cap + (H - cap) * 0.58);
    const r = rng(100 + m.k);                                        // weathering: grime from the ground up, chips, specks
    const gr = g.createLinearGradient(0, H * 0.7, 0, H); gr.addColorStop(0, 'rgba(70,50,30,0)'); gr.addColorStop(1, 'rgba(70,50,30,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(40,30,20,${0.08 + r() * 0.25})`; g.beginPath(); g.arc(r() * W, r() * H, 0.5 + r() * 2.5, 0, TAU); g.fill(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(120,110,95,.5)'; g.beginPath(); g.ellipse(r() * W, r() * H, 4 + r() * 10, 2 + r() * 5, r() * 3, 0, TAU); g.fill(); }
  });
}
function makeStone(m) {
  const geo = new THREE.ExtrudeGeometry(stoneShape(), { depth: SD, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 28 });
  geo.translate(0, 0, -SD / 2);
  const face = stoneFace(m); face.repeat.set(1 / SW, 1 / SH); face.offset.set(0.5, 0);
  const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.75 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  sideMat.onBeforeCompile = (s) => {
    s.vertexShader = 'varying float vY;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    s.fragmentShader = 'varying float vY;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= vY > ${SB.toFixed(3)} ? vec3(0.95, 0.66, 0.06) : vec3(0.86, 0.84, 0.78);
      diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.35, vY));`);
  };
  const stone = new THREE.Mesh(geo, [faceMat, sideMat]); stone.castShadow = stone.receiveShadow = true;
  const G = new THREE.Group(); G.add(stone);
  const base = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.3, 0.12, SD + 0.3), new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 0.95 }));
  base.position.y = 0.04; base.receiveShadow = base.castShadow = true; G.add(base);
  G.scale.setScalar(1.8);
  return G;
}

/* ---------- billboards (trees, people) ---------- */
function billboardMaterial(tex, grid, { color, sway = 0, bob = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uGrid: { value: new THREE.Vector2(grid[0], grid[1]) }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uFogColor: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(20, 260) }, uSway: { value: sway }, uBob: { value: bob }, uRim: { value: new THREE.Color(0) }, uLight: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `
      attribute vec3 iPos; attribute vec2 iSize; attribute float iCell; attribute float iPhase; attribute float iShade;
      uniform vec2 uGrid; uniform float uTime, uSway, uBob; uniform vec2 uFog;
      varying vec2 vUv; varying float vFog, vShade, vY;
      void main() {
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        float bob = uBob * pow(max(0.0, sin(uTime * 5.0 + iPhase * 7.0)), 3.0) * iSize.y * 0.05 * step(0.5, fract(iPhase * 3.1));
        vec3 wp = iPos + right * position.x * iSize.x + vec3(0.0, position.y * iSize.y + bob, 0.0);
        wp += right * uSway * position.y * position.y * sin(uTime * 0.9 + iPhase * 6.0) * iSize.y * 0.025;
        float col = mod(iCell, uGrid.x), row = floor(iCell / uGrid.x);
        vUv = vec2((col + uv.x) / uGrid.x, 1.0 - (row + 1.0 - uv.y) / uGrid.y);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vFog = smoothstep(uFog.x, uFog.y, -mv.z); vShade = iShade; vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uColor, uFogColor, uRim, uLight;
      varying vec2 vUv; varying float vFog, vShade, vY;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.5) discard;
        vec3 col = c.rgb * uLight * vShade * mix(0.82, 1.08, vY) + uRim * vY;
        gl_FragColor = vec4(mix(col, uFogColor, vFog), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
function billboards(items, mat) {
  const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const n = items.length, P = new Float32Array(n * 3), Sz = new Float32Array(n * 2), C = new Float32Array(n), Ph = new Float32Array(n), Sh = new Float32Array(n);
  items.forEach((it, i) => { P.set([it.x, it.y || 0, it.z], i * 3); Sz.set([it.w, it.h], i * 2); C[i] = it.cell; Ph[i] = it.phase; Sh[i] = it.shade ?? 1; });
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3)); geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(Sz, 2));
  geo.setAttribute('iCell', new THREE.InstancedBufferAttribute(C, 1)); geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(Ph, 1)); geo.setAttribute('iShade', new THREE.InstancedBufferAttribute(Sh, 1));
  geo.instanceCount = n;
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; return m;
}

/* ---------- sky: night to sunrise, stars, two ranges of hills ---------- */
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x2f7fe0) }, uHor: { value: new THREE.Color(0xcfe8ff) }, uGlow: { value: new THREE.Color(0xffb060) },
      uHillFar: { value: new THREE.Color(0x7fa6c4) }, uHillNear: { value: new THREE.Color(0x4f7f5a) },
      uSun: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uSunVis: { value: 1 }, uGold: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.4 }, uOver: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 uTop, uHor, uGlow, uHillFar, uHillNear, uSun; uniform float uSunVis, uGold, uTime, uCloud, uOver; varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm2(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p *= 2.03; a *= 0.5; } return v; }
      float n1(float x){ float i = floor(x), f = fract(x); float a = fract(sin(i * 127.1) * 43758.5), b = fract(sin((i + 1.0) * 127.1) * 43758.5); return mix(a, b, f * f * (3.0 - 2.0 * f)); }
      float fbm(float x){ return n1(x) * 0.55 + n1(x * 2.3 + 7.0) * 0.28 + n1(x * 5.1 + 3.0) * 0.17; }
      void main() {
        vec3 d = normalize(vDir); float el = d.y;
        vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.6, el), 0.8));
        float sd = max(dot(d, uSun), 0.0);
        col += uGlow * (pow(sd, 6.0) * 0.55 + pow(sd, 60.0) * 0.6);
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * uSunVis * 3.0 * (1.0 - uOver);
        // soft cumulus clouds, lit from the sun side
        if (el > 0.0) {
          vec2 cp = d.xz / (el + 0.12) * 1.6 + vec2(uTime * 0.006, 0.0);
          float c = smoothstep(0.66 - 0.3 * uCloud, 0.86 - 0.22 * uCloud, fbm2(cp * 0.9));
          float lit = 0.75 + 0.35 * pow(sd, 3.0);
          vec3 cc = mix(vec3(1.0), uGlow * 1.1 + 0.25, uGold * 0.6) * lit;
          col = mix(col, cc, c * smoothstep(0.0, 0.08, el) * 0.85);
          float o = fbm2(cp * 0.5 + 3.0);
          col = mix(col, mix(vec3(0.74, 0.78, 0.83), vec3(0.9, 0.92, 0.95), o) * (0.85 + 0.2 * o), uOver * 0.85 * smoothstep(-0.02, 0.12, el));
        }
        float a = atan(d.x, d.z);
        float far = 0.028 + 0.04 * fbm(a * 2.2 + 1.0), near = 0.012 + 0.026 * fbm(a * 4.5 + 9.0);
        if (el < far) col = mix(uHillFar, col, 0.25) ;
        if (el < near) col = uHillNear;
        if (el < -0.002) col = uHillNear * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createJourneyScene(host, { flagTex }) {
  const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }), { name: 'journey' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 18, 240);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1500);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMaterial()); sky.renderOrder = -1; scene.add(sky);

  // ground and road
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: earthTex(), roughness: 1, color: 0xffffff, envMapIntensity: 0.2 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, -260); ground.receiveShadow = true; scene.add(ground);
  const zoneBlend = makeZoneBlend(STONES), G_MIN = -60, G_MAX = END_S + 160, gLUT = groundLUT(zoneBlend, G_MIN, G_MAX);
  ground.material.onBeforeCompile = (sh) => {
    sh.uniforms.uLUT = { value: gLUT };
    sh.vertexShader = 'varying float vS;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvS = -(modelMatrix * vec4(transformed, 1.0)).z;');
    sh.fragmentShader = 'uniform sampler2D uLUT; varying float vS;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec4 zc = texture2D(uLUT, vec2(clamp((vS - (${G_MIN.toFixed(1)})) / ${(G_MAX - G_MIN).toFixed(1)}, 0.0, 1.0), 0.5));
      float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
      diffuseColor.rgb = mix(diffuseColor.rgb, zc.rgb * zc.rgb * (0.65 + lum * 1.1), zc.a);`);
  };
  const ribbon = (width, y, mat, vScale) => {
    const N = Math.ceil(LEN), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const f = frame(i - S0);
      for (const sgn of [-1, 1]) { const q = f.p.clone().addScaledVector(f.r, sgn * width / 2); pos.push(q.x, y, q.z); uv.push(sgn < 0 ? 0 : 1, i / vScale); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
  };
  ribbon(ROAD_W + 3.4, 0.008, new THREE.MeshStandardMaterial({ roughness: 1, map: shoulderTex(), envMapIntensity: 0.2 }), 6);   // red-earth shoulders
  const rt = roadTex(); rt.wrapS = THREE.ClampToEdgeWrapping;
  ribbon(ROAD_W, 0.016, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.78, metalness: 0.0, color: 0x9a9a9a, envMapIntensity: 0.3 }), 16);

  // lights: sun with shadows, a bright sky fill
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a7a3a, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 220 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);

  // street-light poles (off by day) carry strings of maroon-and-yellow buntings across the road
  const lampGeo = new THREE.CylinderGeometry(0.07, 0.1, 7.2, 8); lampGeo.translate(0, 3.6, 0);
  const armGeo = new THREE.BoxGeometry(1.8, 0.08, 0.08); armGeo.translate(-0.9, 7.1, 0);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.6, roughness: 0.45 });
  const lamps = [];
  for (let s = 36; s < END_S + 40; s += 30) if (s < END_S - 4 && !STONES.some((m) => s > m.d - 14 && s < m.d + 8)) lamps.push({ s, side: (Math.round(s / 30) % 2) ? 1 : -1 });
  const poles = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length), arms = new THREE.InstancedMesh(armGeo, lampMat, lamps.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  lamps.forEach((L, i) => {
    const f = frame(L.s), base = f.p.clone().addScaledVector(f.r, L.side * (ROAD_W / 2 + 1.0));
    const yaw = Math.atan2(f.r.x, f.r.z) - Math.PI / 2 + (L.side > 0 ? 0 : Math.PI);
    q.setFromEuler(new THREE.Euler(0, yaw, 0)); m4.compose(base, q, one); poles.setMatrixAt(i, m4); arms.setMatrixAt(i, m4);
  });
  poles.castShadow = arms.castShadow = true; scene.add(poles, arms);

  const PARTY = [0x9b1218, 0xf6c32e, 0xc8161d, 0xffffff, 0xf6c32e];
  { // buntings: catenary strings of triangular pennants, every 15 m
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.42, 0], 3)); tri.computeVertexNormals();
    const spans = []; for (let s = 2; s < END_S - 2; s += 15) if (!STONES.some((m) => s > m.d - 13 && s < m.d - 3)) spans.push(s);
    const per = 30, im = new THREE.InstancedMesh(tri, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), spans.length * per * 2);
    const strPts = []; let n = 0; const col = new THREE.Color(), rr = rng(15);
    spans.forEach((s0, si) => for2(s0, si));
    function for2(s0, si) {
      for (const dz of [0, 1.2]) {
        const f = frame(s0 + dz), A = f.p.clone().addScaledVector(f.r, -(ROAD_W / 2 + 1.0)).setY(6.4 - dz * 0.6), B = f.p.clone().addScaledVector(f.r, ROAD_W / 2 + 1.0).setY(6.4 - dz * 0.6);
        let prev = null;
        for (let k = 0; k < per; k++) {
          const t = (k + 0.5) / per, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 1.1;
          const yaw = Math.atan2(f.t.x, f.t.z);
          m4.compose(p, q.setFromEuler(new THREE.Euler((rr() - 0.5) * 0.4, yaw, (rr() - 0.5) * 0.15)), one); im.setMatrixAt(n, m4); im.setColorAt(n, col.set(PARTY[(k + si) % PARTY.length])); n++;
          if (prev) strPts.push(prev.x, prev.y + 0.01, prev.z, p.x, p.y + 0.01, p.z); prev = p;
        }
      }
    }
    im.count = n; scene.add(im);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(strPts, 3));
    scene.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x3a2a1a })));
  }
  const flagWave = { uT: { value: 0 } };
  { // party flags on bamboo poles lining both edges, and painted kerb stones
    const fl = []; for (let s = -10; s < END_S + 60; s += 6.5) for (const side of [-1, 1]) if (!STONES.some((m) => m.side === side && s > m.d - 8 && s < m.d + 6)) fl.push({ s: s + (side > 0 ? 3.2 : 0), side });
    const poleG = new THREE.CylinderGeometry(0.025, 0.03, 3.2, 6); poleG.translate(0, 1.6, 0);
    const pim = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 0.8 }), fl.length);
    const fg = new THREE.PlaneGeometry(1.05, 0.7, 12, 4); fg.translate(0.525, 2.75, 0);
    const fmat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.65 });
    fmat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = flagWave.uT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.3;
        float q = position.x / 1.05;
        transformed.z += sin(position.x * 4.0 - uT * 6.0 + ph) * 0.09 * q;
        transformed.y -= q * q * 0.06;`);
    };
    const fim = new THREE.InstancedMesh(fg, fmat, fl.length);
    fl.forEach((F, i) => {
      const f = frame(F.s), p = f.p.clone().addScaledVector(f.r, F.side * (ROAD_W / 2 + 1.8));
      m4.compose(p, q.setFromEuler(new THREE.Euler(0, Math.atan2(f.r.x, f.r.z) + Math.PI / 2 + 0.6, 0)), one); pim.setMatrixAt(i, m4); fim.setMatrixAt(i, m4);
    });
    pim.castShadow = fim.castShadow = true; scene.add(pim, fim);
    const kerbs = []; for (let s = -20; s < END_S + 80; s += 1) for (const side of [-1, 1]) kerbs.push({ s, side });
    const kim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.18, 0.95), new THREE.MeshStandardMaterial({ roughness: 0.6 }), kerbs.length);
    kerbs.forEach((K, i) => {
      const f = frame(K.s), p = f.p.clone().addScaledVector(f.r, K.side * (ROAD_W / 2 + 0.12)).setY(0.09);
      m4.compose(p, q.setFromEuler(new THREE.Euler(0, Math.atan2(f.t.x, f.t.z), 0)), one); kim.setMatrixAt(i, m4);
      kim.setColorAt(i, new THREE.Color(Math.round(K.s) % 2 ? 0xf6c32e : 0x9b1218));
    });
    kim.receiveShadow = true; scene.add(kim);
  }

  // milestones and their objects
  const items = STONES.map((m) => {
    const f = frame(m.d), stone = makeStone(m);
    stone.position.copy(f.p).addScaledVector(f.r, m.side * (ROAD_W / 2 + 1.3));
    stone.rotation.y = Math.atan2(-f.t.x, -f.t.z) + m.side * -0.45;          // face oncoming traffic, turned toward the road
    scene.add(stone);
    const prop = buildProp(m.prop, { flagTex });
    const P = { board: [0.8, 8.3], tin: [0.8, 7.9], leaf: [0.6, 8.0], boat: [2.5, 10.2], books: [0.8, 7.9], truck: [5.5, 11.2], ballot: [0.8, 7.9], flag: [3, 8.6], stage: [26, 40], paddy: [5, 14.5] }[m.prop];
    if (['tin', 'books', 'ballot', 'leaf'].includes(m.prop)) prop.group.scale.setScalar(1.3);
    const pf = frame(m.d + P[0]);
    prop.group.position.copy(pf.p).addScaledVector(pf.r, m.side * P[1]);
    if (m.prop === 'stage') { const dir = pf.t.clone().multiplyScalar(-0.6).addScaledVector(pf.r, -m.side); prop.group.rotation.y = Math.atan2(dir.x, dir.z); }
    else prop.group.rotation.y += Math.atan2(-pf.t.x, -pf.t.z) + m.side * -0.5;
    scene.add(prop.group);
    const bb = new THREE.Box3().setFromObject(prop.group), riseH = bb.max.y + 0.2;
    const FY = { stage: [0.45, 4.5], flag: [0.45, 2.6], truck: [0.5, 1.6], paddy: [0.4, 1.0] }[m.prop] || [0.45, 1.1];
    const focus = stone.position.clone().lerp(prop.group.position, FY[0]).setY(FY[1]);
    return { ...m, stone, prop, focus, riseH };
  });

  // trees: palms and neem along both sides, thinning near the milestones so they stay clear
  const tA = treeAtlas(), tTex = new THREE.CanvasTexture(tA.canvas); tTex.colorSpace = THREE.SRGBColorSpace;
  const trees = [], r = rng(77);
  for (let s = -30; s < END_S + 120; s += 1.6) for (const side of [-1, 1]) {
    if (r() < 0.45) continue;
    const off = ROAD_W / 2 + 4 + Math.pow(r(), 1.6) * 70;
    const nearStone = STONES.some((m) => m.side === side && Math.abs(s - m.d - 2) < 9 && off < 16) || (Math.abs(s - STONES[8].d - 20) < 34 && side === STONES[8].side && off < 60) || (Math.abs(s - STONES[9].d - 4) < 12 && side === STONES[9].side && off < 22);
    if (nearStone || (s > END_S + 6 && off < 26 + (s - END_S) * 0.6)) continue;
    const [za, zb, zt] = zoneBlend(s), Z = ZONES[r() < zt ? zb : za];
    if (r() > Z.trees[0]) continue;
    if (za <= 2 && zb <= 2 && off < 24) continue;                                           // town and city: buildings line the road
    if ((za === 3 || zb === 3) && side === STONES[3].side && off > 20 && s > STONES[3].d - 70 && s < STONES[3].d + 60) continue;   // the sea
    const W = Z.trees[1], tot = Object.values(W).reduce((a, b) => a + b, 0); let pick = r() * tot, kind = 'palm';
    for (const [k, v] of Object.entries(W)) { if ((pick -= v) <= 0) { kind = k; break; } }
    const cell = { palm: Math.floor(r() * 5), broad: 5 + Math.floor(r() * 2), banana: 8 + Math.floor(r() * 2), casuarina: 10 + Math.floor(r() * 2) }[kind];
    const h = { palm: 9 + r() * 7, broad: 7 + r() * 4, banana: 4 + r() * 2, casuarina: 12 + r() * 6 }[kind];
    const p = at(s, side, off);
    trees.push({ x: p.x, z: p.z, w: h, h, cell, phase: r(), shade: 0.85 + r() * 0.2 });
  }
  const treeMat = billboardMaterial(tTex, [tA.cols, tA.rows], { color: 0xffffff, sway: 1 });
  const zones = buildZones(scene, { frame, at, STONES, ROAD_W, END_S, flagTex });
  scene.add(billboards(trees, treeMat));

  // the crowd: a handful in 1992, swelling to a sea at Vikravandi, walking on toward the sunrise at the end
  const pA = peopleAtlas(), pTex = new THREE.CanvasTexture(pA.canvas); pTex.colorSpace = THREE.SRGBColorSpace;
  const people = [], pr = rng(1992);
  const density = (s) => 0.12 + 1.6 * sm(-10, STONES[9].d + 40, s) ** 1.4;           // people per metre per side
  const addPerson = (p, scale = 1) => { const cell = Math.floor(pr() * pA.cols * pA.rows), h = (pA.meta[cell].kid ? 1.15 : 1.75) * scale * (0.92 + pr() * 0.16); people.push({ x: p.x, z: p.z, w: h * pA.aspect * 1.0, h, cell, phase: pr(), shade: 0.9 + pr() * 0.15 }); };
  for (let s = 0; s < END_S + 30; s += 1) for (const side of [-1, 1]) {
    const n = density(s) * (0.6 + pr() * 0.8);
    for (let k = 0; k < Math.floor(n + pr()); k++) {
      const off = ROAD_W / 2 + 2.4 + Math.pow(pr(), 1.5) * (4 + density(s) * 10);
      const clear = STONES.some((m) => m.side === side && s > m.d - 6 && s < m.d + (m.prop === 'truck' ? 14 : 8) && off < (m.prop === 'paddy' ? 21 : 11.5));
      if (!clear) addPerson(at(s + pr(), side, off));
    }
  }
  { // Vikravandi: a dense field between the road and the stage, phone torches above it
    const m = STONES[8];
    for (let i = 0; i < 2600; i++) {
      const s = m.d - 8 + pr() * 62, off = ROAD_W / 2 + 3 + pr() * 32;
      const sf = frame(m.d + 26), stageP = sf.p.clone().addScaledVector(sf.r, m.side * 40);
      const p = at(s, m.side, off); if (p.distanceTo(stageP) < 13) continue;
      if (s < m.d + 6 && off < 11) continue;
      addPerson(p);
    }
  }
  for (let i = 0; i < 260; i++) {
    const s = END_S + 7 + Math.pow(pr(), 0.7) * 90, off = (pr() - 0.5) * (ROAD_W + 6 + (s - END_S) * 0.3);
    if (Math.abs(off - LANE) < 1.2 && s < END_S + 14) continue;
    addPerson(at(s, 1, off));
  }
  const crowdMat = billboardMaterial(pTex, [pA.cols, pA.rows], { color: 0xffffff, bob: 1 });
  scene.add(billboards(people, crowdMat));
  // marigold petals and confetti drifting down around the camera
  const petN = 700, pg = new THREE.BufferGeometry(), pp = new Float32Array(petN * 3), pc = new Float32Array(petN * 3), ph = new Float32Array(petN), dr = rng(3);
  const pcols = [0xff8c00, 0xffb300, 0xffd23f, 0xc8161d, 0xffffff, 0xff6f00].map((c) => new THREE.Color(c));
  for (let i = 0; i < petN; i++) { pp.set([(dr() - 0.5) * 34, dr() * 9, (dr() - 0.5) * 40], i * 3); pcols[Math.floor(dr() * pcols.length)].toArray(pc, i * 3); ph[i] = dr(); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); pg.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const petalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uAmt: { value: 0.3 }, uPx: { value: 1 } },
    vertexShader: `attribute vec3 color; attribute float phase; uniform float uTime, uAmt, uPx; varying vec3 vC; varying float vA, vR;
      void main(){ vec3 p = position; float t = uTime * (0.35 + phase * 0.3) + phase * 20.0;
        p.y = mod(position.y - t * 1.2, 9.0); p.x += sin(t * 1.3 + phase * 9.0) * 0.6; p.z += cos(t * 0.9 + phase * 5.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vC = color; vR = t * 3.0; vA = step(phase, uAmt) * smoothstep(0.0, 1.5, p.y) * smoothstep(9.0, 7.5, p.y);
        gl_PointSize = uPx * 70.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA, vR;
      void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), k = cos(vR); c = vec2(c.x * k - c.y * s, c.x * s + c.y * k);
        float d = length(c * vec2(1.0, 2.2)); if (d > 0.5 || vA < 0.01) discard; gl_FragColor = vec4(vC * (0.85 + 0.3 * c.y), vA); }`,
  });
  const petals = new THREE.Points(pg, petalMat); petals.frustumCulled = false; scene.add(petals);

  // reflections for the metal props: the sky itself, re-captured as the dawn comes up
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial());
  envScene.add(envSky); const envCache = new Map();
  const envFor = (k) => { if (!envCache.has(k)) { const u = envSky.material.uniforms, S = ZONES[k].sky; u.uTop.value.set(S[0]); u.uHor.value.set(S[1]); u.uGlow.value.set(S[2]); u.uHillFar.value.set(S[3]); u.uHillNear.value.set(S[4]); u.uOver.value = ZONES[k].over; envCache.set(k, pmrem.fromScene(envScene, 0.02).texture); } return envCache.get(k); };

  /* ---------- camera rig ---------- */
  const view = { aspect: 1, phone: false, baseFov: 48 };
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(), mouse = { x: 0, y: 0 };
  function weights(s) { return items.map((m) => sm(m.d - 17, m.d - 11, s) * (1 - sm(m.d - 5, m.d - 1, s))); }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function rig(s) {
    const w = weights(s); let k = 0; w.forEach((v, i) => { if (v > w[k]) k = i; });
    const wk = w[k], m = items[k], we = wk * wk * (3 - 2 * wk);
    const f = frame(s), fa = frame(s + 18);
    const lane = LANE + m.side * we * (view.phone ? 0.9 : 0.5);
    camera.position.copy(f.p).addScaledVector(f.r, lane).setY(1.65 + Math.sin(s * 1.1) * 0.012 + we * 0.15);
    camera.fov = view.baseFov * (1 - 0.18 * we); camera.updateProjectionMatrix();
    // a: looking down the road; b: the milestone framed on one third (on phones: centred, upper half)
    const ahead = fa.p.clone().addScaledVector(fa.r, LANE).setY(1.35);
    camera.lookAt(ahead); qa.copy(camera.quaternion);
    camera.lookAt(m.focus);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tanH = tanV * camera.aspect;
    if (view.phone) camera.rotateX(-Math.atan(0.24 * tanV));
    else camera.rotateY(Math.atan((m.side < 0 ? -0.3 : 0.3) * tanH));
    qb.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(qa, qb, we);
    const endK = sm(END_S - 50, END_S, s);                       // finale: tilt up toward the sunrise
    camera.rotateX(endK * 0.06);
    camera.rotateY(-mouse.x * 0.035); camera.rotateX(-mouse.y * 0.02);
    return { k, w: wk };
  }

  const C = (h) => new THREE.Color(h), Z = {};

  function render(s, time = 0) {
    s = Math.max(0, Math.min(END_S, s));
    const D = zoneParams(zoneBlend, s, Z), cur = Z;
    const U = sky.material.uniforms; U.uTop.value.copy(cur.top); U.uHor.value.copy(cur.hor); U.uGlow.value.copy(cur.glow); U.uHillFar.value.copy(cur.far); U.uHillNear.value.copy(cur.near);
    U.uTime.value = time; U.uGold.value = sm(1.2, 0.1, D.el); U.uCloud.value = D.cloud; U.uOver.value = D.over;
    // sun direction: azimuth measured from straight down the road (-z), elevation in radians
    const sunDir = new THREE.Vector3(Math.sin(D.az) * Math.cos(D.el), Math.sin(D.el), -Math.cos(D.az) * Math.cos(D.el)).normalize(); U.uSun.value.copy(sunDir);
    U.uSunVis.value = 1;
    const hor = cur.hor.clone().lerp(cur.far, 0.2);
    scene.fog.color.copy(hor); scene.fog.near = D.fogNear; scene.fog.far = D.fogFar;
    hemi.color.copy(cur.top).lerp(C(0xffffff), 0.55); hemi.groundColor.set(0x6d7a3c).lerp(cur.near, 0.4); hemi.intensity = D.hemi;
    sun.color.copy(cur.light); sun.intensity = D.sunI;

    const R = rig(s);
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 120); sun.target.position.copy(camera.position).add(tmp.set(0, 0, -14).applyQuaternion(camera.quaternion).setY(0));

    const env = envFor(D.k); scene.environment = env; scene.environmentIntensity = 0.55;
    zones.update(time, s, Z, camera, scene.fog, sunDir, renderer.getPixelRatio() * (view.h || 800) / 800);
    [treeMat, crowdMat].forEach((mt) => {
      mt.uniforms.uTime.value = time; mt.uniforms.uFogColor.value.copy(hor); mt.uniforms.uFog.value.set(scene.fog.near, scene.fog.far);
      mt.uniforms.uLight.value.copy(cur.light).multiplyScalar(0.95); mt.uniforms.uRim.value.setRGB(0, 0, 0);
    });
    flagWave.uT.value = time;
    items.forEach((m) => {                                       // each object rises out of the ground as the road reaches it
      const x = sm(m.d - 36, m.d - 19, s), e = x === 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
      // Props carry lights (lamp, headlights). Hiding them would change the number of lights in the scene, which makes
      // three.js recompile every lit material on the spot (a visible freeze mid-scroll). So they stay "on" and are
      // parked far underground, out of every light's reach, until the road gets near.
      m.prop.group.position.y = x > 0 ? -(1 - e) * m.riseH : -400;
    });
    items.forEach((m) => m.prop.update && m.prop.update(time, 1 - sm(30, 110, Math.abs(s - m.d))));
    // petals: a light drift everywhere, a shower at each milestone and at the finale
    petals.position.copy(camera.position).setY(0);
    petalMat.uniforms.uTime.value = time; petalMat.uniforms.uPx.value = renderer.getPixelRatio() * (view.h || 800) / 800;
    petalMat.uniforms.uAmt.value = Math.min(1, D.petals + R.w * 0.45 * (1 - D.rain) + sm(END_S - 40, END_S, s) * 0.8);
    renderer.render(scene, camera);
    return R;
  }

  function resize(w, h) {
    renderer.setSize(w, h, false); camera.aspect = w / h; view.aspect = w / h; view.phone = w / h < 0.8; view.h = h;
    view.baseFov = view.phone ? 64 : 48; camera.fov = view.baseFov; camera.updateProjectionMatrix();
  }
  return { render, resize, mouse, weights, items, renderer, scene, camera };
}
