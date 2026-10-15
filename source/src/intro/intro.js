// Intro: the brass whistle (A01) turns in its studio. Press and hold anywhere to blow it: a ring fills,
// the whistle trembles, then it blows (a synthesised pea whistle), gold shock rings burst out and the
// screen opens from the centre like an iris onto the hero. "Skip" opens it straight away.
import * as THREE from 'three';
import { registerRenderer } from '../gpu.js';
import { createWhistle, createStudioEnvironment, contactShadow, makeMaterials } from '../sections/intro/whistle3d.js';

const HOLD_SEC = 1.0;

// a short referee-style pea whistle, made with WebAudio (no audio file)
function whistleSound(ac) {
  const t = ac.currentTime + 0.01, end = t + 0.95;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.28, t + 0.035);
  out.gain.setValueAtTime(0.28, t + 0.62);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  const comp = ac.createDynamicsCompressor(); out.connect(comp).connect(ac.destination);
  const osc = ac.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(2550, t); osc.frequency.exponentialRampToValueAtTime(2850, t + 0.07);
  const osc2 = ac.createOscillator(); osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(5100, t); osc2.frequency.exponentialRampToValueAtTime(5700, t + 0.07);
  // the pea rattling: fast vibrato + tremolo
  const lfo = ac.createOscillator(); lfo.frequency.value = 42;
  const fm = ac.createGain(); fm.gain.value = 160; lfo.connect(fm); fm.connect(osc.frequency);
  const fm2 = ac.createGain(); fm2.gain.value = 320; lfo.connect(fm2); fm2.connect(osc2.frequency);
  const am = ac.createGain(); am.gain.value = 0.72; const amd = ac.createGain(); amd.gain.value = 0.28; lfo.connect(amd); amd.connect(am.gain);
  const h2 = ac.createGain(); h2.gain.value = 0.12;
  osc.connect(am); osc2.connect(h2); h2.connect(am); am.connect(out);
  // breath
  const len = Math.ceil(ac.sampleRate * 1.0), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2900; bp.Q.value = 1.4;
  const ng = ac.createGain(); ng.gain.value = 0.16; noise.connect(bp).connect(ng).connect(out);
  for (const n of [osc, osc2, lfo, noise]) { n.start(t); n.stop(end + 0.05); }
}

export function startIntro({ onReveal, onDone }) {
  const root = document.getElementById('intro');
  const host = document.getElementById('intro-stage');
  const ring = document.getElementById('intro-ring');
  const skipBtn = document.getElementById('intro-skip');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = registerRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }), { name: 'intro' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const envTex = createStudioEnvironment(renderer);
  scene.environment = envTex;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const whistle = createWhistle(makeMaterials());
  const spin = new THREE.Group(), float = new THREE.Group();
  float.add(whistle); spin.add(float); scene.add(spin);
  whistle.rotation.set(0.12, -0.55, 0.04);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.4);
  key.position.set(-3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key);
  const floorY = -1.55;
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.28 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = floorY; catcher.receiveShadow = true; scene.add(catcher);
  const blob = contactShadow(4.4, 2.0); blob.position.y = floorY + 0.002; scene.add(blob);

  let baseDist = 6;
  function frame() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const size = whistle.userData.size, vFov = THREE.MathUtils.degToRad(camera.fov);
    const fitH = (size.y * 3.5) / (2 * Math.tan(vFov / 2));
    const fitW = (size.x * (camera.aspect < 1 ? 1.6 : 1.9)) / (2 * Math.tan(vFov / 2) * camera.aspect);
    baseDist = Math.max(fitH, fitW, 4.8);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', frame); frame();

  // ---------- hold to blow ----------
  let holding = false, hold = 0, blown = false, tBlow = -1, ac = null, closing = false;
  const audio = () => {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
  };
  // the intro is also the loader: holding only works once every section has been built and warmed up
  let isReady = false, loadP = 0;
  const label = root.querySelector('.i-btn b'), say = root.querySelector('.i-say');
  const down = (e) => { if (blown || e.target.closest('#intro-skip')) return; audio(); if (!isReady) return; holding = true; root.classList.add('holding'); };
  const up = () => { holding = false; root.classList.remove('holding'); };
  root.addEventListener('pointerdown', down);
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  const kd = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !e.target.closest?.('#intro-skip')) { e.preventDefault(); down(e); } };
  const ku = (e) => { if (e.key === ' ' || e.key === 'Enter') up(); };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  skipBtn.addEventListener('click', () => { if (!blown && isReady) { blown = true; tBlow = clock.elapsedTime - 0.3; root.classList.add('blown', 'skipped'); } });

  function blow() {
    blown = true; tBlow = clock.elapsedTime; holding = false;
    root.classList.remove('holding'); root.classList.add('blown');
    if (ac) { try { whistleSound(ac); } catch (e) { /* no sound */ } }
    try { navigator.vibrate?.([40, 30, 90]); } catch (e) { /* ignore */ }
  }

  const ringLen = 2 * Math.PI * 46;
  ring.style.strokeDasharray = String(ringLen);
  const clock = new THREE.Clock();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!blown) {
      hold = Math.min(1, Math.max(0, hold + (holding ? dt / HOLD_SEC : -dt * 1.8)));
      if (hold >= 1) blow();
    }
    ring.style.strokeDashoffset = String(ringLen * (1 - (blown ? 1 : isReady ? hold : loadP)));
    const e = blown ? t - tBlow : 0;                                       // seconds since the blow
    const shake = blown ? Math.max(0, 1 - e / 0.9) : hold * hold;
    // turntable slows as you hold, then the whistle swings to face you and trembles
    spin.rotation.y += dt * (reduceMotion ? 0 : 0.45 * (1 - hold * 0.85));
    float.position.y = (reduceMotion ? 0 : Math.sin(t * 1.1) * 0.06) + 0.05 * hold;
    float.rotation.z = Math.sin(t * 0.7) * 0.03 + Math.sin(t * 53) * 0.035 * shake;
    float.rotation.x = Math.sin(t * 61) * 0.025 * shake;
    float.position.x = Math.sin(t * 71) * 0.03 * shake;
    const s = 1 + 0.07 * hold + 0.1 * sm(0, 0.12, e) - 0.04 * sm(0.12, 0.5, e);
    float.scale.setScalar(s);
    scene.environmentRotation.y = Math.sin(t * 0.18) * 0.5 + hold * 0.6;
    // after the blow the camera rushes past the whistle as the iris opens
    const fly = sm(0.3, 1.4, e);
    camera.position.setFromSphericalCoords(baseDist * (1 - 0.72 * fly), 1.18 - 0.1 * fly, 0.35);
    camera.lookAt(0, -0.32 * (1 - fly) + 0.1 * fly, 0);
    const k = 1 - (float.position.y + 0.06) * 2.2;
    blob.scale.set(0.9 + 0.1 * k, 1, 0.9 + 0.1 * k);
    blob.material.opacity = 0.75 + 0.25 * k;
    renderer.render(scene, camera);
    // iris: a hole grows from the centre and reveals the site underneath
    if (blown) {
      const r = Math.pow(sm(0.28, 1.35, e), 1.6) * 150;
      root.style.setProperty('--r', r.toFixed(2) + 'vmax');
      if (e > 0.28 && !closing) { closing = true; onReveal && onReveal(); }
      if (e > 1.45) finish();
    }
  };
  function finish() {
    cancelAnimationFrame(raf);
    removeEventListener('resize', frame); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku);
    root.remove();
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    envTex.dispose?.(); renderer.dispose(); renderer.forceContextLoss();
    onDone && onDone();
  }
  tick();
  root.classList.add('loading'); label.textContent = 'Loading'; say.setAttribute('aria-live', 'polite');
  const api = {
    progress(p) { loadP = Math.max(loadP, p); },
    ready() { isReady = true; root.classList.remove('loading'); label.textContent = 'Hold'; hold = 0; },
  };
  window.__intro = { blow: () => { audio(); isReady = true; blow(); }, skip: () => skipBtn.click(), get hold() { return hold; }, get ready() { return isReady; } };
  return api;
}
