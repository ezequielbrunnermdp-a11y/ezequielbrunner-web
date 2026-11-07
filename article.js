/* Ezequiel Brunner — lectura de una nota (article.html?slug=...).
   Toma la nota de news-data.js; al final ofrece conversar sobre ese tema y sugiere otras lecturas. */
(function () {
  'use strict';
  var D = document, W = window;
  var box = D.querySelector('#article-content');
  if (!box) return;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fdate(n) { var p = String(n.date || '').split('-'); return n.displayDate || (p.length === 3 ? (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0] : ''); }
  function mins(n) { var w = (n.content || []).join(' ').split(/\s+/).length + String(n.summary || '').split(/\s+/).length; return Math.max(1, Math.ceil(w / 200)); }

  var items = Array.isArray(W.newsItems) ? W.newsItems.slice() : [];
  items.forEach(function (n, i) { n._i = i; });
  items.sort(function (a, b) { return a.date === b.date ? a._i - b._i : (a.date < b.date ? 1 : -1); });
  var slug = new URLSearchParams(location.search).get('slug');
  var item = items.filter(function (n) { return n.slug === slug; })[0];

  if (!item) {
    box.innerHTML = '<div class="art-missing"><p class="label">Artículo no encontrado</p><h1>La nota que buscás no está disponible.</h1><p>Verificá el enlace o regresá a la sección de novedades para abrir un artículo publicado.</p><div class="cta"><a class="btn p" href="publicaciones.html">Ver publicaciones <span class="arr" aria-hidden="true">→</span></a></div></div>';
    return;
  }

  D.title = item.title + ' | Ezequiel Brunner';
  updateSeo(item);
  var cat = D.getElementById('crumb-cat');
  if (cat) cat.textContent = item.category;
  var img = item.image ? '<figure class="art-img"><img src="' + esc(item.image) + '" alt="' + esc(item.title) + '"></figure>' : '';
  box.innerHTML =
    '<header class="art-head">' +
    '<p class="eyebrow">' + esc(item.category) + '</p>' +
    '<h1>' + esc(item.title) + '</h1>' +
    '<p class="meta"><span>' + esc(item.author || 'Por Ezequiel Brunner') + '</span><span>' + esc(fdate(item)) + '</span><span>' + mins(item) + ' min de lectura</span></p>' +
    (item.tagline ? '<p class="art-tagline">' + esc(item.tagline) + '</p>' : '') +
    '<p class="art-dek">' + esc(item.summary) + '</p>' +
    '</header>' + img +
    '<div class="art-body">' + (item.content || []).map(function (p) { return '<p>' + p + '</p>'; }).join('')   /* como antes: los párrafos admiten marcado propio */ + '</div>';

  /* después de leer: conversar sobre este tema */
  var cta = D.getElementById('art-cta');
  if (cta) {
    var subject = 'Consulta sobre la nota: ' + item.title;
    var body = 'Hola Ezequiel, leí tu nota «' + item.title + '» y me gustaría conversar sobre este tema.\n\n';
    D.getElementById('art-mail').href = 'mailto:contacto@ezequielbrunner.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    D.getElementById('art-form').href = 'index.html?tema=' + encodeURIComponent(item.slug) + '#contacto';
    D.getElementById('art-cta-topic').textContent = '«' + item.title + '»';
    cta.hidden = false;
  }

  /* más lecturas */
  var more = D.getElementById('more-notes'), ol = D.getElementById('more-list');
  var rest = items.filter(function (n) { return n.slug !== item.slug; }).slice(0, 3);
  if (more && ol && rest.length) {
    ol.innerHTML = rest.map(function (n) {
      return '<li class="read"><a href="article.html?slug=' + encodeURIComponent(n.slug) + '"><span class="label">' + esc(n.category) + '</span><h3><span>' + esc(n.title) + '</span></h3><p>' + esc(n.summary) + '</p><span class="meta"><span>' + esc(fdate(n)) + '</span><span>' + mins(n) + ' min</span></span></a></li>';
    }).join('');
    more.hidden = false;
  }

  function updateSeo(it) {
    var url = location.origin + location.pathname + '?slug=' + encodeURIComponent(it.slug);
    var desc = (it.seo && it.seo.description) || it.summary;
    setMeta('name', 'description', desc);
    if (it.seo && it.seo.keywords) setMeta('name', 'keywords', it.seo.keywords);
    var c = D.querySelector('link[rel="canonical"]');
    if (!c) { c = D.createElement('link'); c.rel = 'canonical'; D.head.appendChild(c); }
    c.href = url;
    setMeta('property', 'og:title', it.title + ' | Ezequiel Brunner');
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', it.title + ' | Ezequiel Brunner');
    setMeta('name', 'twitter:description', desc);
  }
  function setMeta(attr, key, val) {
    if (!val) return;
    var m = D.querySelector('meta[' + attr + '="' + key + '"]');
    if (!m) { m = D.createElement('meta'); m.setAttribute(attr, key); D.head.appendChild(m); }
    m.setAttribute('content', val);
  }
})();
