/* Ezequiel Brunner — controlador de la escena 3D de la portada.
   Dibuja en un hilo aparte si el navegador lo permite (Worker + OffscreenCanvas); si no, en la página cuando
   terminó de cargar. Sin WebGL2: una imagen fija de la misma escena. Movimiento reducido o ahorro de datos:
   un solo cuadro quieto. Se pausa fuera de pantalla y con la pestaña oculta. Equipos modestos: menos resolución
   y 30 cuadros por segundo. Responde al cursor, a la inclinación del teléfono (donde no pide permiso), a los
   accesos (cálido para Gastronomía, frío para Automatización) y al desplazamiento. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var cv = D.querySelector('canvas[data-scene]');
  if (!cv || !W.requestAnimationFrame) return;
  var host = cv.closest('[data-stage]') || cv.parentElement;
  var V = '20261117';
  var RM = H.classList.contains('rm');
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var NAV = W.navigator || {}, CONN = NAV.connection || {};
  var LITE = (NAV.hardwareConcurrency || 8) <= 4 || (NAV.deviceMemory || 8) <= 4;
  var STILL = RM || !!CONN.saveData;
  var OFF = !!(W.Worker && W.OffscreenCanvas && HTMLCanvasElement.prototype.transferControlToOffscreen);

  function css(name, dflt) { var v = parseFloat(getComputedStyle(host).getPropertyValue(name)); return isNaN(v) ? dflt : v; }
  function layout() { return { l: css('--scene-l', .44), r: css('--scene-r', .97), t: css('--scene-t', .14), b: css('--scene-b', .9), mobile: css('--scene-mobile', 0) > 0 }; }
  function measure() {
    var w = cv.clientWidth, h = cv.clientHeight, d = Math.min(W.devicePixelRatio || 1, LITE ? 1.25 : 1.5);
    // tope de píxeles: una pantalla grande no tiene por qué costar más batería
    while (w * h * d * d > 3.2e6 && d > 1) d -= .125;
    return { w: w, h: h, dpr: d };
  }

  function poster() {
    H.classList.add('no-3d');
    if (host.querySelector('.stage-poster')) return;
    var box = cv.parentElement, pic = D.createElement('picture');
    pic.className = 'stage-poster';
    pic.innerHTML = '<source media="(max-width: 760px)" type="image/avif" srcset="assets/img/escena-m.avif">' +
      '<source media="(max-width: 760px)" type="image/webp" srcset="assets/img/escena-m.webp">' +
      '<source type="image/avif" srcset="assets/img/escena.avif"><img src="assets/img/escena.webp" alt="" decoding="async">';
    box.appendChild(pic);
  }

  var post = null;
  function start() {
    var s = measure();
    if (!s.w || !s.h) return;
    var init = { type: 'init', w: s.w, h: s.h, dpr: s.dpr, lite: LITE, still: STILL, mobile: !FINE, gap: (LITE || !FINE) ? 33 : 16, layout: layout() };
    if (OFF) {
      var off;
      try { off = cv.transferControlToOffscreen(); } catch (e) { return mainThread(init); }
      var wk = new Worker('assets/js/scene-worker.js?v=' + V);
      wk.onmessage = function (e) {
        var t = e.data && e.data.type;
        if (t === 'ready') ready();
        else if (t === 'fail') { wk.terminate(); post = null; replaceCanvas(); afterLoad(function () { mainThread(init); }); }
      };
      wk.onerror = function () { wk.terminate(); post = null; poster(); };
      init.canvas = off;
      wk.postMessage(init, [off]);
      post = function (m) { wk.postMessage(m); };
      wire();
    } else afterLoad(function () { mainThread(init); });
  }

  // si el hilo aparte no pudo crear WebGL2, el lienzo ya fue transferido: se usa uno nuevo
  function replaceCanvas() {
    var n = cv.cloneNode(false); cv.parentNode.replaceChild(n, cv); cv = n;
  }
  function afterLoad(fn) { if (D.readyState === 'complete') setTimeout(fn, 120); else W.addEventListener('load', function () { setTimeout(fn, 120); }); }

  function mainThread(init) {
    if (!W.WebGL2RenderingContext) return poster();
    var go = function () {
      var gl = null;
      try { gl = cv.getContext('webgl2', { antialias: !LITE, alpha: false, depth: true, stencil: false, powerPreference: !FINE || LITE ? 'low-power' : 'default' }); } catch (e) { gl = null; }
      if (!gl || !W.SceneEngine) return poster();
      var eng;
      try { eng = new W.SceneEngine(gl, init); eng.resize(init.w, init.h, init.dpr); eng.layout(init.layout); eng.setSide(0); eng.frame(16); }
      catch (e) { return poster(); }
      var running = false, last = 0;
      function loop(now) {
        if (!running) return;
        if (last && now - last < init.gap - 1) { requestAnimationFrame(loop); return; }
        var dt = last ? now - last : 16; last = now; eng.frame(dt); requestAnimationFrame(loop);
      }
      post = function (m) {
        if (m.type === 'run') { var on = m.on && !init.still; if (on && !running) { running = true; last = 0; requestAnimationFrame(loop); } else if (!on) running = false; }
        else if (m.type === 'resize') { eng.resize(m.w, m.h, m.dpr); eng.layout(m.layout); eng.frame(16); }
        else if (m.type === 'pointer') eng.pointer(m.x, m.y, m.k);
        else if (m.type === 'side') { eng.setSide(m.v); if (init.still) eng.frame(16); }
        else if (m.type === 'scroll') eng.setScroll(m.v);
      };
      ready(); wire();
    };
    if (W.SceneEngine) return go();
    var sc = D.createElement('script'); sc.src = 'assets/js/scene-engine.js?v=' + V; sc.onload = go; sc.onerror = poster; D.head.appendChild(sc);
  }

  function ready() { cv.classList.add('on'); host.classList.add('scene-on'); }

  var wired = false;
  function wire() {
    if (wired) return; wired = true;
    var visible = true;
    var run = function () { if (post) post({ type: 'run', on: visible && !D.hidden }); };
    if ('IntersectionObserver' in W) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }).observe(host);
    D.addEventListener('visibilitychange', run);
    run();

    // tamaño y composición (la composición la define el CSS de la portada)
    var rt = 0, lw = 0, lh = 0;
    var resized = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var s = measure();
        if (!s.w || !s.h || (s.w === lw && s.h === lh)) return;
        lw = s.w; lh = s.h;
        if (post) post({ type: 'resize', w: s.w, h: s.h, dpr: s.dpr, layout: layout() });
      }, 140);
    };
    if ('ResizeObserver' in W) new ResizeObserver(resized).observe(host); else W.addEventListener('resize', resized);

    // accesos: Gastronomía enciende la operación (cálido); Automatización, la capa de información (frío)
    host.addEventListener('scene:side', function (e) { if (post) post({ type: 'side', v: +(e.detail && e.detail.v) || 0 }); });

    if (STILL) return;
    // cursor, con inercia en el motor
    if (FINE) {
      var pr = 0, px = 0, py = 0, pk = 0;
      var send = function () { pr = 0; if (post) post({ type: 'pointer', x: px, y: py, k: pk }); };
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect(); px = (e.clientX - r.left) / r.width * 2 - 1; py = (e.clientY - r.top) / r.height * 2 - 1; pk = 1;
        if (!pr) pr = requestAnimationFrame(send);
      }, { passive: true });
      host.addEventListener('pointerleave', function () { pk = 0; if (!pr) pr = requestAnimationFrame(send); });
    } else if ('DeviceOrientationEvent' in W && typeof W.DeviceOrientationEvent.requestPermission !== 'function') {
      // inclinación del teléfono (Android): sin pedir permisos; en iOS la escena se mueve sola
      var g0 = null, b0 = null, tr = 0, tx = 0, ty = 0;
      W.addEventListener('deviceorientation', function (e) {
        if (e.gamma === null || e.beta === null) return;
        if (g0 === null) { g0 = e.gamma; b0 = e.beta; }
        tx = Math.max(-1, Math.min(1, (e.gamma - g0) / 18)); ty = Math.max(-1, Math.min(1, (e.beta - b0) / 24));
        if (!tr) tr = requestAnimationFrame(function () { tr = 0; if (post && visible) post({ type: 'pointer', x: tx, y: ty, k: 1 }); });
      }, { passive: true });
    }
    // desplazamiento: al bajar, la cámara sube y la escena se aleja
    var sr = 0;
    W.addEventListener('scroll', function () {
      if (sr || !visible) return;
      sr = requestAnimationFrame(function () {
        sr = 0; var r = host.getBoundingClientRect();
        if (post) post({ type: 'scroll', v: Math.max(0, Math.min(1, -r.top / Math.max(1, r.height))) });
      });
    }, { passive: true });
  }

  if (!W.WebGL2RenderingContext) { poster(); return; }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
