/*!
 * Ezequiel Brunner — comportamiento común a todas las páginas.
 * Encabezado y menú, desplazamiento suave, apariciones discretas al bajar y fundido entre páginas.
 * Mejora progresiva: sin JavaScript o con movimiento reducido el contenido se ve completo.
 */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var G = W.gsap, ST = W.ScrollTrigger, Split = W.SplitText;
  var EB = W.EB = { ready: false };
  var lenis = null;
  function scrollY() { return lenis ? lenis.scroll : W.pageYOffset; }
  function hdrH() { var h = $('.hdr'); return h ? h.offsetHeight : 76; }

  /* ------------------------------------------------- encabezado y menú */
  function initHeader() {
    var h = $('.hdr');
    if (!h) return;
    var last = scrollY(), tk = false;
    function upd() {
      tk = false;
      var y = scrollY(), open = R.classList.contains('menu-open');
      h.classList.toggle('solid', y > 24 || open);
      // se aparta al bajar y vuelve al subir
      if (!open && !h.contains(D.activeElement)) {
        if (y > 160 && y > last + 4) h.classList.add('away');
        else if (y < last - 4 || y < 160) h.classList.remove('away');
      }
      last = y;
    }
    function req() { if (!tk) { tk = true; requestAnimationFrame(upd); } }
    W.addEventListener('scroll', req, { passive: true });
    if (lenis) lenis.on('scroll', req);
    h.addEventListener('focusin', function () { h.classList.remove('away'); });
    upd();

    var btn = $('.menu-btn'), panel = $('#mnav');
    if (!btn || !panel) return;
    var label = $('.menu-label', btn);
    function setMenu(o) {
      R.classList.toggle('menu-open', o);
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (label) label.textContent = o ? 'Cerrar' : 'Menú';
      D.body.style.overflow = o ? 'hidden' : '';
      if (lenis) { if (o) lenis.stop(); else lenis.start(); }
      h.classList.remove('away');
      upd();
      if (o) { var f = $('a', panel); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 80); }
    }
    btn.addEventListener('click', function () { setMenu(!R.classList.contains('menu-open')); });
    $$('a', panel).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    D.addEventListener('keydown', function (e) {
      if (!R.classList.contains('menu-open')) return;
      if (e.key === 'Escape') { setMenu(false); btn.focus(); return; }
      if (e.key !== 'Tab') return;
      var items = [btn].concat($$('a, button', panel));
      var i = items.indexOf(D.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    });
    var mq = matchMedia('(min-width: 1101px)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { setMenu(false); });
  }

  /* sección activa en el menú */
  function initActive() {
    var links = $$('.nav a[href^="#"], .mnav a[href^="#"]');
    if (!links.length) return;
    var ids = [];
    links.forEach(function (a) { var id = a.getAttribute('href').slice(1); if (id && ids.indexOf(id) < 0 && D.getElementById(id)) ids.push(id); });
    var secs = ids.map(function (id) { return D.getElementById(id); });
    var tk = false, cur = null;
    function upd() {
      tk = false;
      var line = W.innerHeight * .42, now = null;
      secs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top < line && r.bottom > line) now = s.id; });
      if (now === cur) return;
      cur = now;
      links.forEach(function (a) { if (a.getAttribute('href').slice(1) === now) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    W.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ------------------------------------------------- desplazamiento suave */
  function initScroll() {
    if (G && ST) G.registerPlugin(ST);
    if (G && Split) G.registerPlugin(Split);
    if (fine && !reduced && W.Lenis && G && ST) {
      lenis = new W.Lenis({ lerp: .11, smoothWheel: true, wheelMultiplier: .9 });
      lenis.on('scroll', ST.update);
      G.ticker.add(function (t) { lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
      EB.lenis = lenis;
    }
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      var here = location.pathname.replace(/index\.html$/, ''), there = url.pathname.replace(/index\.html$/, '');
      if (url.origin !== location.origin || there !== here || !url.hash || url.hash === '#') return;
      if (url.search && url.search !== location.search && !a.hasAttribute('data-tema')) return;
      var t = D.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!t) return;
      e.preventDefault();
      goTo(t);
      try { history.replaceState(null, '', url.hash); } catch (_) { }
    });
  }
  function goTo(t) {
    var top = t.id === 'top' || t.id === 'inicio';
    var off = top ? 0 : -(hdrH() - 1);
    if (lenis) lenis.scrollTo(top ? 0 : t, { offset: off, duration: 1.4, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
    else W.scrollTo({ top: top ? 0 : t.getBoundingClientRect().top + W.pageYOffset + off, behavior: reduced ? 'auto' : 'smooth' });
    if (!top) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  EB.goTo = goTo;

  /* ------------------------------------------- fundido breve entre páginas */
  function initLeave() {
    if (reduced) return;
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
      var here = location.pathname.replace(/index\.html$/, ''), there = url.pathname.replace(/index\.html$/, '');
      if (there === here && (url.search === location.search || a.hasAttribute('data-tema'))) return;
      var last = url.pathname.split('/').pop();
      if (last.indexOf('.') > -1 && !/\.html$/.test(last)) return;
      e.preventDefault();
      R.classList.add('leaving');
      setTimeout(function () { location.href = url.href; }, 260);
    });
    W.addEventListener('pageshow', function (e) { if (e.persisted) R.classList.remove('leaving'); });
  }

  /* ------------------------------------------------ el nombre a todo el ancho */
  function fitName() {
    var h = $('.hero-name');
    if (!h) return;
    function fit() {
      h.style.fontSize = '100px';
      h.style.width = 'max-content';
      var w = h.getBoundingClientRect().width;
      h.style.width = '';
      var cw = h.parentElement.getBoundingClientRect().width;
      if (w > 0 && cw > 0) h.style.fontSize = clamp(100 * cw / w * .985, 48, 260).toFixed(2) + 'px';
    }
    fit();
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit);
    var t;
    W.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 80); });
  }

  /* la puntuación queda pegada a la palabra en itálica que la precede (no salta de renglón) */
  function glue(el) {
    $$('em, strong, a, span', el).forEach(function (n) {
      var nx = n.nextSibling;
      if (!nx || nx.nodeType !== 3) return;
      var m = nx.textContent.match(/^[.,;:!?)»”]+/);
      if (!m || n.parentNode.classList.contains('glue')) return;
      var w = D.createElement('span'); w.className = 'glue'; w.style.whiteSpace = 'nowrap';
      n.parentNode.insertBefore(w, n); w.appendChild(n); w.appendChild(D.createTextNode(m[0]));
      nx.textContent = nx.textContent.slice(m[0].length);
    });
  }

  /* ------------------------------------------------- apariciones al bajar */
  function initReveals() {
    if (!G || !ST || reduced) return;
    R.classList.add('fx');
    var skip = function (el) { return el.closest('.hero, .page-hero, .p-hero, .hdr, .mnav, .ftr'); };
    // títulos: cada línea sube desde su propio renglón
    if (Split) $$('main h2, .f-title, .doc-head h3, .art-head h1, .page-hero h1, .p-title').forEach(function (h) {
      if (h.closest('.hdr, .mnav')) return;
      glue(h);
      try {
        Split.create(h, {
          type: 'lines', mask: 'lines', linesClass: 'rv-l', autoSplit: true, aria: 'auto',
          onSplit: function (self) {
            return G.from(self.lines, { yPercent: 105, duration: 1.25, ease: 'power4.out', stagger: .08, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
          }
        });
      } catch (err) { if (W.console) console.warn(err); }
    });
    // textos breves: aparecen con un desplazamiento mínimo
    $$('main .eyebrow, main .label, .lead, .sec-intro, .dek, .quote, .note, .doc-head p, .press, .sign, .reads-head, .caps p, .meta, main .link, .channels, .section-heading > p:not(.eyebrow), .prose p, .contact-copy > p:not(.eyebrow), .hero-summary, .art-dek, .art-body p').forEach(function (p) {
      if (skip(p) && !p.closest('.page-hero, .p-hero')) return;
      if (p.closest('.read, .doc-list, .f-meta')) return;
      G.from(p, { opacity: 0, y: 14, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 92%', once: true } });
    });
    // piezas de una lista: entran en tanda
    var items = $$('.read, .doc-list li, .item, .list, .step, .fact, .stats > div, .channel, .toc li, .doc-card, .m-card, .dossier, .service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card, .faq-item, .flow-node, .career-list li, .principle-strip > div').filter(function (c) { return !skip(c); });
    items.forEach(function (c) { if (c.getBoundingClientRect().top > W.innerHeight * .94) G.set(c, { opacity: 0, y: 22 }); });
    ST.batch(items, { start: 'top 94%', once: true, onEnter: function (els) { G.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .07, overwrite: true, clearProps: 'opacity,transform' }); } });
    // fotografías: se descubren de abajo hacia arriba
    $$('.area-photo .ph, .photo .ph, .page-hero-media, .f-img, .r-img').forEach(function (f) {
      if (f.closest('.hero')) return;
      var img = $('img', f);
      var tl = G.timeline({ scrollTrigger: { trigger: f, start: 'top 86%', once: true } });
      tl.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'power4.inOut' });
      if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 2, ease: 'power3.out', clearProps: 'transform' }, 0);
    });
  }

  /* ------------------------------------------------------------- arranque */
  function boot() {
    initScroll();
    initHeader();
    initActive();
    initLeave();
    fitName();
    var go = function () {
      initReveals();
      EB.ready = true;
      if (ST) { setTimeout(function () { ST.refresh(); }, 300); W.addEventListener('load', function () { ST.refresh(); }); }
    };
    if (D.fonts && D.fonts.ready) Promise.race([D.fonts.ready, new Promise(function (r) { setTimeout(r, 1000); })]).then(go); else go();
    // si se llega con un ancla, se respeta la altura del encabezado
    if (location.hash && location.hash.length > 1) {
      var t = D.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) W.addEventListener('load', function () { setTimeout(function () { W.scrollTo(0, t.getBoundingClientRect().top + W.pageYOffset - hdrH() + 1); if (lenis) lenis.scrollTo(W.pageYOffset, { immediate: true }); }, 60); });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
