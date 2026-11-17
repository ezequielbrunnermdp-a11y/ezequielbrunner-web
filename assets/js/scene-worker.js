/* Ezequiel Brunner — escena 3D en un hilo aparte (OffscreenCanvas): la página nunca espera al dibujo. */
importScripts('scene-engine.js?v=20261117');

var eng = null, running = false, still = false, last = 0, gap = 16;
var raf = self.requestAnimationFrame ? function (f) { return self.requestAnimationFrame(f); }
                                     : function (f) { return setTimeout(function () { f(performance.now()); }, 16); };

function loop(now) {
  if (!running || !eng) return;
  if (last && now - last < gap - 1) { raf(loop); return; }
  var dt = last ? now - last : 16; last = now;
  eng.frame(dt);
  raf(loop);
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.type === 'init') {
    var gl = null;
    try {
      gl = m.canvas.getContext('webgl2', { antialias: !m.lite, alpha: false, depth: true, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: m.mobile || m.lite ? 'low-power' : 'default' });
    } catch (err) { gl = null; }
    if (!gl) { self.postMessage({ type: 'fail' }); return; }
    try {
      eng = new self.SceneEngine(gl, m);
      eng.resize(m.w, m.h, m.dpr); eng.layout(m.layout); eng.setSide(0);
      eng.frame(16);
    } catch (err) { eng = null; self.postMessage({ type: 'fail', msg: String(err && err.message || err) }); return; }
    still = !!m.still; gap = m.gap || 16;
    m.canvas.addEventListener && m.canvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); running = false; self.postMessage({ type: 'fail' }); });
    self.postMessage({ type: 'ready' });
    return;
  }
  if (!eng) return;
  if (m.type === 'run') {
    var on = !!m.on && !still;
    if (on && !running) { running = true; last = 0; raf(loop); } else if (!on) running = false;
  } else if (m.type === 'resize') { eng.resize(m.w, m.h, m.dpr); eng.layout(m.layout); eng.frame(16); }
  else if (m.type === 'pointer') eng.pointer(m.x, m.y, m.k);
  else if (m.type === 'side') { eng.setSide(m.v); if (still) eng.frame(16); }
  else if (m.type === 'scroll') eng.setScroll(m.v);
};
