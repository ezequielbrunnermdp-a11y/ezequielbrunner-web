/* Ezequiel Brunner — pantalla dividida del inicio.
   Al pasar el cursor el panel crece y muestra los servicios; al elegir, ocupa la pantalla y se entra al área. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var split = D.querySelector('[data-split]');
  if (!split) return;
  var RM = H.classList.contains('rm');
  var panels = Array.prototype.slice.call(split.querySelectorAll('.panel'));
  var HOVER = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 901px)') : { matches: true };
  var going = false;

  function setOn(p) {
    panels.forEach(function (x) { x.classList.toggle('on', x === p); });
    split.classList.toggle('has-on', !!p);
  }

  /* --- el panel activo crece (escritorio) */
  panels.forEach(function (p) {
    if (HOVER) {
      p.addEventListener('pointerenter', function () { if (!going && WIDE.matches) setOn(p); });
      p.addEventListener('pointerleave', function () { if (!going) setOn(null); });
    }
    p.addEventListener('focusin', function () { if (!going && WIDE.matches) setOn(p); });
    p.addEventListener('focusout', function (e) { if (!going && !p.contains(e.relatedTarget)) setOn(null); });
  });

  /* --- la última área visitada queda señalada (no se redirige: la portada siempre se ve) */
  try {
    var last = localStorage.getItem('eb:area');
    panels.forEach(function (p) { p.classList.toggle('last', p.getAttribute('data-panel') === last); });
  } catch (_) {}

  /* --- profundidad casi imperceptible y una luz que revela los colores reales bajo el cursor */
  if (HOVER && !RM) {
    var raf = 0, mx = 0, my = 0, cx = 0, cy = 0;
    split.addEventListener('pointermove', function (e) {
      mx = e.clientX / W.innerWidth - 0.5; my = e.clientY / W.innerHeight - 0.5; cx = e.clientX; cy = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        panels.forEach(function (p, i) {
          var media = p.querySelector('.p-media'), d = i ? 12 : 16;
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

  /* --- elegir un área: transición y entrada */
  function choose(p, href) {
    if (going) return;
    going = true;
    var key = p.getAttribute('data-panel');
    try { localStorage.setItem('eb:area', key); sessionStorage.setItem('eb:nav', '1'); } catch (_) {}
    if (RM) { W.location.href = href; return; }
    var media = p.querySelector('.p-media');
    if (media) media.style.viewTransitionName = 'area-media';
    p.classList.add('chosen');
    split.classList.add('going');
    setTimeout(function () { W.location.href = href; }, 900);
  }
  panels.forEach(function (p) {
    var cta = p.querySelector('[data-go]');
    p.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.target.closest('a') && e.target.closest('a') !== cta) return;
      e.preventDefault();
      choose(p, cta.href);
    });
  });

  /* --- al volver con el botón «atrás» la pantalla se restablece */
  W.addEventListener('pageshow', function (e) {
    if (!e.persisted && !going) return;
    going = false;
    split.classList.remove('going');
    panels.forEach(function (p) { p.classList.remove('chosen'); var m = p.querySelector('.p-media'); if (m) m.style.viewTransitionName = ''; });
    setOn(null);
  });
})();
