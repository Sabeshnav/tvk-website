// Ideology · core idea. The section locks when it reaches the screen and the title sequence plays on its own
// (a swipe fast-forwards it). When the leaf has risen, its meaning and the core idea appear below it and
// scrolling is released. Scrolling back above the section resets it.
import { createKuralScene } from './kuralScene.js';
import { lock as lockPage, unlock as unlockPage } from '../../scroller.js';
import { setFence } from '../../fence.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const section = document.getElementById('kural');
const stage = document.getElementById('kural-stage');
const copy = document.getElementById('kural-copy');

async function fonts() {
  const f = new FontFace('KuralHand', 'url(data:font/woff2;base64,__KAVIVANAR_B64__)');
  await f.load(); document.fonts.add(f);
  await document.fonts.ready;
}

fonts().then(() => createKuralScene(stage, { fontFamily: 'KuralHand' })).then((fx) => {
  const T = fx.T;
  const place = () => {
    const r = stage.getBoundingClientRect();
    fx.resize(r.width, r.height);
    section.style.setProperty('--copy-top', `${Math.round(fx.leafBottomPx(r.height) + Math.min(36, r.height * 0.04))}px`);
  };
  place(); addEventListener('resize', place);

  // ---------- state: idle -> playing (locked) -> done ----------
  let state = 'idle', t = 0, speed = 1, locked = false, lastY = scrollY, last = performance.now(), copyShown = 0;
  const top = () => section.getBoundingClientRect().top + scrollY;
  let startedAt = 0;
  const skip = () => { if (state === 'playing' && performance.now() - startedAt > 700) speed = 5; };   // a swipe fast-forwards
  const owner = { gesture: skip };
  const lock = () => { locked = true; lockPage(owner, top()); };
  const unlock = () => { if (!locked) return; locked = false; unlockPage(0); };

  // a chapter jump releases the lock and shows the finished leaf
  addEventListener('site:jump', () => { if (locked) { locked = false; state = 'done'; t = Math.max(t, T.done + 1); speed = 1; } });
  let above = scrollY < top() - 1.5;
  const onScroll = () => {
    const y = scrollY, Y = top();
    if (y < Y - 1.5) above = true; else if (y > Y + innerHeight) above = false;
    setFence('kural', state === 'idle' && !reduceMotion ? Y : null);     // the page glides to a stop right at the top
    if (state === 'idle' && !window.__siteJump && above && y >= Y - 1.5 && y < Y + innerHeight * 0.9) {
      if (reduceMotion) { state = 'done'; t = T.done + 1; }
      else { state = 'playing'; t = 0; speed = 1; startedAt = performance.now(); copyShown = 0; lock(); }
    }
    // a chapter jump that lands on this section: replay it from the start when they scroll in
    if (window.__siteJump && !locked && state === 'done' && Math.abs(y - Y) < 10) { state = 'idle'; t = 0; }
    // reached from below (e.g. after a chapter jump): show it finished rather than an empty table
    if (state === 'idle' && !locked && !above && y > Y + innerHeight * 0.9) { state = 'done'; t = T.done + 1; }
    if (state === 'done' && !locked && y < Y - innerHeight * 0.98) { state = 'idle'; t = 0; }
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!window.__kuralPause) {
      if (state === 'playing') {
        t += dt * speed;
        if (t >= T.done && copyShown > 2.4) { state = 'done'; unlock(); speed = 1; }   // release only once the copy has fully appeared
      } else if (state === 'done') t += dt;
      section.classList.toggle('lit', t > 0.15);
      section.classList.toggle('titled', t > 0.5 && t < 2.6);
      section.classList.toggle('risen', t > T.riseStart + 0.2);
      copy.classList.toggle('in', t > T.copy);
      copyShown = t > T.copy ? copyShown + dt : 0;
      fx.render(state === 'idle' ? 0 : t);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__kural = { T, render: (tt) => fx.render(tt), set: (tt) => { t = tt; }, pause: () => { window.__kuralPause = true; }, state: () => ({ state, locked, t }) };
});
