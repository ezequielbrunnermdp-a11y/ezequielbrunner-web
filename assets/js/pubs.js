/* Ezequiel Brunner — archivo de publicaciones: filtros y notas al día con news-data.js. */
(function () {
  'use strict';
  var D = document, W = window;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* notas: si news-data.js suma o cambia una nota, el índice se rehace solo */
  var list = $('#notes-list');
  if (list && Array.isArray(W.newsItems)) {
    var items = W.newsItems.map(function (n, i) { n._i = i; return n; }).sort(function (a, b) { return a.date === b.date ? a._i - b._i : (a.date < b.date ? 1 : -1); });
    var shown = $$('a', list).map(function (a) { return new URL(a.href).searchParams.get('slug'); }).join('|');
    if (shown !== items.map(function (n) { return n.slug; }).join('|')) {
      list.innerHTML = items.map(function (n, i) {
        var w = (n.content || []).join(' ').split(/\s+/).length + String(n.summary || '').split(/\s+/).length, p = String(n.date || '').split('-');
        var date = n.displayDate || (p.length === 3 ? (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0] : '');
        return '<li class="item" data-group="notas"><a class="toc-row" href="article.html?slug=' + encodeURIComponent(n.slug) + '"><span class="toc-n" aria-hidden="true">' + ('0' + (i + 1)).slice(-2) + '</span><span class="toc-main"><span class="meta"><span class="cat">' + esc(n.category) + '</span><span>' + esc(date) + '</span><span>' + Math.max(1, Math.ceil(w / 200)) + ' min de lectura</span></span><span class="toc-t">' + esc(n.title) + '</span><span class="toc-d">' + esc(n.summary) + '</span></span><span class="toc-go" aria-hidden="true">→</span></a></li>';
      }).join('');
    }
  }

  /* filtros: Todo · Notas · Doctrina · Medios */
  var bar = $('.filters');
  if (!bar) return;
  bar.hidden = false;
  var btns = $$('button', bar), secs = $$('.p-sec[data-group]');
  function apply(f, scroll) {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-f') === f ? 'true' : 'false'); });
    secs.forEach(function (s) { s.hidden = f !== 'todo' && s.getAttribute('data-group') !== f; });
    if (W.ScrollTrigger) W.ScrollTrigger.refresh();
    if (scroll) { var t = f === 'todo' ? $('#notas') : D.getElementById(f); if (t && W.EB && W.EB.goTo) W.EB.goTo(t); }
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { apply(b.getAttribute('data-f'), true); }); });
  var h = location.hash.slice(1);
  if (h === 'notas' || h === 'doctrina' || h === 'medios') { /* con un ancla, se muestra todo y se llega a esa parte */ }
})();
