// Turns a stream of wheel deltas into whole swipes (one call to onSwipe(+1/-1) per swipe).
// A trackpad flick produces a long tail of shrinking "momentum" events; those belong to the same swipe.
// A new swipe is recognised after a pause, or when the deltas grow again (a fresh flick during momentum),
// or every second while the input keeps going at full strength (a wheel spun on and on).
export function makeSwipeDetector(onSwipe, { threshold = 30, gapMs = 160 } = {}) {
  const G = {
    lastT: -1e9, start: -1e9, acc: 0, fired: false, avg: 0, peak: 0,
    // the gesture in progress no longer counts (e.g. the scroll that carried the visitor into a locked section)
    consume() { this.fired = true; },
    feed(d, now, armed = true) {
      const a = Math.abs(d), gap = now - this.lastT;
      this.lastT = now;
      const fresh = gap > gapMs
        || (a > 6 && a > this.avg * 1.8 && now - this.start > 150)
        || (now - this.start > 1000 && a >= this.peak * 0.6 && a > 6);
      if (fresh) { this.start = now; this.acc = 0; this.fired = false; this.peak = 0; this.avg = a; }
      this.avg = this.avg * 0.7 + a * 0.3; this.peak = Math.max(this.peak, a);
      this.acc += d;
      if (!this.fired && armed && Math.abs(this.acc) >= threshold) { this.fired = true; onSwipe(Math.sign(this.acc)); return true; }
      return false;
    },
  };
  return G;
}
