import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWhistle, createStudioEnvironment, contactShadow, makeMaterials } from './whistle3d.js';

const host = document.getElementById('stage');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const mats = makeMaterials();
const whistle = createWhistle(mats);
const spin = new THREE.Group();     // turntable
const float = new THREE.Group();    // gentle bob
float.add(whistle);
spin.add(float);
scene.add(spin);
whistle.rotation.set(0.12, -0.55, 0.04);

// a key light for the cast shadow and one hard specular glint
const key = new THREE.DirectionalLight(0xfff1dc, 1.4);
key.position.set(-3, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
scene.add(key);

const floorY = -1.55;
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.28 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = floorY;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);
const blob = contactShadow(4.4, 2.0);
blob.position.y = floorY + 0.002;
scene.add(blob);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.enableZoom = false;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.75;
controls.target.set(0, 0, 0);

function frame() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // fit the whistle's width on narrow (phone) screens and its height on wide ones
  const size = whistle.userData.size;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const fitH = (size.y * 2.6) / (2 * Math.tan(vFov / 2));
  const fitW = (size.x * (camera.aspect < 1 ? 1.3 : 1.75)) / (2 * Math.tan(vFov / 2) * camera.aspect);
  const dist = Math.max(fitH, fitW, 4.5);
  camera.position.setFromSphericalCoords(dist, 1.18, 0.35);
  camera.updateProjectionMatrix();
  controls.update();
}
window.addEventListener('resize', frame);
frame();

let spinOn = !reduceMotion, lastInteract = -1e9;
controls.addEventListener('start', () => { lastInteract = performance.now(); spinOn = false; });
controls.addEventListener('end', () => { lastInteract = performance.now(); });
const spinBtn = document.getElementById('spin');
spinBtn.addEventListener('click', () => { spinOn = !spinOn; lastInteract = spinOn ? -1e9 : performance.now() + 1e12; spinBtn.setAttribute('aria-pressed', String(spinOn)); spinBtn.textContent = spinOn ? 'Pause spin' : 'Spin'; });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!spinOn && performance.now() - lastInteract > 3500 && !reduceMotion) spinOn = true;
  if (spinOn) spin.rotation.y += dt * 0.45;
  if (!reduceMotion) {
    float.position.y = Math.sin(t * 1.1) * 0.06;
    float.rotation.z = Math.sin(t * 0.7) * 0.03;
    scene.environmentRotation.y = Math.sin(t * 0.18) * 0.5;   // light slowly sweeps across the metal
  }
  const k = 1 - (float.position.y + 0.06) * 2.2;            // shadow softens as it rises
  blob.scale.set(0.9 + 0.1 * k, 1, 0.9 + 0.1 * k);
  blob.material.opacity = 0.75 + 0.25 * k;
  controls.update();
  renderer.render(scene, camera);
});
window.__whistleReady = true;
