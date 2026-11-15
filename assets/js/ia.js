/* Ezequiel Brunner — Automatización & IA: demostración interactiva (ficticia).
   Un pedido recorre cinco etapas. Cada etapa se puede elegir (también con el teclado); el recorrido se reproduce
   una vez al entrar en pantalla y se puede pausar. En la última etapa, la persona decide. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var demo = D.querySelector('[data-demo]');
  if (!demo) return;
  var RM = H.classList.contains('rm');
  var tabs = Array.prototype.slice.call(demo.querySelectorAll('[role="tab"]'));
  var rail = demo.querySelector('.demo-rail');
  var play = demo.querySelector('[data-demo-play]'), lab = play && play.querySelector('.dp-lab');
  var log = demo.querySelector('[data-log]'), logBox = log && log.parentNode;
  var res = demo.querySelector('[data-decision]');
  var cur = 1, playing = false, timer = 0, STEP = 3600;

  function show(i, focus) {
    cur = i;
    demo.setAttribute('data-stage', String(i));
    tabs.forEach(function (t, k) {
      var on = k === i - 1;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var pan = D.getElementById(t.getAttribute('aria-controls'));
      if (pan) pan.hidden = !on;
    });
    if (focus) tabs[i - 1].focus();
    if (rail && rail.scrollWidth > rail.clientWidth + 2) rail.scrollTo({ left: Math.max(0, tabs[i - 1].offsetLeft - 16), behavior: RM ? 'auto' : 'smooth' });
    if (i < 5 && log) { log.textContent = 'Pendiente de decisión'; logBox.classList.remove('done'); if (res) res.textContent = ''; }
  }
  function label(t) { if (lab) lab.textContent = t; }
  function stop() {
    playing = false; clearTimeout(timer);
    if (play) play.setAttribute('aria-pressed', 'false');
    label(cur >= 5 ? 'Repetir el recorrido' : 'Reproducir el recorrido');
  }
  function next() {
    if (!playing) return;
    if (cur >= 5) { stop(); return; }
    show(cur + 1);
    timer = setTimeout(next, STEP);
  }
  function start() {
    if (cur >= 5) show(1);
    playing = true;
    if (play) play.setAttribute('aria-pressed', 'true');
    label('Pausar el recorrido');
    timer = setTimeout(next, STEP);
  }
  if (play) play.addEventListener('click', function () { if (playing) stop(); else start(); });

  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { stop(); show(k + 1); });
    t.addEventListener('keydown', function (e) {
      var n = null, key = e.key;
      if (key === 'ArrowRight' || key === 'ArrowDown') n = (k + 1) % tabs.length;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') n = (k - 1 + tabs.length) % tabs.length;
      else if (key === 'Home') n = 0;
      else if (key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); stop(); show(n + 1, true); }
    });
  });

  /* la decisión es de la persona */
  Array.prototype.forEach.call(demo.querySelectorAll('[data-decide]'), function (b) {
    b.addEventListener('click', function () {
      stop();
      var ok = b.getAttribute('data-decide') === 'ok';
      var msg = ok ? 'Pedido aprobado · aviso enviado a Sucursal Centro' : 'Aceite ajustado a 3 L · pedido aprobado y aviso enviado';
      if (log) { log.textContent = msg; logBox.classList.add('done'); }
      if (res) res.textContent = 'Decisión registrada: ' + (ok ? 'pedido aprobado tal como llegó.' : 'aceite ajustado a 3 L y pedido aprobado.');
    });
  });

  /* se reproduce una vez cuando entra en pantalla (salvo movimiento reducido) */
  if (!RM && 'IntersectionObserver' in W) {
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      if (cur === 1 && !playing) start();
    }, { threshold: 0.5 });
    io.observe(demo);
  }
  D.addEventListener('visibilitychange', function () { if (D.hidden && playing) stop(); });
})();
