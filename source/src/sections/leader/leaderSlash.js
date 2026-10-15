// Leader "slash" transition, drawn in code (Canvas 2D) from Sabesh's supplied artwork.
// Start: the figure from the right of the reference.  End: the figure from the left (mic retouched out).
// A gold brush-stroke slash cuts across, the frame snaps at 12 fps (stop-motion), smear + RGB split,
// white flash, scale punch, then the end pose settles with a breathing gold aura and rising embers.
// Every frame is a pure function of time, so the same code runs live and exports a transparent video.

const TAU = Math.PI * 2;
const FPS_STEP = 12;                          // stop-motion frame rate for the transition
export const TRANSITION = 7 / FPS_STEP;       // ~0.58 s from the first swish to settle
export const ENTER = 4 / FPS_STEP, EXIT = 3 / FPS_STEP, BACK = 3 / FPS_STEP;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- prepared layers for each figure ---------- */
function prepFigure(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const base = canvasOf(w, h); const g = base.getContext('2d'); g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, h);
  // channel-split copies for the RGB split (red-only and cyan-only)
  const mk = (keep) => { const c = canvasOf(w, h), cg = c.getContext('2d'), d = cg.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = keep[0] ? data.data[i] : 0; d.data[i + 1] = keep[1] ? data.data[i + 1] : 0; d.data[i + 2] = keep[2] ? data.data[i + 2] : 0; d.data[i + 3] = data.data[i + 3]; }
    cg.putImageData(d, 0, 0); return c; };
  const red = mk([1, 0, 0]), cyan = mk([0, 1, 1]);
  const tint = (col) => { const c = canvasOf(w, h), cg = c.getContext('2d'); cg.drawImage(base, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = col; cg.fillRect(0, 0, w, h); return c; };
  const white = tint('#fff8e6');
  // soft gold aura: the silhouette blurred with a wide warm glow
  const pad = 80, glow = canvasOf(w + pad * 2, h + pad * 2), gg = glow.getContext('2d');
  const gold = tint('#ffb42e');
  gg.shadowColor = 'rgba(255,176,46,1)'; gg.shadowBlur = 46; gg.shadowOffsetX = 0; gg.drawImage(gold, pad, pad);
  gg.shadowBlur = 18; gg.drawImage(gold, pad, pad);
  gg.globalCompositeOperation = 'destination-out'; gg.shadowBlur = 0; gg.drawImage(base, pad, pad);   // keep only the halo outside the body
  // edge points (for embers) along the top half of the silhouette
  const edges = [];
  for (let y = 2; y < h * 0.75; y += 3) for (let x = 2; x < w - 2; x += 3) {
    const a = data.data[(y * w + x) * 4 + 3];
    if (a > 160 && (data.data[((y - 3) * w + x) * 4 + 3] < 40 || data.data[(y * w + x - 3) * 4 + 3] < 40 || data.data[(y * w + x + 3) * 4 + 3] < 40)) edges.push([x, y]);
  }
  return { w, h, base, red, cyan, white, glow, pad, edges };
}

/* ---------- gold brush-stroke slash, painted procedurally like the artwork's strokes ---------- */
function makeSlash() {
  // one long dry-brush stroke: bristles of mixed amber/gold paint, a fat belly near the start,
  // a sharp tapering tip, broken ragged edges and flecks of paint thrown off the end
  const W = 2000, H = 300, c = canvasOf(W, H), g = c.getContext('2d'), r = rng(42);
  const yC = (x) => H * 0.52 - (x / W) * H * 0.06 + Math.sin(x / W * 3.1) * H * 0.02;     // slight arc
  const half = (x) => { const q = x / W; return H * 0.36 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(q, 0.62))), 0.9) * (q < 0.04 ? q / 0.04 : 1); };
  const pal = ['#9c5212', '#b8661a', '#d9892a', '#e9a23a', '#f4bd4f', '#ffd779', '#ffe8ae'];
  g.lineCap = 'round';
  for (let k = 0; k < 900; k++) {
    const v = (r() * 2 - 1) * (0.25 + 0.75 * Math.sqrt(r()));      // denser in the middle of the stroke
    const edge = Math.abs(v);
    const x0 = W * (r() * (0.08 + edge * 0.3)), x1 = W * (1 - r() * (0.05 + edge * 0.55));  // edge bristles break off early
    if (x1 <= x0) continue;
    const ci = Math.min(pal.length - 1, Math.max(0, Math.floor((1 - edge) * 4 + r() * 3)));
    g.strokeStyle = pal[ci]; g.globalAlpha = 0.35 + r() * 0.6 * (1 - edge * 0.5);
    g.lineWidth = 0.8 + r() * 3.2 * (1 - edge * 0.6);
    const wob = r() * 0.06, ph = r() * 6;
    g.beginPath();
    for (let x = x0; x <= x1; x += 24) {
      const y = yC(x) + (v + Math.sin(x / 140 + ph) * wob) * half(x);
      if (x === x0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  // dark paint ridges for depth
  for (let k = 0; k < 60; k++) {
    const v = (r() * 2 - 1) * 0.8, x0 = W * r() * 0.4, x1 = x0 + W * (0.15 + r() * 0.4);
    g.strokeStyle = '#7a3c0c'; g.globalAlpha = 0.25 + r() * 0.3; g.lineWidth = 1 + r() * 1.5;
    g.beginPath(); for (let x = x0; x <= Math.min(W, x1); x += 24) { const y = yC(x) + v * half(x); if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  }
  // flecks thrown off the tip and edges
  for (let k = 0; k < 220; k++) {
    const q = Math.pow(r(), 0.5), x = W * (0.45 + q * 0.6), sgn = r() < 0.5 ? -1 : 1;
    const y = yC(Math.min(W, x)) + sgn * (half(Math.min(W - 1, x)) * (0.7 + r() * 0.9) + r() * 30);
    g.fillStyle = pal[3 + Math.floor(r() * 4)]; g.globalAlpha = 0.45 + r() * 0.55;
    g.beginPath(); g.ellipse(x, y, 1 + r() * 4, 0.6 + r() * 2, -0.05, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  // the bright blade edge riding the stroke
  const core = g.createLinearGradient(0, 0, W, 0);
  core.addColorStop(0, 'rgba(255,255,255,0)'); core.addColorStop(0.3, 'rgba(255,248,225,.75)'); core.addColorStop(0.95, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = core; g.lineWidth = 2.4; g.beginPath();
  for (let x = W * 0.06; x <= W * 0.99; x += 20) { const y = yC(x) - half(x) * 0.18; if (x === W * 0.06) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  return c;
}

/* ---------- embers: pure functions of time ---------- */
function ember(i, seed) { const r = rng(seed * 7919 + i * 104729); return { u: r(), ph: r() * TAU, life: 1.2 + r() * 1.6, vy: 60 + r() * 110, drift: (r() - 0.5) * 40, size: 0.8 + r() * 2.2, hue: r() }; }

export function createLeaderSlash(canvas, { start, end }) {
  const g = canvas.getContext('2d');
  const A = prepFigure(start), B = prepFigure(end);
  const slash = makeSlash();
  let W = 0, H = 0, dpr = 1, scale = 1;

  function resize(cssW, cssH, ratio = Math.min(devicePixelRatio || 1, 2)) {
    dpr = ratio; W = Math.round(cssW * dpr); H = Math.round(cssH * dpr);
    canvas.width = W; canvas.height = H;
    // portrait screens: let the figure run slightly past the sides so he reads bigger
    const wFit = cssW / cssH < 0.8 ? 1.12 : 0.94;
    scale = Math.min((H * 0.88) / Math.max(A.h, B.h), (W * wFit) / Math.max(A.w, B.w));
  }

  // draw a figure anchored bottom-centre; mode: normal | split | white | ghost
  function fig(F, { dx = 0, dy = 0, s = 1, rot = 0, alpha = 1, mode = 'normal', split = 0 } = {}) {
    const fw = F.w * scale * s, fh = F.h * scale * s;
    g.save();
    g.translate(W / 2 + dx, H + dy); g.rotate(rot); g.globalAlpha = alpha;
    const x = -fw / 2, y = -fh;
    if (mode === 'white') g.drawImage(F.white, x, y, fw, fh);
    else if (mode === 'split' && split > 0.3) {
      g.globalCompositeOperation = 'lighter';
      g.drawImage(F.red, x - split, y, fw, fh); g.drawImage(F.cyan, x + split, y, fw, fh);
    } else g.drawImage(F.base, x, y, fw, fh);
    g.restore();
  }
  function aura(F, a, t) {
    if (a <= 0) return;
    // the halo "boils" at 12 fps like hand-drawn animation
    const k = Math.floor(t * 12), j = rng(k + 3);
    const s = scale, pw = (F.w + F.pad * 2) * s, ph = (F.h + F.pad * 2) * s;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
    g.drawImage(F.glow, W / 2 - pw / 2 + (j() - 0.5) * 3 * dpr, H - ph + F.pad * s + (j() - 0.5) * 3 * dpr, pw, ph);
    g.restore();
  }
  function embers(F, t, t0, rate, burst = 0) {
    // continuous embers spawned since t0, plus an optional burst at t0
    g.save(); g.globalCompositeOperation = 'lighter';
    const draw = (e, age) => {
      if (age < 0 || age > e.life) return;
      const p = F.edges[Math.floor(e.u * F.edges.length)]; if (!p) return;
      const k = age / e.life;
      const x = W / 2 + (p[0] - F.w / 2) * scale + Math.sin(age * 3 + e.ph) * 8 * dpr + e.drift * age * dpr;
      const y = H - (F.h - p[1]) * scale - e.vy * age * dpr;
      const a = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(age * 18 + e.ph));
      const col = e.hue < 0.5 ? '255,196,92' : '255,140,48';
      g.fillStyle = `rgba(${col},${a.toFixed(3)})`;
      g.beginPath(); g.arc(x, y, e.size * dpr * (1 - k * 0.5), 0, TAU); g.fill();
    };
    for (let i = 0; i < burst; i++) { const e = ember(i, 1); e.vy *= 2.2; e.life *= 0.7; draw(e, t - t0); }
    const n = Math.floor((t - t0) * rate);
    for (let i = Math.max(0, n - Math.ceil(rate * 3)); i <= n; i++) draw(ember(i, 2), t - t0 - i / rate);
    g.restore();
  }
  // ---- the blade follows the start pose's hand: it grows out of the hand and flies off past the fingertips
  const HAND = { back: [300, 418], wrist: [365, 385], tip: [540, 295] };      // start-image pixels
  const P = (pt) => [W / 2 + (pt[0] - A.w / 2) * scale, H - (A.h - pt[1]) * scale];
  function bladeGeom() {
    const o = P(HAND.back), w = P(HAND.wrist), t = P(HAND.tip);
    const ang = Math.atan2(t[1] - w[1], t[0] - w[0]);
    const len = Math.max(W * 0.5, (W * 1.05 - o[0]) / Math.cos(ang));
    return { o, ang, len, th: A.h * scale * 0.085, hand: [(w[0] + t[0]) / 2, (w[1] + t[1]) / 2] };
  }
  let slashBuf = null;
  function slashAt(prog, alpha, thin = 1) {
    if (alpha <= 0 || prog <= 0) return;
    if (!slashBuf || slashBuf.width !== W || slashBuf.height !== H) slashBuf = canvasOf(W, H);
    const b = slashBuf.getContext('2d'), G = bladeGeom(), len = G.len, th = G.th * thin;
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
    b.translate(G.o[0], G.o[1]); b.rotate(G.ang);
    b.drawImage(slash, 0, -th / 2, len, th);
    const tip = len * prog;
    if (prog < 1) {
      b.globalCompositeOperation = 'destination-in';
      const m = b.createLinearGradient(tip - len * 0.06, 0, tip, 0);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = m; b.fillRect(-10, -th, tip + 10, th * 2);
      b.globalCompositeOperation = 'lighter';
      const gl = b.createRadialGradient(tip, 0, 0, tip, 0, th * 1.1);
      gl.addColorStop(0, 'rgba(255,250,230,.95)'); gl.addColorStop(0.3, 'rgba(255,200,110,.45)'); gl.addColorStop(1, 'rgba(255,180,80,0)');
      b.fillStyle = gl; b.fillRect(tip - th * 1.2, -th * 1.2, th * 2.4, th * 2.4);
    }
    g.save(); g.globalAlpha = alpha; g.drawImage(slashBuf, 0, 0); g.restore();
  }
  function speedLines(t, a) {
    if (a <= 0) return;
    const r = rng(Math.floor(t * 12) + 11), G = bladeGeom();
    g.save(); g.translate(G.hand[0], G.hand[1]); g.rotate(G.ang); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const y = (r() - 0.5) * H * 0.9, x = (r() - 0.35) * W * 0.9, L = (0.18 + r() * 0.45) * W;
      const grd = g.createLinearGradient(x, 0, x + L, 0);
      grd.addColorStop(0, 'rgba(255,230,170,0)'); grd.addColorStop(0.7, `rgba(255,236,190,${(0.5 * a).toFixed(3)})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd; g.lineWidth = (0.6 + r() * 2) * dpr;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y); g.stroke();
    }
    g.restore();
  }
  function flash(a, at) {
    if (a <= 0) return;
    const c = at || [W / 2, H * 0.52];
    g.save(); g.globalCompositeOperation = 'lighter';
    const rad = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], Math.max(W, H) * 0.6);
    rad.addColorStop(0, `rgba(255,248,225,${a.toFixed(3)})`); rad.addColorStop(0.35, `rgba(255,214,140,${(a * 0.5).toFixed(3)})`); rad.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = rad; g.fillRect(-W, -H, W * 3, H * 3); g.restore();
  }
  let ox = 0, zoom = 1;
  // global offset + zoom about the bottom-centre (used for the glide to the left)
  const base = (sx = 0, sy = 0) => g.setTransform(zoom, 0, 0, zoom, ox + sx + (W / 2) * (1 - zoom), sy + H * (1 - zoom));
  function startIdle(t) { const b = 0.28 + 0.12 * Math.sin(t * 1.6); aura(A, b, t); fig(A, { s: 1 + 0.003 * Math.sin(t * 1.6) }); }
  function endIdle(t) {
    const b = 0.42 + 0.2 * Math.sin(t * 1.7) + 0.06 * Math.sin(t * 4.3);
    aura(B, b, t); embers(B, t, 0, 16, 0); fig(B, { s: 1 + 0.004 * Math.sin(t * 1.7) });
  }

  /**
   * Render one frame.
   *  mode 'blank'           nothing (the section is waiting)
   *  mode 'enter'  t        the start pose drops in and lands (stop-motion), then idles
   *  mode 'exit'   t        the start pose drops away (scrolling back up)
   *  mode 'start'  t        start pose idling
   *  mode 'slash'  t        the slash transition, then the end pose idling
   *  mode 'back'   t        quick light-swap from the end pose back to the start pose
   *  opts.ox                horizontal offset in CSS px (the glide to the left)
   */
  function render(t, { mode = 'slash', ox: oxCss = 0, zoom: z = 1 } = {}) {
    ox = oxCss * dpr; zoom = z;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (mode === 'blank') return;
    const k = Math.floor(Math.max(0, t) * FPS_STEP);
    const shake = (amt) => { const r = rng(k + 99); base((r() - 0.5) * amt * dpr, (r() - 0.5) * amt * dpr); };
    const u = W / 100;
    base();
    if (mode === 'start') { startIdle(t); return; }
    if (mode === 'enter') {
      switch (k) {
        case 0: fig(A, { dy: H * 0.3, s: 0.94, alpha: 0.6, mode: 'white' }); break;
        case 1: aura(A, 0.3, t); fig(A, { dy: H * 0.1, s: 0.98, mode: 'split', split: 1 * u }); break;
        case 2: shake(5); aura(A, 0.6, t); fig(A, { dy: -H * 0.018, s: 1.03 }); flash(0.22); break;
        case 3: aura(A, 0.45, t); fig(A, { dy: H * 0.005, s: 0.992 }); break;
        default: startIdle(t);
      }
      return;
    }
    if (mode === 'exit') {
      switch (k) {
        case 0: fig(A, { dy: H * 0.02, mode: 'split', split: 0.8 * u }); break;
        case 1: fig(A, { dy: H * 0.14, s: 0.97, alpha: 0.6, mode: 'white' }); break;
        case 2: fig(A, { dy: H * 0.34, s: 0.94, alpha: 0.3, mode: 'white' }); break;
        default: break;
      }
      return;
    }
    if (mode === 'back') {
      switch (k) {
        case 0: shake(6); fig(B, { mode: 'white', alpha: 0.9 }); flash(0.6); break;
        case 1: fig(A, { mode: 'white', s: 1.04 }); flash(0.3); break;
        case 2: aura(A, 0.4, t); fig(A, { mode: 'split', split: 0.6 * u }); break;
        default: startIdle(t);
      }
      return;
    }
    // mode 'slash'
    const G = bladeGeom();
    switch (k) {
      case 0:                                       // anticipation: lean into it, the blade leaves the hand
        fig(A, { s: 1.03, dx: -1 * u, rot: -0.015 }); slashAt(0.4, 1); flash(0.12, G.hand); break;
      case 1:                                       // the blade flies out along the hand
        fig(A, { s: 1.03, dx: -1.2 * u, mode: 'split', split: 0.5 * u }); slashAt(0.85, 1); flash(0.18, G.hand); break;
      case 2:                                       // swish: smear trails, speed lines
        shake(6);
        for (let i = 4; i >= 1; i--) fig(A, { dx: -(2 + i * 2.6) * u, s: 1.02, alpha: 0.12 + 0.05 * (4 - i), mode: 'white' });
        fig(A, { dx: -2.4 * u, s: 1.02, mode: 'split', split: 1.2 * u });
        speedLines(t, 1); slashAt(1, 1); flash(0.35, G.hand); break;
      case 3:                                       // white-out swap
        shake(10);
        fig(A, { dx: -5 * u, s: 1.02, alpha: 0.55, mode: 'white' });
        for (let i = 3; i >= 1; i--) fig(B, { dx: (2 + i * 2.4) * u, s: 1.1, alpha: 0.15 + 0.08 * (3 - i), mode: 'white' });
        fig(B, { dx: 1.5 * u, s: 1.1, mode: 'white' });
        speedLines(t, 0.8); slashAt(1, 0.85); flash(0.95, G.hand); break;
      case 4:                                       // landing: scale punch, colour split
        shake(8);
        aura(B, 0.9, t); fig(B, { s: 1.12, rot: 0.025, dx: 0.6 * u, mode: 'split', split: 1.1 * u });
        slashAt(1, 0.5, 0.75); embers(B, t, 4 / FPS_STEP, 0, 70); flash(0.25); break;
      case 5:
        shake(4);
        aura(B, 0.8, t); fig(B, { s: 0.975, rot: -0.008, mode: 'split', split: 0.45 * u });
        slashAt(1, 0.2, 0.5); embers(B, t, 4 / FPS_STEP, 0, 70); break;
      case 6:
        aura(B, 0.7, t); fig(B, { s: 1.008 }); embers(B, t, 4 / FPS_STEP, 0, 70); break;
      default:
        embers(B, t, 4 / FPS_STEP, 0, 70); endIdle(t);
    }
  }
  return { resize, render };
}
