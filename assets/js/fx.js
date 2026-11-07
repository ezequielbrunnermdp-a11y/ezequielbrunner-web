/*!
 * Ezequiel Brunner — capa de experiencia compartida por todas las páginas.
 * Encabezado y menú, desplazamiento suave, escena 3D (se carga después del contenido),
 * cursor, cortina entre páginas y revelados. Todo es mejora progresiva:
 * sin JavaScript, sin WebGL o con movimiento reducido el sitio se ve completo.
 */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  var qs = new URLSearchParams(location.search);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var G = W.gsap, ST = W.ScrollTrigger, Split = W.SplitText;
  var EB = W.EB = { ready: false, stage: null, s: 0 };
  var lenis = null;
  var posterMode = qs.get('poster') === '1';
  function scrollY() { return lenis ? lenis.scroll : W.pageYOffset; }
  function small() { return W.innerWidth <= 820; }
  function hdrH() { var h = $('.hdr'); return h ? h.offsetHeight : 72; }

  /* ------------------------------------------------------- encabezado y menú */
  function initHeader() {
    var h = $('.hdr');
    if (!h) return;
    var tk = false;
    function upd() {
      tk = false;
      var y = scrollY(), max = R.scrollHeight - W.innerHeight;
      h.classList.toggle('solid', y > 24 || R.classList.contains('menu-open'));
      h.style.setProperty('--sp', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    }
    function req() { if (!tk) { tk = true; requestAnimationFrame(upd); } }
    W.addEventListener('scroll', req, { passive: true });
    if (lenis) lenis.on('scroll', req);
    EB.updateHeader = upd;
    upd();

    // submenú de Servicios: se abre con el puntero, con el teclado o con el botón
    $$('.has-sub').forEach(function (li) {
      var b = $('.sub-btn', li);
      if (!b) return;
      function set(o) { li.classList.toggle('open', o); b.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      b.addEventListener('click', function (e) { e.stopPropagation(); set(!li.classList.contains('open')); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Escape' && li.classList.contains('open')) { set(false); b.focus(); } });
      li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) set(false); });
      D.addEventListener('click', function (e) { if (!li.contains(e.target)) set(false); });
      $$('.sub a', li).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    });

    // menú de pantalla completa
    var btn = $('.menu-btn'), panel = $('#mnav');
    if (!btn || !panel) return;
    var label = $('.menu-label', btn);
    function setMenu(o) {
      R.classList.toggle('menu-open', o);
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      if (label) label.textContent = o ? 'Cerrar' : 'Menú';
      D.body.style.overflow = o ? 'hidden' : '';
      if (lenis) { if (o) lenis.stop(); else lenis.start(); }
      upd();
      if (o) { var f = $('a', panel); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); }
    }
    EB.closeMenu = function () { if (R.classList.contains('menu-open')) setMenu(false); };
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
    var mq = matchMedia('(min-width: 1081px)');
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
      var line = W.innerHeight * .4, now = null;
      secs.forEach(function (s) { if (s.getBoundingClientRect().top < line) now = s.id; });
      // "Servicios" sigue marcado mientras se recorre cualquiera de sus tres áreas
      var parent = now && /^servicios-/.test(now) ? 'servicios' : null;
      if (now === cur) return;
      cur = now;
      links.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        if (id === now || id === parent) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    W.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* --------------------------------------------------------- desplazamiento */
  function initScroll() {
    if (G && ST) G.registerPlugin(ST);
    if (G && Split) G.registerPlugin(Split);
    if (fine && !reduced && W.Lenis && G && ST && !posterMode) {
      lenis = new W.Lenis({ lerp: .1, smoothWheel: true, wheelMultiplier: .95 });
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
    var off = -(hdrH() + 8);
    if (t.id === 'inicio' || t.id === 'top') off = 0;
    if (lenis) lenis.scrollTo(t.id === 'top' ? 0 : t, { offset: off, duration: 1.6, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
    else W.scrollTo({ top: t.id === 'top' ? 0 : t.getBoundingClientRect().top + W.pageYOffset + off, behavior: reduced ? 'auto' : 'smooth' });
    if (t.id !== 'top') { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  EB.goTo = goTo;

  /* ---------------------------------------------------------- escena 3D */
  var stage = null, secs = [], bounds = [], vh = 800, docH = 4000;
  function stageAllowed() {
    if (!$('[data-stage]')) return false;
    if (qs.has('nogl') || reduced) return false;
    if (!W.WebGL2RenderingContext) return false;
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return false;
    try { var t = D.createElement('canvas').getContext('webgl2'); if (!t) return false; var l = t.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); } catch (_) { return false; }
    return true;
  }
  function pickTier() {
    if (qs.get('tier')) return +qs.get('tier');
    var cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    if (coarse || small()) return cores >= 6 && mem >= 4 ? 1 : 0;
    return cores >= 8 && mem >= 8 ? 2 : 1;
  }
  function measure() {
    vh = W.innerHeight; docH = R.scrollHeight;
    var sy = W.pageYOffset;
    var spans = secs.map(function (el) { var r = el.getBoundingClientRect(); return { top: r.top + sy, bottom: r.bottom + sy }; });
    bounds = [];
    for (var i = 0; i < spans.length - 1; i++) {
      var h = Math.min(spans[i].bottom - spans[i].top, spans[i + 1].bottom - spans[i + 1].top);
      bounds.push({ b: (spans[i].bottom + spans[i + 1].top) / 2, T: clamp(h * .6, vh * .45, vh * .85) });
    }
  }
  // progreso continuo entre estados (0 = portada): el punto de lectura baja del centro al pie al llegar al final
  function progress(y) {
    var maxY = Math.max(1, docH - vh), u = clamp(y / maxY, 0, 1), c = y + vh * (.5 + .5 * u);
    for (var i = 0; i < bounds.length; i++) {
      var b = bounds[i], a0 = b.b - b.T / 2;
      if (c < a0) return i;
      if (c < b.b + b.T / 2) { var k = (c - a0) / b.T; return i + k * k * (3 - 2 * k); }
    }
    return Math.max(0, secs.length - 1);
  }
  function initStage() {
    if (!stageAllowed()) { R.classList.add('stage-off'); return; }
    var load = function () {
      var s = D.createElement('script');
      s.src = 'assets/js/stage.js?v=20261107';
      s.async = true;
      s.onload = bootStage;
      s.onerror = function () { R.classList.add('stage-off'); };
      D.head.appendChild(s);
    };
    // el contenido primero: la escena se pide cuando la página ya cargó y el navegador está libre
    var idle = W.requestIdleCallback || function (f) { setTimeout(f, 200); };
    if (posterMode) load();
    else if (D.readyState === 'complete') idle(load, { timeout: 1500 });
    else W.addEventListener('load', function () { idle(load, { timeout: 1500 }); });
  }
  function bootStage() {
    if (!W.EBStage) { R.classList.add('stage-off'); return; }
    var canvas = D.createElement('canvas');
    canvas.id = 'stage'; canvas.setAttribute('aria-hidden', 'true');
    D.body.insertBefore(canvas, D.body.firstChild);
    var portrait = $('[data-stage="hero"]') ? 'assets/ezequiel-recorte.webp' : null;
    stage = W.EBStage.boot({ canvas: canvas, tier: pickTier(), adaptive: !qs.get('tier') && !posterMode, reduced: posterMode, portrait: portrait, preserve: posterMode });
    if (!stage) { canvas.remove(); R.classList.add('stage-off'); return; }
    EB.stage = stage;
    secs = $$('[data-stage]');
    stage.setStates(secs);
    stage.alive = 1;
    if (posterMode) { stage.back.visible = false; stage.dust.visible = false; }
    measure();
    var forced = qs.get('s');
    stage.beforeRender = function () {
      var s = forced !== null ? parseFloat(forced) : progress(scrollY());
      stage.s = EB.s = s;
    };
    stage.onDegrade = function () { R.classList.add('lite'); };
    stage.onReady = function () {
      R.classList.add('stage-on');
      EB.stageReady = true;
      if (!posterMode) setTimeout(function () { stage.sweep(); }, 500);
    };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); R.classList.remove('stage-on'); R.classList.add('stage-off'); stage.stop(); });
    if (fine && !posterMode) {
      W.addEventListener('pointermove', function (e) {
        stage.pointer.tx = e.clientX / W.innerWidth * 2 - 1;
        stage.pointer.ty = e.clientY / W.innerHeight * 2 - 1;
      }, { passive: true });
      R.addEventListener('pointerleave', function () { stage.pointer.tx = stage.pointer.ty = 0; });
    }
    var rt;
    W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { stage.resize(); measure(); }, 120); });
    if ('ResizeObserver' in W) {
      var last = 0;
      new ResizeObserver(function () { var h = D.body.scrollHeight; if (Math.abs(h - last) > 4) { last = h; clearTimeout(rt); rt = setTimeout(measure, 150); } }).observe(D.body);
    }
    W.addEventListener('load', measure);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(measure);
    D.addEventListener('visibilitychange', function () { if (!D.hidden) measure(); });
    W.addEventListener('pageshow', function (e) { if (e.persisted) { stage.start(); measure(); } });
    stage.start();
  }

  /* ---------------------------------------------------------------- cursor */
  function initCursor() {
    if (!fine || reduced) return;
    var dot = D.createElement('div'), ring = D.createElement('div');
    dot.className = 'cur cur-dot'; ring.className = 'cur cur-ring';
    [dot, ring].forEach(function (e) { e.setAttribute('aria-hidden', 'true'); D.body.appendChild(e); });
    R.classList.add('has-cursor');
    var x = -100, y = -100, rx = -100, ry = -100, seen = false;
    W.addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; if (!seen) { rx = x; ry = y; seen = true; } }, { passive: true });
    D.addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    D.addEventListener('pointerup', function () { ring.classList.remove('is-down'); });
    D.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('a, button, summary, label, select, [data-cursor]') : null;
      var txt = e.target.closest ? e.target.closest('input:not([type="radio"]):not([type="checkbox"]), textarea') : null;
      ring.classList.toggle('is-hover', !!t && !txt);
      ring.classList.toggle('is-text', !!txt);
    });
    R.addEventListener('pointerleave', function () { dot.style.opacity = ring.style.opacity = 0; });
    R.addEventListener('pointerenter', function () { dot.style.opacity = ring.style.opacity = 1; });
    var tick = function () {
      rx += (x - rx) * .17; ry += (y - ry) * .17;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    };
    if (G) G.ticker.add(tick); else (function f() { tick(); requestAnimationFrame(f); })();
  }

  /* -------------------------------------- luz de borde en tarjetas y botones magnéticos */
  function initLamps() {
    if (!fine) return;
    var vis = new Set(), pending = false, px = 0, py = 0;
    $$('.service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card, .flow-node, .faq-item, .contact-section, .bridge, .recruitment, .archive-details, .process-diagram').forEach(function (n) { n.classList.add('lamp'); });
    var io = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); }); }) : null;
    $$('.lamp').forEach(function (l) { if (io) io.observe(l); else vis.add(l); });
    function apply() {
      pending = false;
      vis.forEach(function (el) { var r = el.getBoundingClientRect(); el.style.setProperty('--lx', (px - r.left) + 'px'); el.style.setProperty('--ly', (py - r.top) + 'px'); });
    }
    W.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!pending) { pending = true; requestAnimationFrame(apply); } }, { passive: true });
  }
  function initMagnetic() {
    if (!fine || reduced || !G) return;
    $$('.btn, [data-magnetic]').forEach(function (b) {
      if (b.closest('form, .mnav')) return;
      var qx = G.quickTo(b, 'x', { duration: .5, ease: 'power3' }), qy = G.quickTo(b, 'y', { duration: .5, ease: 'power3' });
      b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * .2); qy((e.clientY - r.top - r.height / 2) * .3); });
      b.addEventListener('pointerleave', function () { qx(0); qy(0); });
    });
  }

  /* ------------------------------------------------------- cortina entre páginas */
  var curtain, cring, cst = { x: 0, y: 0 };
  function setCurtain(r) {
    curtain.style.clipPath = 'circle(' + r + 'px at ' + cst.x + 'px ' + cst.y + 'px)';
    cring.style.width = cring.style.height = (r * 2) + 'px';
    cring.style.left = cst.x + 'px'; cring.style.top = cst.y + 'px';
    cring.style.opacity = r > 4 && r < 2400 ? Math.min(1, r / 120) : 0;
  }
  function initCurtain() {
    curtain = D.createElement('div'); curtain.className = 'curtain'; curtain.setAttribute('aria-hidden', 'true');
    cring = D.createElement('div'); cring.className = 'curtain-ring'; cring.setAttribute('aria-hidden', 'true');
    D.body.appendChild(curtain); D.body.appendChild(cring);
    var maxR = function () { return Math.hypot(W.innerWidth, W.innerHeight) * 1.05; };
    var stored = null;
    try { stored = sessionStorage.getItem('eb-curtain'); sessionStorage.removeItem('eb-curtain'); } catch (_) { }
    if (stored && G && !reduced) {
      var p = stored.split(',');
      cst.x = parseFloat(p[0]) || W.innerWidth / 2; cst.y = parseFloat(p[1]) || W.innerHeight / 2;
      curtain.style.visibility = 'visible'; setCurtain(maxR());
      R.classList.remove('curtain-on');
      var o = { r: maxR() };
      G.to(o, { r: 0, duration: 1, ease: 'power3.inOut', delay: .05, onUpdate: function () { setCurtain(o.r); }, onComplete: function () { curtain.style.visibility = 'hidden'; cring.style.opacity = 0; } });
    } else R.classList.remove('curtain-on');
    if (reduced || !G) return;
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin || /^(mailto|tel):/.test(url.protocol)) return;
      var here = location.pathname.replace(/index\.html$/, ''), there = url.pathname.replace(/index\.html$/, '');
      if (there === here && (url.search === location.search || a.hasAttribute('data-tema'))) return;
      var last = url.pathname.split('/').pop();
      if (last.indexOf('.') > -1 && !/\.html$/.test(last)) return;
      e.preventDefault();
      var x = e.clientX || W.innerWidth / 2, y = e.clientY || W.innerHeight / 2;
      if (e.detail === 0) { var rr = a.getBoundingClientRect(); x = rr.left + rr.width / 2; y = rr.top + rr.height / 2; }
      cst.x = x; cst.y = y;
      try { sessionStorage.setItem('eb-curtain', x + ',' + y); } catch (_) { }
      curtain.style.visibility = 'visible';
      var o = { r: 0 }, done = false, go = function () { if (!done) { done = true; location.href = url.href; } };
      G.to(o, { r: maxR(), duration: .7, ease: 'power3.in', onUpdate: function () { setCurtain(o.r); }, onComplete: go });
      setTimeout(go, 1400);
    });
    W.addEventListener('pageshow', function (e) { if (e.persisted) { curtain.style.visibility = 'hidden'; cring.style.opacity = 0; setCurtain(0); } });
  }

  /* ---------------------------------------------------------------- revelados */
  function glue(el) {
    $$('em, strong, a, span', el).forEach(function (n) {
      var nx = n.nextSibling;
      if (!nx || nx.nodeType !== 3) return;
      var m = nx.textContent.match(/^[.,;:!?)»”]+/);
      if (!m || n.parentNode.classList.contains('fx-glue')) return;
      var w = D.createElement('span'); w.className = 'fx-glue'; w.style.whiteSpace = 'nowrap';
      n.parentNode.insertBefore(w, n); w.appendChild(n); w.appendChild(D.createTextNode(m[0]));
      nx.textContent = nx.textContent.slice(m[0].length);
    });
  }
  function splitReveal(el) {
    glue(el);
    try {
      Split.create(el, {
        type: 'words', mask: 'words', wordsClass: 'fx-w', autoSplit: true, aria: 'auto',
        onSplit: function (self) {
          return G.from(self.words, { yPercent: 118, rotate: 3, duration: 1.2, ease: 'expo.out', stagger: .055, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
        }
      });
    } catch (err) { if (W.console) console.warn(err); }
  }
  function initReveals() {
    if (!G || !ST || reduced || posterMode) return;
    R.classList.add('fx');
    var skip = function (el) { return el.closest('.hero, .page-hero, .hdr, .mnav'); };
    if (Split) $$('main h2, .doc-head h3, .feature-title, .art-head h1, .subsection-heading h3, .news-group-title').forEach(function (h) { if (!skip(h)) splitReveal(h); });
    $$('.lead, .sec-intro, .quote, .note, .dek, .doc-head p, .meta, .sec-all, .reads-head, .press, .sign, .p-sec-head p:not(.eyebrow), .section-heading > p:not(.eyebrow), .prose p, .contact-copy > p:not(.eyebrow), .bridge p:not(.eyebrow), .recruitment p:not(.eyebrow), .example-note, .career-source').forEach(function (p) {
      if (skip(p) || p.closest('.read')) return;
      G.from(p, { opacity: 0, y: 26, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 92%', once: true } });
    });
    $$('.eyebrow, .label').forEach(function (e) {
      if (skip(e)) return;
      G.from(e, { opacity: 0, x: -16, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 94%', once: true } });
    });
    var cards = $$('.card, .read, .doc-list li, .step, .fact, .channel, .stats > div, .svc-links li, .svc-tagline, .item, .service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card, .faq-item, .flow-node, .career-list li, .principle-strip > div').filter(function (c) { return !skip(c); });
    cards.forEach(function (c) { if (c.getBoundingClientRect().top > W.innerHeight * .92) G.set(c, { opacity: 0, y: 48 }); });
    ST.batch(cards, { start: 'top 93%', once: true, onEnter: function (els) { G.to(els, { opacity: 1, y: 0, duration: 1.15, ease: 'expo.out', stagger: .08, overwrite: true, clearProps: 'opacity,transform' }); } });
    $$('.svc-photo, .photo, .pub-cover').forEach(function (f) {
      if (skip(f)) return;
      G.from(f, { clipPath: 'inset(12% 8% 12% 8% round 28px)', opacity: 0, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 90%', once: true } });
    });
    // franja de palabras: acelera y se inclina con la velocidad del scroll
    var track = $('.marquee .track');
    if (track) {
      var tw = G.to(track, { xPercent: -50, ease: 'none', duration: 48, repeat: -1 });
      var skew = G.quickTo(track, 'skewX', { duration: .5, ease: 'power3' });
      ST.create({
        trigger: '.marquee', start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { if (self.isActive) tw.play(); else tw.pause(); },
        onUpdate: function (self) {
          var v = clamp(self.getVelocity() / -260, -8, 8);
          skew(v); tw.timeScale(1 + Math.abs(v) * .8);
          G.to(tw, { timeScale: 1, duration: 1.2, overwrite: true, delay: .05 });
        }
      });
    }
  }

  /* peso de la tipografía del nombre según la cercanía del cursor */
  function initNameWeight() {
    if (!fine || reduced || !Split || posterMode) return;
    var h = $('.hero-name');
    if (!h) return;
    var sp;
    try { sp = Split.create(h, { type: 'chars', charsClass: 'ch', aria: 'auto' }); } catch (_) { return; }
    var chars = sp.chars, px = -1e4, py = -1e4, raf = 0;
    W.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    function upd() {
      raf = 0;
      var r0 = h.getBoundingClientRect();
      if (r0.bottom < 0 || r0.top > W.innerHeight) return;
      chars.forEach(function (c) {
        var r = c.getBoundingClientRect(), d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        c.style.fontVariationSettings = '"opsz" 144, "wght" ' + (300 + 240 * Math.exp(-d * d / (2 * 140 * 140))).toFixed(0);
      });
    }
  }

  /* ---------------------------------------------------------------- arranque */
  function boot() {
    if (posterMode) R.classList.add('poster-mode');
    initScroll();
    initHeader();
    initActive();
    initStage();
    if (posterMode) return;
    initCurtain();
    initCursor();
    initLamps();
    initMagnetic();
    var go = function () {
      initReveals();
      initNameWeight();
      EB.ready = true;
      if (ST) {
        setTimeout(function () { ST.refresh(); }, 400);
        W.addEventListener('load', function () { ST.refresh(); });
      }
    };
    if (D.fonts && D.fonts.ready) Promise.race([D.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(go); else go();
    // si se llega con un ancla, se respeta la altura del encabezado
    if (location.hash && location.hash.length > 1) {
      var t = D.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) W.addEventListener('load', function () { setTimeout(function () { W.scrollTo(0, t.getBoundingClientRect().top + W.pageYOffset - hdrH() - 8); if (lenis) lenis.scrollTo(W.pageYOffset, { immediate: true }); }, 60); });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
