// Our Journey: a pinned scroll track drives the camera down the Milestone Road.
// Scroll maps to distance with a pause ("dwell") at each milestone, where that year's card shows.
import * as THREE from 'three';
import { createJourneyScene, STONES, END_S, sm } from './journeyScene.js';
import { setFence } from '../../fence.js';

const track = document.getElementById('journey');
const stage = document.getElementById('journey-stage');
const cardsEl = document.getElementById('journey-cards');
const railEl = document.getElementById('journey-rail');
const intro = document.getElementById('journey-intro');
const outro = document.getElementById('journey-outro');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// scroll progress -> distance along the road
const KEYS = []; {
  const segs = [{ w: 0.5, a: 0, b: 0, ease: false }];
  let s = 0;
  for (const m of STONES) { segs.push({ w: 1, a: s, b: m.d - 12, ease: true }); segs.push({ w: 1.25, a: m.d - 12, b: m.d - 6, ease: false, dwell: true }); s = m.d - 6; }
  segs.push({ w: 1.5, a: s, b: END_S - 4, ease: true }, { w: 0.7, a: END_S - 4, b: END_S, ease: false });
  const tot = segs.reduce((a, g) => a + g.w, 0); let p = 0;
  for (const g of segs) { KEYS.push({ p0: p / tot, p1: (p + g.w) / tot, ...g }); p += g.w; }
}
// the scroll progress at the end of each milestone's dwell: the page is held there until that card has been read
const DWELL_END = KEYS.filter((k) => k.dwell).map((k) => k.p1);
const INTRO_END = KEYS[0].p1;
const distAt = (p) => { const k = KEYS.find((k) => p <= k.p1) || KEYS[KEYS.length - 1]; const q = (p - k.p0) / (k.p1 - k.p0 || 1); return k.a + (k.b - k.a) * (k.ease ? sm(0, 1, q) : Math.min(1, Math.max(0, q))); };

async function loadFonts() {
  const faces = [new FontFace('StoneTa', 'url(data:font/woff2;base64,__NST700_B64__)', { weight: '700' }), new FontFace('StoneEn', 'url(data:font/woff2;base64,__CINZEL700_B64__)', { weight: '700' })];
  await Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))));
}
function loadFlag() {
  return new Promise((res) => { const t = new THREE.TextureLoader().load('data:image/webp;base64,__FLAG_B64__', () => res(t)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });
}

// cards and the year rail
STONES.forEach((m, k) => {
  const c = document.createElement('article'); c.className = 'card ' + (m.side < 0 ? 'right' : 'left'); c.dataset.k = k;
  c.innerHTML = `<p class="yr" aria-hidden="true">${m.year}</p><p class="no">${String(k + 1).padStart(2, '0')} / 10</p><h3 class="ta" lang="ta">${m.ta}</h3><p class="en">${m.en}</p><p class="desc">${m.desc}</p>`;
  cardsEl.appendChild(c);
  const r = document.createElement('li'); r.innerHTML = `<i></i><span>${m.year}</span>`; railEl.appendChild(r);
});
const cards = [...cardsEl.children], ticks = [...railEl.children];

Promise.all([loadFonts(), loadFlag()]).then(([, flagTex]) => {
  const fx = createJourneyScene(stage, { flagTex });
  const size = () => { const r = stage.getBoundingClientRect(); fx.resize(r.width, r.height); };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', (e) => { fx.mouse.x = (e.clientX / innerWidth) * 2 - 1; fx.mouse.y = (e.clientY / innerHeight) * 2 - 1; });
  const progress = () => { const r = track.getBoundingClientRect(), max = track.offsetHeight - innerHeight; return max > 0 ? Math.min(1, Math.max(0, -r.top / max)) : 0; };

  let s = distAt(progress()), last = performance.now(), clock = 0, shown = -1;
  // ---------- reading holds: intro title, each milestone card, then the closing title ----------
  const READ_SEC = 1.6, seen = { intro: 0, outro: 0, cards: STONES.map(() => 0) };
  const fenceY = (p) => track.getBoundingClientRect().top + scrollY + p * (track.offsetHeight - innerHeight);
  function holds(dt) {
    if (shown >= 0) seen.cards[shown] += dt;
    if (intro.classList.contains('in')) seen.intro += dt;
    if (outro.classList.contains('in')) seen.outro += dt;
    let p = null;
    if (seen.intro < 1.2) p = INTRO_END;
    else { const k = seen.cards.findIndex((v) => v < READ_SEC); if (k >= 0) p = DWELL_END[k]; else if (seen.outro < 1.4) p = 1; }
    setFence('journey', p === null ? null : fenceY(p));
  }
  const ui = (s) => {
    const w = fx.weights(s); let k = -1, best = 0.55; w.forEach((v, i) => { if (v > best) { best = v; k = i; } });
    if (k !== shown) { cards.forEach((c, i) => c.classList.toggle('in', i === k)); shown = k; }
    const passed = STONES.filter((m) => s >= m.d - 12).length;
    ticks.forEach((t, i) => { t.classList.toggle('on', i < passed); t.classList.toggle('now', i === passed - 1); });
    railEl.style.setProperty('--fill', String(Math.max(0, passed - 1) / 9));
    intro.classList.toggle('in', s < 5);
    outro.classList.toggle('in', s > END_S - 22);
    railEl.classList.toggle('in', s > 5 && s < END_S - 22);
  };
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); clock += dt;
    if (!window.__journeyPause) {
      const target = distAt(progress());
      s = reduceMotion ? target : s + (target - s) * (1 - Math.exp(-dt * 3.2));
      fx.render(s, clock); ui(s); holds(dt);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__journey = { fx, render: (d, t = 0) => { fx.render(d, t); ui(d); }, pause: () => { window.__journeyPause = true; }, STONES, END_S, distAt, get s() { return s; } };
});
