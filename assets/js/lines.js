/* Ezequiel Brunner — «líneas de datos» para Automatización & IA.
   Un relieve de líneas finas que se mueve despacio, lleva pulsos de luz y se ilumina cerca del cursor.
   Es un dibujo hecho con código (no una imagen generada). Con movimiento reducido queda quieto. */
(function () {
  'use strict';
  var D = document, W = window;
  var canvases = [].slice.call(D.querySelectorAll('canvas[data-lines]'));
  if (!canvases.length || !W.requestAnimationFrame) return;
  var RM = D.documentElement.classList.contains('rm');
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* ruido simplex 3D (Stefan Gustavson, dominio público), versión compacta */
  var G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  var perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  (function seed() {
    var p = new Uint8Array(256), i, j, t, s = 7;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; j = s % (i + 1); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  })();
  var F3 = 1 / 3, G3c = 1 / 6;
  function noise(x, y, z) {
    var s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    var t = (i + j + k) * G3c, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var x1 = x0 - i1 + G3c, y1 = y0 - j1 + G3c, z1 = z0 - k1 + G3c, x2 = x0 - i2 + 2 * G3c, y2 = y0 - j2 + 2 * G3c, z2 = z0 - k2 + 2 * G3c;
    var x3 = x0 - 1 + 3 * G3c, y3 = y0 - 1 + 3 * G3c, z3 = z0 - 1 + 3 * G3c;
    var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * n;
  }

  function Field(cv) {
    var ctx = cv.getContext('2d'), w = 0, h = 0, rows = 0, cols = 0, visible = true, raf = 0, last = 0, skip = false;
    var mouse = { x: -9999, y: -9999, k: 0, tk: 0 };
    var host = cv.closest('[data-lines-host]') || cv.parentElement;
    var tAcc = Number(cv.getAttribute('data-t') || 0);

    function resize() {
      var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
      w = cv.clientWidth; h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rows = w < 640 ? 38 : 60; cols = w < 640 ? 60 : 104;
      skip = w < 640;
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      var horizon = h * 0.2, near = h * 1.08;
      mouse.k += (mouse.tk - mouse.k) * 0.08;
      for (var i = 0; i < rows; i++) {
        var z = i / (rows - 1), p = Math.pow(z, 1.75);
        var base = horizon + (near - horizon) * p;
        var amp = 6 + 170 * p;
        var light = 0;
        ctx.beginPath();
        for (var j = 0; j <= cols; j++) {
          var u = j / cols, x = -24 + (w + 48) * u;
          var n = noise(u * 2.1, z * 2.6 + 0.7, t * 0.00005) * 0.7 + noise(u * 5.3, z * 6.1, t * 0.00009 + 3.1) * 0.3;
          var r = 1 - Math.abs(n); r = r * r * r;
          var bell = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.04 - 0.02))), 1.4);
          var y = base - r * amp * bell;
          if (mouse.k > 0.01) {
            var dx = x - mouse.x, dy = base - mouse.y;
            var g = Math.exp(-(dx * dx) / 34000 - (dy * dy) / 22000) * mouse.k;
            y -= g * (34 + 54 * p);
            if (g > light) light = g;
          }
          if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        // la línea de adelante tapa a las de atrás: se borra la franja entre su cresta y su base
        // (las líneas de atrás nunca bajan de su propia base, que está más arriba)
        ctx.save();
        ctx.lineTo(w + 24, base + 2); ctx.lineTo(-24, base + 2); ctx.closePath();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
        ctx.fill();
        ctx.restore();
        var a = 0.03 + 0.52 * p + light * 0.5;
        ctx.strokeStyle = 'rgba(222, 232, 229, ' + a.toFixed(3) + ')';
        ctx.lineWidth = 0.55 + 0.75 * p;
        ctx.stroke();
        if (i % 3 === 1) {
          // pulso de datos que recorre la línea
          var span = w * 1.7, px = ((t * (0.05 + (i % 7) * 0.008) + i * 211) % span) - w * 0.35;
          var gr = ctx.createLinearGradient(px - 180, 0, px + 180, 0);
          gr.addColorStop(0, 'rgba(130, 176, 170, 0)');
          gr.addColorStop(0.5, 'rgba(160, 215, 205, ' + (0.35 + 0.65 * p).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(130, 176, 170, 0)');
          ctx.strokeStyle = gr; ctx.lineWidth = 0.9 + 1.1 * p;
          ctx.stroke();
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (!visible || D.hidden) return;
      var minGap = skip ? 32 : 22;            // ~30 cuadros por segundo en el celular, ~45 en computadora
      if (last && now - last < minGap) { raf = requestAnimationFrame(frame); return; }
      var dt = last ? Math.min(64, now - last) : 16; last = now;
      tAcc += dt;
      draw(tAcc);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && !RM) { last = 0; raf = requestAnimationFrame(frame); } }

    resize(); draw(tAcc);
    cv.classList.add('on');
    if (RM) return;
    W.addEventListener('resize', function () { resize(); draw(tAcc); });
    if ('IntersectionObserver' in W) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(cv);
    D.addEventListener('visibilitychange', function () { if (!D.hidden) start(); });
    if (FINE && host) {
      host.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.tk = 1; });
      host.addEventListener('pointerleave', function () { mouse.tk = 0; });
    }
    start();
  }

  function init() { canvases.forEach(function (cv) { try { Field(cv); } catch (e) { /* queda la imagen de respaldo */ } }); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
