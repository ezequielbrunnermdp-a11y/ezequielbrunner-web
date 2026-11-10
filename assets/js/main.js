/* Ezequiel Brunner — comportamiento común a todas las páginas.
   GSAP, ScrollTrigger, SplitText y Lenis mejoran la experiencia, pero el sitio funciona sin ellos. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var RM = H.classList.contains('rm');
  var G = W.gsap, ST = W.ScrollTrigger, SPLIT = W.SplitText;
  var FINE = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var EMAIL = 'contacto@ezequielbrunner.com';
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  if (G && ST) G.registerPlugin(ST);
  if (G && SPLIT) G.registerPlugin(SPLIT);

  /* ------------------------------------------------ desplazamiento suave (solo con mouse) */
  var lenis = null;
  if (!RM && FINE && W.Lenis) {
    lenis = new W.Lenis({ lerp: 0.105, smoothWheel: true, wheelMultiplier: 0.9 });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add(function (t) { lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  }
  function hdrH() { var h = $('.hdr'); return h ? h.offsetHeight : 0; }
  function goTo(el) {
    var y = el.getBoundingClientRect().top + W.pageYOffset - hdrH() - 12;
    if (lenis) lenis.scrollTo(Math.max(0, y), { duration: 1.3, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
    else W.scrollTo({ top: Math.max(0, y), behavior: RM ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------ encabezado */
  var hdr = $('.hdr'), lastY = W.pageYOffset, ticking = false;
  function onScroll() {
    var y = W.pageYOffset;
    if (hdr && !H.classList.contains('menu-open')) {
      hdr.classList.toggle('solid', y > 24);
      if (y > 260 && y > lastY + 4) hdr.classList.add('away');
      else if (y < lastY - 4 || y < 260) hdr.classList.remove('away');
    }
    lastY = y;
    ticking = false;
  }
  W.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  D.addEventListener('focusin', function (e) { if (hdr && hdr.contains(e.target)) hdr.classList.remove('away'); });

  /* ------------------------------------------------ menú de pantalla completa */
  var menu = $('[data-menu]'), mbtn = $('[data-menu-btn]'), lastFocus = null;
  function setBtn(open) {
    if (!mbtn) return;
    mbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var sr = $('.sr', mbtn); if (sr) sr.textContent = open ? 'Cerrar menú' : 'Abrir menú';
  }
  function openMenu() {
    if (!menu) return;
    lastFocus = D.activeElement;
    menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add('open'); });
    H.classList.add('menu-open'); setBtn(true);
    if (lenis) lenis.stop();
    var first = $('a', menu); if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeMenu(keepFocus) {
    if (!menu || !H.classList.contains('menu-open')) return;
    menu.classList.remove('open'); H.classList.remove('menu-open'); setBtn(false);
    if (lenis) lenis.start();
    setTimeout(function () { if (!H.classList.contains('menu-open')) menu.hidden = true; }, 470);
    if (!keepFocus && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (mbtn) mbtn.addEventListener('click', function () { if (H.classList.contains('menu-open')) closeMenu(); else openMenu(); });
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab' && H.classList.contains('menu-open')) {
      var f = $$('a, button', menu).concat(mbtn ? [mbtn] : []);
      var i = f.indexOf(D.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ------------------------------------------------ formulario: completar desde los botones de cada sección */
  function prefill(spec) {
    var f = $('[data-form]'); if (!f || !spec) return;
    var i = spec.indexOf(':'), key = spec.slice(0, i), val = spec.slice(i + 1);
    var el = f.elements[key];
    if (el && el.tagName === 'SELECT') {
      for (var j = 0; j < el.options.length; j++) {
        if (el.options[j].text === val) { el.selectedIndex = j; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
      }
    }
    var m = f.elements.mensaje;
    if (m && !m.value) m.value = key === 'mensaje' ? val : 'Me interesa: ' + val + '.';
  }

  /* ------------------------------------------------ enlaces internos */
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var id = a.getAttribute('href');
    if (a.hasAttribute('data-prefill')) prefill(a.getAttribute('data-prefill'));
    if (id === '#' || id === '#top') {
      e.preventDefault(); closeMenu(true);
      if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else W.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      return;
    }
    var t = D.getElementById(decodeURIComponent(id.slice(1)));
    if (!t) return;
    e.preventDefault(); closeMenu(true);
    goTo(t);
    try { history.pushState(null, '', id); } catch (_) {}
    if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    setTimeout(function () { t.focus({ preventScroll: true }); }, RM ? 0 : 700);
  });

  /* ------------------------------------------------ transiciones entre páginas */
  var VT = ('onpagereveal' in W) && W.CSS && CSS.supports && CSS.supports('view-transition-name: a');
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-go-area')) { try { localStorage.setItem('eb:area', a.getAttribute('data-go-area')); } catch (_) {} }
    if (e.defaultPrevented || VT || RM || a.hasAttribute('data-go')) return;
    if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (/^(mailto|tel):/i.test(href)) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    H.classList.add('leaving');
    setTimeout(function () { location.href = url.href; }, 320);
  });
  W.addEventListener('pageshow', function () { H.classList.remove('leaving'); });

  /* ------------------------------------------------ sección activa en el menú */
  var navLinks = $$('.nav a[data-sec]');
  if (navLinks.length && 'IntersectionObserver' in W) {
    var secMap = {};
    navLinks.forEach(function (a) { var s = D.getElementById(a.getAttribute('href').slice(1)); if (s) secMap[s.id] = a; });
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (x) { x.classList.remove('on'); x.removeAttribute('aria-current'); });
        var a = secMap[en.target.id];
        if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    Object.keys(secMap).forEach(function (id) { nio.observe(D.getElementById(id)); });
  }

  /* ------------------------------------------------ apariciones al bajar */
  var rvs = $$('[data-rv]');
  function done(el) { el.classList.add('in'); setTimeout(function () { el.removeAttribute('data-rv'); el.classList.remove('in'); el.style.transitionDelay = ''; }, 1600); }
  if (!RM && 'IntersectionObserver' in W) {
    rvs.forEach(function (el) {
      var sib = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.hasAttribute('data-rv'); });
      var i = sib.indexOf(el);
      if (i > 0) el.style.transitionDelay = (Math.min(i, 5) * 0.08) + 's';
    });
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { done(en.target); rio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    rvs.forEach(function (el) { rio.observe(el); });
  } else rvs.forEach(function (el) { el.removeAttribute('data-rv'); });

  // títulos: cada renglón sube desde su propia línea
  if (!RM && G && ST && SPLIT) {
    var titles = $$('.sec .h2, .sub-h').filter(function (h) { return !h.closest('.capas'); });
    var startSplit = function () {
      titles.forEach(function (h) {
        try {
          SPLIT.create(h, {
            type: 'lines', mask: 'lines', linesClass: 'rv-l', autoSplit: true, aria: 'auto',
            onSplit: function (self) {
              return G.from(self.lines, { yPercent: 108, duration: 1.25, ease: 'power4.out', stagger: 0.085, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
            }
          });
        } catch (err) { /* el título queda visible sin animación */ }
      });
    };
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(startSplit); else startSplit();
  }

  /* ------------------------------------------------ cifras */
  var counts = $$('.count[data-to]');
  if (counts.length && !RM && 'IntersectionObserver' in W) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, to = +el.getAttribute('data-to'), t0 = performance.now(), dur = 1700;
        (function step(t) {
          var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(to * e);
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.6 });
    counts.forEach(function (el) { el.textContent = '0'; cio.observe(el); });
  }

  /* ------------------------------------------------ bordes que se iluminan con el cursor */
  if (FINE) {
    var litRaf = 0, litEv = null;
    D.addEventListener('pointermove', function (e) {
      litEv = e;
      if (litRaf) return;
      litRaf = requestAnimationFrame(function () {
        litRaf = 0;
        var c = litEv.target.closest && litEv.target.closest('.lit');
        if (!c) return;
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (litEv.clientX - r.left).toFixed(0) + 'px');
        c.style.setProperty('--my', (litEv.clientY - r.top).toFixed(0) + 'px');
      });
    }, { passive: true });
  }

  /* ------------------------------------------------ copiar el email */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.getAttribute('data-copy');
      var show = function (m) { b.textContent = m; setTimeout(function () { b.textContent = 'Copiar'; }, 2200); };
      var select = function () {
        var a = b.previousElementSibling; if (!a) return show('Copialo a mano');
        var r = D.createRange(); r.selectNodeContents(a); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r); show('Seleccionado');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { show('Copiado'); }, select);
      else select();
    });
  });

  /* ------------------------------------------------ formularios
     Si Netlify Forms está activo, la consulta se guarda allí. Si no, se prepara el email con todos los datos. */
  var LABELS = { nombre: 'Nombre', empresa: 'Empresa', email: 'Email', telefono: 'Teléfono', tipo: 'Tipo de negocio', etapa: 'Etapa del negocio',
    servicio: 'Servicio de interés', rubro: 'Rubro o sector', tamano: 'Tamaño del equipo', area: 'Área a evaluar' };
  $$('[data-form]').forEach(function (f) {
    f.noValidate = true;
    var status = $('[data-status]', f);
    var wrapOf = function (el) { return el.closest('.f'); };
    function setErr(el, msg) {
      var w = wrapOf(el); if (!w) return;
      var e = $('.f-err', w);
      w.classList.toggle('err', !!msg);
      if (msg) {
        if (!e) { e = D.createElement('span'); e.className = 'f-err'; e.id = el.id + '-err'; w.appendChild(e); }
        e.textContent = msg;
        el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', e.id);
      } else {
        if (e) e.parentNode.removeChild(e);
        el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
      }
    }
    function check(el) {
      if (!el.name || el.type === 'hidden' || el.name === 'bot-field') return true;
      var v = (el.value || '').trim(), msg = '';
      if (el.required && !v) msg = el.tagName === 'SELECT' ? 'Elegí una opción.' : 'Completá este campo.';
      else if (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Revisá el email: parece incompleto.';
      else if (el.type === 'tel' && v && !/^[0-9+()\s.\-]{6,}$/.test(v)) msg = 'Revisá el teléfono.';
      else if (el.minLength > 0 && v && v.length < el.minLength) msg = 'Contame un poco más (al menos ' + el.minLength + ' caracteres).';
      setErr(el, msg);
      return !msg;
    }
    $$('input, select, textarea', f).forEach(function (el) {
      el.addEventListener('blur', function () { if (el.value) check(el); });
      el.addEventListener('input', function () { var w = wrapOf(el); if (w && w.classList.contains('err')) check(el); });
      el.addEventListener('change', function () { if (el.tagName === 'SELECT') check(el); });
    });
    function mailtoHref(fd) {
      var lines = [];
      Object.keys(LABELS).forEach(function (k) { var v = fd.get(k); if (v) lines.push(LABELS[k] + ': ' + v); });
      var subj = f.getAttribute('data-subject') + (fd.get('empresa') ? ' · ' + fd.get('empresa') : '');
      return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.join('\n') + '\n\n' + (fd.get('mensaje') || ''));
    }
    function ok() {
      f.classList.remove('sending');
      status.className = 'f-status ok';
      status.innerHTML = '<b>¡Gracias! Recibí tu consulta.</b>Te voy a responder al email que dejaste.';
      f.reset();
      status.setAttribute('tabindex', '-1'); status.focus();
    }
    function viaEmail(fd) {
      var href = mailtoHref(fd);
      f.classList.remove('sending');
      status.className = 'f-status ok';
      status.innerHTML = '<b>Tu consulta está lista para enviar.</b>Se abrió tu aplicación de correo con todos los datos completos: solo falta enviarla. ' +
        'Si no se abrió, <a href="' + href + '">tocá acá</a> o escribí a <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.';
      status.setAttribute('tabindex', '-1'); status.focus();
      W.location.href = href;
    }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bad = null;
      $$('input, select, textarea', f).forEach(function (el) { if (!check(el) && !bad) bad = el; });
      if (bad) { status.className = 'f-status'; status.textContent = 'Revisá los campos marcados.'; bad.focus(); return; }
      var fd = new FormData(f);
      if (fd.get('bot-field')) return;
      f.classList.add('sending');
      status.className = 'f-status'; status.textContent = 'Enviando…';
      var body = new URLSearchParams();
      fd.forEach(function (v, k) { body.append(k, v); });
      var ctrl = W.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(String(r.status)); ok(); })
        .catch(function () { clearTimeout(timer); viaEmail(fd); });
    });
  });

  /* ------------------------------------------------ pestañas: soluciones por departamento */
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[role="tab"]', box), list = $('[role="tablist"]', box);
    function sel(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        D.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      if (list.scrollWidth > list.clientWidth + 2) list.scrollTo({ left: t.offsetLeft - 20, behavior: RM ? 'auto' : 'smooth' });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(t); });
      t.addEventListener('keydown', function (e) {
        var n = null, k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowDown') n = tabs[(i + 1) % tabs.length];
        else if (k === 'ArrowLeft' || k === 'ArrowUp') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (k === 'Home') n = tabs[0];
        else if (k === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); sel(n, true); }
      });
    });
  });

  /* ------------------------------------------------ filtros de publicaciones */
  var chips = $$('[data-filter]');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var k = c.getAttribute('data-filter');
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      $$('[data-group]').forEach(function (s) { s.classList.toggle('is-hidden', k !== 'todo' && s.getAttribute('data-group') !== k); });
      if (ST) ST.refresh();
    });
  });

  /* ------------------------------------------------ método: la línea avanza con la lectura */
  $$('[data-steps]').forEach(function (ol) {
    var line = $('.steps-line i', ol), steps = $$('.step', ol);
    var all = function () { if (line) line.style.setProperty('--p', 1); steps.forEach(function (s) { s.classList.add('on'); }); };
    if (RM || !G || !ST) return all();
    ST.create({
      trigger: ol, start: 'top 78%', end: 'bottom 62%', scrub: 0.6,
      onUpdate: function (s) {
        if (line) line.style.setProperty('--p', s.progress.toFixed(3));
        steps.forEach(function (st, i) { st.classList.toggle('on', s.progress >= (i / steps.length) - 0.001); });
      }
    });
  });

  /* ------------------------------------------------ flujo de ejemplo: se enciende cuando está a la vista */
  var flowEl = $('[data-flow]');
  if (flowEl && !RM && 'IntersectionObserver' in W) {
    new IntersectionObserver(function (es) { flowEl.classList.toggle('in', es[0].isIntersecting); }, { threshold: 0.35 }).observe(flowEl);
  }

  /* ------------------------------------------------ barra inferior en el celular */
  var dock = $('[data-dock]'), heroEl = $('.hero'), contactEl = $('#contacto'), footEl = $('.ftr');
  if (dock && heroEl && 'IntersectionObserver' in W) {
    var vis = { hero: true, contact: false, foot: false };
    var upd = function () { dock.classList.toggle('on', !vis.hero && !vis.contact && !vis.foot); };
    var watch = function (el, key) { if (el) new IntersectionObserver(function (es) { vis[key] = es[0].isIntersecting; upd(); }, { threshold: 0.02 }).observe(el); };
    watch(heroEl, 'hero'); watch(contactEl, 'contact'); watch(footEl, 'foot');
  }

  /* ------------------------------------------------ portada: profundidad mínima de la imagen */
  var heroImg = $('.hero-media img');
  if (heroImg && !RM) {
    var hTick = false;
    W.addEventListener('scroll', function () {
      if (hTick) return; hTick = true;
      requestAnimationFrame(function () {
        var y = W.pageYOffset;
        if (y < W.innerHeight * 1.3) heroImg.style.setProperty('--hy', (y * -0.12).toFixed(1) + 'px');
        hTick = false;
      });
    }, { passive: true });
  }

  /* ------------------------------------------------ por capas: la sección queda fija y la pieza se arma al bajar */
  (function capas() {
    var sec = $('#capas');
    if (!sec || !G || !ST || RM) return;
    sec.classList.add('live');
    var steps = $$('.cstep', sec), bars = $$('.capas-bar i', sec), box = $('.cs-box', sec);
    var P = function (n) { return $('.cp-p' + n, sec); }, C = function (n) { return $('.cp-c' + n, sec); };
    var tones = ['#101315', '#15120F', '#0F1417', '#14110F', '#101315'];
    var fall = function () { return -Math.min(W.innerHeight * 0.6, 540); };
    G.set(steps.slice(1), { autoAlpha: 0, y: 26 });
    G.set([P(2), P(3), P(4), C(2), C(3), C(4)], { autoAlpha: 0 });
    G.set(bars[0], { backgroundSize: '100% 100%' });
    G.from(P(1), { y: -50, autoAlpha: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: sec, start: 'top 75%', once: true } });
    var tl = G.timeline({ defaults: { ease: 'none' } });
    for (var k = 2; k <= 5; k++) {
      var at = (k - 2) * 1.4 + 0.3;
      tl.to(steps[k - 2], { autoAlpha: 0, y: -26, duration: 0.35, ease: 'power2.in' }, at);
      tl.fromTo(steps[k - 1], { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, at + 0.32);
      tl.to(sec, { backgroundColor: tones[k - 1], duration: 0.8 }, at);
      tl.to(bars[k - 1], { backgroundSize: '100% 100%', duration: 0.5 }, at + 0.2);
      if (k <= 4) {
        tl.fromTo(C(k), { autoAlpha: 0, y: fall, rotation: k % 2 ? 3 : -4, scale: 1.03 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 0.9, ease: 'power3.out' }, at);
        tl.to(P(k), { autoAlpha: 1, duration: 0.12 }, at + 0.86);
        tl.to([C(k), P(k - 1)], { autoAlpha: 0, duration: 0.1 }, at + 0.96);
      } else {
        tl.to(box, { scale: 1.05, duration: 0.9, ease: 'power2.inOut' }, at);
      }
    }
    tl.to({}, { duration: 0.5 });
    ST.create({
      trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(W.innerHeight * 3.4); },
      pin: $('.capas-pin', sec), scrub: 0.7, animation: tl, invalidateOnRefresh: true, anticipatePin: 1
    });
  })();

  if (ST) W.addEventListener('load', function () { ST.refresh(); });
})();
