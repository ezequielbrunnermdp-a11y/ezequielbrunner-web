/* Ezequiel Brunner — Gastronomía: los siete ejes de la gestión.
   El índice de la izquierda marca el eje que se está leyendo y su línea se completa al bajar; cada eje dibuja su
   visual al entrar en pantalla. La calculadora de costo de un plato responde mientras se escribe.
   Sin JavaScript o con movimiento reducido, todo se ve completo desde el inicio. */
(function () {
  'use strict';
  var D = document, W = window;
  var sec = D.querySelector('[data-axes]');
  if (!sec) return;
  var arts = Array.prototype.slice.call(sec.querySelectorAll('.ax'));
  var links = Array.prototype.slice.call(sec.querySelectorAll('.axes-idx a'));
  var line = sec.querySelector('.axi-line');

  if ('IntersectionObserver' in W) {
    // aparición: el visual de cada eje se dibuja una vez
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.28 });
    arts.forEach(function (a) { io.observe(a); });
    // índice: el eje del centro de la pantalla queda marcado y la línea avanza
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var k = en.target.getAttribute('data-ax'), i = arts.indexOf(en.target);
        links.forEach(function (l) { var on = l.getAttribute('data-ax') === k; l.classList.toggle('on', on); if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
        if (line) line.style.setProperty('--p', ((i + 1) / arts.length).toFixed(3));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    arts.forEach(function (a) { spy.observe(a); });
  } else arts.forEach(function (a) { a.classList.add('in'); });

  /* calculadora de costo de un plato (orientativa) */
  var calc = sec.querySelector('[data-calc]');
  if (calc) {
    var price = calc.querySelector('[data-price]'), cost = calc.querySelector('[data-cost]'), iva = calc.querySelector('[data-iva]');
    var outPct = calc.querySelector('[data-pct]'), outM = calc.querySelector('[data-margin]'), bar = calc.querySelector('[data-bar]');
    var fmt = (W.Intl && Intl.NumberFormat) ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }) : { format: function (n) { return Math.round(n); } };
    var upd = function () {
      var p = parseFloat(price.value), c = parseFloat(cost.value);
      if (!(p > 0) || !(c >= 0)) { outPct.textContent = '—'; outM.textContent = '—'; bar.style.setProperty('--p', 0); return; }
      var net = iva.checked ? p / 1.21 : p, pct = c / net;
      outPct.textContent = (pct * 100).toFixed(pct < .1 ? 1 : 0).replace('.', ',') + ' %';
      outM.textContent = (net - c < 0 ? '− $ ' : '$ ') + fmt.format(Math.abs(net - c));
      bar.style.setProperty('--p', Math.min(1, pct).toFixed(3));
    };
    [price, cost, iva].forEach(function (el) { el.addEventListener('input', upd); el.addEventListener('change', upd); });
    upd();
  }
})();
