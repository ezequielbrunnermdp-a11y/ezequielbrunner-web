/* Ezequiel Brunner — comportamiento propio de la página de inicio. */
(function () {
  'use strict';
  var D = document, W = window;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var G = W.gsap, ST = W.ScrollTrigger;

  /* ---- enlaces viejos a secciones que cambiaron de lugar ---- */
  var OLD = { '#ia': '#servicios-ia', '#gastronomia': '#servicios-gastronomia', '#personas': '#servicios-personas', '#procesos': '#metodo', '#enfoque': '#sobre-mi' };
  var MOVED = { '#dossier': 'publicaciones.html#dossier', '#medios': 'publicaciones.html#medios', '#novedades': 'publicaciones.html#notas', '#trabaja-conmigo': 'gastronomia.html#trabaja-conmigo' };
  if (MOVED[location.hash]) location.replace(MOVED[location.hash]);
  else if (OLD[location.hash]) { try { history.replaceState(null, '', OLD[location.hash]); } catch (_) { } }

  /* ---- frases que rotan ---- */
  var words = $$('.rotator .word span'), box = $('.rotator .word'), wi = 0;
  function fit() { if (box && words[wi]) box.style.width = words[wi].offsetWidth + 'px'; }
  fit();
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit);
  W.addEventListener('resize', fit);
  if (!reduce && words.length) {
    setInterval(function () {
      if (D.hidden) return;
      var a = words[wi]; a.classList.remove('on'); a.classList.add('out');
      wi = (wi + 1) % words.length;
      var b = words[wi]; b.classList.remove('out'); b.classList.add('on'); fit();
      setTimeout(function () { a.classList.remove('out'); }, 900);
    }, 2800);
  }

  /* ---- publicaciones: se toman de news-data.js (si se suma una nota, aparece sola) ---- */
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function notes() {
    var it = Array.isArray(W.newsItems) ? W.newsItems.slice() : [];
    it.forEach(function (n, i) {
      n._i = i;
      var w = (n.content || []).join(' ').split(/\s+/).length + String(n.summary || '').split(/\s+/).length;
      n._min = Math.max(1, Math.ceil(w / 200));
      var p = String(n.date || '').split('-');
      n._date = n.displayDate || (p.length === 3 ? (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0] : '');
      n._url = 'article.html?slug=' + encodeURIComponent(n.slug);
    });
    it.sort(function (a, b) { return a.date === b.date ? a._i - b._i : (a.date < b.date ? 1 : -1); });
    return it;
  }
  function metaHTML(n, short) {
    return '<span class="cat">' + esc(n.category) + '</span><span>' + esc(n._date) + '</span><span>' + n._min + ' min' + (short ? '' : ' de lectura') + '</span>';
  }
  var list = notes();
  (function hydrate() {
    var feat = $('.feature');
    if (!list.length || !feat) return;
    var shown = [feat.getAttribute('data-slug')].concat($$('#reads-list .read a').map(function (a) { return new URL(a.href).searchParams.get('slug'); }));
    var want = list.slice(0, 5).map(function (n) { return n.slug; });
    if (shown.join('|') === want.join('|')) return;
    var f = list[0];
    feat.setAttribute('data-slug', f.slug);
    $$('a[href^="article.html"]', feat).forEach(function (a) { a.href = f._url; });
    var title = $('.feature-title a', feat); if (title) title.textContent = f.title;
    var m = $('.meta', feat); if (m) m.innerHTML = metaHTML(f);
    var dk = $('.dek', feat); if (dk) dk.textContent = f.summary;
    var cv = $('.cv-mid', feat); if (cv) cv.textContent = f.category;
    var ct = $('.cv-top span:last-child', feat); if (ct) ct.textContent = f._date;
    var cb = $('.cv-bot span:last-child', feat); if (cb) cb.textContent = f._min + ' min de lectura';
    var tm = $('[data-tema]', feat); if (tm) { tm.setAttribute('data-tema', f.slug); tm.href = '?tema=' + encodeURIComponent(f.slug) + '#contacto'; }
    var hl = $('.hero-latest');
    if (hl) { hl.href = f._url; $('.hl-k', hl).innerHTML = '<i aria-hidden="true"></i>Última publicación · ' + esc(f._date); $('.hl-t', hl).textContent = f.title; }
    var ol = $('#reads-list');
    if (ol) ol.innerHTML = list.slice(1, 5).map(function (n, i) {
      return '<li><article class="read lamp"><a href="' + esc(n._url) + '"><span class="read-n" aria-hidden="true">' + ('0' + (i + 2)).slice(-2) + '</span><p class="meta">' + metaHTML(n, true) + '</p><h4>' + esc(n.title) + '</h4><p class="read-dek">' + esc(n.summary) + '</p><span class="read-go">Leer la nota <span class="arr" aria-hidden="true">→</span></span></a></article></li>';
    }).join('');
  })();

  /* ---- después de leer: conversar sobre una nota (completa el formulario, sin cambiar su envío) ---- */
  function setTopic(slug) {
    var n = list.filter(function (x) { return x.slug === slug; })[0];
    if (!n) return false;
    var t = $('#form-topic'), m = $('#fm');
    if (t) { t.hidden = false; t.innerHTML = 'Tema: <b>' + esc(n.title) + '</b>'; }
    if (m && !m.value) m.value = 'Leí la nota «' + n.title + '» y me gustaría conversar sobre este tema.';
    return true;
  }
  var tema = new URLSearchParams(location.search).get('tema');
  if (tema) setTopic(tema);
  $$('[data-tema]').forEach(function (a) {
    a.addEventListener('click', function () { setTopic(a.getAttribute('data-tema')); });
  });

  /* ---- manifiesto: las palabras se encienden al bajar ---- */
  var man = $('#manifesto');
  if (man && G && ST && !reduce) {
    Array.prototype.slice.call(man.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = D.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          var s = D.createElement('span'); s.className = 'wd'; s.textContent = part; frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) n.classList.add('wd');
    });
    D.documentElement.classList.add('fx');
    G.to($$('.wd', man), { opacity: 1, stagger: .12, ease: 'none', scrollTrigger: { trigger: man, start: 'top 82%', end: 'bottom 58%', scrub: .6 } });
  }

  /* ---- contadores ---- */
  if (G && ST && !reduce) $$('.count').forEach(function (el) {
    var to = +el.getAttribute('data-to'), o = { v: 0 };
    ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { el.textContent = '0'; G.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
  });

  /* ---- copiar el email ---- */
  $$('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = 'Copiar'; }, 2000); };
      function sel() { var s = getSelection(), r = D.createRange(); r.selectNodeContents($('#mail')); s.removeAllRanges(); s.addRange(r); done('Seleccionado'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { done('Copiado ✓'); }, sel);
      else sel();
    });
  });

  /* ---- formulario: arma el email (sin cambios) ---- */
  $('#f').addEventListener('submit', function (ev) {
    ev.preventDefault(); var d = new FormData(ev.target);
    var body = 'Nombre: ' + d.get('n') + '\nEmail: ' + d.get('e') + '\nEmpresa: ' + d.get('c') + '\nÁrea: ' + d.get('a') + '\n\n' + d.get('m');
    location.href = 'mailto:contacto@ezequielbrunner.com?subject=' + encodeURIComponent('Consulta web: ' + d.get('a')) + '&body=' + encodeURIComponent(body);
  });
})();
