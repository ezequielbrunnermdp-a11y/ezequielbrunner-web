/* Ezequiel Brunner — portada cinematográfica.
   La luz y la profundidad siguen al cursor (con suavidad); al acercarse a un acceso, la escena se vuelve cálida
   (Gastronomía) o fría (Automatización), las líneas de luz se activan hacia ese lado y el panel gana protagonismo.
   Al elegir, se navega al instante; con View Transitions la imagen y el panel continúan en la página del área. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var cine = D.querySelector('[data-cine]');
  if (!cine) return;
  var RM = H.classList.contains('rm');
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var doors = Array.prototype.slice.call(cine.querySelectorAll('.door'));
  var lines = cine.querySelector('canvas[data-connect]');

  function setSide(k) {
    cine.classList.toggle('on-gas', k === 'gastronomia');
    cine.classList.toggle('on-ia', k === 'automatizacion');
    if (lines) lines.dispatchEvent(new CustomEvent('field:active', { detail: k ? { v: 1, side: k === 'gastronomia' ? -1 : 1 } : { v: 0, side: 0 } }));
  }

  /* --- accesos: protagonismo al acercarse (mouse o teclado) */
  doors.forEach(function (d) {
    var k = d.getAttribute('data-go');
    var on = function () { if (!cine.classList.contains(k === 'gastronomia' ? 'on-gas' : 'on-ia')) setSide(k); };
    if (FINE) {
      d.addEventListener('pointerenter', on);
      d.addEventListener('pointermove', on, { passive: true });
      d.addEventListener('pointerleave', function () { setSide(null); });
    }
    d.addEventListener('focus', on);
    d.addEventListener('blur', function () { setSide(null); });
    /* elegir: el panel queda marcado para la transición y el enlace navega en el mismo instante */
    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try { localStorage.setItem('eb:area', k); } catch (_) {}
      if (!RM) d.classList.add('chosen');
    });
  });

  /* --- la última área visitada queda señalada (la portada nunca redirige) */
  try {
    var last = localStorage.getItem('eb:area');
    doors.forEach(function (d) { d.classList.toggle('last', d.getAttribute('data-go') === last); });
  } catch (_) {}

  /* --- luz y profundidad que siguen al cursor, con inercia */
  if (FINE && !RM) {
    var tx = 0.5, ty = 0.5, cx = 0.5, cy = 0.5, raf = 0;
    var step = function () {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      cine.style.setProperty('--lx', cx.toFixed(4));
      cine.style.setProperty('--ly', cy.toFixed(4));
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(step) : 0;
    };
    cine.addEventListener('pointermove', function (e) {
      var r = cine.getBoundingClientRect();
      tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    cine.addEventListener('pointerleave', function () { tx = 0.5; ty = 0.5; if (!raf) raf = requestAnimationFrame(step); });
  }

  /* --- el gráfico del acceso de IA: quieto con movimiento reducido y en pausa fuera de pantalla */
  var svg = cine.querySelector('.pg');
  if (svg && svg.pauseAnimations) {
    if (RM) svg.pauseAnimations();
    else if ('IntersectionObserver' in W) {
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations(); }).observe(svg);
    }
  }

  /* --- al volver con «atrás», la portada queda como al principio */
  W.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    doors.forEach(function (d) { d.classList.remove('chosen'); });
    setSide(null);
  });
})();
