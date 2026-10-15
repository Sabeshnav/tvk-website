// The pledge: a pinned scroll section. One scroll past the threshold swings four hammers that
// smash all four stones at once; the pledge text then appears on its own. Scrolling back above
// the threshold hides the text and rebuilds the stones.
import { createPledgeScene, WORDS, S } from './pledgeScene.js';
import { setFence } from '../../fence.js';

const track = document.getElementById('pledge');
const stage = document.getElementById('pledge-stage');
const copy = document.getElementById('pledge-copy');
const cue = document.getElementById('pledge-cue');
const head = document.querySelector('#pledge .head');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMASH_AT = 0.08;                                  // scroll progress at which all stones break

async function fonts() {
  const faces = [new FontFace('StoneTa', 'url(data:font/woff2;base64,__NST700_B64__)', { weight: '700' }), new FontFace('StoneEn', 'url(data:font/woff2;base64,__CINZEL700_B64__)', { weight: '700' })];
  await Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))));
}

fonts().then(() => {
  const fx = createPledgeScene(stage, { ta: 'StoneTa', en: 'StoneEn' });
  const size = () => { const r = stage.getBoundingClientRect(); fx.resize(r.width, r.height); };
  size(); addEventListener('resize', size);
  addEventListener('pointermove', (e) => { fx.mouse.x = (e.clientX / innerWidth) * 2 - 1; fx.mouse.y = (e.clientY / innerHeight) * 2 - 1; });

  const progress = () => { const r = track.getBoundingClientRect(), max = track.offsetHeight - innerHeight; return max > 0 ? Math.min(1, Math.max(0, -r.top / max)) : 0; };
  const ts = WORDS.map(() => 0);
  let last = performance.now(), clock = 0, shown = 0;
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); clock += dt;
    if (!window.__pledgePause) {
      const p = progress();
      const want = p >= SMASH_AT;
      for (let k = 0; k < ts.length; k++) {
        if (reduceMotion) ts[k] = want ? S.end : 0;
        else ts[k] = want ? ts[k] + dt : ts[k] - dt * 3;         // strike together; rebuild together, in reverse
        ts[k] = Math.min(S.end, Math.max(0, ts[k]));
      }
      const allDone = ts.every((t) => t >= S.impact + 0.6);
      const textIn = want && allDone;
      copy.classList.toggle('in', textIn);
      // hold the page inside the section until the stones have broken and the pledge text has fully appeared
      shown = textIn ? shown + dt : 0;
      setFence('pledge', shown > 2 ? null : track.getBoundingClientRect().top + scrollY + track.offsetHeight - innerHeight);
      head.style.opacity = textIn ? '0' : '1';
      cue.style.opacity = String(p < 0.06 ? 1 : 0);
      fx.render(ts, clock);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__pledge = { render: (t, c = 0) => fx.render(t, c), pause: () => { window.__pledgePause = true; }, S, ts };
});
