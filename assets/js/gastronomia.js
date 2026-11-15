/* Ezequiel Brunner — Gastronomía: «Detrás de cada servicio hay una operación».
   Escritorio con movimiento: la sección queda fija; la palabra «operación» se abre por su «i» hasta mostrar al equipo
   y cada pilar cambia la composición: personas (la foto entera), procesos (la foto se corre y aparece la rutina),
   costos (la foto se angosta y se arma la fórmula del CMV), resultados (la foto se cierra y se dibujan los indicadores).
   Celular, movimiento reducido o sin JavaScript: los pilares se leen uno debajo del otro. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var G = W.gsap, ST = W.ScrollTrigger;
  var sec = D.querySelector('[data-nar]');
  if (!sec || H.classList.contains('rm')) return;
  function $(s) { return sec.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(sec.querySelectorAll(s)); }

  /* versión apilada: las líneas de los indicadores y la rutina se dibujan al entrar en pantalla */
  if ('IntersectionObserver' in W) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.35 });
    $$('.ns').forEach(function (el) { io.observe(el); });
  }

  if (!G || !ST || !G.matchMedia) return;
  G.registerPlugin(ST);

  G.matchMedia().add('(min-width: 901px) and (min-height: 600px)', function () {
    sec.classList.add('live');
    var pin = $('.nar-pin'), media = $('.nar-media'), shade = $('.nar-shade');
    var svg = $('.nar-mask'), word = $('.nar-word'), text = $('.nar-word text'), veil = $('.nar-veil');
    var mask = $('mask'), rect = $('mask rect');
    var head = $('.nar-head'), steps = $$('.ns'), close = $('.nar-close'), prog = $$('.nar-prog li'), cap = $('.nar-cap');
    var origin = { x: 800, y: 450 };

    function fit() {
      // unidades con alto 900; el ancho acompaña la proporción de la pantalla
      var vw = Math.max(1, pin.clientWidth), vh = Math.max(1, pin.clientHeight), w2 = Math.round(900 * vw / vh);
      svg.setAttribute('viewBox', '0 0 ' + w2 + ' 900');
      rect.setAttribute('width', w2); veil.setAttribute('width', w2); mask.setAttribute('width', w2);
      text.setAttribute('x', w2 / 2);
      text.style.fontSize = '330px';
      var len = text.getComputedTextLength() || 1;
      var fs = Math.min(430, 330 * (w2 * 0.84) / len);
      text.style.fontSize = fs + 'px';
      var base = 470 + fs * 0.26;
      text.setAttribute('y', base);
      try {
        var box = text.getExtentOfChar(6);                // la «i» de «operación»
        origin = { x: box.x + box.width / 2, y: base - fs * 0.2 };
      } catch (_) { origin = { x: w2 / 2, y: 450 }; }
    }
    fit();
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { fit(); ST.refresh(); });

    var flowLine = $('.ns-procesos .nf-line i'), flowItems = $$('.ns-procesos .nv-flow li');
    var formula = $$('.ns-costos .nfo-t'), paths = $$('.ns-resultados .ni-l path');
    G.set(steps.concat([close]), { autoAlpha: 0, y: 34 });
    G.set(media, { clipPath: 'inset(0% 0% 0% 0%)' });
    G.set(shade, { opacity: 0 });
    G.set(flowLine, { scaleX: 0, transformOrigin: 'left center' });
    G.set(flowItems, { autoAlpha: 0, y: 14 });
    G.set(formula, { autoAlpha: 0, y: 22 });
    G.set(paths, { strokeDashoffset: 1 });

    var tl = G.timeline({ defaults: { ease: 'none' } });
    // la palabra se abre por la «i» y aparece el equipo
    tl.to(head, { autoAlpha: 0, y: -28, duration: 0.32, ease: 'power2.in' }, 0.12)
      .to(word, { scale: 46, svgOrigin: function () { return origin.x + ' ' + origin.y; }, duration: 1, ease: 'power3.in' }, 0.18)
      .to(veil, { opacity: 0, duration: 0.36 }, 0.78)
      .to(shade, { opacity: 1, duration: 0.4 }, 0.92)
    // 01 · personas
      .to(steps[0], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 1.15)
    // 02 · procesos: la foto se corre a la derecha
      .to(steps[0], { autoAlpha: 0, y: -30, duration: 0.32, ease: 'power2.in' }, 2.1)
      .to(media, { clipPath: 'inset(17% 5% 10% 54%)', duration: 0.8, ease: 'power2.inOut' }, 2.1)
      .to(shade, { opacity: 0.35, duration: 0.6 }, 2.1)
      .to(steps[1], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 2.5)
      .to(flowItems, { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.3, ease: 'power2.out' }, 2.62)
      .to(flowLine, { scaleX: 1, duration: 0.7 }, 2.62)
    // 03 · costos: la foto se angosta y la fórmula se arma término por término
      .to(steps[1], { autoAlpha: 0, y: -30, duration: 0.32, ease: 'power2.in' }, 3.75)
      .to(media, { clipPath: 'inset(24% 5% 16% 82%)', filter: 'grayscale(1) brightness(.62)', duration: 0.8, ease: 'power2.inOut' }, 3.75)
      .to(cap, { autoAlpha: 0, duration: 0.3 }, 3.75)
      .to(steps[2], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 4.15)
      .to(formula, { autoAlpha: 1, y: 0, stagger: 0.14, duration: 0.34, ease: 'power3.out' }, 4.3)
    // 04 · resultados: la foto se cierra y se dibujan los indicadores
      .to(steps[2], { autoAlpha: 0, y: -30, duration: 0.32, ease: 'power2.in' }, 5.4)
      .to(media, { clipPath: 'inset(56% 5% 44% 82%)', duration: 0.55, ease: 'power2.in' }, 5.4)
      .to(steps[3], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 5.7)
      .to(paths, { strokeDashoffset: 0, stagger: 0.12, duration: 0.6 }, 5.85)
    // cierre
      .to(steps[3], { autoAlpha: 0, y: -30, duration: 0.32, ease: 'power2.in' }, 7)
      .to(close, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 7.22)
      .to({}, { duration: 0.45 });

    var marks = [[1.1, 2.3], [2.4, 3.95], [4.05, 5.6], [5.65, 7.1]];
    function mark() {
      var t = tl.time();
      prog.forEach(function (li, i) { li.classList.toggle('on', t >= marks[i][0] && t < marks[i][1]); });
    }
    ST.create({
      trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(W.innerHeight * 4.6); },
      pin: pin, scrub: 0.6, animation: tl, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: mark, onRefreshInit: fit
    });

    return function () { sec.classList.remove('live'); prog.forEach(function (li) { li.classList.remove('on'); }); };
  });
})();
