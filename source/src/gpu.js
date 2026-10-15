// Shared GPU housekeeping for every WebGL scene on the page.
//  - registerRenderer(r, { cap }) wraps a renderer as it is created:
//      * its pixel ratio is capped (full-screen 3D at a laptop's 2x density is the single biggest GPU cost),
//      * the first scene + camera (+ render target) it draws are remembered, for warming up.
//  - warmUp(list) draws each remembered scene once with EVERYTHING switched on (hidden props, far-away
//    set pieces, level-of-detail meshes, things outside the camera) and with the same render target the
//    section uses. That compiles every shader (including shadow-map variants) and uploads every mesh and
//    texture while the intro is up, instead of freezing the page the first time each thing scrolls into view.
export const DPR_CAP = 1.5;
export const renderers = [];

export function registerRenderer(r, { cap = DPR_CAP, name = '', adaptive = true } = {}) {
  const e = { r, cap, name, adaptive, scene: null, camera: null, target: null, frames: 0, warmed: false };
  const setPR = r.setPixelRatio.bind(r);
  e.setPR = setPR;
  r.setPixelRatio = (v) => setPR(Math.min(v || 1, e.cap));
  const render = r.render.bind(r);
  e.rawRender = render;
  r.render = (scene, camera) => {
    if (!e.scene && scene && camera && !camera.isOrthographicCamera) { e.scene = scene; e.camera = camera; e.target = r.getRenderTarget(); }
    render(scene, camera); e.frames++;
  };
  renderers.push(e);
  return r;
}

export const warmLog = [];
export function warmUp(list = renderers) {
  for (const e of list) {
    warmLog.push([e.name, !!e.scene, e.warmed, e.frames]);
    if (e.warmed || !e.scene) continue;
    e.warmed = true;
    const undo = [];
    try {
      e.scene.traverse((o) => {
        if (!o.visible) { undo.push(() => { o.visible = false; }); o.visible = true; }
        if (o.frustumCulled) { undo.push(() => { o.frustumCulled = true; }); o.frustumCulled = false; }
      });
      const prev = e.r.getRenderTarget();
      e.r.setRenderTarget(e.target);
      e.rawRender(e.scene, e.camera);
      e.r.setRenderTarget(prev);
    } catch (err) { console.warn('warmUp', e.name, err); }
    undo.forEach((f) => f());
  }
}

// Adaptive resolution: if a section can't hold a smooth frame rate on this machine, render it at a slightly
// lower resolution (one step at a time, never below 1x). The canvas keeps its size on screen.
export function degrade(name) {
  const e = renderers.find((x) => x.name === name);
  if (!e || !e.adaptive) return false;
  const now = Math.min(devicePixelRatio || 1, e.cap);
  if (now <= 1) return false;
  e.cap = Math.max(1, now - 0.25);
  e.setPR(e.cap);                                  // three resizes the drawing buffer in place
  return true;
}
