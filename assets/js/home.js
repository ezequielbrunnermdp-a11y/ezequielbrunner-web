/* Ezequiel Brunner — comportamiento propio de la página de inicio. */
(function () {
  'use strict';
  var D = document, W = window;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  var G = W.gsap, ST = W.ScrollTrigger;

  /* ---- menú móvil ---- */
  var header = $('#top'), mb = $('.menu-btn');
  function closeMenu() {
    header.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.setAttribute('aria-label', 'Abrir menú');
    D.body.style.overflow = '';
  }
  mb.addEventListener('click', function () {
    var o = header.classList.toggle('open');
    mb.setAttribute('aria-expanded', o); mb.setAttribute('aria-label', o ? 'Cerrar menú' : 'Abrir menú');
    D.body.style.overflow = o ? 'hidden' : '';
  });
  $$('.mobile-nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  W.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('open')) { closeMenu(); mb.focus(); } });
  matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);

  /* ---- frases que rotan ---- */
  var words = $$('.rotator .word span'), box = $('.rotator .word'), wi = 0;
  function fit() { if (box && words[wi]) box.style.width = words[wi].offsetWidth + 'px'; }
  fit();
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit);
  if (!reduce && words.length) {
    setInterval(function () {
      var a = words[wi]; a.classList.remove('on'); a.classList.add('out');
      wi = (wi + 1) % words.length;
      var b = words[wi]; b.classList.remove('out'); b.classList.add('on'); fit();
      setTimeout(function () { a.classList.remove('out'); }, 900);
    }, 2800);
  }

  /* ---- manifiesto: las palabras se encienden al bajar ---- */
  var man = $('#manifesto');
  if (man) {
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
    if (G && ST && !reduce) {
      G.to($$('.wd', man), { opacity: 1, stagger: .12, ease: 'none', scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 55%', scrub: .6 } });
    }
  }

  /* ---- contadores ---- */
  $$('.count').forEach(function (el) {
    var to = +el.getAttribute('data-to');
    if (!G || !ST || reduce) return;
    var o = { v: 0 };
    ST.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () {
        el.textContent = '0';
        G.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
      }
    });
  });

  /* ---- sección activa: riel lateral y menú ---- */
  var ids = ['ia', 'gastronomia', 'personas', 'procesos', 'sobre-mi', 'contacto'];
  var secs = ids.map(function (id) { return D.getElementById(id); });
  var hud = $$('.hud a'), navs = $$('.links a'), tick = false;
  function active() {
    tick = false;
    var cur = '';
    secs.forEach(function (s) { if (s && s.getBoundingClientRect().top < W.innerHeight * .5) cur = s.id; });
    hud.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-for') === cur); });
    navs.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + cur); });
    D.documentElement.classList.toggle('warm-on', cur === 'gastronomia' || cur === 'personas');
  }
  W.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(active); } }, { passive: true });
  active();

  /* ---- copiar el email ---- */
  $$('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var done = function (t) { b.textContent = t; setTimeout(function () { b.textContent = 'Copiar'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(b.getAttribute('data-copy')).then(function () { done('Copiado ✓'); }, sel);
      } else sel();
      function sel() {
        var s = getSelection(), r = D.createRange(); r.selectNodeContents($('#mail')); s.removeAllRanges(); s.addRange(r); done('Seleccionado');
      }
    });
  });

  /* ---- formulario: arma el email (sin cambios) ---- */
  $('#f').addEventListener('submit', function (ev) {
    ev.preventDefault(); var d = new FormData(ev.target);
    var body = 'Nombre: ' + d.get('n') + '\nEmail: ' + d.get('e') + '\nEmpresa: ' + d.get('c') + '\nÁrea: ' + d.get('a') + '\n\n' + d.get('m');
    location.href = 'mailto:contacto@ezequielbrunner.com?subject=' + encodeURIComponent('Consulta web: ' + d.get('a')) + '&body=' + encodeURIComponent(body);
  });
})();
