// The site shell: the intro (which doubles as the loader), the sections, the scroll controller, the top bar,
// chapter dots, the phone menu, bridges and chapter jumps.
//
// Smoothness rules this file enforces:
//  1. Every section is built and its shaders compiled while the intro is up, one after another,
//     never mid-scroll (building a 3D scene or compiling its shaders freezes the page for a moment).
//  2. A section's animation loop only runs while it is actually on screen, and nothing runs under the intro.
//  3. All wheel/key scrolling goes through one controller (scroller.js), so holds and locks never fight it.
import { renderers, warmUp, warmLog, degrade } from './gpu.js';
import { jumpTo } from './scroller.js';
import { startIntro } from './intro/intro.js';
import { start as startHero } from './sections/hero/_entry.js';
import { start as startLeader } from './sections/leader/_entry.js';
import { start as startKural } from './sections/kural/_entry.js';
import { start as startPledge } from './sections/pledge/_entry.js';
import { start as startJourney } from './sections/journey/_entry.js';
import { start as startJoin } from './sections/join/_entry.js';

const html = document.documentElement;
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// the experience always starts at the top (a reload mid-page would otherwise land inside a locked section)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);
const withIntro = !params.has('nointro');
window.__introUp = withIntro;

// ?perf: per-section frame cost, how many loops run at once, long tasks, draw calls (for diagnosing jank)
const PERF = params.has('perf') ? { sec: {}, frames: [], long: [], starts: {} } : null;
if (PERF) {
  window.__perf = PERF; PERF.warmLog = warmLog;
  PERF.progs = (name) => { const e = renderers.find((x) => x.name === name); return (e.r.info.programs || []).map((p) => [p.name, p.cacheKey || '']); };
  PERF.gl = () => renderers.map((e) => ({ name: e.name, frames: e.frames, calls: e.r.info.render.calls, tris: e.r.info.render.triangles, progs: (e.r.info.programs || []).length, dpr: e.r.getPixelRatio(), px: e.r.domElement.width + 'x' + e.r.domElement.height }));
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => PERF.long.push([Math.round(e.startTime), Math.round(e.duration), Math.round(scrollY)]))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* no longtask api */ }
  let lastT = 0;
  const tick = (t) => { if (lastT) PERF.frames.push([Math.round(t), +(t - lastT).toFixed(1), Math.round(scrollY), Object.keys(PERF.sec).filter((k) => PERF.sec[k].last > t - 40).join('+')]); lastT = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// ---------- per-section animation gate ----------
// A section's requestAnimationFrame only fires while the section is on screen (and the intro is gone).
// Two "warm-up" frames always run right after a section starts, so it draws once while hidden: that compiles
// its shaders and uploads its textures during the intro instead of when the visitor reaches it.
const visibleNow = new Set();
function gate(el) {
  let visible = false, warm = 2; const queue = [];
  const st = PERF ? (PERF.sec[el.id] = { n: 0, ms: 0, max: 0, last: 0 }) : null;
  const run = (cb) => (t) => {
    if (!st) return cb(t);
    const a = performance.now(); cb(t); const d = performance.now() - a; st.n++; st.ms += d; st.max = Math.max(st.max, d); st.last = t;
  };
  const live = () => visible && !window.__introUp;
  const flush = () => { if (live()) queue.splice(0).forEach((cb) => requestAnimationFrame(run(cb))); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) visibleNow.add(el.id); else visibleNow.delete(el.id); flush(); }, { rootMargin: '8% 0px' }).observe(el);
  addEventListener('intro:gone', flush);
  return (cb) => {
    if (warm > 0) { warm--; return requestAnimationFrame(run(cb)); }
    if (live()) return requestAnimationFrame(run(cb));
    queue.push(cb); return 0;
  };
}

// ---------- sections: started in order while the intro is up (or on demand if the visitor gets there first) ----------
const SECTIONS = [
  ['#c-hero', startHero, () => true],
  ['#c-leader', startLeader, () => window.__leader],
  ['#c-kural', startKural, () => window.__kural],
  ['#c-pledge', startPledge, () => window.__pledge],
  ['#c-journey', startJourney, () => window.__journey],
  ['#c-join', startJoin, () => window.__join],
];
const starters = SECTIONS.map(([sel, start, ready]) => {
  const el = $(sel), raf = gate(el);
  let started = false;
  const go = () => {
    if (started) return; started = true;
    const a = performance.now();
    try { start(raf); } catch (err) { console.error(sel, err); }
    if (PERF) PERF.starts[sel] = [Math.round(a), Math.round(performance.now() - a), Math.round(scrollY)];
  };
  // safety net: if the visitor reaches a section before the loader got to it, start it now
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '120% 0px' });
  io.observe(el);
  return { sel, go, ready };
});
// Rehearsal: draw each scene once in each of its key states while the intro is up. Anything that only
// appears later (props rising by the road, the smashed fragments, the newcomer and confetti, the risen leaf)
// gets its shaders compiled and its data uploaded now, not the first time the visitor scrolls to it.
const REHEARSE = {
  '#c-kural': () => { const K = window.__kural; return [1, 5, 9.6, 12, 14, 0].map((t) => () => K.render(t)); },
  '#c-pledge': () => { const P = window.__pledge, n = P.ts.length; return [0.35, 0.45, 1.2, 2, 0].map((t) => () => P.render(Array(n).fill(t), 1)); },
  '#c-journey': () => { const J = window.__journey; return [...J.STONES.map((m) => () => J.fx.render(m.d - 8, 1)), () => J.fx.render(J.END_S, 1), () => J.fx.render(0, 0)]; },
  '#c-join': () => { const J = window.__join; return [[0.5, -1], [0.95, -1], [1, 0.6], [1, 2.5], [1, 6], [0, -1]].map(([p, j]) => () => J.render(p, 3, j)); },
};
async function preload(onProgress) {
  let done = 0;
  for (const s of starters) {
    const before = renderers.length;
    s.go();
    const t0 = performance.now();
    while (!s.ready() && performance.now() - t0 < 20000) await nextFrame();   // builds are async (fonts, textures)
    await nextFrame(); await nextFrame(); await nextFrame();                    // its warm-up frames
    warmUp(renderers.slice(before));                                         // shaders + textures for anything off-camera
    await nextFrame();
    for (const draw of (REHEARSE[s.sel] ? REHEARSE[s.sel]() : [])) { try { draw(); } catch (err) { /* best effort */ } await nextFrame(); }
    onProgress && onProgress(++done / starters.length);
  }
}

// ---------- frame-rate governor ----------
// Watches the real frame rate; if the section on screen can't keep ~45 fps, it drops that section's
// resolution a notch (see gpu.js degrade). Quiet while the intro/loader is up or the tab is hidden.
{
  let lastT = 0, buf = [], coolUntil = 0;
  const tick = (t) => {
    const d = t - lastT; lastT = t;
    if (!window.__introUp && !document.hidden && d > 0 && d < 250) buf.push(d);
    if (buf.length >= 90) {
      const sorted = buf.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1]; buf = [];
      if (med > 22 && t > coolUntil) {
        for (const id of visibleNow) if (degrade(id.replace('c-', ''))) coolUntil = t + 2500;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- intro ----------
const endIntro = () => { html.classList.remove('intro-on'); window.__introUp = false; window.dispatchEvent(new Event('intro:gone')); };
const dropIntro = () => { $('#intro')?.remove(); endIntro(); };
if (!withIntro) { dropIntro(); preload(); }
else {
  try {
    const intro = startIntro({ onReveal: endIntro, onDone: () => {} });
    preload((p) => intro.progress(p)).then(() => intro.ready());
  } catch (err) { console.error('intro', err); dropIntro(); preload(); }   // no WebGL: never leave the visitor stuck behind the intro
}

// ---------- chapters: progress bar, dots, nav highlight, auto-hiding nav ----------
const nav = $('#site-nav'), bar = $('#site-progress');
const CHAPS = ['hero', 'leader', 'ideology', 'journey', 'join'];
const chapTop = { hero: '#c-hero', leader: '#b-leader', ideology: '#b-ideology', journey: '#b-journey', join: '#b-join' };
const jumpTarget = { hero: '#c-hero', leader: '#leader', ideology: '#kural', journey: '#journey', join: '#join' };
const absTop = (el) => el.getBoundingClientRect().top + scrollY;
let lastY = scrollY, current = '';
function onScroll() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  bar.style.setProperty('--p', (max > 0 ? y / max : 0).toFixed(4));
  if (Math.abs(y - lastY) > 6) { nav.classList.toggle('hide', y > lastY && y > 120); lastY = y; }
  let cur = 'hero';
  for (const c of CHAPS) if (y + innerHeight * 0.45 >= absTop($(chapTop[c]))) cur = c;
  if (cur !== current) {
    current = cur;
    document.querySelectorAll('[data-jump]').forEach((a) => { if (a.closest('.links,.dots')) a.setAttribute('aria-current', String(a.dataset.jump === cur)); });
  }
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ---------- bridges fade their titles in ----------
const bio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('in', e.isIntersecting)), { threshold: 0.35 });
document.querySelectorAll('.bridge').forEach((b) => bio.observe(b));

// ---------- phone menu ----------
const sheet = $('#sheet'), menuBtn = $('#menu-btn');
const setMenu = (open) => { sheet.classList.toggle('open', open); sheet.setAttribute('aria-hidden', String(!open)); menuBtn.setAttribute('aria-expanded', String(open)); };
menuBtn.addEventListener('click', () => setMenu(true));
$('#sheet-x').addEventListener('click', () => setMenu(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

// ---------- chapter jumps: a quick maroon-and-gold wipe covers an instant jump ----------
// A jump releases any locked section and lands instantly (scroller.jumpTo).
const curtain = $('#curtain');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function jump(key) {
  const el = $(jumpTarget[key]); if (!el) return;
  setMenu(false);
  const to = key === 'hero' ? 0 : Math.max(0, absTop(el) - 4);
  // the flag stays up until the jump's scroll event has been handled (scroll events fire before the next frame's callbacks)
  const land = () => jumpTo(to);
  if (reduceMotion) { land(); return; }
  curtain.classList.remove('out'); void curtain.offsetWidth; curtain.classList.add('in');
  setTimeout(() => { land(); curtain.classList.remove('in'); curtain.classList.add('out'); }, 400);
  setTimeout(() => curtain.classList.remove('out'), 900);
}
document.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); jump(a.dataset.jump); }));
window.__site = { jump };
