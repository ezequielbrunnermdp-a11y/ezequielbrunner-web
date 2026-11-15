/* Ezequiel Brunner — líneas de datos: controlador.
   Si el navegador lo permite, el dibujo corre en un hilo aparte (Worker + OffscreenCanvas) y la página no se traba;
   si no, se carga el motor en la página cuando terminó de cargar. Se pausa fuera de pantalla y con la pestaña oculta.
   Equipos modestos: menos líneas y menos resolución. Movimiento reducido o ahorro de datos: un solo cuadro quieto. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var canvases = Array.prototype.slice.call(D.querySelectorAll('canvas[data-lines]'));
  if (!canvases.length || !W.requestAnimationFrame) return;
  var V = '20261115';
  var RM = H.classList.contains('rm');
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var NAV = W.navigator || {}, CONN = NAV.connection || {};
  var LITE = (NAV.hardwareConcurrency || 8) <= 4 || (NAV.deviceMemory || 8) <= 4;
  var STILL = RM || !!CONN.saveData;
  var OFF = !!(W.Worker && W.OffscreenCanvas && W.HTMLCanvasElement && HTMLCanvasElement.prototype.transferControlToOffscreen);

  function measure(cv) {
    return { w: cv.clientWidth, h: cv.clientHeight, dpr: Math.min(W.devicePixelRatio || 1, LITE ? 1.25 : 1.5) };
  }

  function onMain(cv, s, opts) {
    var f = new W.FieldEngine(cv.getContext('2d'), opts);
    f.resize(s.w, s.h, s.dpr); f.frame(16, true);
    cv.classList.add('on');
    var running = false, last = 0;
    function loop(now) {
      if (!running) return;
      if (last && now - last < opts.gap) { requestAnimationFrame(loop); return; }
      var dt = last ? Math.min(64, now - last) : 16; last = now;
      f.frame(dt, false);
      requestAnimationFrame(loop);
    }
    return function (m) {
      if (m.type === 'run') {
        if (m.on && !opts.still) { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } } else running = false;
      } else if (m.type === 'resize') { f.resize(m.w, m.h, m.dpr); f.frame(16, true); }
      else if (m.type === 'pointer') f.pointer(m.x, m.y, m.k);
      else if (m.type === 'active') f.activate(m.v);
    };
  }

  function setup(cv) {
    var s = measure(cv);
    if (!s.w || !s.h) return;
    var host = cv.closest('.panel, .hero') || cv.parentElement;
    var opts = { t: +cv.getAttribute('data-t') || 0, mode: cv.getAttribute('data-mode') || 'hero', touch: !FINE, lite: LITE,
                 still: STILL, gap: (s.w < 640 || !FINE) ? 33 : 22, act: STILL ? 0.62 : null };
    var post;
    if (OFF) {
      var off = cv.transferControlToOffscreen();
      var wk = new Worker('assets/js/lines-worker.js?v=' + V);
      wk.onmessage = function (e) { if (e.data && e.data.type === 'ready') cv.classList.add('on'); };
      var init = { type: 'init', canvas: off, w: s.w, h: s.h, dpr: s.dpr, run: false };
      for (var k in opts) init[k] = opts[k];
      wk.postMessage(init, [off]);
      post = function (m) { wk.postMessage(m); };
    } else {
      post = onMain(cv, s, opts);
    }

    /* solo se anima mientras se ve */
    var visible = true;
    var run = function () { post({ type: 'run', on: visible && !D.hidden }); };
    if ('IntersectionObserver' in W) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }).observe(cv);
    else run();
    D.addEventListener('visibilitychange', run);

    /* tamaño: cuando cambia la ventana o el contenedor */
    var rt = 0, lastW = s.w, lastH = s.h;
    var resized = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var n = measure(cv);
        if (!n.w || !n.h || (n.w === lastW && n.h === lastH)) return;
        lastW = n.w; lastH = n.h;
        post({ type: 'resize', w: n.w, h: n.h, dpr: n.dpr });
      }, 160);
    };
    if ('ResizeObserver' in W) new ResizeObserver(resized).observe(cv); else W.addEventListener('resize', resized);

    /* cursor: los nodos cercanos se encienden y las conexiones se dibujan */
    if (FINE && !STILL && host) {
      var pr = 0, px = 0, py = 0, pk = 0;
      var send = function () { pr = 0; post({ type: 'pointer', x: px, y: py, k: pk }); };
      host.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; pk = 1;
        if (!pr) pr = requestAnimationFrame(send);
      }, { passive: true });
      host.addEventListener('pointerleave', function () { pk = 0; if (!pr) pr = requestAnimationFrame(send); });
    }

    /* portada: al acercarse al panel de IA, la red completa se activa */
    cv.addEventListener('field:active', function (e) { post({ type: 'active', v: +e.detail || 0 }); });
  }

  function all() { canvases.forEach(function (cv) { try { setup(cv); } catch (e) { /* queda la imagen de respaldo */ } }); }

  function init() {
    if (OFF) return all();
    var go = function () {
      var sc = D.createElement('script');
      sc.src = 'assets/js/lines-engine.js?v=' + V;
      sc.onload = all;
      D.head.appendChild(sc);
    };
    // sin hilo aparte, el motor espera a que la página termine de cargar
    if (D.readyState === 'complete') setTimeout(go, 150); else W.addEventListener('load', function () { setTimeout(go, 150); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
