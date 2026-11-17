/* Ezequiel Brunner — Automatización & IA: demostración interactiva (ficticia).
   Se elige un proceso administrativo (reposición, facturas, turnos o cierre de caja) y se recorren sus cinco etapas:
   ingreso, registro, procesamiento, alerta y decisión humana. Cada etapa se puede elegir (también con el teclado);
   el recorrido se reproduce una vez al entrar en pantalla o al cambiar de proceso, y se puede pausar.
   En la última etapa decide la persona. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var demo = D.querySelector('[data-demo]');
  if (!demo) return;
  var RM = H.classList.contains('rm');
  var $$ = function (s, r) { return Array.prototype.slice.call((r || demo).querySelectorAll(s)); };
  var tabs = $$('[role="tab"]'), procBtns = $$('[role="radio"]');
  var panels = tabs.map(function (t) { return D.getElementById(t.getAttribute('aria-controls')); });
  var rail = demo.querySelector('.demo-rail');
  var play = demo.querySelector('[data-demo-play]'), lab = play && play.querySelector('.dp-lab');
  var log = demo.querySelector('[data-log]'), logBox = log && log.parentNode;
  var res = demo.querySelector('[data-decision]');
  var data = [];
  try { data = JSON.parse(demo.querySelector('[data-demo-data]').textContent); } catch (e) { data = []; }
  var proc = data[0] || null, cur = 1, playing = false, timer = 0, STEP = 3600, seen = false;
  var N = tabs.length;

  function show(i, focus) {
    cur = i;
    demo.setAttribute('data-stage', String(i));
    tabs.forEach(function (t, k) {
      var on = k === i - 1;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (panels[k]) panels[k].hidden = !on;
    });
    if (focus) tabs[i - 1].focus();
    if (rail && rail.scrollWidth > rail.clientWidth + 2) rail.scrollTo({ left: Math.max(0, tabs[i - 1].offsetLeft - 16), behavior: RM ? 'auto' : 'smooth' });
    if (i < N && log) { log.textContent = 'Pendiente de decisión'; logBox.classList.remove('done'); if (res) res.textContent = ''; }
  }
  function label(t) { if (lab) lab.textContent = t; }
  function stop() {
    playing = false; clearTimeout(timer);
    if (play) play.setAttribute('aria-pressed', 'false');
    label(cur >= N ? 'Repetir el recorrido' : 'Reproducir el recorrido');
  }
  function next() {
    if (!playing) return;
    if (cur >= N) { stop(); return; }
    show(cur + 1);
    timer = setTimeout(next, STEP);
  }
  function start() {
    if (cur >= N) show(1);
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
      if (key === 'ArrowRight' || key === 'ArrowDown') n = (k + 1) % N;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') n = (k - 1 + N) % N;
      else if (key === 'Home') n = 0;
      else if (key === 'End') n = N - 1;
      if (n !== null) { e.preventDefault(); stop(); show(n + 1, true); }
    });
  });

  /* cambiar de proceso: textos de cada etapa, lo que se ve y las opciones de la decisión */
  function f(name) { return demo.querySelector('[data-f="' + name + '"]'); }
  function setText(name, v) { var el = f(name); if (el) el.textContent = v; }
  function setProc(k, focus) {
    var p = null;
    data.forEach(function (x) { if (x.k === k) p = x; });
    if (!p) return;
    proc = p;
    demo.setAttribute('data-proc', k);
    procBtns.forEach(function (b) {
      var on = b.getAttribute('data-proc') === k;
      b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    var pr = demo.querySelector('[data-problem]'); if (pr) pr.textContent = p.problem;
    panels.forEach(function (pan, i) {
      var s = p.stages[i]; if (!pan || !s) return;
      pan.querySelector('.dp-t').textContent = s.h3; pan.querySelector('.dp-w').textContent = s.what;
      ['before', 'after', 'human'].forEach(function (n) { var el = pan.querySelector('[data-f="' + n + '"]'); if (el) el.textContent = s[n]; });
    });
    $$('[data-decide]').forEach(function (b) {
      p.decide.forEach(function (d) { if (d[0] === b.getAttribute('data-decide')) b.querySelector('span').textContent = d[1]; });
    });
    var S = p.sample;
    ['from', 'channel', 'time', 'msg', 'id', 'cap', 'rcap', 'alert', 'fine'].forEach(function (n) { setText(n, S[n]); });
    var rows = f('rows');
    if (rows) {
      rows.textContent = '';
      S.rows.forEach(function (r, j) {
        var li = D.createElement('li'); li.className = 'dv-row'; li.setAttribute('data-st', r[2]); li.style.setProperty('--i', j);
        var a = D.createElement('span'); a.className = 'dv-p'; a.textContent = r[0];
        var q = D.createElement('span'); q.className = 'dv-q'; q.textContent = r[1];
        var st = D.createElement('span'); st.className = 'dv-s'; st.innerHTML = '<i aria-hidden="true"></i>';
        var tx = D.createElement('span'); tx.textContent = r[3]; st.appendChild(tx);
        li.appendChild(a); li.appendChild(q); li.appendChild(st); rows.appendChild(li);
      });
    }
    var bars = f('bars');
    if (bars) Array.prototype.forEach.call(bars.children, function (b, j) { if (S.bars[j] !== undefined) b.style.setProperty('--h', S.bars[j]); });
    stop(); show(1);
    if (!RM && seen) start();
  }
  procBtns.forEach(function (b, k) {
    b.addEventListener('click', function () { setProc(b.getAttribute('data-proc')); });
    b.addEventListener('keydown', function (e) {
      var n = null, key = e.key, L = procBtns.length;
      if (key === 'ArrowRight' || key === 'ArrowDown') n = (k + 1) % L;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') n = (k - 1 + L) % L;
      else if (key === 'Home') n = 0;
      else if (key === 'End') n = L - 1;
      if (n !== null) { e.preventDefault(); setProc(procBtns[n].getAttribute('data-proc'), true); }
    });
  });

  /* la decisión es de la persona */
  $$('[data-decide]').forEach(function (b) {
    b.addEventListener('click', function () {
      stop();
      var k = b.getAttribute('data-decide'), d = null;
      if (proc) proc.decide.forEach(function (x) { if (x[0] === k) d = x; });
      if (!d) return;
      if (log) { log.textContent = d[2]; logBox.classList.add('done'); }
      if (res) res.textContent = 'Decisión registrada: ' + d[3];
    });
  });

  /* se reproduce una vez cuando entra en pantalla (salvo movimiento reducido) */
  if ('IntersectionObserver' in W) {
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect(); seen = true;
      if (!RM && cur === 1 && !playing) start();
    }, { threshold: 0.2 });   // el bloque puede ser más alto que la pantalla (celular)
    io.observe(demo);
  } else seen = true;
  D.addEventListener('visibilitychange', function () { if (D.hidden && playing) stop(); });
})();
