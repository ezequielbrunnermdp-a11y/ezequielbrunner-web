/*!
 * Ezequiel Brunner — orquestador visual
 * Une el desplazamiento con el escenario WebGL (scene.js) y con GSAP:
 * escenas por sección, cursor, cortina entre páginas, revelados y arranque.
 * Todo es una mejora progresiva: sin JavaScript o sin WebGL el contenido se ve igual.
 */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var qs = new URLSearchParams(location.search);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var G = W.gsap, ST = W.ScrollTrigger, Split = W.SplitText;
  var EB = W.EB = { ready: false, reduced: reduced, s: 0, index: 0, onScene: [], debug: {} };
  var isSmall = function () { return W.innerWidth <= 820; };

  /* ------------------------------------------------------------ paletas y escenas */
  var C = {
    mintDeep: [.04, .36, .34], mint: [.37, .92, .83], sky: [.49, .83, .99], teal: [.04, .30, .36],
    amberDeep: [.55, .22, .08], amber: [.91, .73, .54], cream: [1, .95, .85], white: [.95, 1, 1], warm: [1, .88, .68], orange: [.95, .66, .38]
  };
  var DEF = {
    cloud:    { f: 4, pal: [C.mintDeep, C.mint, C.sky], glow: [.05, .30, .30], gi: .10, rot: [.2, .08], intensity: .85, dof: .7, size: 1.0, swirl: 1.2, scan: 1 },
    portrait: { f: 0, pal: [[.03, .30, .30], C.mint, C.cream], glow: [.05, .32, .30], gi: .15, rot: [0, 0], intensity: 1, dof: .3, size: 1 },
    network:  { f: 1, pal: [C.teal, C.mint, C.warm], glow: [.04, .30, .32], gi: .14, rot: [-.5, .1], intensity: 1, dof: .5, size: 1.05 },
    steam:    { f: 2, pal: [C.amberDeep, C.amber, C.cream], glow: [.32, .15, .05], gi: .18, rot: [0, .42], intensity: 1.05, dof: .35, size: 1.1 },
    org:      { f: 3, pal: [C.teal, C.mint, C.orange], glow: [.07, .22, .24], gi: .12, rot: [.12, 0], intensity: 1, dof: .4, size: 1 },
    lattice:  { f: 5, pal: [C.mintDeep, C.mint, C.sky], glow: [.04, .28, .30], gi: .12, rot: [.6, .25], intensity: .95, dof: .5, size: .95 },
    flow:     { f: 6, pal: [C.teal, C.mint, C.amber], glow: [.06, .26, .26], gi: .12, rot: [.2, .1], intensity: 1, dof: .4, size: 1 },
    ring:     { f: 7, pal: [[.05, .40, .45], C.amber, C.white], glow: [.30, .18, .08], gi: .16, rot: [.15, 1.0], intensity: 1.05, dof: .3, size: 1 },
    wordmark: { f: 8, pal: [[.03, .30, .30], C.mint, C.cream], glow: [.05, .28, .26], gi: .12, rot: [0, 0], intensity: 1, dof: .1, size: .9 }
  };

  /* ---------------------------------------------------------------- capacidades */
  var Q = qs.get('fxq');
  var cores = navigator.hardwareConcurrency || 4;
  var N = Q === 'high' ? 36000 : Q === 'mid' ? 20000 : Q === 'low' ? 9000 : (coarse || isSmall() ? 14000 : cores >= 6 ? 36000 : 22000);
  if (!Q && navigator.connection && navigator.connection.saveData) N = Math.min(N, 12000);
  var dprMax = N >= 30000 ? 2 : N >= 18000 ? 1.6 : 1.4;

  var canvas = null, GL = false, scenes = [], secs = [], bounds = [], vh = 800, docH = 4000, introT = { v: 0 };
  var lenis = null, scrollY = 0, lastScrollY = 0, vel = 0;

  /* ---------------------------------------------------------------- escenario WebGL */
  function initGL() {
    if (!W.EBScene || !W.WebGL2RenderingContext || R.classList.contains('no-gl')) { R.classList.add('no-gl'); return false; }
    canvas = D.createElement('canvas');
    canvas.id = 'fx-canvas'; canvas.setAttribute('aria-hidden', 'true');
    D.body.insertBefore(canvas, D.body.firstChild);
    var ok = W.EBScene.init({ canvas: canvas, N: N, dprMax: dprMax, reduced: reduced, adaptive: !Q, preserve: !!qs.get('fxpreserve'), lampR: isSmall() ? 90 : 130 });
    if (!ok) { canvas.remove(); R.classList.add('no-gl'); return false; }
    W.EBScene.onLost = function () { R.classList.add('no-gl'); };
    W.EBScene.onDegrade = function (f) { if (f < .62) R.classList.add('fx-lite'); };
    sizeCanvas();
    return true;
  }
  var cw = 0, ch = 0;
  function sizeCanvas() {
    if (!canvas) return;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== cw || h !== ch) { cw = w; ch = h; W.EBScene.resize(w, h); }
  }

  function numPair(str, def) {
    if (!str) return def;
    var p = str.split(',').map(parseFloat);
    return p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]) ? p : def;
  }

  function makeScene(el) {
    var name = el.getAttribute('data-scene'), d = DEF[name] || DEF.portrait, o = {};
    for (var k in d) o[k] = d[k];
    o.name = name; o.el = el;
    o.bg = { glow: d.glow, c: [.5, .5], i: d.gi };
    if (el.hasAttribute('data-warm')) {                      // versión cálida (gastronomía)
      o.pal = [C.amberDeep, C.amber, C.cream];
      o.bg = { glow: [.30, .15, .05], c: [.5, .5], i: d.gi * 1.1 };
    }
    var anchorSel = el.getAttribute('data-anchor');
    var anchor0 = anchorSel ? $(anchorSel, el) || $(anchorSel) : null;
    var mode = el.getAttribute('data-fit-mode') || 'min';
    o.layout = function (out, Wd, Hd) {
      var m = isSmall();
      var anchor = anchor0 && !(m && el.getAttribute('data-anchor-m') === 'none') ? anchor0 : null;
      var fit = parseFloat(el.getAttribute(m && el.hasAttribute('data-fit-m') ? 'data-fit-m' : 'data-fit')) || 1;
      var off = numPair(el.getAttribute(m && el.hasAttribute('data-off-m') ? 'data-off-m' : 'data-off'), [0, 0]);
      if (anchor) {
        var r = anchor.getBoundingClientRect();
        var base = mode === 'h' ? r.height / 2 : mode === 'w' ? r.width / 2 : Math.min(r.width, r.height) / 2;
        out.unit = base * fit;
        out.cx = r.left + r.width / 2 - Wd / 2 + off[0] * out.unit;
        out.cy = Hd / 2 - (r.top + r.height / 2) - off[1] * out.unit;
      } else {
        var pos = numPair(el.getAttribute(m && el.hasAttribute('data-pos-m') ? 'data-pos-m' : (m ? 'data-none' : 'data-pos')), m ? [.5, .32] : [.5, .5]);
        var size = parseFloat(el.getAttribute(m && el.hasAttribute('data-size-m') ? 'data-size-m' : 'data-size')) || .8;
        out.unit = size * Math.min(Wd, Hd) / 2 * fit;
        out.cx = (pos[0] - .5) * Wd + off[0] * out.unit;
        out.cy = (.5 - pos[1]) * Hd - off[1] * out.unit;
      }
    };
    o.intensityD = el.hasAttribute('data-intensity') ? parseFloat(el.getAttribute('data-intensity')) : d.intensity;
    o.intensityM = el.hasAttribute('data-intensity-m') ? parseFloat(el.getAttribute('data-intensity-m')) : o.intensityD * .65;
    o.intensity = isSmall() ? o.intensityM : o.intensityD;
    return o;
  }

  function buildScenes() {
    secs = $$('[data-scene]');
    if (!secs.length) return false;
    scenes = secs.map(makeScene);
    // la nube de arranque: mismo centro que la primera escena, más grande
    var first = scenes[0], intro = {};
    for (var k in DEF.cloud) intro[k] = DEF.cloud[k];
    intro.name = 'intro'; intro.bg = { glow: DEF.cloud.glow, c: [.5, .5], i: DEF.cloud.gi };
    intro.layout = function (out, Wd, Hd) { first.layout(out, Wd, Hd); out.unit *= 1.5; };
    W.EBScene.setScenes([intro].concat(scenes));
    return true;
  }

  function measure() {
    scenes.forEach(function (sc) { sc.intensity = isSmall() ? sc.intensityM : sc.intensityD; });
    vh = W.innerHeight; docH = D.documentElement.scrollHeight;
    var sy = W.pageYOffset;
    secs.forEach(function (el, i) {
      var r = el.getBoundingClientRect();
      scenes[i].top = r.top + sy; scenes[i].bottom = r.bottom + sy;
    });
    bounds = [];
    for (var i = 0; i < scenes.length - 1; i++) {
      var b = (scenes[i].bottom + scenes[i + 1].top) / 2;
      var h = Math.min(scenes[i].bottom - scenes[i].top, scenes[i + 1].bottom - scenes[i + 1].top);
      bounds.push({ b: b, T: clamp(h * .6, vh * .45, vh * .9) });
    }
  }

  /* progreso continuo entre escenas a partir del scroll (0 = primera sección) */
  function sceneProgress(y) {
    var maxY = Math.max(1, docH - vh), u = clamp(y / maxY, 0, 1);
    var c = y + vh * (.5 + .5 * u);          // al llegar al final, el punto de lectura llega al fondo
    for (var i = 0; i < bounds.length; i++) {
      var b = bounds[i], a0 = b.b - b.T / 2;
      if (c < a0) return i;
      if (c < b.b + b.T / 2) { var u = (c - a0) / b.T; return i + u * u * (3 - 2 * u); }
    }
    return Math.max(0, scenes.length - 1);
  }

  function updateScene(dt) {
    var y = lenis ? lenis.scroll : W.pageYOffset;
    var dy = y - lastScrollY; lastScrollY = y;
    vel = lerp(vel, dt > 0 ? dy / dt : 0, .2);
    W.EBScene.state.scrollVel = clamp(vel / 2600, -1, 1);
    var sp = qs.get('fxs') !== null ? parseFloat(qs.get('fxs')) : (EB.debug.forceS != null ? EB.debug.forceS : sceneProgress(y));
    EB.s = sp;
    var eff = 1 + sp - (1 - introT.v);
    if (EB.debug.rawS != null) eff = EB.debug.rawS;
    W.EBScene.state.s = Math.max(0, eff);
    var idx = Math.round(sp);
    if (idx !== EB.index) {
      EB.index = idx;
      if (!reduced && introT.v >= 1) { W.EBScene.flash(.75); }
      EB.onScene.forEach(function (cb) { cb(idx, scenes[idx]); });
    }
    if (lenis) {
      // la altura del documento cambia con acordeones/imágenes: se recalcula bajo demanda
    }
  }

  /* ---------------------------------------------------------------------- cursor */
  function initCursor() {
    if (!fine || reduced) return;
    var dot = D.createElement('div'), ring = D.createElement('div'), wrap = D.createElement('div');
    wrap.className = 'cur'; dot.className = 'cur cur-dot'; ring.className = 'cur cur-ring';
    wrap.style.display = 'none';
    [dot, ring].forEach(function (e) { e.setAttribute('aria-hidden', 'true'); D.body.appendChild(e); });
    R.classList.add('has-cursor');
    var x = -100, y = -100, rx = -100, ry = -100, seen = false;
    W.addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!seen) { rx = x; ry = y; seen = true; }
    }, { passive: true });
    D.addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    D.addEventListener('pointerup', function () { ring.classList.remove('is-down'); });
    D.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('a, button, summary, label, [data-cursor], select, input[type="submit"]') : null;
      var txt = e.target.closest ? e.target.closest('input:not([type="radio"]):not([type="checkbox"]), textarea') : null;
      ring.classList.toggle('is-hover', !!t && !txt);
      ring.classList.toggle('is-text', !!txt);
    });
    D.documentElement.addEventListener('pointerleave', function () { dot.style.opacity = 0; ring.style.opacity = 0; });
    D.documentElement.addEventListener('pointerenter', function () { dot.style.opacity = 1; ring.style.opacity = 1; });
    (G ? function (cb) { G.ticker.add(cb); } : function (cb) { (function f() { cb(); requestAnimationFrame(f); })(); })(function () {
      rx += (x - rx) * .16; ry += (y - ry) * .16;
      dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    });
  }

  /* --------------------------------------------- puntero → escenario, luz en tarjetas */
  function initPointer() {
    var pending = false, px = 0, py = 0;
    if (D.body.getAttribute('data-page') !== 'home') {
      $$('.service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card, .flow-node, .faq-item, .contact-section, .bridge, .recruitment, .archive-details, .article-card, .process-diagram').forEach(function (n) { n.classList.add('lamp'); });
    }
    var lamps = [], vis = new Set();
    function collect() { lamps = $$('.lamp'); if ('IntersectionObserver' in W) { lamps.forEach(function (l) { io.observe(l); }); } else lamps.forEach(function (l) { vis.add(l); }); }
    var io = 'IntersectionObserver' in W ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); });
    }) : null;
    collect();
    EB.refreshLamps = function () { collect(); };
    function apply() {
      pending = false;
      vis.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--lx', (px - r.left) + 'px');
        el.style.setProperty('--ly', (py - r.top) + 'px');
      });
    }
    W.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (GL) W.EBScene.pointer(px, py, e.pointerType !== 'touch');
      if (!pending) { pending = true; requestAnimationFrame(apply); }
    }, { passive: true });
    D.documentElement.addEventListener('pointerleave', function () { if (GL) W.EBScene.pointer(0, 0, false); });
    W.addEventListener('blur', function () { if (GL) W.EBScene.pointer(0, 0, false); });
    var holding = false, holdTimer = 0;
    D.addEventListener('pointerdown', function (e) {
      if (!GL || reduced) return;
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, summary, label')) return;
      holding = true;
      var touch = e.pointerType === 'touch', x = e.clientX, y = e.clientY;
      if (touch) {
        // en pantallas táctiles, un deslizamiento es scroll: la atracción empieza solo si el dedo se queda quieto
        clearTimeout(holdTimer);
        holdTimer = setTimeout(function () { if (holding) { W.EBScene.pointer(x, y, true); W.EBScene.state.pulling = true; } }, 230);
      } else W.EBScene.state.pulling = true;
    });
    function release(e, cancelled) {
      clearTimeout(holdTimer);
      if (!holding) return;
      holding = false;
      var wasPulling = W.EBScene.state.pulling;
      W.EBScene.state.pulling = false;
      if (cancelled) return;                                   // el navegador tomó el gesto (scroll): sin onda
      var x = e.clientX != null ? e.clientX : W.innerWidth / 2, y = e.clientY != null ? e.clientY : W.innerHeight / 2;
      W.EBScene.pulse(x, y, wasPulling ? 1.1 : .8);
      if (wasPulling) W.EBScene.flash(.35);
      if (e.pointerType === 'touch') setTimeout(function () { W.EBScene.pointer(0, 0, false); }, 700);
    }
    D.addEventListener('pointerup', function (e) { release(e, false); });
    D.addEventListener('pointercancel', function (e) { release(e, true); });
    // los botones y tarjetas también hablan con el escenario
    D.addEventListener('pointerover', function (e) {
      if (!GL || reduced || e.pointerType === 'touch') return;
      var t = e.target.closest ? e.target.closest('.lamp, .btn, .button') : null;
      if (t && !t.contains(e.relatedTarget)) W.EBScene.pulse(e.clientX, e.clientY, .45);
    });
  }

  function initMagnetic() {
    if (!fine || reduced || !G) return;
    $$('.btn, .button, [data-magnetic]').forEach(function (b) {
      var qx = G.quickTo(b, 'x', { duration: .5, ease: 'power3' }), qy = G.quickTo(b, 'y', { duration: .5, ease: 'power3' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * .22); qy((e.clientY - r.top - r.height / 2) * .32);
      });
      b.addEventListener('pointerleave', function () { qx(0); qy(0); });
    });
  }

  /* ------------------------------------------------------------- scroll suave */
  function initScroll() {
    if (G && ST) G.registerPlugin(ST);
    if (G && Split) G.registerPlugin(Split);
    if (fine && !reduced && W.Lenis && G && ST) {
      lenis = new W.Lenis({ lerp: .09, smoothWheel: true, wheelMultiplier: .95 });
      lenis.on('scroll', ST.update);
      G.ticker.add(function (t) { lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
      $$('.nav-panel, .mobile-nav, [data-lenis-prevent-auto]').forEach(function (e) { e.setAttribute('data-lenis-prevent', ''); });
      EB.lenis = lenis;
    }
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
      var t = D.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -64, duration: 1.7, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
      else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      try { history.replaceState(null, '', url.hash); } catch (_) { }
      t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
    });
  }

  /* --------------------------------------------------------- cortina entre páginas */
  var curtain, ring, curtainSt = { r: 0, x: 0, y: 0 };
  function setCurtain(r) {
    curtainSt.r = r;
    curtain.style.clipPath = 'circle(' + r + 'px at ' + curtainSt.x + 'px ' + curtainSt.y + 'px)';
    ring.style.width = ring.style.height = (r * 2) + 'px';
    ring.style.left = curtainSt.x + 'px'; ring.style.top = curtainSt.y + 'px';
    ring.style.opacity = r > 4 && r < 2200 ? Math.min(1, r / 120) : 0;
  }
  function initCurtain() {
    curtain = D.createElement('div'); curtain.className = 'curtain'; curtain.setAttribute('aria-hidden', 'true');
    ring = D.createElement('div'); ring.className = 'curtain-ring'; ring.setAttribute('aria-hidden', 'true');
    D.body.appendChild(curtain); D.body.appendChild(ring);
    var maxR = function () { return Math.hypot(W.innerWidth, W.innerHeight) * 1.05; };
    var stored = null;
    try { stored = sessionStorage.getItem('eb-curtain'); } catch (_) { }
    if (stored && G && !reduced) {
      var p = stored.split(',');
      curtainSt.x = parseFloat(p[0]) || W.innerWidth / 2; curtainSt.y = parseFloat(p[1]) || W.innerHeight / 2;
      curtain.style.visibility = 'visible'; setCurtain(maxR());
      R.classList.remove('curtain-on');
      try { sessionStorage.removeItem('eb-curtain'); } catch (_) { }
      var o = { r: maxR() };
      EB.curtainIn = G.to(o, { r: 0, duration: 1.05, ease: 'power3.inOut', delay: .08, onUpdate: function () { setCurtain(o.r); }, onComplete: function () { curtain.style.visibility = 'hidden'; ring.style.opacity = 0; } });
    } else R.classList.remove('curtain-on');

    if (reduced || !G) return;
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var url; try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      var last = url.pathname.split('/').pop();
      if (last.indexOf('.') > -1 && !/\.html$/.test(last)) return;
      e.preventDefault();
      var x = e.clientX || W.innerWidth / 2, y = e.clientY || W.innerHeight / 2;
      if (e.detail === 0) { var rr = a.getBoundingClientRect(); x = rr.left + rr.width / 2; y = rr.top + rr.height / 2; }
      curtainSt.x = x; curtainSt.y = y;
      try { sessionStorage.setItem('eb-curtain', x + ',' + y); } catch (_) { }
      curtain.style.visibility = 'visible';
      var o = { r: 0 }, go = function () { location.href = url.href; };
      G.to(o, { r: maxR(), duration: .75, ease: 'power3.in', onUpdate: function () { setCurtain(o.r); }, onComplete: go });
      setTimeout(go, 1600);
    });
    W.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      curtain.style.visibility = 'hidden'; ring.style.opacity = 0; setCurtain(0);
      if (GL) W.EBScene.start();
    });
  }

  /* --------------------------------------------------------------- revelados */
  var HEAD_SEL = 'main h2, .section-heading h2, .bridge h2, .contact-copy h2, .recruitment h2, .subsection-heading h3, .news-group-title';
  var SOFT_SEL = '.lead, .hero-summary, .section-heading > p:not(.eyebrow), .quote, .note, .prose p, .contact-copy > p:not(.eyebrow), .bridge p:not(.eyebrow), .recruitment p:not(.eyebrow), .example-note, .career-source';
  var CARD_SEL = '.article-card, .service-card, .usecase-card, .panel, .publication-card, .media-card, .news-card, .step, .faq-item, .flow-node, .career-list li, .principle-strip > div, .card, .fact, .channel, .stats > div';

  function gluePunctuation(el) {
    $$('em, strong, a, span', el).forEach(function (n) {
      var nx = n.nextSibling;
      if (!nx || nx.nodeType !== 3) return;
      var m = nx.textContent.match(/^[.,;:!?)\u00bb\u201d]+/);
      if (!m || n.parentNode.classList.contains('fx-glue')) return;
      var w = D.createElement('span'); w.className = 'fx-glue'; w.style.whiteSpace = 'nowrap';
      n.parentNode.insertBefore(w, n); w.appendChild(n); w.appendChild(D.createTextNode(m[0]));
      nx.textContent = nx.textContent.slice(m[0].length);
    });
  }
  function splitReveal(el, opts) {
    if (!G || !Split || reduced) return;
    opts = opts || {};
    gluePunctuation(el);
    try {
      Split.create(el, {
        type: 'words', mask: 'words', wordsClass: 'fx-w', autoSplit: true, aria: 'auto',
        onSplit: function (self) {
          return G.from(self.words, {
            yPercent: 118, rotate: opts.rotate == null ? 3 : opts.rotate, duration: opts.duration || 1.25, ease: 'expo.out', stagger: opts.stagger || .06,
            scrollTrigger: { trigger: el, start: opts.start || 'top 90%', once: true }
          });
        }
      });
    } catch (err) { if (W.console) console.warn(err); }
  }

  function initReveals() {
    if (!G || !ST || reduced) return;
    $$(HEAD_SEL).forEach(function (h) { if (!h.closest('.hero, .page-hero')) splitReveal(h); });
    $$(SOFT_SEL).forEach(function (p) {
      if (p.closest('.hero, .page-hero, .manifesto')) return;
      G.from(p, { opacity: 0, y: 28, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 92%', once: true } });
    });
    $$('.eyebrow').forEach(function (e) {
      if (e.closest('.hero, .page-hero')) return;
      G.from(e, { opacity: 0, x: -18, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: e, start: 'top 94%', once: true } });
    });
    var cards = $$(CARD_SEL).filter(function (c) { return !c.closest('.hero, .page-hero'); });
    cards.forEach(function (c) { if (c.getBoundingClientRect().top > W.innerHeight * .92) G.set(c, { opacity: 0, y: 56 }); });
    ST.batch(cards, {
      start: 'top 92%', once: true,
      onEnter: function (els) { G.to(els, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: .09, overwrite: true, clearProps: 'opacity,transform' }); }
    });
    // las tarjetas ya visibles al cargar no deben quedar ocultas: ST.batch las dispara en el refresh
    $$('[data-parallax]').forEach(function (el) {
      var s = parseFloat(el.getAttribute('data-parallax')) || .1;
      G.fromTo(el, { yPercent: -s * 100 }, { yPercent: s * 100, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // imágenes: se abren con una disolución en WebGL (o con un recorte si no hay WebGL)
    $$('[data-gl-image]').forEach(function (fig) {
      var pl = fig._plane;
      if (pl) {
        pl.reveal = 0;
        ST.create({ trigger: fig, start: 'top 88%', once: true, onEnter: function () { G.to(pl, { reveal: 1, duration: 2.1, ease: 'power2.inOut' }); W.EBScene.pulse(fig.getBoundingClientRect().left + fig.getBoundingClientRect().width / 2, fig.getBoundingClientRect().top + fig.getBoundingClientRect().height / 2, .8); } });
      } else {
        G.from(fig, { clipPath: 'inset(14% 10% 14% 10% round 28px)', opacity: 0, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 90%', once: true } });
      }
    });
    // la franja de palabras acelera y se inclina con la velocidad del scroll
    var track = $('.marquee .track');
    if (track) {
      var tw = G.to(track, { xPercent: -50, ease: 'none', duration: 46, repeat: -1 });
      var skew = G.quickTo(track, 'skewX', { duration: .5, ease: 'power3' });
      ST.create({
        trigger: '.marquee', start: 'top bottom', end: 'bottom top',
        onUpdate: function (self) {
          var v = clamp(self.getVelocity() / -260, -9, 9);
          skew(v); tw.timeScale(1 + Math.abs(v) * .9);
          G.to(tw, { timeScale: 1, duration: 1.2, overwrite: true, delay: .05 });
        }
      });
    }
  }

  /* ----------------------------------------------------------------- arranque */
  function introSequence() {
    var items = $$('[data-intro]');
    if (!G || reduced) { items.forEach(function (e) { e.style.opacity = 1; }); introT.v = 1; return; }
    var tl = G.timeline({ defaults: { ease: 'expo.out' }, delay: EB.curtainIn ? .5 : .15 });
    EB.introTL = tl;
    items.sort(function (a, b) { return (parseFloat(a.getAttribute('data-intro')) || 0) - (parseFloat(b.getAttribute('data-intro')) || 0); });
    items.forEach(function (el) {
      var order = parseFloat(el.getAttribute('data-intro')) || 0, at = .25 + order * .16;
      el.style.opacity = 1;
      var isHead = /^H1$/.test(el.tagName);
      if (isHead && Split) {
        var chars = el.hasAttribute('data-chars');
        var sp = Split.create(el, { type: chars ? 'chars,lines' : 'lines', mask: 'lines', linesClass: 'fx-split-line', charsClass: 'ch', aria: 'auto' });
        EB.heroSplit = sp;
        tl.from(chars ? sp.chars : sp.lines, { yPercent: 118, rotate: chars ? 5 : 2, duration: 1.5, stagger: chars ? .045 : .1, ease: 'expo.out' }, at);
      } else {
        tl.from(el, { opacity: 0, y: 34, duration: 1.3 }, at);
      }
    });
    G.to(introT, { v: 1, duration: 3.1, ease: 'power3.inOut', delay: EB.curtainIn ? .35 : 0 });
  }

  /* peso de la tipografía del nombre según la cercanía del cursor */
  function initNameWeight() {
    if (!fine || reduced) return;
    var h = $('.hero h1[data-chars]');
    if (!h) return;
    var px = -1e4, py = -1e4, raf = 0, active = false;
    W.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    function update() {
      raf = 0;
      var chars = $$('.ch', h);
      if (!chars.length) return;
      var any = false;
      chars.forEach(function (c) {
        var r = c.getBoundingClientRect();
        if (r.bottom < 0 || r.top > W.innerHeight) return;
        var d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        var w = 300 + 230 * Math.exp(-d * d / (2 * 150 * 150));
        c.style.fontVariationSettings = '"wght" ' + w.toFixed(0);
        any = true;
      });
      active = any;
    }
  }

  /* encabezado: fondo de vidrio y barra de progreso (sirve a todas las páginas) */
  function initHeader() {
    var h = $('header');
    if (!h) return;
    var tk = false;
    function upd() {
      tk = false;
      var y = lenis ? lenis.scroll : W.pageYOffset, max = D.documentElement.scrollHeight - W.innerHeight;
      h.classList.toggle('solid', y > 30);
      h.style.setProperty('--sp', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
    }
    W.addEventListener('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd); } }, { passive: true });
    if (lenis) lenis.on('scroll', function () { if (!tk) { tk = true; requestAnimationFrame(upd); } });
    upd();
  }

  /* --------------------------------------------------------------------- init */
  function boot() {
    var okGL = initGL();
    GL = okGL;
    var haveScenes = false;
    if (GL) {
      var wm = $('.wordmark');
      if (wm) {
        var parts = [];
        wm.childNodes.forEach(function (n) {
          if (n.nodeType === 3 && n.textContent) parts.push({ t: n.textContent, italic: false });
          else if (n.nodeType === 1) parts.push({ t: n.textContent, italic: true });
        });
        if (parts.length) W.EBScene.setWordmark({ parts: parts, weight: 300, family: 'Fraunces, Georgia, serif' });
      }
      haveScenes = buildScenes();
      if (!haveScenes) { GL = false; canvas.remove(); R.classList.add('no-gl'); }
    }
    initScroll();
    initHeader();
    initCurtain();
    initCursor();
    initPointer();
    initMagnetic();
    if (GL) {
      measure();
      var ready = function () {
        // cuando todo está listo: planos de imagen, primera escena, bucle
        $$('[data-gl-image]').forEach(function (fig) {
          fig._plane = W.EBScene.addPlane(fig, { gray: parseFloat(fig.getAttribute('data-gray')) || 0, tint: fig.hasAttribute('data-warm') ? [.91, .73, .54] : [.37, .92, .83], zoom: fig.hasAttribute('data-zoom') ? parseFloat(fig.getAttribute('data-zoom')) : 1.14, parAmt: fig.hasAttribute('data-par') ? parseFloat(fig.getAttribute('data-par')) : 0.065 });
          if (fig._plane) fig.classList.add('has-plane');
        });
        W.EBScene.beforeDraw = updateScene;
        W.EBScene.ensure(DEF.cloud.f); W.EBScene.ensure(DEF.portrait.f);
        W.EBScene.prewarm([1, 2, 3, 5, 6, 7, 8]);
        if (reduced) { introT.v = 1; updateScene(0.016); W.EBScene.renderOnce(); var rp = function () { updateScene(0.016); W.EBScene.renderOnce(); }; W.addEventListener('scroll', rp, { passive: true }); W.addEventListener('resize', rp); }
        else W.EBScene.start();
        finish();
      };
      var mapUrl = $('meta[name="eb-portrait"]');
      var url = mapUrl ? mapUrl.getAttribute('content') : 'assets/portrait-map.png';
      var fontsReady = D.fonts && D.fonts.ready ? Promise.race([D.fonts.ready, new Promise(function (r) { setTimeout(r, 1800); })]) : Promise.resolve();
      Promise.all([W.EBScene.loadPortrait(url), fontsReady]).then(function () { measure(); ready(); }, ready);
    } else {
      D.fonts && D.fonts.ready ? D.fonts.ready.then(finish) : finish();
    }
    function finish() {
      initReveals();
      introSequence();
      initNameWeight();
      EB.ready = true;
      R.classList.add('fx-ready');
      if (ST) {
        ST.addEventListener('refresh', function () { if (GL) measure(); });
        setTimeout(function () { ST.refresh(); }, 600);
      }
      if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { if (GL) measure(); if (ST) ST.refresh(); });
      W.addEventListener('load', function () { if (GL) measure(); if (ST) ST.refresh(); });
    }
    D.addEventListener('toggle', function () { if (ST) { clearTimeout(EB._tg); EB._tg = setTimeout(function () { ST.refresh(); if (GL) measure(); }, 320); } }, true);
    var rt;
    W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { sizeCanvas(); if (GL) measure(); }, 120); });
    if ('ResizeObserver' in W) {
      var last = 0;
      new ResizeObserver(function () { var h = D.body.scrollHeight; if (Math.abs(h - last) > 4) { last = h; clearTimeout(rt); rt = setTimeout(function () { if (GL) measure(); }, 160); } }).observe(D.body);
    }
    EB.debug.setS = function (v) { EB.debug.forceS = v; introT.v = 1; };
    EB.debug.setRaw = function (v) { EB.debug.rawS = v; };
    EB.debug.measure = measure;
    EB.debug.progressAt = function (y) { return sceneProgress(y); };
    EB.debug.count = function () { return scenes.length; };
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
