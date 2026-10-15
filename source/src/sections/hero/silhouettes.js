// Layered silhouettes for the TVK hero, all drawn in code (Canvas 2D):
//   L0 hills  ->  L1 skyline (one temple, one church, one mosque, trees)  ->  L2 far crowd  ->  [3D flag]
//   ->  L3 near crowd  ->  L4 foreground heads.
// The skyline is drawn once; the crowds are animated (arms rise, hands wave, people jump, flags wave)
// and get more excited as the flag unfurls. Each layer is moved with CSS transforms for parallax.

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function rng(seed) {                     // mulberry32: same layout on every visit
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ======================= skyline: one temple, one church, one mosque ======================= */
// shapes are added to the current path of `g`; the caller fills once

function gopuram(g, cx, by, h, r, tiers = 8) {
  const bw = h * 0.6, tw = h * 0.24, baseH = h * 0.17, crownY = by - h * 0.83;
  g.rect(cx - bw / 2, by - baseH, bw, baseH + 2);
  // base cornice
  g.rect(cx - bw / 2 - h * 0.012, by - baseH - h * 0.012, bw + h * 0.024, h * 0.014);
  const top0 = by - baseH - h * 0.012;
  const th = (top0 - crownY) / tiers;
  for (let k = 0; k < tiers; k++) {
    const f = k / tiers, f1 = (k + 1) / tiers;
    const wB = lerp(bw * 0.9, tw, f), wT = lerp(bw * 0.9, tw, f1);
    const y0 = top0 - k * th, y1 = y0 - th;
    // tapered tier
    g.moveTo(cx - wB / 2, y0 + 1); g.lineTo(cx - wT / 2, y1); g.lineTo(cx + wT / 2, y1); g.lineTo(cx + wB / 2, y0 + 1); g.closePath();
    // projecting cornice at the top of the tier
    const lw = wT + h * 0.014;
    g.rect(cx - lw / 2, y1 - h * 0.008, lw, h * 0.012);
    // sculpture/kudu bumps standing on the cornice
    const n = Math.max(3, Math.round(lw / (h * 0.035)));
    for (let s = 1; s < n; s++) {
      const x = cx - lw / 2 + (s / n) * lw, bh = h * (0.007 + r() * 0.009), bwid = h * 0.011;
      g.moveTo(x - bwid / 2, y1 - h * 0.006); g.lineTo(x - bwid / 2, y1 - h * 0.006 - bh * 0.6);
      g.quadraticCurveTo(x, y1 - h * 0.006 - bh * 1.4, x + bwid / 2, y1 - h * 0.006 - bh * 0.6); g.lineTo(x + bwid / 2, y1 - h * 0.006); g.closePath();
    }
  }
  // barrel-vault crown (shala) with curled horn ends
  const cw = tw * 1.08, cy = crownY - h * 0.004, chh = h * 0.07;
  g.moveTo(cx - cw / 2, cy); g.lineTo(cx - cw / 2, cy - chh * 0.5);
  g.quadraticCurveTo(cx - cw / 2, cy - chh * 1.25, cx, cy - chh * 1.25);
  g.quadraticCurveTo(cx + cw / 2, cy - chh * 1.25, cx + cw / 2, cy - chh * 0.5);
  g.lineTo(cx + cw / 2, cy); g.closePath();
  for (const s of [-1, 1]) {           // horns
    const x = cx + s * cw / 2;
    g.moveTo(x, cy - chh * 0.2); g.quadraticCurveTo(x + s * h * 0.05, cy - chh * 0.5, x + s * h * 0.03, cy - chh * 1.25);
    g.quadraticCurveTo(x + s * h * 0.02, cy - chh * 0.7, x - s * h * 0.005, cy - chh * 0.6); g.closePath();
  }
  // kalasam finials
  const kn = tiers >= 8 ? 7 : 5;
  for (let s = 0; s < kn; s++) {
    const x = cx - cw * 0.38 + (s / (kn - 1)) * cw * 0.76, y = cy - chh * 1.2;
    const kr = h * 0.011;
    g.moveTo(x + kr, y - kr); g.arc(x, y - kr, kr, 0, Math.PI * 2);
    g.moveTo(x - kr * 0.35, y - kr * 1.8); g.lineTo(x, y - kr * 1.8 - h * 0.035); g.lineTo(x + kr * 0.35, y - kr * 1.8); g.closePath();
  }
}


function church(g, cx, by, h) {   // Gothic church: gabled facade, side aisles, central bell tower and spire with a cross
  const fw = h * 0.34, fh = h * 0.4;
  g.rect(cx - fw / 2, by - fh, fw, fh + 2);                                   // facade
  g.moveTo(cx - fw / 2, by - fh); g.lineTo(cx, by - fh - h * 0.12); g.lineTo(cx + fw / 2, by - fh); g.closePath();   // gable
  for (const s of [-1, 1]) {
    const ax = cx + s * (fw / 2 + h * 0.09);                                  // side aisles with lean-to roofs
    g.rect(ax - h * 0.09, by - h * 0.24, h * 0.18, h * 0.24 + 2);
    g.moveTo(ax - s * h * 0.09, by - h * 0.3); g.lineTo(ax + s * h * 0.09, by - h * 0.24); g.lineTo(ax - s * h * 0.09, by - h * 0.24); g.closePath();
    const px = cx + s * fw / 2;                                               // corner pinnacles
    g.rect(px - h * 0.016, by - fh - h * 0.05, h * 0.032, h * 0.05);
    g.moveTo(px - h * 0.02, by - fh - h * 0.05); g.lineTo(px, by - fh - h * 0.13); g.lineTo(px + h * 0.02, by - fh - h * 0.05); g.closePath();
  }
  const tw = h * 0.12, tTop = by - h * 0.7;                                   // bell tower
  g.rect(cx - tw / 2, tTop, tw, h * 0.7);
  g.rect(cx - tw / 2 - h * 0.01, tTop, tw + h * 0.02, h * 0.014);
  for (const s of [-1, 1]) { const px = cx + s * tw / 2; g.moveTo(px - h * 0.012, tTop); g.lineTo(px, tTop - h * 0.07); g.lineTo(px + h * 0.012, tTop); g.closePath(); }
  g.moveTo(cx - tw * 0.42, tTop); g.lineTo(cx, by - h * 0.94); g.lineTo(cx + tw * 0.42, tTop); g.closePath();   // spire
  g.rect(cx - h * 0.006, by - h * 1.02, h * 0.012, h * 0.09);                 // cross
  g.rect(cx - h * 0.028, by - h * 0.995, h * 0.056, h * 0.012);
  return { win: { x: cx, y: by - fh * 0.62, r: fw * 0.17 }, bell: { x: cx, y: tTop + h * 0.08, w: tw * 0.36, hh: h * 0.07 } };
}

function onion(g, x, base, w, hh) {  // onion dome sitting on `base`
  g.moveTo(x - w * 0.42, base);
  g.bezierCurveTo(x - w * 0.62, base - hh * 0.35, x - w * 0.5, base - hh * 0.72, x, base - hh);
  g.bezierCurveTo(x + w * 0.5, base - hh * 0.72, x + w * 0.62, base - hh * 0.35, x + w * 0.42, base);
  g.closePath();
}

function mosque(g, cx, by, h) {   // prayer hall, arched parapet, big onion dome on a drum, two minarets
  const hw = h * 0.56, hh = h * 0.24;
  g.rect(cx - hw / 2, by - hh, hw, hh + 2);
  for (let s = 0; s <= 8; s++) {                                              // parapet merlons
    const x = cx - hw / 2 + (s / 8) * hw;
    g.moveTo(x - h * 0.014, by - hh); g.lineTo(x - h * 0.014, by - hh - h * 0.018); g.quadraticCurveTo(x, by - hh - h * 0.04, x + h * 0.014, by - hh - h * 0.018); g.lineTo(x + h * 0.014, by - hh); g.closePath();
  }
  const dTop = by - hh - h * 0.07;
  g.rect(cx - h * 0.13, dTop, h * 0.26, h * 0.07 + 1);                         // drum
  onion(g, cx, dTop, h * 0.32, h * 0.3);                                       // main dome
  g.rect(cx - h * 0.005, dTop - h * 0.36, h * 0.01, h * 0.08);                 // finial
  for (const s of [-1, 1]) {                                                    // small corner domes
    const x = cx + s * hw * 0.36;
    g.rect(x - h * 0.04, by - hh - h * 0.03, h * 0.08, h * 0.03 + 1);
    onion(g, x, by - hh - h * 0.03, h * 0.1, h * 0.1);
    g.rect(x - h * 0.003, by - hh - h * 0.17, h * 0.006, h * 0.05);
  }
  const mins = [];
  for (const s of [-1, 1]) {                                                    // minarets
    const x = cx + s * (hw / 2 + h * 0.06), mw = h * 0.055, top = by - h * 0.88;
    g.moveTo(x - mw * 0.62, by + 2); g.lineTo(x - mw / 2, top); g.lineTo(x + mw / 2, top); g.lineTo(x + mw * 0.62, by + 2); g.closePath();
    for (const f of [0.45, 0.7]) g.rect(x - mw * 0.95, by - h * f, mw * 1.9, h * 0.018);   // balconies
    g.rect(x - mw * 0.75, top - h * 0.01, mw * 1.5, h * 0.012);
    g.rect(x - mw * 0.42, top - h * 0.07, mw * 0.84, h * 0.06);                // lantern
    onion(g, x, top - h * 0.07, mw * 1.05, h * 0.08);
    g.rect(x - h * 0.003, top - h * 0.2, h * 0.006, h * 0.06);
    mins.push({ x, y: top - h * 0.205 });
  }
  return { crescents: [{ x: cx, y: dTop - h * 0.375, r: h * 0.026 }, ...mins.map((m) => ({ x: m.x, y: m.y, r: h * 0.018 }))] };
}

function crescent(g, x, y, r) {      // a crescent moon finial (horns up)
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(x, y - r * 0.42, r * 0.86, 0, TAU); g.fill();
  g.restore();
}

/* ======================= trees ======================= */

function coconutPalm(g, x, by, h, lean, r) {
  // slender trunk with a gentle S-curve and a flared base
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
  g.beginPath();                                                                // coconut cluster
  for (let k = 0; k < 5; k++) { const cx = tx + (k - 2) * h * 0.016, cy = ty + h * 0.02 + (k % 2) * h * 0.012; g.moveTo(cx + h * 0.016, cy); g.arc(cx, cy, h * 0.016, 0, TAU); }
  g.fill();
}

function broadTree(g, x, by, h, r, roots = false) {   // neem / banyan style: branching trunk and leafy clumps
  const tips = [];
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

function makeCrowd({ seed, count, W, bottom, uMin, uMax, rows = 1, modes, kids = 0, flagShare = 0.15 }) {
  const r = rng(seed), people = [];
  for (let i = 0; i < count; i++) {
    const row = i % rows;
    const fem = r() < 0.42;
    const u = lerp(uMin, uMax, r()) * (1 - row * 0.18) * (fem ? 0.94 : 1);
    const pick = () => modes[Math.floor(r() * modes.length)];
    const P = {
      x: (i + 0.5 + (r() - 0.5) * 0.8) / count * W, base: bottom + u * (0.35 + row * 0.12 + r() * 0.15), u, fem,
      h: 0.95 + r() * 0.2, sw: fem ? 0.85 + r() * 0.15 : 0.92 + r() * 0.22,
      hair: fem ? [1, 2, 4, 6][Math.floor(r() * 4)] : [0, 0, 3, 5, 0][Math.floor(r() * 5)], side: r() < 0.5 ? -1 : 1,
      thr: r() * 0.55, jumper: r() < 0.4, jf: 5 + r() * 3, sf: 0.8 + r() * 0.8, wf: 2.5 + r() * 2.5, ph: r() * 10,
      armL: pick(), armR: pick(), flagDir: r() < 0.5 ? -1 : 1, row,
    };
    if (r() < flagShare) { if (r() < 0.5) P.armR = 'flag'; else P.armL = 'flag'; }
    if (P.armL === 'flag' && P.armR === 'flag') P.armL = 'up';
    people.push(P);
  }
  // a few kids on shoulders (bigger heads for their size)
  for (let k = 0; k < kids; k++) {
    const host = people[Math.floor(r() * people.length)];
    host.kid = { x: host.x, u: host.u * 0.52, hs: 1.25, h: 1, sw: 0.9, fem: r() < 0.5, hair: [0, 2, 5][Math.floor(r() * 3)], side: 1, thr: 0, jumper: false, jf: 0, sf: 1.4, wf: 4, ph: r() * 10, armL: 'up', armR: r() < 0.5 ? 'flag' : 'up', flagDir: 1 };
    host.armL = host.armR = 'down';
  }
  people.sort((a, b) => b.row - a.row);   // back rows first
  return people;
}

/* ======================= the layer system ======================= */
export function createSilhouettes(sticky, { phone }) {
  const mk = (cls) => { const c = document.createElement('canvas'); c.className = 'sil ' + cls; c.setAttribute('aria-hidden', 'true'); return c; };
  const L = {
    glow: Object.assign(document.createElement('div'), { className: 'sil-glow' }),
    hills: mk('sil-hills'), sky: mk('sil-sky'), far: mk('sil-far'), near: mk('sil-near'), fg: mk('sil-fg'),
  };
  const stage = sticky.querySelector('#stage');
  sticky.insertBefore(L.hills, stage); sticky.insertBefore(L.glow, stage); sticky.insertBefore(L.sky, stage); sticky.insertBefore(L.far, stage);
  stage.after(L.fg); stage.after(L.near);

  // depth: how far each layer moves for cursor / scroll parallax (far = small)
  const depth = { hills: 0.06, sky: 0.14, far: 0.26, near: 0.42, fg: 1.6 };
  let vw = 0, vh = 0, over = 0, crowds = {};

  function sizeCanvas(c, w, h, dprCap) {
    const d = Math.min(devicePixelRatio || 1, dprCap);
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return g;
  }

  function drawHills(g, w, h) {
    const r = rng(11);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(98,22,30,.75)'); grd.addColorStop(1, 'rgba(60,12,20,.9)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, h);
    const a = [r() * 6, r() * 6, r() * 6];
    for (let x = 0; x <= w; x += 6) {
      const q = x / w;
      const y = h * (0.42 + 0.16 * Math.sin(q * 5.3 + a[0]) + 0.08 * Math.sin(q * 13.1 + a[1]) + 0.03 * Math.sin(q * 37 + a[2]));
      g.lineTo(x, y);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
  }

  function drawSkyline(g, w, h) {
    const r = rng(7), by = h;
    const col = '#170308';
    g.fillStyle = col; g.strokeStyle = col;
    const S = (x) => x * w;
    // one temple, one church, one mosque, with coconut palms and broad trees between them
    const items = phone
      ? [['tree', 0.02, 0.36], ['temple', 0.2, 0.8], ['palm', 0.37, 0.5, 0.06], ['mosque', 0.55, 0.62], ['palm', 0.7, 0.42, -0.05], ['church', 0.86, 0.68]]
      : [['palm', 0.025, 0.5, 0.08], ['tree', 0.08, 0.4, 1], ['temple', 0.2, 0.92], ['palm', 0.31, 0.52, 0.06], ['palm', 0.335, 0.4, -0.08],
         ['tree', 0.42, 0.42], ['mosque', 0.535, 0.78], ['tree', 0.645, 0.38, 1], ['palm', 0.695, 0.5, -0.07], ['church', 0.8, 0.84],
         ['palm', 0.895, 0.46, 0.08], ['tree', 0.955, 0.44]];
    shrubRow(g, 0, w, by, h, r);
    const extras = {};
    g.beginPath();
    for (const it of items) {
      const [k, fx, fh] = it, x = S(fx), hh = fh * h;
      if (k === 'temple') gopuram(g, x, by, hh, r, 9);
      else if (k === 'church') extras.church = church(g, x, by, hh);
      else if (k === 'mosque') extras.mosque = mosque(g, x, by, hh);
    }
    g.fill();
    for (const it of items) {
      if (it[0] === 'palm') coconutPalm(g, S(it[1]), by, it[2] * h, it[3], r);
      else if (it[0] === 'tree') broadTree(g, S(it[1]), by, it[2] * h, r, !!it[3]);
    }
    if (extras.mosque) for (const c of extras.mosque.crescents) crescent(g, c.x, c.y, c.r);
    // warm light through the church's rose window and belfry
    if (extras.church) {
      const b = extras.church.bell;
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.moveTo(b.x - b.w / 2, b.y + b.hh); g.lineTo(b.x - b.w / 2, b.y + b.w / 2); g.arc(b.x, b.y + b.w / 2, b.w / 2, Math.PI, 0); g.lineTo(b.x + b.w / 2, b.y + b.hh); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(255,196,110,.85)';
      g.fillRect(b.x - b.w / 2, b.y, b.w, b.hh);
      g.restore();
    }
    return extras;
  }

  let skyExtras = {}, frame = 0;
  function layout() {
    vw = sticky.clientWidth; vh = sticky.clientHeight;
    over = phone ? 40 : Math.round(vw * 0.05);
    const W = vw + over * 2;
    const hH = Math.round(vh * (phone ? 0.42 : 0.5)), sH = Math.round(vh * (phone ? 0.36 : 0.46));
    drawHills(sizeCanvas(L.hills, W, hH, 1.5), W, hH);
    skyExtras = drawSkyline(sizeCanvas(L.sky, W, sH, 2), W, sH);
    // crowd canvases (redrawn every frame)
    const fH = Math.round(vh * (phone ? 0.34 : 0.36)), nH = Math.round(vh * (phone ? 0.5 : 0.62)), gH = Math.round(vh * (phone ? 0.42 : 0.55));
    crowds.far = { g: sizeCanvas(L.far, W, fH, 1), W, H: fH };
    crowds.near = { g: sizeCanvas(L.near, W, nH, 1.25), W, H: nH };
    crowds.fg = { g: sizeCanvas(L.fg, W, gH, 0.55), W, H: gH };   // drawn small and scaled up = a soft out-of-focus look without a CSS blur
    const uF = vh * (phone ? 0.06 : 0.07), uN = vh * (phone ? 0.155 : 0.2), uG = vh * (phone ? 0.3 : 0.48);
    crowds.far.people = makeCrowd({ seed: 21, count: Math.round(W / (uF * 0.42)), W, bottom: fH * 0.6, uMin: uF * 0.85, uMax: uF * 1.1, rows: 3,
      modes: ['up', 'up', 'down', 'clap', 'pump'], flagShare: 0.18 });
    crowds.near.people = makeCrowd({ seed: 33, count: Math.max(6, Math.round(W / (uN * 0.62))), W, bottom: nH, uMin: uN * 0.85, uMax: uN * 1.1, rows: 2,
      modes: ['up', 'pump', 'down', 'phone', 'up', 'clap'], kids: phone ? 1 : 2, flagShare: phone ? 0.12 : 0.3 });
    crowds.fg.people = makeCrowd({ seed: 51, count: phone ? 3 : 5, W, bottom: gH, uMin: uG * 0.9, uMax: uG * 1.1, rows: 1,
      modes: ['down'], flagShare: 0 });
    crowds.far.color = '#120306'; crowds.near.color = '#060102'; crowds.fg.color = '#000';
    // skyline + hills stand just behind the far crowd's shoulders
    L.hills.style.bottom = L.sky.style.bottom = Math.round(fH * 0.3) + 'px';
    L.glow.style.bottom = Math.round(fH * 0.3) + 'px';
    for (const P of crowds.fg.people) P.base = gH + P.u * (0.62 + (P.x % 7) * 0.02);     // only heads, shoulders and raised arms show
  }

  function drawCrowd(c, t, E, rim) {
    const { g, W, H, people } = c;
    g.clearRect(0, 0, W, H);
    const pass = (color, dy) => {
      g.fillStyle = color; g.strokeStyle = color;
      for (const P of people) {
        const p = dy ? { ...P, base: P.base + dy } : P;
        const top = drawPerson(g, p, t, E, H);
        if (P.kid) drawPerson(g, { ...P.kid, x: top.cx, base: top.headY + P.u * 0.32 + dy, torsoBottom: top.headY + P.u * 0.3 + dy }, t, E, H);
      }
    };
    if (rim) pass(rim, -Math.max(1, c === crowds.near ? 2 : 1));   // warm light catching the top edges
    pass(c.color, 0);
  }
  layout();
  addEventListener('resize', layout);

  return {
    update({ prog, hoist, mx, my, t }) {
      // excitement: calm murmur -> cheering as the flag reaches the top and opens
      const E = 0.18 + 0.82 * sm(0.42, 0.74, prog);
      // the small far crowd and the soft foreground heads redraw on alternate frames (30 fps is plenty for them)
      frame++;
      if (frame % 2 === 0 || frame < 3) drawCrowd(crowds.far, t, E, 'rgba(255,170,90,.25)');
      drawCrowd(crowds.near, t, E, 'rgba(255,190,100,.55)');
      if (frame % 2 === 1 || frame < 3) drawCrowd(crowds.fg, t, E, null);
      // parallax: as the camera rises with the flag the ground sinks (near layers more); cursor shifts by depth
      const sink = (phone ? 0.1 : 0.2) * vh * hoist;
      const px = phone ? 26 : 44, py = phone ? 8 : 16;
      for (const k of ['hills', 'sky', 'far', 'near', 'fg']) {
        const d = depth[k];
        L[k].style.transform = `translate3d(${(-over - mx * px * d).toFixed(1)}px, ${(sink * d - my * py * d).toFixed(1)}px, 0)`;
      }
      // the horizon brightens like a sunrise as the flag goes up
      L.glow.style.opacity = (0.45 + 0.55 * sm(0.1, 0.8, prog)).toFixed(3);
      L.glow.style.transform = `translate3d(${(-mx * px * 0.1).toFixed(1)}px, ${(sink * 0.1).toFixed(1)}px, 0)`;
    },
  };
}
