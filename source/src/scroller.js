// One scroll controller for the whole page (desktop wheel, trackpad and keys; touch stays native).
//
// Why: the page used to mix the browser's own smooth wheel scrolling with sections that snapped the page back
// (scroll holds, locked sections). The two fought each other, so the page juddered and felt stuck. Now:
//  - wheel/keys move a target position; the page eases towards it every frame (no snapping, no overshoot);
//  - the target can't pass the nearest scroll hold (fence.js), so the page glides to a stop there;
//  - a locked section owns the input: whole swipes are recognised and handed to it as gesture(+1 / -1),
//    including during trackpad momentum (a new swipe is spotted when the scroll speeds up again).
import { fenceAhead } from './fence.js';
import { makeSwipeDetector } from './swipe.js';

const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RATE = 9;                                   // easing speed (1/s): higher = snappier
const S = { target: scrollY, cur: scrollY, owner: null, lockY: 0, ours: scrollY, jumping: 0 };
const maxY = () => Math.max(0, html.scrollHeight - innerHeight);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const limit = () => Math.min(maxY(), fenceAhead(S.cur));
function write(y) { S.ours = y; window.scrollTo(0, y); }

// ---------- swipe recognition while a section is locked (see swipe.js) ----------
const G = makeSwipeDetector((dir) => S.owner && S.owner.gesture(dir));

// ---------- public API ----------
export function lock(owner, y) {
  S.owner = owner; S.lockY = Math.round(y); S.target = S.cur = S.lockY; write(S.lockY);
  html.classList.add('scroll-locked'); G.consume(); tx = ty = null;     // the swipe (wheel or touch) that brought them here doesn't count
}
export function unlock(push = 0) {
  if (!S.owner) return;
  S.owner = null; html.classList.remove('scroll-locked');
  S.cur = scrollY; S.target = clamp(S.cur + push, 0, push > 0 ? limit() : maxY());
}
export const isLocked = () => !!S.owner;
// a chapter jump: sections release their locks, then the page lands instantly
export function jumpTo(y) {
  window.__siteJump = true;
  window.dispatchEvent(new Event('site:jump'));
  S.owner = null; html.classList.remove('scroll-locked');
  S.target = S.cur = clamp(y, 0, maxY()); write(S.cur);
  S.jumping = 2;                                  // keep the flag up until the jump's scroll event has been handled
}
export function scrollBy(d) { if (!S.owner) S.target = clamp(S.target + d, 0, d > 0 ? limit() : maxY()); }

// ---------- input ----------
const sheetOpen = () => !!document.querySelector('.sheet.open');
addEventListener('wheel', (e) => {
  if (e.ctrlKey || sheetOpen()) return;                                   // pinch-zoom, or the phone menu
  e.preventDefault();
  if (html.classList.contains('intro-on')) return;
  const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
  const dy = e.deltaY * k, dx = e.deltaX * k;
  G.feed(S.owner && Math.abs(dx) > Math.abs(dy) ? dx : dy, performance.now(), !!S.owner);
  if (S.owner) return;
  S.target = clamp(S.target + dy, 0, dy > 0 ? limit() : maxY());
}, { passive: false });

let keyT = 0;
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || sheetOpen()) return;
  const el = e.target;
  if (el.closest && el.closest('input,textarea,select,[contenteditable]')) return;
  if (e.key === ' ' && el.closest && el.closest('button,a,[role=button]')) return;   // space presses buttons
  const page = innerHeight * 0.85;
  const map = { ArrowDown: [1, 120], ArrowUp: [-1, 120], PageDown: [1, page], PageUp: [-1, page], ' ': [e.shiftKey ? -1 : 1, page], End: [1, 1e9], Home: [-1, 1e9], ArrowRight: [1, 0], ArrowLeft: [-1, 0] };
  const m = map[e.key];
  if (!m || html.classList.contains('intro-on')) return;
  if (S.owner) {
    e.preventDefault();
    if (performance.now() - keyT > 250) { keyT = performance.now(); S.owner.gesture(m[0]); }
    return;
  }
  if (!m[1]) return;                                                      // left/right only matter in a locked section
  e.preventDefault();
  scrollBy(m[0] * m[1]);
});

let tx = null, ty = null;
addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (!S.owner) return;                                                    // normal pages scroll natively on touch
  if (e.cancelable) e.preventDefault();
  if (tx === null) return;
  const dx = tx - e.touches[0].clientX, dy = ty - e.touches[0].clientY;
  const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (Math.abs(d) > 30) { tx = ty = null; S.owner.gesture(Math.sign(d)); }
}, { passive: false });

// scrolling we didn't cause (touch, scrollbar drag, find-in-page): follow it, but still respect holds and locks
addEventListener('scroll', () => {
  const y = scrollY;
  if (Math.abs(y - S.ours) <= 2) return;
  if (window.__siteJump) { S.target = S.cur = S.ours = y; return; }
  if (S.owner) { write(S.lockY); return; }
  const L = Math.min(maxY(), fenceAhead(S.cur));
  if (y > L + 1) { write(L); S.target = S.cur = L; return; }
  S.target = S.cur = S.ours = y;
}, { passive: true });

// ---------- the easing loop ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (S.jumping && --S.jumping === 0) window.__siteJump = false;
  if (!S.owner) {
    const L = limit();
    if (S.target > L) S.target = Math.max(L, Math.min(S.target, S.cur > L ? S.cur : L));
    const d = S.target - S.cur;
    if (Math.abs(d) > 0.4) { S.cur += reduceMotion ? d : d * (1 - Math.exp(-dt * RATE)); write(S.cur); }
    else if (S.cur !== S.target) { S.cur = S.target; write(S.cur); }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
addEventListener('resize', () => { S.target = clamp(S.target, 0, maxY()); });
window.__scroller = { S, lock, unlock, jumpTo };
