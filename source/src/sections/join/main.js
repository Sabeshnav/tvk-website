// Join Us: scroll pulls the camera back from the empty place to the whole of Tamil Nadu; tapping the place (or the
// button) brings a newcomer into it, the crowd cheers, and the Join button appears.
import { createJoinScene, sm } from './joinScene.js';
import { setFence } from '../../fence.js';

const track = document.getElementById('join');
const stage = document.getElementById('join-stage');
const q = (id) => document.getElementById(id);
const t1 = q('join-t1'), t2 = q('join-t2'), t3 = q('join-t3'), done = q('join-done'), label = q('join-label'), take = q('join-take');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function fonts() {
  const faces = [new FontFace('StoneTa', 'url(data:font/woff2;base64,__NST700_B64__)', { weight: '700' }), new FontFace('StoneEn', 'url(data:font/woff2;base64,__CINZEL700_B64__)', { weight: '700' })];
  await Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))));
}

fonts().then(() => {
  const fx = createJoinScene(stage);
  const size = () => { const r = stage.getBoundingClientRect(); fx.resize(r.width, r.height); };
  size(); addEventListener('resize', size);
  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });
  const progress = () => { const r = track.getBoundingClientRect(), max = track.offsetHeight - innerHeight; return max > 0 ? Math.min(1, Math.max(0, -r.top / max)) : 0; };

  let p = progress(), last = performance.now(), clock = 0, joinedAt = -1;
  const seen = { t1: 0, t2: 0, t3: 0, done: 0 };
  const join = () => { if (joinedAt < 0 && p > 0.5) { joinedAt = clock; track.classList.add('joined'); } };
  take.addEventListener('click', join);
  stage.addEventListener('click', (e) => {                           // tapping the glowing place itself
    const s = fx.spotScreen(), r = stage.getBoundingClientRect();
    const dx = e.clientX - (r.left + s.x * r.width), dy = e.clientY - (r.top + s.y * r.height);
    if (Math.hypot(dx, dy) < Math.max(48, r.width * 0.05)) join();
  });

  const ui = (p, j) => {
    t1.classList.toggle('in', p < 0.16);
    t2.classList.toggle('in', p > 0.3 && p < 0.62);
    const ready = p > 0.74 && j < 0;
    t3.classList.toggle('in', ready);
    done.classList.toggle('in', j > 2.2 && p > 0.6);
    const s = fx.spotScreen();
    label.style.transform = `translate(${(s.x * 100).toFixed(2)}vw, ${(s.y * 100).toFixed(2)}svh)`;
    label.classList.toggle('in', ready && s.visible);
  };
  const loop = (now) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); clock += dt;
    if (!window.__joinPause) {
      const target = progress();
      p = reduceMotion ? target : p + (target - p) * (1 - Math.exp(-dt * 5));
      const j = joinedAt < 0 ? -1 : (reduceMotion ? 10 : clock - joinedAt);
      fx.render(p, clock, j, mouse); ui(p, j);
      // reading holds: each panel stays on screen long enough to be read before the page moves on
      for (const [el, key] of [[t1, 't1'], [t2, 't2'], [t3, 't3'], [done, 'done']]) seen[key] = el.classList.contains('in') ? seen[key] + dt : seen[key];
      let hold = null;
      if (seen.t1 < 1.2) hold = 0.15;
      else if (seen.t2 < 1.4) hold = 0.6;
      else if (j < 0 ? seen.t3 < 1.4 : seen.done < 1.8) hold = 1;
      setFence('join', hold === null ? null : track.getBoundingClientRect().top + scrollY + hold * (track.offsetHeight - innerHeight));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__join = { render: (pp, t = 0, j = -1) => { fx.render(pp, t, j); ui(pp, j); }, pause: () => { window.__joinPause = true; }, count: fx.count, join, get p() { return p; }, get joined() { return joinedAt >= 0; } };
});
