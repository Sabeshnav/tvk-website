// Real-time 3D brass referee whistle, built entirely in code (three.js).
// Geometry: lathed barrel with a stamped face, tapered mouthpiece, bite guard,
// a sound window and mouth slot cut with CSG, an eyelet and a split ring.
// Material: lacquered brass (physical metal + clearcoat) lit by a studio
// environment of soft boxes, so the shine moves as the whistle turns.
import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const R = 1;        // barrel radius
const H = 0.42;     // half the barrel's thickness
const L = 2.25;     // mouthpiece length, from barrel centre to tip
const MW = 0.74;    // mouthpiece width at the barrel
const MH = 0.60;    // mouthpiece height at the barrel
const BEVEL = 0.04;

/* ---------- textures made in code ---------- */
function noiseTexture(size = 512, seed = 7) {
  // fine polishing marks + faint mottling, used as a roughness map
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(118,118,118)';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {               // soft mottling
    const v = 100 + rand() * 50;
    g.fillStyle = `rgba(${v},${v},${v},0.05)`;
    g.beginPath();
    g.arc(rand() * size, rand() * size, 4 + rand() * 30, 0, Math.PI * 2);
    g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {                 // hairline polishing scratches
    const x = rand() * size, y = rand() * size, len = 8 + rand() * 60, a = rand() * Math.PI;
    const v = rand() < 0.5 ? 70 : 170;
    g.strokeStyle = `rgba(${v},${v},${v},${0.10 + rand() * 0.16})`;
    g.lineWidth = 0.6 + rand() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ---------- materials ---------- */
export function makeMaterials() {
  const rough = noiseTexture();
  const brass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e4bb63'),
    metalness: 1,
    roughness: 0.2,
    roughnessMap: rough,
    clearcoat: 0.55,             // lacquer layer gives the second, sharper highlight
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.15,
  });
  const brassRing = brass.clone();
  brassRing.roughness = 0.28;
  brassRing.clearcoat = 0.25;
  const interior = new THREE.MeshStandardMaterial({ color: new THREE.Color('#20150a'), metalness: 0.5, roughness: 0.65 });
  return { brass, brassRing, interior };
}

/* ---------- geometry pieces ---------- */
function barrelGeometry() {
  // radius-vs-height profile, lathed around Y, then turned so the faces point along Z
  const face = [
    [0.0, 0.014], [0.47, 0.014], [0.5, 0.004], [0.56, 0.0], [0.585, -0.012], [0.615, -0.012],
    [0.64, 0.0], [0.84, 0.0], [0.865, 0.016], [0.9, 0.024], [0.95, 0.024], [0.975, 0.012],
  ];
  const pts = [];
  const V = (r, y) => pts.push(new THREE.Vector2(Math.max(r, 0.0005), y));
  // bottom face, from the axis outwards (y = -H - bump)
  face.forEach(([r, d]) => V(r, -H - d));
  // rounded edge: (0.975, -H-0.012) curving into the wall at (1, -H+0.048)
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; V(0.975 + 0.025 * Math.sin(a), -H + 0.048 - 0.06 * Math.cos(a)); }
  for (let i = 1; i < 8; i++) V(R, -H + 0.048 + (i / 8) * (2 * H - 0.096));
  for (let i = 8; i >= 1; i--) { const a = (i / 8) * Math.PI / 2; V(0.975 + 0.025 * Math.sin(a), H - 0.048 + 0.06 * Math.cos(a)); }
  // top face, from the rim back to the axis
  face.slice().reverse().forEach(([r, d]) => V(r, H + d));
  const g = new THREE.LatheGeometry(pts, 160);
  g.rotateX(Math.PI / 2);
  return g;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const taperY = (t) => 1 - 0.2 * t;   // the mouthpiece gets thinner towards the tip
const taperZ = (t) => 1 - 0.16 * t;

function mouthpieceGeometry(len = L, from = 0, inflate = 0) {
  const g = new THREE.ExtrudeGeometry(roundedRect(MW + inflate, MH + inflate, 0.15 + inflate / 2), {
    depth: len, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 5, curveSegments: 10, steps: Math.max(2, Math.round(len * 10)),
  });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i) + from;
    const t = THREE.MathUtils.clamp(sz / L, 0, 1);
    const ky = taperY(t), kz = taperZ(t);
    const top = (MH + inflate) / 2 + BEVEL;
    const yTop = 1 + inflate / 2;
    p.setXYZ(i, -sz, yTop - top * ky + sy * ky, sx * kz);
  }
  // weld the extrusion so its rounded corners shade smoothly
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const w = mergeVertices(g, 1e-4);
  w.computeVertexNormals();
  w.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(w.attributes.position.count * 2), 2));
  return w;
}

function prep(g) {
  g.clearGroups && g.clearGroups();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  return g;
}

/** Builds the whistle. Returns a THREE.Group centred on its middle. */
export function createWhistle(mats = makeMaterials()) {
  const evaluator = new Evaluator();
  evaluator.useGroups = true;
  evaluator.attributes = ['position', 'normal', 'uv'];

  const barrel = new Brush(prep(barrelGeometry()), mats.brass);
  const mouth = new Brush(prep(mouthpieceGeometry()), mats.brass);
  const guard = new Brush(prep(mouthpieceGeometry(0.13, L - 0.27, 0.07)), mats.brass);
  [barrel, mouth, guard].forEach((b) => b.updateMatrixWorld());

  let body = evaluator.evaluate(barrel, mouth, ADDITION);
  body = evaluator.evaluate(body, guard, ADDITION);

  // sound window: an angled cut in the top where the mouthpiece meets the barrel
  const win = new Brush(prep(new THREE.BoxGeometry(0.44, 0.52, 0.5)), mats.interior);
  win.position.set(-0.4, 1.02, 0);
  win.rotation.z = -0.38;
  win.updateMatrixWorld();
  body = evaluator.evaluate(body, win, SUBTRACTION);

  // mouth slot at the tip
  const tipH = MH * taperY(1);
  const slot = new Brush(prep(new THREE.BoxGeometry(0.7, tipH * 0.17, MW * taperZ(1) * 0.78)), mats.interior);
  slot.position.set(-L - 0.12, 1 - tipH / 2 - BEVEL * taperY(1), 0);
  slot.updateMatrixWorld();
  body = evaluator.evaluate(body, slot, SUBTRACTION);

  body.castShadow = true;
  body.receiveShadow = true;

  const group = new THREE.Group();
  group.add(body);

  // eyelet under the mouthpiece, and a two-coil split ring through it
  const tipBottom = 1 - (MH * taperY(0.82) + 2 * BEVEL);
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 16, 48), mats.brass);
  eyelet.position.set(-1.78, tipBottom - 0.04, 0);
  eyelet.castShadow = true;
  group.add(eyelet);

  const ring = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 20, 120), mats.brassRing);
    coil.position.z = (i - 0.5) * 0.068;
    coil.castShadow = true;
    ring.add(coil);
  }
  ring.position.set(-1.78, tipBottom - 0.04 - 0.3 + 0.03, 0);
  ring.rotation.set(0.25, 1.05, 0.12);
  group.add(ring);

  // centre the whole object
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  group.children.forEach((ch) => ch.position.sub(c));
  group.userData.size = box.getSize(new THREE.Vector3());
  return group;
}

/** A studio of soft boxes, turned into reflections for the metal. */
export function createStudioEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.085, 0.07, 0.06), side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, color, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  const hdr = (r, g, b) => new THREE.Color(r, g, b);
  panel(10, 3.4, hdr(5.5, 5.2, 4.8), [0, 6.6, 1], [0, 0, 0]);         // big top softbox
  panel(9, 5, hdr(2.4, 2.1, 1.8), [0, 2.2, 10], [0, 0, 0]);           // large soft front box (behind the camera): lights the faces
  panel(1.1, 9, hdr(10, 9.8, 9.4), [-8, 0.5, 2], [0, 0, 0]);          // long white strip, left
  panel(1.4, 9, hdr(9, 6.4, 3.6), [8, 0.5, -1], [0, 0, 0]);           // warm strip, right
  panel(7, 2.4, hdr(1.8, 1.7, 1.6), [0, 1, -10], [0, 0, 0]);          // back panel
  panel(4, 6, hdr(2.2, 1.9, 1.5), [7, 1.5, 7], [0, 0, 0]);            // soft box front-right, warms the faces
  panel(16, 16, hdr(0.16, 0.06, 0.05), [0, -6.8, 0], [0, 0, 0]);      // dim warm floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

/** Soft contact shadow texture (cheap on phones). */
export function contactShadow(width = 4.2, depth = 1.8) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 64, 4, 128, 64, 120);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
