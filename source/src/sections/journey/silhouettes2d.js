// Silhouette drawing borrowed from A02 (flag-hoist-3d/src/silhouettes.js): people, coconut palms and broad trees,
// drawn once into texture atlases for the Journey road's billboards.
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function rng(seed) {                     // mulberry32: same layout on every visit
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ======================= skyline: one temple, one church, one mosque ======================= */
// shapes are added to the current path of `g`; the caller fills once

function coconutPalm(g, x, by, h, lean, r) {
  // slender trunk with a gentle S-curve and a flared base
  if (g.trunkCol) g.fillStyle = g.trunkCol;
  if (g.leafCol) g.strokeStyle = g.leafCol;
  const tx = x + lean * h, ty = by - h;
  const c1x = x + lean * h * 0.05, c1y = by - h * 0.4, c2x = x + lean * h * 0.75, c2y = by - h * 0.75;
  const w0 = h * 0.024, w1 = h * 0.012;
  g.beginPath();
  g.moveTo(x - w0 * 1.5, by + 2); g.quadraticCurveTo(x - w0, by - h * 0.03, x - w0, by - h * 0.06);
  g.bezierCurveTo(c1x - w0, c1y, c2x - w1, c2y, tx - w1, ty);
  g.lineTo(tx + w1, ty);
  g.bezierCurveTo(c2x + w1, c2y, c1x + w0, c1y, x + w0, by - h * 0.06);
  g.quadraticCurveTo(x + w0, by - h * 0.03, x + w0 * 1.5, by + 2); g.closePath(); g.fill();
  // crown: arching fronds, each a spine with paired leaflets that hang down toward the tip
  const fronds = 12;
  for (let f = 0; f < fronds; f++) {
    const spread = f / (fronds - 1);
    const a0 = lerp(-2.9, -0.24, spread) + (r() - 0.5) * 0.15;                // start direction (radians, 0 = right)
    const L = h * (0.3 + r() * 0.08) * (0.75 + 0.25 * Math.sin(spread * Math.PI));
    const lift = Math.sin(spread * Math.PI) * 0.35 + 0.1;                       // upright fronds arch higher
    const pts = [];
    for (let s = 0; s <= 16; s++) {
      const q = s / 16;
      pts.push([tx + Math.cos(a0) * L * q, ty + Math.sin(a0) * L * q * (1 - q * 0.35) - lift * L * q * (1 - q) * 0.6 + L * 0.55 * q * q]);
    }
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineWidth = h * 0.009; g.stroke();
    g.lineCap = 'butt'; g.beginPath();
    for (let s = 1; s < 16; s++) {
      const [px, py] = pts[s], [qx, qy] = pts[s + 1];
      const d = Math.hypot(qx - px, qy - py) || 1, ux = (qx - px) / d, uy = (qy - py) / d;
      const q = s / 16, len = h * 0.085 * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.15)), 0.7);
      for (const sd of [-1, 1]) {
        // leaflet: angled forward along the frond, then drooping under gravity
        const lx = ux * 0.55 + (-uy) * sd * 0.8, ly = uy * 0.55 + ux * sd * 0.8 + 0.55;
        const n = Math.hypot(lx, ly) || 1;
        g.moveTo(px, py); g.lineTo(px + (lx / n) * len, py + (ly / n) * len);
      }
    }
    g.lineWidth = h * 0.0045; g.stroke();
  }
  if (g.nutCol) g.fillStyle = g.nutCol;
  g.beginPath();                                                                // coconut cluster
  for (let k = 0; k < 5; k++) { const cx = tx + (k - 2) * h * 0.016, cy = ty + h * 0.02 + (k % 2) * h * 0.012; g.moveTo(cx + h * 0.016, cy); g.arc(cx, cy, h * 0.016, 0, TAU); }
  g.fill();
}

function broadTree(g, x, by, h, r, roots = false) {   // neem / banyan style: branching trunk and leafy clumps
  const tips = [];
  if (g.trunkCol) g.fillStyle = g.trunkCol;
  const branch = (x0, y0, ang, len, w, depth) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    g.beginPath();
    g.moveTo(x0 + nx * w, y0 + ny * w); g.lineTo(x1 + nx * w * 0.66, y1 + ny * w * 0.66); g.lineTo(x1 - nx * w * 0.66, y1 - ny * w * 0.66); g.lineTo(x0 - nx * w, y0 - ny * w); g.closePath();
    g.moveTo(x1 + w * 0.66, y1); g.arc(x1, y1, w * 0.66, 0, TAU);
    g.fill();
    if (depth === 0) { tips.push([x1, y1]); return; }
    const kids = depth > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const spread = kids === 2 ? (k ? 1 : -1) * (0.35 + r() * 0.25) : (k - 1) * (0.5 + r() * 0.2);
      branch(x1, y1, ang + spread + (r() - 0.5) * 0.2, len * (0.68 + r() * 0.12), w * 0.66, depth - 1);
    }
  };
  // trunk with a root flare
  const tw = h * 0.045;
  g.beginPath(); g.moveTo(x - tw * 2, by + 2); g.quadraticCurveTo(x - tw, by - h * 0.04, x - tw, by - h * 0.1); g.lineTo(x + tw, by - h * 0.1); g.quadraticCurveTo(x + tw, by - h * 0.04, x + tw * 2, by + 2); g.closePath(); g.fill();
  branch(x, by - h * 0.08, -Math.PI / 2 + (r() - 0.5) * 0.15, h * 0.28, tw, 4);
  // leafy clumps at the branch tips: a core plus a ring of small lobes gives a leafy, serrated edge
  if (g.leafCol) g.fillStyle = g.leafCol;
  for (const [tx2, ty2] of tips) {
    const R = h * (0.07 + r() * 0.04);
    g.beginPath(); g.moveTo(tx2 + R, ty2); g.arc(tx2, ty2, R, 0, TAU);
    const lobes = 9;
    for (let l = 0; l < lobes; l++) {
      const a = (l / lobes) * TAU + r() * 0.5, rr = R * (0.32 + r() * 0.18);
      const lx = tx2 + Math.cos(a) * R * 0.95, ly = ty2 + Math.sin(a) * R * 0.9;
      g.moveTo(lx + rr, ly); g.arc(lx, ly, rr, 0, TAU);
    }
    g.fill();
  }
  if (roots) {                                                                  // banyan aerial roots
    if (g.trunkCol) g.strokeStyle = g.trunkCol;
    g.beginPath();
    for (const [tx2, ty2] of tips) if (r() < 0.55 && ty2 > by - h * 0.85) { g.moveTo(tx2 + (r() - 0.5) * h * 0.04, ty2 + h * 0.04); g.lineTo(tx2 + (r() - 0.5) * h * 0.03, by); }
    g.lineWidth = h * 0.006; g.stroke();
  }
}

function shrubRow(g, x0, x1, by, h, r) {   // low bushes that tie everything to the ground
  g.beginPath();
  let x = x0;
  while (x < x1) { const rr = h * (0.025 + r() * 0.035); g.moveTo(x + rr, by); g.arc(x, by, rr, 0, TAU); x += rr * (1.1 + r() * 0.6); }
  g.rect(x0, by - h * 0.01, x1 - x0, h * 0.02);
  g.fill();
}

/* ======================= crowd people ======================= */
// One person seen from behind: sloped shoulders, tapered arms with elbows, real hands.

function limb(ctx, ax, ay, bx, by, wa, wb) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa); ctx.lineTo(bx + nx * wb, by + ny * wb); ctx.lineTo(bx - nx * wb, by - ny * wb); ctx.lineTo(ax - nx * wa, ay - ny * wa); ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(bx, by, wb, 0, TAU); ctx.fill();
}

function hand(ctx, x, y, ang, u, open, side, wave) {
  // back of the hand, seen from behind the person. d = along the forearm toward the fingers, p = across the hand
  const dx = Math.sin(ang), dy = -Math.cos(ang), px = -dy, py = dx;
  const P = (a, b) => [x + dx * a * u + px * b * u, y + dy * a * u + py * b * u];
  if (!open) {
    // fist: a rounded block, a row of four knuckles on top, the thumb wrapped across the side
    const c = P(0.042, 0);
    ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.036 * u, 0.047 * u, ang, 0, TAU); ctx.fill();
    for (let f = 0; f < 4; f++) { const k = P(0.08, (f - 1.5) * 0.017); ctx.beginPath(); ctx.arc(k[0], k[1], 0.0115 * u, 0, TAU); ctx.fill(); }
    const th = P(0.04, -side * 0.034); ctx.beginPath(); ctx.ellipse(th[0], th[1], 0.012 * u, 0.026 * u, ang - side * 0.4, 0, TAU); ctx.fill();
    return { x: c[0], y: c[1] };
  }
  // open hand: palm widening from the wrist to the knuckles, four separate tapered fingers, a thumb
  const w0 = P(0, -0.024), w1 = P(0, 0.024), k0 = P(0.07, -0.038), k1 = P(0.07, 0.038);
  ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); ctx.lineTo(k0[0], k0[1]); ctx.lineTo(k1[0], k1[1]); ctx.lineTo(w1[0], w1[1]); ctx.closePath(); ctx.fill();
  const lens = [0.058, 0.07, 0.074, 0.064];
  for (let f = 0; f < 4; f++) {
    const off = (f - 1.5) * 0.0245, base = P(0.068, off);
    const fa = ang + (f - 1.5) * 0.13 + wave * 0.07, L = lens[side > 0 ? f : 3 - f] * u;
    const tip = [base[0] + Math.sin(fa) * L, base[1] - Math.cos(fa) * L];
    limb(ctx, base[0], base[1], tip[0], tip[1], 0.0112 * u, 0.0085 * u);
  }
  const tb = P(0.022, -side * 0.026), ta = ang - side * 0.85;
  limb(ctx, tb[0], tb[1], tb[0] + Math.sin(ta) * 0.056 * u, tb[1] - Math.cos(ta) * 0.056 * u, 0.0135 * u, 0.0095 * u);
  const c = P(0.04, 0);
  return { x: c[0], y: c[1] };
}

function drawPerson(ctx, P, t, E, bottom) {
  const u = P.u, hs = P.hs || 1;
  const raise = sm(P.thr, P.thr + 0.18, E);
  const jump = P.jumper ? Math.pow(Math.max(0, Math.sin(t * P.jf + P.ph)), 2) * 0.07 * u * E : 0;
  const cx = P.x + Math.sin(t * P.sf + P.ph) * 0.02 * u;
  const sy = P.base - P.h * u - jump;          // shoulder line
  const sw = (P.fem ? 0.2 : 0.235) * u * P.sw;
  const bot = P.torsoBottom ?? bottom + 4;
  const nw = 0.04 * u;
  // torso: sloping trapezius, rounded deltoids, back tapering to the waist
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.9, bot);
  ctx.lineTo(cx - sw * 0.84, sy + 0.5 * u);
  ctx.quadraticCurveTo(cx - sw * 0.94, sy + 0.28 * u, cx - sw * 0.97, sy + 0.15 * u);
  ctx.bezierCurveTo(cx - sw * 1.05, sy + 0.06 * u, cx - sw * 1.0, sy - 0.005 * u, cx - sw * 0.8, sy - 0.02 * u);
  ctx.quadraticCurveTo(cx - sw * 0.42, sy - 0.035 * u, cx - nw * 1.3, sy - 0.08 * u);
  ctx.lineTo(cx - nw, sy - 0.15 * u * hs);
  ctx.lineTo(cx + nw, sy - 0.15 * u * hs);
  ctx.lineTo(cx + nw * 1.3, sy - 0.08 * u);
  ctx.quadraticCurveTo(cx + sw * 0.42, sy - 0.035 * u, cx + sw * 0.8, sy - 0.02 * u);
  ctx.bezierCurveTo(cx + sw * 1.0, sy - 0.005 * u, cx + sw * 1.05, sy + 0.06 * u, cx + sw * 0.97, sy + 0.15 * u);
  ctx.quadraticCurveTo(cx + sw * 0.94, sy + 0.28 * u, cx + sw * 0.84, sy + 0.5 * u);
  ctx.lineTo(cx + sw * 0.9, bot); ctx.closePath(); ctx.fill();
  // head (back view): cranium, small ears
  const hx = cx + Math.sin(t * P.sf * 1.3 + P.ph) * 0.01 * u, rx = 0.078 * u * hs, ry = 0.097 * u * hs, hy = sy - 0.2 * u * hs - ry * 0.25;
  ctx.beginPath(); ctx.ellipse(hx, hy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - rx * 0.97, hy + ry * 0.12, 0.014 * u * hs, 0.026 * u * hs, -0.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + rx * 0.97, hy + ry * 0.12, 0.014 * u * hs, 0.026 * u * hs, 0.15, 0, TAU); ctx.fill();
  ctx.beginPath();
  switch (P.hair) {
    case 0: ctx.ellipse(hx, hy - ry * 0.12, rx * 1.05, ry * 0.92, 0, 0, TAU); break;            // short crop
    case 1: {                                                                                   // long hair over the back
      const sway = Math.sin(t * 1.6 + P.ph) * 0.01 * u;
      ctx.moveTo(hx - rx * 1.04, hy - ry * 0.2);
      ctx.bezierCurveTo(hx - rx * 1.25, hy + ry * 1.1, hx - rx * 1.2 + sway, sy + 0.08 * u, hx - rx * 0.95 + sway, sy + 0.24 * u);
      ctx.lineTo(hx + rx * 0.95 + sway, sy + 0.24 * u);
      ctx.bezierCurveTo(hx + rx * 1.2 + sway, sy + 0.08 * u, hx + rx * 1.25, hy + ry * 1.1, hx + rx * 1.04, hy - ry * 0.2);
      ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(hx, hy - ry * 0.15, rx * 1.06, ry * 0.92, 0, 0, TAU); break;
    }
    case 2: ctx.ellipse(hx, hy - ry * 0.72, rx * 0.52, ry * 0.4, 0, 0, TAU); break;              // bun
    case 3:                                                                                     // cap with a side brim
      ctx.ellipse(hx, hy - ry * 0.18, rx * 1.12, ry * 0.88, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.beginPath();
      ctx.rect(hx + (P.side > 0 ? rx * 0.7 : -rx * 1.65), hy - ry * 0.24, rx * 0.95, 0.022 * u); break;
    case 4: {                                                                                   // long single plait down the back
      ctx.ellipse(hx, hy - ry * 0.1, rx * 1.04, ry * 0.94, 0, 0, TAU); ctx.fill();
      const sw2 = Math.sin(t * 1.4 + P.ph) * 0.03 * u;
      for (let k = 0; k < 9; k++) {
        const q = k / 8, bxp = hx + sw2 * q, byp = hy + ry * 0.9 + q * 0.42 * u, bw = lerp(0.034, 0.017, q) * u;
        ctx.beginPath(); ctx.ellipse(bxp, byp, bw, 0.03 * u, 0, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); break;
    }
    case 5:                                                                                     // curly volume (subtle)
      for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU, rr = 1.12 + 0.05 * Math.sin(a * 11 + P.ph); ctx.lineTo(hx + Math.cos(a) * rx * rr, hy - ry * 0.1 + Math.sin(a) * ry * rr * 0.95); }
      ctx.closePath(); break;
    case 6:                                                                                     // dupatta over the head
      ctx.moveTo(hx - rx * 1.18, hy + ry * 0.3); ctx.quadraticCurveTo(hx - rx * 1.25, hy - ry * 1.3, hx, hy - ry * 1.18);
      ctx.quadraticCurveTo(hx + rx * 1.25, hy - ry * 1.3, hx + rx * 1.18, hy + ry * 0.3);
      ctx.quadraticCurveTo(hx + sw * 0.6, sy - 0.02 * u, hx + sw * 0.85, sy + 0.05 * u); ctx.lineTo(hx - sw * 0.85, sy + 0.05 * u);
      ctx.quadraticCurveTo(hx - sw * 0.6, sy - 0.02 * u, hx - rx * 1.18, hy + ry * 0.3); ctx.closePath(); break;
  }
  ctx.fill();

  // arms: tapered upper arm and forearm, then a hand (open and waving, or a fist)
  const L1 = 0.3 * u, L2 = 0.27 * u;
  for (const side of [-1, 1]) {
    const mode = side < 0 ? P.armL : P.armR;
    if (mode === 'down' || raise < 0.04) continue;
    const S = [cx + side * sw * 0.8, sy + 0.055 * u];
    let a1 = 0, a2 = 0;
    const w = t * P.wf + P.ph + (side > 0 ? 1.3 : 0);
    if (mode === 'up') { a1 = side * (0.3 + 0.1 * Math.sin(w)); a2 = a1 + side * (0.08 + 0.3 * Math.sin(w * 1.4)); }
    else if (mode === 'clap') { a1 = side * (0.22 + 0.06 * Math.sin(w * 3)); a2 = -side * (0.35 + 0.3 * (0.5 + 0.5 * Math.sin(w * 3))); }
    else if (mode === 'pump') { const k = 0.5 + 0.5 * Math.sin(w * 1.6); a1 = side * (0.12 + 0.12 * k); a2 = a1 + side * (0.15 + 1.25 * k); }
    else { a1 = side * (0.18 + 0.05 * Math.sin(w * 0.7)); a2 = a1 - side * 0.1; }        // flag / phone
    const g = raise * (2 - raise);                   // seen from behind, a raised arm grows up out of the shoulder
    const ex = S[0] + Math.sin(a1) * L1 * g, ey = S[1] - Math.cos(a1) * L1 * g;
    const wx = ex + Math.sin(a2) * L2 * g, wy = ey - Math.cos(a2) * L2 * g;
    ctx.beginPath(); ctx.arc(S[0], S[1], 0.05 * u, 0, TAU); ctx.fill();
    limb(ctx, S[0], S[1], ex, ey, 0.05 * u, 0.037 * u);
    limb(ctx, ex, ey, wx, wy, 0.036 * u, 0.025 * u);
    if (g < 0.5) continue;
    const open = mode === 'up' || mode === 'clap';
    const hp = hand(ctx, wx, wy, a2, u, open, side, Math.sin(w * 2));
    if (raise < 0.4) continue;
    if (mode === 'flag') {                           // flag on a stick, cloth rippling
      const sx2 = hp.x + Math.sin(a2 * 0.3) * 0.75 * u, sy2 = hp.y - u * 0.75;
      ctx.beginPath(); ctx.moveTo(hp.x, hp.y + 0.06 * u); ctx.lineTo(sx2, sy2); ctx.lineWidth = 0.022 * u; ctx.lineCap = 'round'; ctx.stroke();
      const fw = 0.44 * u, fh = 0.29 * u, dir = P.flagDir;
      ctx.beginPath();
      for (let s = 0; s <= 10; s++) { const q = s / 10; ctx.lineTo(sx2 + dir * q * fw * (1 - 0.08 * Math.sin(q * 5 - t * 7 + P.ph) ** 2), sy2 + Math.sin(q * 5 - t * 7 + P.ph) * 0.06 * u * q + q * 0.04 * u); }
      for (let s = 10; s >= 0; s--) { const q = s / 10; ctx.lineTo(sx2 + dir * q * fw * (1 - 0.08 * Math.sin(q * 5 - t * 7 + P.ph - 0.4) ** 2), sy2 + fh * (1 - 0.15 * q) + Math.sin(q * 5 - t * 7 + P.ph - 0.4) * 0.06 * u * q + q * 0.06 * u); }
      ctx.closePath(); ctx.fill();
    } else if (mode === 'phone') {                   // phone held up, filming
      ctx.save(); ctx.translate(hp.x, hp.y - 0.06 * u); ctx.rotate(a2 * 0.3);
      ctx.beginPath(); ctx.roundRect(-0.045 * u, -0.085 * u, 0.09 * u, 0.16 * u, 0.012 * u); ctx.fill(); ctx.restore();
    }
  }
  return { headY: hy - ry, sy, cx };
}

function bananaPlant(g, x, by, h, r) {   // pseudo-stem and big paddle leaves, some split by the wind
  const stemTop = by - h * 0.36, sw = h * 0.03;
  g.fillStyle = g.trunkCol || '#6f8a3a';
  g.beginPath(); g.moveTo(x - sw * 1.4, by); g.quadraticCurveTo(x - sw, by - h * 0.2, x - sw * 0.8, stemTop); g.lineTo(x + sw * 0.8, stemTop); g.quadraticCurveTo(x + sw, by - h * 0.2, x + sw * 1.4, by); g.closePath(); g.fill();
  const leaves = 9;
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2.3 + (r() - 0.5) * 0.2, L = h * (0.42 + r() * 0.16), W = h * 0.1;
    const ex = x + Math.cos(a) * L, ey = stemTop + Math.sin(a) * L * 0.75 + L * 0.25 * Math.abs(Math.cos(a));
    const mx = (x + ex) / 2, my = (stemTop + ey) / 2 - L * 0.12, nx = -(ey - stemTop) / L, ny = (ex - x) / L;
    g.fillStyle = g.leafCol || '#4c9a2a';
    g.beginPath(); g.moveTo(x, stemTop); g.quadraticCurveTo(mx + nx * W, my + ny * W, ex, ey); g.quadraticCurveTo(mx - nx * W, my - ny * W, x, stemTop); g.fill();
    g.strokeStyle = 'rgba(210,230,140,.55)'; g.lineWidth = h * 0.006; g.beginPath(); g.moveTo(x, stemTop); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
    if (r() < 0.5) { g.strokeStyle = 'rgba(0,0,0,0)'; g.save(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { const q = 0.3 + r() * 0.6; g.beginPath(); g.moveTo(lerp(x, ex, q), lerp(stemTop, ey, q) - L * 0.12 * Math.sin(q * Math.PI)); g.lineTo(lerp(x, ex, q) + nx * W, lerp(stemTop, ey, q) + ny * W); g.strokeStyle = '#000'; g.stroke(); } g.restore(); }
  }
}
function casuarina(g, x, by, h, r) {     // tall, slim, feathery: the seaside tree of the Coromandel coast
  g.fillStyle = g.trunkCol || '#5b4331';
  g.beginPath(); g.moveTo(x - h * 0.012, by); g.lineTo(x - h * 0.004, by - h); g.lineTo(x + h * 0.004, by - h); g.lineTo(x + h * 0.012, by); g.closePath(); g.fill();
  g.strokeStyle = g.leafCol || '#2e6b2e'; g.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    const q = k / 25, y = by - h * (0.22 + q * 0.78), span = h * 0.17 * Math.sin(Math.PI * (0.15 + q * 0.85)) * (0.8 + r() * 0.4);
    for (const sd of [-1, 1]) {
      const bx = x + sd * span, droop = h * (0.03 + r() * 0.04);
      g.lineWidth = h * 0.006; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sd * span * 0.6, y - h * 0.01, bx, y + droop); g.stroke();
      g.lineWidth = h * 0.003;
      for (let n = 0; n < 7; n++) { const t2 = 0.3 + n * 0.1, px = lerp(x, bx, t2), py = lerp(y, y + droop, t2 * t2); g.beginPath(); g.moveTo(px, py); g.lineTo(px + sd * h * 0.01, py + h * (0.03 + r() * 0.03)); g.stroke(); }
    }
  }
}

/* ======================= atlases for the 3D road ======================= */
// Each atlas is a grid of cells; a cell holds one figure standing on the cell's bottom edge, centred.
// Figures are drawn in full colour (party maroon and yellow, festive clothes, green trees).

const SKIN = ['#8a5330', '#9c6238', '#6e3f21', '#b07448', '#7d4a2a'];
const SHIRT = ['#8e1418', '#f2b705', '#ffffff', '#8e1418', '#f2b705', '#4da3e0', '#e8562a', '#ffffff', '#6cc04a', '#b5162a', '#ffd23f'];
const SAREE = ['#c2185b', '#8e1418', '#f2b705', '#2e7d32', '#e65100', '#6a1b9a', '#d81b60', '#ff8f00'];
const LOWER = ['#f4efe2', '#f4efe2', '#2c3e66', '#3a3a3a', '#f4efe2', '#5a4632'];

export function peopleAtlas(cols = 8, rows = 4, cw = 128, ch = 256) {
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
  const g = c.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch; const t = tmp.getContext('2d');
  const r = rng(1992), modes = ['up', 'up', 'pump', 'clap', 'flag', 'flag', 'phone', 'down', 'down'];
  const meta = [];
  for (let i = 0; i < cols * rows; i++) {
    t.clearRect(0, 0, cw, ch); t.globalCompositeOperation = 'source-over'; t.fillStyle = t.strokeStyle = '#fff';
    const cx = cw / 2, by = ch - 2;
    const fem = r() < 0.42, kid = i % 11 === 7;
    const u = (kid ? 0.42 : 0.6 + r() * 0.04) * ch * 0.5;
    const pick = () => modes[Math.floor(r() * modes.length)];
    const legs = u * 0.86, hipY = by - legs, shoulderY = hipY - u * 0.6;
    const P = {
      x: cx, base: shoulderY + u * 1.0, u, fem, h: 1.0, sw: fem ? 0.88 : 0.98, torsoBottom: hipY + 2,
      hair: fem ? [1, 2, 4][Math.floor(r() * 3)] : [0, 0, 3, 5, 0][Math.floor(r() * 5)], side: r() < 0.5 ? -1 : 1,
      thr: 0, jumper: false, jf: 0, sf: 1, wf: 3, ph: r() * 10, armL: pick(), armR: pick(), flagDir: r() < 0.5 ? -1 : 1,
    };
    if (P.armL === 'flag' && P.armR === 'flag') P.armL = 'up';
    if (kid) { P.armL = 'up'; P.armR = 'flag'; }
    const info = drawPerson(t, P, P.ph, 1, hipY);
    const hw = u * (fem ? 0.17 : 0.18), cloth = fem || r() < 0.35;
    if (cloth) {
      t.beginPath(); t.moveTo(cx - hw * 1.02, hipY); t.lineTo(cx + hw * 1.02, hipY); t.lineTo(cx + hw * 1.25, by - u * 0.04); t.lineTo(cx - hw * 1.25, by - u * 0.04); t.closePath(); t.fill();
      t.beginPath(); t.ellipse(cx - hw * 0.5, by - u * 0.02, u * 0.07, u * 0.03, 0, 0, TAU); t.ellipse(cx + hw * 0.5, by - u * 0.02, u * 0.07, u * 0.03, 0, 0, TAU); t.fill();
    } else {
      const st = (r() - 0.5) * u * 0.12;
      limb(t, cx - hw * 0.5, hipY, cx - hw * 0.55 - st, by - u * 0.47, u * 0.085, u * 0.065);
      limb(t, cx - hw * 0.55 - st, by - u * 0.47, cx - hw * 0.6 - st, by - u * 0.04, u * 0.065, u * 0.045);
      limb(t, cx + hw * 0.5, hipY, cx + hw * 0.55 + st, by - u * 0.47, u * 0.085, u * 0.065);
      limb(t, cx + hw * 0.55 + st, by - u * 0.47, cx + hw * 0.6 + st, by - u * 0.04, u * 0.065, u * 0.045);
      t.beginPath(); t.ellipse(cx - hw * 0.6 - st, by - u * 0.02, u * 0.07, u * 0.03, 0, 0, TAU); t.ellipse(cx + hw * 0.6 + st, by - u * 0.02, u * 0.07, u * 0.03, 0, 0, TAU); t.fill();
    }
    t.fillRect(cx - hw * 0.98, hipY - u * 0.02, hw * 1.96, u * 0.08);
    // colour it in bands: flag cloth above the hands, skin on raised arms and face, hair, shirt, then the lower body
    t.globalCompositeOperation = 'source-atop';
    const skin = SKIN[Math.floor(r() * SKIN.length)], shirt = fem ? SAREE[Math.floor(r() * SAREE.length)] : SHIRT[Math.floor(r() * SHIRT.length)];
    const lower = fem ? shirt : cloth ? '#f4efe2' : LOWER[Math.floor(r() * LOWER.length)];
    const headTop = info.headY, sy = info.sy, flagLine = sy - u * 0.62;
    const fg = t.createLinearGradient(0, 0, 0, flagLine);                     // flags: maroon, yellow, maroon (the party flag)
    fg.addColorStop(0, '#8e1418'); fg.addColorStop(0.3, '#b3141b'); fg.addColorStop(0.42, '#f6c736'); fg.addColorStop(0.62, '#f6c736'); fg.addColorStop(0.74, '#b3141b'); fg.addColorStop(1, '#8e1418');
    t.fillStyle = fg; t.fillRect(0, 0, cw, Math.max(0, Math.min(flagLine, headTop - 2)));
    t.fillStyle = skin; t.fillRect(0, Math.min(flagLine, headTop - 2), cw, sy - Math.min(flagLine, headTop - 2));
    const hx0 = cx - u * 0.12, hx1 = cx + u * 0.12;
    t.fillStyle = '#17110d'; t.fillRect(hx0, headTop - 4, hx1 - hx0, (sy - headTop) * 0.42 + 4);              // hair (seen from behind)
    if (P.hair === 1 || P.hair === 4) t.fillRect(hx0, headTop, hx1 - hx0, sy - headTop + u * 0.35);       // long hair / plait down the back
    t.fillStyle = shirt; t.fillRect(0, sy - u * 0.02, cw, hipY - sy + u * 0.04);
    if (P.hair === 1 || P.hair === 4) { t.fillStyle = '#17110d'; t.fillRect(cx - u * 0.06, sy, u * 0.12, u * 0.33); }
    t.fillStyle = lower; t.fillRect(0, hipY + u * 0.02, cw, by - hipY);
    if (cloth && !fem) { t.fillStyle = '#c9a227'; t.fillRect(0, by - u * 0.12, cw, u * 0.03); }               // veshti border
    t.fillStyle = '#1b130e'; t.fillRect(0, by - u * 0.05, cw, u * 0.06);                                       // feet / sandals
    const sh = t.createLinearGradient(cx - u * 0.4, 0, cx + u * 0.4, 0); sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.3)');
    t.fillStyle = sh; t.fillRect(0, 0, cw, ch);                                                              // a little roundness
    g.drawImage(tmp, (i % cols) * cw, Math.floor(i / cols) * ch);
    meta.push({ kid });
  }
  return { canvas: c, cols, rows, aspect: cw / ch, meta };
}

export function treeAtlas(cols = 4, rows = 3, cw = 512, ch = 512) {
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
  const g = c.getContext('2d');
  const r = rng(2024), leaves = ['#2f7d32', '#3f8f2a', '#4c9a2a', '#2e6b2e', '#5aa43a'];
  for (let i = 0; i < cols * rows; i++) {
    const x0 = (i % cols) * cw, by = Math.floor(i / cols) * ch + ch - 4;
    g.save(); g.beginPath(); g.rect(x0, by - ch + 4, cw, ch); g.clip();
    g.trunkCol = i < 5 ? '#7a6248' : '#5b4331'; g.leafCol = leaves[i % leaves.length]; g.nutCol = '#7d6a1c';
    g.fillStyle = g.strokeStyle = g.leafCol;
    if (i < 5) coconutPalm(g, x0 + cw * (0.5 - (i % 2 ? 0.08 : -0.08)), by, ch * 0.8, (i % 2 ? 0.16 : -0.16) * (0.5 + r()), r);
    else if (i < 7) broadTree(g, x0 + cw / 2, by, ch * 0.92, r, i === 6);
    else if (i === 7) { g.fillStyle = '#3d8a2e'; shrubRow(g, x0 + 10, x0 + cw - 10, by - 6, ch * 0.9, r); }
    else if (i < 10) { g.trunkCol = '#7c8f45'; g.leafCol = i === 8 ? '#4f9e2c' : '#3f8a2a'; bananaPlant(g, x0 + cw / 2, by, ch * 0.92, r); }
    else { g.trunkCol = '#5b4331'; g.leafCol = i === 10 ? '#2f6b34' : '#3a7a3a'; casuarina(g, x0 + cw / 2, by, ch * 0.95, r); }
    // sunlight: brighter on the upper left, deeper underneath
    g.globalCompositeOperation = 'source-atop';
    const L = g.createLinearGradient(x0, by - ch, x0 + cw * 0.6, by); L.addColorStop(0, 'rgba(255,240,170,.28)'); L.addColorStop(0.5, 'rgba(255,255,255,0)'); L.addColorStop(1, 'rgba(0,30,0,.35)');
    g.fillStyle = L; g.fillRect(x0, by - ch, cw, ch);
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  return { canvas: c, cols, rows };
}
