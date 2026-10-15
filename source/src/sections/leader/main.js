// Leadership: Vijay's one-swipe slash sequence, then a horizontal carousel of the three leaders.
//   1. The section scrolls into place and locks (blank screen).
//   2. One swipe (wheel / touch / arrow keys) brings the start pose up and the sequence plays on its own:
//      short hold -> slash -> end pose -> glide left -> copy on the right.
//   3. Still locked, each further swipe (down/up, left/right) moves the carousel: Vijay -> Aadhav Arjuna ->
//      N. Anand, with a gold brush wipe between them. Dots and arrows work too.
//   4. A swipe past the last leader releases scrolling and moves on; swiping back from the first one leaves upward.
// Scrolling back above the section resets it, so it replays next time it is reached.
import { createLeaderSlash, TRANSITION, ENTER } from './leaderSlash.js';
import { lock as lockPage, unlock as unlockPage } from '../../scroller.js';
import { setFence } from '../../fence.js';

const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/webp;base64,' + b64; });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const section = document.getElementById('leader');
const canvas = document.getElementById('leader-canvas');
const copy = document.getElementById('leader-copy');
const hint = document.getElementById('leader-hint');
const slidesEl = document.getElementById('leader-slides');
const wipe = document.getElementById('leader-wipe');
const nav = document.getElementById('leader-nav');
const slides = [...slidesEl.children];
const dots = [...nav.querySelectorAll('[data-go]')];
const [prevBtn, nextBtn] = [nav.querySelector('[data-step="-1"]'), nav.querySelector('[data-step="1"]')];
const N = slides.length, SLIDE_DUR = 950, READ_MS = 1700;   // a leader's copy is fully in ~1.5 s after the switch
const isPhone = () => innerWidth / innerHeight < 0.8;

// timeline (seconds from the swipe)
const T_HOLD = ENTER + 0.55;                 // start pose lands, then a beat
const T_SLASH_END = T_HOLD + TRANSITION;     // slash finished, end pose landed
const T_GLIDE = T_SLASH_END + 0.35;          // glide starts
const GLIDE_DUR = 0.8;
const T_COPY = T_GLIDE + GLIDE_DUR * 0.55;   // copy starts coming in
const T_DONE = T_GLIDE + GLIDE_DUR + 0.45;   // sequence finished: the carousel takes over

Promise.all([load('__START_B64__'), load('__END_B64__')]).then(([start, end]) => {
  const fx = createLeaderSlash(canvas, { start, end });
  let cssW = 0;
  const size = () => { const r = canvas.getBoundingClientRect(); cssW = r.width; fx.resize(r.width, r.height); };
  size(); addEventListener('resize', size);

  // ---------- state ----------
  // 'idle' (not reached) | 'armed' (locked, blank, waiting for the swipe) | 'playing' | 'done' (carousel)
  let state = 'idle', t0 = 0, locked = false, lastY = scrollY, slide = 0, movingUntil = 0, readUntil = 0;
  const now = () => performance.now() / 1000;
  const top = () => section.getBoundingClientRect().top + scrollY;

  // ---------- carousel ----------
  function setHint(text, side) {
    hint.querySelector('span').textContent = text;
    hint.classList.toggle('side', !!side);
  }
  function syncUi() {
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === slide)));
    prevBtn.disabled = slide === 0;
    nextBtn.disabled = slide === N - 1 && !locked;
    nextBtn.setAttribute('aria-label', slide === N - 1 && locked ? 'Continue' : 'Next leader');
    if (state === 'done' && locked) { setHint(slide < N - 1 ? 'Swipe for next leader' : 'Swipe to continue', slide < N - 1); hint.classList.add('in'); }
    else if (state === 'done') hint.classList.remove('in');
  }
  function go(k, instant) {
    k = Math.max(0, Math.min(N - 1, k));
    if (k === slide && !instant) return;
    const back = k < slide;
    slide = k;
    slidesEl.style.transition = instant ? 'none' : '';
    slidesEl.style.setProperty('--k', String(k));
    if (instant) { void slidesEl.offsetWidth; slidesEl.style.transition = ''; }
    slides.forEach((s, i) => {
      s.classList.toggle('cur', i === k);
      const c = s.querySelector('.copy');
      if (i === 0) return;
      clearTimeout(s._t);
      if (i === k) s._t = setTimeout(() => c.classList.add('in'), instant ? 0 : 380); else c.classList.remove('in');
    });
    if (!instant && !reduceMotion) { wipe.classList.remove('go', 'back'); void wipe.offsetWidth; wipe.classList.add('go'); wipe.classList.toggle('back', back); }
    movingUntil = performance.now() + (instant ? 0 : SLIDE_DUR);
    readUntil = performance.now() + (instant ? 0 : READ_MS);
    syncUi();
  }
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.go)));
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  // a swipe/arrow/dot that arrives while the current leader is still coming in is kept and applied right after
  let pending = 0, pendingAt = 0;
  function step(dir) {
    const n = performance.now();
    if (n < movingUntil - 250 || (locked && n < readUntil)) { pending = dir; pendingAt = n; return; }
    pending = 0;
    if (dir > 0 && slide < N - 1) go(slide + 1);
    else if (dir < 0 && slide > 0) go(slide - 1);
    else if (locked) release(dir);
  }
  function release(dir) {
    unlock(dir > 0 ? innerHeight : -innerHeight * 0.5); syncUi();
  }

  // ---------- scroll lock (input comes from the shared scroller, which recognises whole swipes) ----------
  function lock() { locked = true; lockPage(owner, top()); }
  function unlock(push = 0) { if (!locked) return; locked = false; unlockPage(push); }
  const owner = {
    gesture(dir) {
      if (state === 'playing' || !dir) return;            // the slash sequence ignores input
      if (state === 'armed') {
        if (dir > 0) { state = 'playing'; t0 = now(); hint.classList.remove('in'); }
        else { state = 'idle'; hint.classList.remove('in'); unlock(-innerHeight * 0.5); }   // swiping back up while blank: let them leave
        return;
      }
      if (state === 'done') step(dir);
    },
  };

  // a chapter jump releases the lock (finishing the sequence instantly if it was mid-way)
  addEventListener('site:jump', () => {
    if (!locked) return;
    locked = false; hint.classList.remove('in');
    if (state !== 'done') { state = 'done'; t0 = now() - 99; nav.classList.add('in'); }
    syncUi();
  });
  function reset() {
    state = 'idle'; copy.classList.remove('in'); nav.classList.remove('in'); hint.classList.remove('in'); go(0, true);
  }
  // arrival: the page glides to a stop exactly at the section's top (a scroll hold), then locks
  let above = scrollY < top() - 1.5;
  const onScroll = () => {
    const y = scrollY, T = top();
    if (y < T - 1.5) above = true; else if (y > T + innerHeight) above = false;
    setFence('leader', state === 'idle' && !reduceMotion ? T : null);
    if (state === 'idle' && !reduceMotion && !window.__siteJump && above && y >= T - 1.5 && y < T + innerHeight * 0.9) {
      state = 'armed'; lock(); setHint('Swipe', false);
      setTimeout(() => state === 'armed' && hint.classList.add('in'), 700);
    }
    if (state === 'idle' && !above && (reduceMotion || y > T + innerHeight * 0.9 || window.__siteJump) && y >= T - innerHeight * 0.4) { state = 'done'; t0 = now() - 99; nav.classList.add('in'); syncUi(); }
    if (window.__siteJump && !locked && state === 'done' && Math.abs(y - T) < 10) reset();   // jumped onto it: replay
    // scrolled back above it: reset so it plays again next time
    if ((state === 'done' || state === 'idle') && !locked && y < T - innerHeight * 0.98 && (state !== 'idle' || slide)) reset();
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- render ----------
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const glideTo = () => (isPhone() ? 0 : -cssW * 0.245);
  const loop = () => {
    if (!window.__leaderPause) {
      let mode = 'blank', t = 0, g = 0;
      if (state === 'playing') {
        const e = now() - t0;
        if (e < ENTER) { mode = 'enter'; t = e; }
        else if (e < T_HOLD) { mode = 'start'; t = e; }
        else { mode = 'slash'; t = e - T_HOLD; g = ease(Math.min(1, Math.max(0, (e - T_GLIDE) / GLIDE_DUR))); }
        if (e >= T_COPY) copy.classList.add('in');
        if (e >= T_DONE) {
          state = 'done';
          if (reduceMotion) unlock();
          nav.classList.add('in'); syncUi();
        }
      } else if (state === 'done') { mode = 'slash'; t = now() - t0 - T_HOLD; g = 1; copy.classList.add('in'); }
      if (pending && performance.now() - pendingAt < 2500) step(pending); else pending = 0;
      // the first slide only needs drawing while it is on screen
      if (slide === 0 || performance.now() < movingUntil) {
        const ox = glideTo() * g;
        fx.render(t, { mode, ox, zoom: 1 - 0.12 * (glideTo() ? g : 0) });
      }
    }
    requestAnimationFrame(loop);
  };
  loop();
  window.__leader = { render: (t, o) => fx.render(t, o), resize: (w, h, r) => fx.resize(w, h, r), TRANSITION, ENTER, T_DONE, go, step,
    pause: () => { window.__leaderPause = true; }, state: () => ({ state, locked, slide }) };
});
