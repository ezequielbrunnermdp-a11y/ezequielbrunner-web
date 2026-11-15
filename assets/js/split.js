/* Ezequiel Brunner — portada: dos universos.
   Escritorio: al acercar el cursor el panel crece, la foto gana presencia (una luz revela sus colores) y en
   Automatización la red de datos se enciende. Al elegir se navega al instante: si el navegador tiene
   View Transitions, la imagen del panel se convierte en la portada del área. Sin demoras artificiales. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var split = D.querySelector('[data-split]');
  if (!split) return;
  var RM = H.classList.contains('rm');
  var panels = Array.prototype.slice.call(split.querySelectorAll('.panel'));
  var HOVER = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 901px)') : { matches: true };
  var field = split.querySelector('.panel-automatizacion canvas[data-lines]');

  function activate(v) {
    if (field) field.dispatchEvent(new CustomEvent('field:active', { detail: v }));
  }
  function setOn(p) {
    panels.forEach(function (x) { x.classList.toggle('on', x === p); });
    split.classList.toggle('has-on', !!p);
    activate(p && p.getAttribute('data-panel') === 'automatizacion' ? 1 : 0);
  }

  /* --- el panel activo crece (mouse o teclado, en pantallas anchas) */
  panels.forEach(function (p) {
    if (HOVER) {
      // también al mover: si la página cargó con el cursor encima, el «enter» ya ocurrió antes de este script
      var enter = function () { if (WIDE.matches && !p.classList.contains('on')) setOn(p); };
      p.addEventListener('pointerenter', enter);
      p.addEventListener('pointermove', enter, { passive: true });
      p.addEventListener('pointerleave', function () { setOn(null); });
    }
    p.addEventListener('focusin', function () { if (WIDE.matches) setOn(p); });
    p.addEventListener('focusout', function (e) { if (!p.contains(e.relatedTarget)) setOn(null); });
  });

  /* --- la última área visitada queda señalada (la portada nunca redirige) */
  try {
    var last = localStorage.getItem('eb:area');
    panels.forEach(function (p) { p.classList.toggle('last', p.getAttribute('data-panel') === last); });
  } catch (_) {}

  /* --- profundidad casi imperceptible y luz que sigue al cursor sobre la foto */
  if (HOVER && !RM) {
    var raf = 0, mx = 0, my = 0, cx = 0, cy = 0;
    split.addEventListener('pointermove', function (e) {
      mx = e.clientX / W.innerWidth - 0.5; my = e.clientY / W.innerHeight - 0.5; cx = e.clientX; cy = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        panels.forEach(function (p, i) {
          var media = p.querySelector('.p-media'), d = i ? 10 : 16;
          if (!media) return;
          media.style.setProperty('--px', (-mx * d).toFixed(2) + 'px');
          media.style.setProperty('--py', (-my * d * 0.8).toFixed(2) + 'px');
          var lit = p.querySelector('.pm-litwrap');
          if (lit) {
            var r = lit.getBoundingClientRect();
            lit.style.setProperty('--sx', (cx - r.left).toFixed(0) + 'px');
            lit.style.setProperty('--sy', (cy - r.top).toFixed(0) + 'px');
          }
        });
      });
    }, { passive: true });
  }

  /* --- elegir un área: se marca el panel para la transición y se navega en el mismo instante */
  panels.forEach(function (p) {
    var cta = p.querySelector('[data-go]');
    p.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a');
      if (a && a !== cta) return;
      e.preventDefault();
      try { localStorage.setItem('eb:area', p.getAttribute('data-panel')); } catch (_) {}
      if (!RM) p.classList.add('chosen');
      W.location.href = cta.href;
    });
  });

  /* --- al volver con «atrás», la portada queda como al principio */
  W.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    panels.forEach(function (p) { p.classList.remove('chosen'); });
    setOn(null);
  });
})();
