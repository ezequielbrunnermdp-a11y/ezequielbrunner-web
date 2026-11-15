/* Ezequiel Brunner — las líneas de datos se dibujan en un hilo aparte (OffscreenCanvas):
   la página queda libre para responder al toque, al teclado y al desplazamiento. */
/* global FieldEngine */
importScripts('lines-engine.js?v=20261115');

var field = null, running = false, last = 0, gap = 22, still = false, timer = 0;
var raf = self.requestAnimationFrame ? self.requestAnimationFrame.bind(self) : function (f) { return setTimeout(function () { f(performance.now()); }, 16); };

function loop(now) {
  timer = 0;
  if (!running || !field) return;
  if (last && now - last < gap) { timer = raf(loop); return; }
  var dt = last ? Math.min(64, now - last) : 16;
  last = now;
  field.frame(dt, false);
  timer = raf(loop);
}
function start() { if (!running && !still) { running = true; last = 0; if (!timer) timer = raf(loop); } }

self.onmessage = function (e) {
  var m = e.data;
  if (m.type === 'init') {
    field = new FieldEngine(m.canvas.getContext('2d'), m);
    field.resize(m.w, m.h, m.dpr);
    gap = m.gap || 22; still = !!m.still;
    field.frame(16, true);
    self.postMessage({ type: 'ready' });
    if (!still && m.run) start();
  } else if (!field) {
    return;
  } else if (m.type === 'resize') {
    field.resize(m.w, m.h, m.dpr); field.frame(16, still || !running);
  } else if (m.type === 'pointer') {
    field.pointer(m.x, m.y, m.k);
  } else if (m.type === 'active') {
    field.activate(m.v);
  } else if (m.type === 'run') {
    if (m.on) start(); else running = false;
  }
};
