/* Ezequiel Brunner · comportamiento de la página (sin dependencias).
   Encabezado, menú, sección activa, apariciones, red de la portada, tarjetas deslizables,
   visor de fotos, copiar el email y el botón flotante de WhatsApp. */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var reduce = html.classList.contains('rm');
  var IO = 'IntersectionObserver' in w;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* ---------- encabezado: fondo al desplazarse */
  var hdr = $('[data-hdr]');
  var onScroll = function () { if (hdr) hdr.classList.toggle('is-solid', w.scrollY > 8); };
  onScroll();
  w.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- menú de pantalla completa */
  var menu = $('[data-menu]');
  var openBtn = $('[data-menu-open]');
  var lastFocus = null;
  var outside = $$('body > header, body > main, body > footer, [data-wa-float]');
  function focusables() { return $$('a[href], button:not([disabled])', menu); }
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    html.style.overflow = open ? 'hidden' : '';
    outside.forEach(function (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    if (open) {
      lastFocus = d.activeElement;
      var f = focusables();
      if (f.length) f[0].focus();
    } else if (lastFocus && lastFocus.focus) {
      lastFocus.focus();
    }
  }
  if (menu && openBtn) {
    openBtn.addEventListener('click', function (e) { e.preventDefault(); setMenu(true); });
    $$('[data-menu-close]', menu).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); setMenu(false); });
    });
    $$('.menu-nav a', menu).forEach(function (a) {
      a.addEventListener('click', function () { lastFocus = null; setMenu(false); });
    });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setMenu(false); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    w.addEventListener('resize', function () {
      if (menu.classList.contains('is-open') && getComputedStyle(openBtn).display === 'none') setMenu(false);
    });
  }

  /* ---------- sección activa en el menú */
  var groups = {};
  $$('[data-nav]').forEach(function (a) { (groups[a.getAttribute('data-nav')] = groups[a.getAttribute('data-nav')] || []).push(a); });
  var owner = { inicio: 'inicio', servicios: 'servicios', 'sobre-mi': 'servicios', proyectos: 'proyectos', medios: 'proyectos', galeria: 'proyectos', contacto: 'contacto' };
  var secs = $$('[data-sec]');
  function markActive() {
    var line = w.innerHeight * 0.38, current = 'inicio';
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= line) current = secs[i].id;
    }
    // al final de la página manda Contacto
    if (w.innerHeight + w.scrollY >= d.documentElement.scrollHeight - 4) current = 'contacto';
    var key = owner[current] || 'inicio';
    Object.keys(groups).forEach(function (k) {
      groups[k].forEach(function (a) { if (k === key) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    });
  }
  if (secs.length) {
    var ticking = false;
    w.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      w.requestAnimationFrame(function () { markActive(); ticking = false; });
    }, { passive: true });
    w.addEventListener('resize', markActive);
    markActive();
  }

  /* ---------- apariciones suaves */
  var rv = $$('[data-rv]');
  if (!IO || reduce) {
    rv.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); ro.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rv.forEach(function (el) { ro.observe(el); });
  }

  /* ---------- la red de la portada se pausa fuera de la pantalla */
  var artEl = $('[data-art]');
  if (artEl && IO && !reduce) {
    new IntersectionObserver(function (entries) {
      artEl.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(artEl);
    d.addEventListener('visibilitychange', function () { if (d.hidden) artEl.classList.add('is-paused'); });
  }

  /* ---------- portadas de proyectos: en pantallas táctiles se animan al aparecer */
  var touch = w.matchMedia && w.matchMedia('(hover: none)').matches;
  if (touch && IO && !reduce) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-live'); co.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    $$('[data-cv]').forEach(function (el) { co.observe(el); });
  }

  /* ---------- tarjetas deslizables: barra de avance; con teclado, la tira recibe el foco y se mueve con las flechas */
  var car = $('[data-carousel]'), bar = $('[data-carousel-bar]');
  if (car && bar) {
    var upd = function () {
      var max = car.scrollWidth - car.clientWidth;
      if (max > 1) car.setAttribute('tabindex', '0'); else car.removeAttribute('tabindex');
      var vis = car.clientWidth / Math.max(car.scrollWidth, 1);
      var p = max > 0 ? vis + (1 - vis) * (car.scrollLeft / max) : 1;
      bar.style.setProperty('--p', Math.min(1, Math.max(vis, p)).toFixed(3));
    };
    car.addEventListener('scroll', upd, { passive: true });
    w.addEventListener('resize', upd);
    upd();
  }

  /* ---------- visor de fotos */
  var dlg = $('[data-lb-dialog]');
  var links = $$('[data-lb]');
  if (dlg && typeof dlg.showModal === 'function' && links.length) {
    var img = $('[data-lb-img]', dlg), cap = $('[data-lb-cap]', dlg), num = $('[data-lb-n]', dlg);
    var idx = 0, opener = null;
    var items = links.map(function (a) {
      var im = $('img', a), fc = a.parentNode.querySelector('figcaption .gal-c');
      return { src: a.getAttribute('href'), alt: im ? im.alt : '', cap: fc ? fc.textContent : '' };
    });
    var show = function (i) {
      idx = (i + items.length) % items.length;
      img.src = items[idx].src; img.alt = items[idx].alt;
      cap.textContent = items[idx].cap;
      num.textContent = (idx + 1) + ' / ' + items.length;
    };
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); opener = a; show(i); dlg.showModal(); html.style.overflow = 'hidden';
      });
    });
    $('[data-lb-prev]', dlg).addEventListener('click', function () { show(idx - 1); });
    $('[data-lb-next]', dlg).addEventListener('click', function () { show(idx + 1); });
    $('[data-lb-close]', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { html.style.overflow = ''; if (opener) opener.focus(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb-in')) dlg.close(); });
    var sx = null;
    dlg.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 48) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });
  }

  /* ---------- copiar el email */
  var status = $('[data-copy-status]');
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () {
        b.classList.add('is-done');
        if (status) status.textContent = 'Email copiado';
        setTimeout(function () { b.classList.remove('is-done'); if (status) status.textContent = ''; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { w.location.href = 'mailto:' + text; });
      } else {
        w.location.href = 'mailto:' + text;
      }
    });
  });

  /* ---------- WhatsApp flotante: aparece después de la portada y se retira en Contacto */
  var fab = $('[data-wa-float]');
  var hero = $('#inicio'), contact = $('#contacto');
  if (fab && IO && hero && contact) {
    var inHero = true, inContact = false;
    var sync = function () { fab.classList.toggle('is-on', !inHero && !inContact); };
    new IntersectionObserver(function (en) { inHero = en[0].isIntersecting; sync(); }, { threshold: 0.12 }).observe(hero);
    new IntersectionObserver(function (en) { inContact = en[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(contact);
  }
})();
