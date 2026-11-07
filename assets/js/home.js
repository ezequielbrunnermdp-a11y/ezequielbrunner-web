/* Ezequiel Brunner — comportamiento propio de la página de inicio. */
(function () {
  'use strict';
  var D = document, W = window;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var G = W.gsap, ST = W.ScrollTrigger;

  /* ---- enlaces viejos a secciones que cambiaron de nombre o de lugar ---- */
  var OLD = { '#servicios-ia': '#ia', '#servicios-gastronomia': '#gastronomia', '#servicios-personas': '#personas', '#procesos': '#metodo', '#enfoque': '#sobre-mi' };
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
      setTimeout(function () { a.classList.remove('out'); }, 1000);
    }, 3200);
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
    var title = $('.f-title a', feat); if (title) title.textContent = f.title;
    var labels = $$('.f-meta .label', feat); if (labels[1]) labels[1].textContent = f.category;
    var m = $('.f-side .meta', feat); if (m) m.innerHTML = '<span>' + esc(f.author || 'Por Ezequiel Brunner') + '</span><span>' + esc(f._date) + '</span><span>' + f._min + ' min de lectura</span>';
    var dk = $('.dek', feat); if (dk) dk.textContent = f.summary;
    var tm = $('[data-tema]', feat); if (tm) { tm.setAttribute('data-tema', f.slug); tm.href = '?tema=' + encodeURIComponent(f.slug) + '#contacto'; }
    var hl = $('.hero-latest');
    if (hl) { hl.href = f._url; $('.label', hl).textContent = 'Última publicación · ' + f._date; $('.hl-t', hl).textContent = f.title; }
    var ol = $('#reads-list');
    if (ol) ol.innerHTML = list.slice(1, 5).map(function (n, i) {
      var img = n.image ? '<figure class="r-img"><img class="bw" src="' + esc(n.image) + '" alt="" loading="lazy" decoding="async"></figure>' : '';
      return '<li class="read"><a href="' + esc(n._url) + '">' + img + '<span class="r-top"><span class="r-n" aria-hidden="true">' + ('0' + (i + 2)).slice(-2) + '</span><span class="label">' + esc(n.category) + '</span></span><h4 class="r-title"><span>' + esc(n.title) + '</span></h4><p class="r-dek">' + esc(n.summary) + '</p><span class="meta"><span>' + esc(n._date) + '</span><span>' + n._min + ' min</span></span></a></li>';
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
  $$('[data-tema]').forEach(function (a) { a.addEventListener('click', function () { setTopic(a.getAttribute('data-tema')); }); });

  /* ---- enfoque: las palabras se encienden al leer ---- */
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
    $$('.wd', man).forEach(function (w) { w.dataset.c = getComputedStyle(w).color; });
    G.to($$('.wd', man), { color: function (i, el) { return el.tagName === 'EM' ? '#e7e0d4' : '#f2efe9'; }, stagger: .1, ease: 'none', scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 52%', scrub: .5 } });
  }

  /* ---- por capas: la sección queda fija y la pieza se arma al bajar ---- */
  (function capas() {
    var sec = $('#capas');
    if (!sec || !G || !ST || reduce) return;
    sec.classList.add('live');
    var steps = $$('.cstep', sec), bars = $$('.capas-bar i', sec), box = $('.cs-box', sec);
    var P = function (n) { return $('.cp-p' + n, sec); }, C = function (n) { return $('.cp-c' + n, sec); };
    var tones = ['#0b0b0a', '#12100c', '#0b0e10', '#110d0a', '#0a0a0a'];
    var fall = function () { return -Math.min(W.innerHeight * .6, 540); };
    G.set(steps.slice(1), { autoAlpha: 0, y: 26 });
    G.set([P(2), P(3), P(4), C(2), C(3), C(4)], { autoAlpha: 0 });
    G.set(bars[0], { backgroundSize: '100% 100%' });
    // la base aparece una vez, al llegar
    G.from(P(1), { y: -50, autoAlpha: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: sec, start: 'top 75%', once: true } });
    var tl = G.timeline({ defaults: { ease: 'none' } });
    for (var k = 2; k <= 5; k++) {
      var at = (k - 2) * 1.4 + .3;
      tl.to(steps[k - 2], { autoAlpha: 0, y: -26, duration: .35, ease: 'power2.in' }, at);
      tl.fromTo(steps[k - 1], { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .45, ease: 'power3.out' }, at + .32);
      tl.to(sec, { backgroundColor: tones[k - 1], duration: .8 }, at);
      tl.to(bars[k - 1], { backgroundSize: '100% 100%', duration: .5 }, at + .2);
      if (k <= 4) {
        // la capa cae desde arriba y se asienta; al tocar, aparece la pila completa con sus sombras
        tl.fromTo(C(k), { autoAlpha: 0, y: fall, rotation: k % 2 ? 3 : -4, scale: 1.03 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: .9, ease: 'power3.out' }, at);
        tl.to(P(k), { autoAlpha: 1, duration: .12 }, at + .86);
        tl.to([C(k), P(k - 1)], { autoAlpha: 0, duration: .1 }, at + .96);
      } else {
        tl.to(box, { scale: 1.05, duration: .9, ease: 'power2.inOut' }, at);
      }
    }
    tl.to({}, { duration: .5 });
    ST.create({
      trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(W.innerHeight * 3.4); },
      pin: $('.capas-pin', sec), scrub: .7, animation: tl, invalidateOnRefresh: true, anticipatePin: 1
    });
  })();

  /* ---- cifras ---- */
  if (G && ST && !reduce) $$('.count').forEach(function (el) {
    var to = +el.getAttribute('data-to'), o = { v: 0 };
    ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { el.textContent = '0'; G.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
  });

  /* ---- copiar el email ---- */
  $$('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = 'Copiar'; }, 2000); };
      function sel() { var s = getSelection(), r = D.createRange(); r.selectNodeContents($('#mail')); s.removeAllRanges(); s.addRange(r); done('Seleccionado'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { done('Copiado'); }, sel);
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
