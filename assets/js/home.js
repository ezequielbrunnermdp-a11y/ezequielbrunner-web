/* Ezequiel Brunner — portada.
   Los dos accesos le hablan a la escena 3D: al acercarse a Gastronomía la maqueta se enciende en cobre (la operación);
   a Automatización & IA, en turquesa (la capa de información). Funciona con mouse, teclado y toque.
   Al elegir, se navega al instante; con View Transitions el acceso continúa en la portada del área. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var stage = D.querySelector('[data-stage]');
  if (!stage) return;
  var RM = H.classList.contains('rm');
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var paths = Array.prototype.slice.call(stage.querySelectorAll('.path'));
  var side = 0;

  function setSide(v) {
    if (v === side) return;
    side = v;
    stage.classList.toggle('on-gas', v < 0); stage.classList.toggle('on-ia', v > 0);
    stage.dispatchEvent(new CustomEvent('scene:side', { detail: { v: v } }));
  }

  paths.forEach(function (a) {
    var k = a.getAttribute('data-go'), v = k === 'gastronomia' ? -1 : 1;
    if (FINE) {
      a.addEventListener('pointerenter', function () { setSide(v); });
      a.addEventListener('pointerleave', function () { setSide(0); });
    } else {
      // en pantallas táctiles, el primer contacto ya ilumina el área elegida
      a.addEventListener('touchstart', function () { setSide(v); }, { passive: true });
    }
    a.addEventListener('focus', function () { setSide(v); });
    a.addEventListener('blur', function () { setSide(0); });
    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try { localStorage.setItem('eb:area', k); } catch (_) {}
      if (!RM) a.classList.add('chosen');
    });
  });

  /* la última área visitada queda señalada (la portada nunca redirige) */
  try {
    var last = localStorage.getItem('eb:area');
    paths.forEach(function (a) { a.classList.toggle('last', a.getAttribute('data-go') === last); });
  } catch (_) {}

  /* al volver con «atrás», la portada queda como al principio */
  W.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    paths.forEach(function (a) { a.classList.remove('chosen'); });
    setSide(0);
  });
})();
