// Scroll fences: a section can stop the page from scrolling past a point until its content has been shown.
// Each section calls setFence(id, y) every frame with the document Y it must not scroll past yet (or null).
// The scroller (scroller.js) eases the page to a stop at the nearest fence ahead; it never snaps back.
// A fence only holds the user while they come towards it from above: a fence already behind them is ignored.
const fences = new Map();
window.__fences = fences;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setFence(id, y) {
  if (y == null || reduceMotion) fences.delete(id); else fences.set(id, Math.round(y));
}
// the nearest fence at or ahead of document position y
export function fenceAhead(y) {
  let m = Infinity;
  for (const f of fences.values()) if (f >= y - 2 && f < m) m = f;
  return m;
}
