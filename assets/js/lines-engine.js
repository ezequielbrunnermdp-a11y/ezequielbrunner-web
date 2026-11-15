/* Ezequiel Brunner — motor de las «líneas de datos» (Automatización & IA).
   Un relieve de líneas finas que se mueve despacio y, encima, una red de nodos apoyados sobre el relieve:
   procesos que se conectan. Con el cursor (o con una ola lenta en pantallas táctiles) los nodos se encienden,
   las conexiones se dibujan y viajan pulsos de información. Sin DOM: corre en un Worker o en la página. */
(function (root) {
  'use strict';

  /* ruido simplex 3D (Stefan Gustavson, dominio público), versión compacta */
  var G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  var perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  (function seed() {
    var p = new Uint8Array(256), i, j, t, s = 7;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; j = s % (i + 1); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  })();
  var F3 = 1 / 3, G3c = 1 / 6;
  function noise(x, y, z) {
    var s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    var t = (i + j + k) * G3c, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var x1 = x0 - i1 + G3c, y1 = y0 - j1 + G3c, z1 = z0 - k1 + G3c, x2 = x0 - i2 + 2 * G3c, y2 = y0 - j2 + 2 * G3c, z2 = z0 - k2 + 2 * G3c;
    var x3 = x0 - 1 + 3 * G3c, y3 = y0 - 1 + 3 * G3c, z3 = z0 - 1 + 3 * G3c;
    var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * n;
  }

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* opts: t (tiempo inicial), mode ('panel' | 'hero'), touch (sin cursor), lite (equipos modestos) */
  function Field(ctx, opts) {
    this.ctx = ctx;
    this.t = opts.t || 0;
    this.mode = opts.mode || 'hero';
    this.touch = !!opts.touch;
    this.lite = !!opts.lite;
    this.w = 0; this.h = 0;
    this.mouse = { x: -9999, y: -9999, k: 0, tk: 0 };
    this.base = this.mode === 'panel' ? 0.1 : 0.42;       // activación en reposo
    this.act = this.base; this.tact = this.base;
    if (opts.act != null) { this.act = this.tact = opts.act; }
    this.nodes = []; this.edges = []; this.pulses = [];
  }

  Field.prototype.resize = function (w, h, dpr) {
    this.w = w; this.h = h;
    var c = this.ctx.canvas;
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var small = w < 640;
    this.rows = this.lite ? (small ? 26 : 38) : (small ? 34 : 52);
    this.cols = this.lite ? (small ? 44 : 66) : (small ? 58 : 96);
    this.build(small);
  };

  /* nodos repartidos sobre el relieve, lejos del texto (abajo a la izquierda); cada uno se une a sus dos vecinos */
  Field.prototype.build = function (small) {
    var r = rng(this.mode === 'panel' ? 23 : 41), n = small ? 12 : (this.lite ? 16 : 22), nodes = [], tries = 0;
    while (nodes.length < n && tries < 600) {
      tries++;
      var u = 0.08 + r() * 0.88, z = 0.14 + r() * 0.7;
      if (u < 0.5 && z > 0.5) continue;                         // zona del texto
      var ok = true;
      for (var i = 0; i < nodes.length; i++) { var du = (nodes[i].u - u) * 1.6, dz = nodes[i].z - z; if (du * du + dz * dz < 0.012) { ok = false; break; } }
      if (ok) nodes.push({ u: u, z: z, x: 0, y: 0, g: 0, ph: r() * 6.28 });
    }
    var edges = [], seen = {};
    nodes.forEach(function (a, ia) {
      var d = nodes.map(function (b, ib) { var du = (a.u - b.u) * 1.6, dz = a.z - b.z; return { ib: ib, d: du * du + dz * dz }; })
        .filter(function (o) { return o.ib !== ia; }).sort(function (p, q) { return p.d - q.d; });
      for (var k = 0; k < 2 && k < d.length; k++) {
        var key = Math.min(ia, d[k].ib) + '-' + Math.max(ia, d[k].ib);
        if (!seen[key]) { seen[key] = 1; edges.push({ a: ia, b: d[k].ib, vis: 0 }); }
      }
    });
    edges.sort(function (p, q) { return (nodes[p.a].u + nodes[p.b].u) - (nodes[q.a].u + nodes[q.b].u); });  // se encienden de izquierda a derecha
    edges.forEach(function (e, i) { e.th = 0.12 + 0.76 * (i / Math.max(1, edges.length - 1)); });
    this.nodes = nodes; this.edges = edges; this.pulses = [];
  };

  Field.prototype.pointer = function (x, y, k) { this.mouse.x = x; this.mouse.y = y; this.mouse.tk = k; };
  Field.prototype.activate = function (v) { this.tact = Math.max(this.base, v); };

  /* altura del relieve en (u, z): se usa para las líneas y para apoyar los nodos */
  Field.prototype.ridge = function (u, z, t) {
    var n = noise(u * 2.1, z * 2.6 + 0.7, t * 0.00005) * 0.7 + noise(u * 5.3, z * 6.1, t * 0.00009 + 3.1) * 0.3;
    var r = 1 - Math.abs(n); return r * r * r;
  };

  Field.prototype.frame = function (dt, still) {
    var ctx = this.ctx, w = this.w, h = this.h;
    if (!w || !h) return;
    if (!still) this.t += dt;
    var t = this.t, m = this.mouse;
    m.k += (m.tk - m.k) * 0.08;
    // en pantallas táctiles la red «respira»: se enciende y se apaga despacio sola
    if (this.touch && !still) this.tact = this.base + (0.75 - this.base) * (0.5 + 0.5 * Math.sin(t * 0.0007));
    this.act += (this.tact - this.act) * (still ? 1 : 0.05);
    var act = this.act;

    ctx.clearRect(0, 0, w, h);
    var horizon = h * 0.2, near = h * 1.08, rows = this.rows, cols = this.cols;
    for (var i = 0; i < rows; i++) {
      var z = i / (rows - 1), p = Math.pow(z, 1.75);
      var base = horizon + (near - horizon) * p, amp = 6 + 170 * p, light = 0;
      ctx.beginPath();
      for (var j = 0; j <= cols; j++) {
        var u = j / cols, x = -24 + (w + 48) * u;
        var bell = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * clamp(u * 1.04 - 0.02, 0, 1)), 1.4);
        var y = base - this.ridge(u, z, t) * amp * bell;
        if (m.k > 0.01) {
          var dx = x - m.x, dy = base - m.y, gg = Math.exp(-(dx * dx) / 34000 - (dy * dy) / 22000) * m.k;
          y -= gg * (34 + 54 * p);
          if (gg > light) light = gg;
        }
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      // la línea de adelante tapa a las de atrás
      ctx.save();
      ctx.lineTo(w + 24, base + 2); ctx.lineTo(-24, base + 2); ctx.closePath();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(222, 232, 229, ' + (0.03 + 0.5 * p + light * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 0.55 + 0.75 * p;
      ctx.stroke();
      if (i % 3 === 1 && !still) {
        var span = w * 1.7, px = ((t * (0.05 + (i % 7) * 0.008) + i * 211) % span) - w * 0.35;
        var gr = ctx.createLinearGradient(px - 180, 0, px + 180, 0);
        gr.addColorStop(0, 'rgba(130, 176, 170, 0)');
        gr.addColorStop(0.5, 'rgba(160, 215, 205, ' + (0.3 + 0.55 * p).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(130, 176, 170, 0)');
        ctx.strokeStyle = gr; ctx.lineWidth = 0.9 + 1.1 * p;
        ctx.stroke();
      }
    }

    /* red de procesos: nodos apoyados en el relieve */
    var nodes = this.nodes, edges = this.edges, k, nd;
    for (k = 0; k < nodes.length; k++) {
      nd = nodes[k];
      var pz = Math.pow(nd.z, 1.75), b0 = horizon + (near - horizon) * pz, a0 = 6 + 170 * pz;
      var bl = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * clamp(nd.u * 1.04 - 0.02, 0, 1)), 1.4);
      nd.x = -24 + (w + 48) * nd.u;
      nd.y = b0 - this.ridge(nd.u, nd.z, t) * a0 * bl - 3;
      var wave = 0.5 + 0.5 * Math.sin(t * 0.0008 - nd.u * 4.2 + nd.z * 1.3 + nd.ph * 0.2);
      var cur = 0;
      if (m.k > 0.01) { var ddx = nd.x - m.x, ddy = nd.y - m.y; cur = Math.exp(-(ddx * ddx + ddy * ddy) / 52000) * m.k; nd.y -= cur * 26; }
      nd.g = clamp(act * (0.3 + 0.7 * wave * wave) + cur * 0.9, 0, 1);
      nd.cur = cur;
    }
    ctx.lineCap = 'round';
    for (k = 0; k < edges.length; k++) {
      var e = edges[k], A = nodes[e.a], B = nodes[e.b];
      var want = (act + 0.7 * Math.max(A.cur, B.cur)) > e.th ? 1 : 0;
      e.vis += (want - e.vis) * (still ? 1 : 0.06);
      if (e.vis < 0.02) continue;
      var gE = Math.min(A.g, B.g);
      var ex = A.x + (B.x - A.x) * e.vis, ey = A.y + (B.y - A.y) * e.vis;
      ctx.strokeStyle = 'rgba(160, 215, 205, ' + ((0.08 + 0.42 * gE) * e.vis).toFixed(3) + ')';
      ctx.lineWidth = 0.7 + 0.7 * gE;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    /* pulsos de información que recorren las conexiones visibles */
    if (!still) {
      var rate = (this.lite ? 0.5 : 1) * (0.012 + 0.07 * act + 0.08 * m.k);
      if (Math.random() < rate && this.pulses.length < 16 && edges.length) {
        var ed = edges[(Math.random() * edges.length) | 0];
        if (ed.vis > 0.9) this.pulses.push({ e: ed, s: 0, d: Math.random() < 0.5, v: 0.0006 + Math.random() * 0.0006 });
      }
      for (k = this.pulses.length - 1; k >= 0; k--) {
        var pu = this.pulses[k]; pu.s += pu.v * dt;
        if (pu.s >= 1 || pu.e.vis < 0.5) { this.pulses.splice(k, 1); continue; }
        var P = nodes[pu.d ? pu.e.a : pu.e.b], Q = nodes[pu.d ? pu.e.b : pu.e.a];
        var s1 = pu.s, s0 = Math.max(0, s1 - 0.16);
        var x1 = P.x + (Q.x - P.x) * s1, y1 = P.y + (Q.y - P.y) * s1, x0 = P.x + (Q.x - P.x) * s0, y0 = P.y + (Q.y - P.y) * s0;
        var pg = ctx.createLinearGradient(x0, y0, x1, y1);
        pg.addColorStop(0, 'rgba(190, 235, 226, 0)'); pg.addColorStop(1, 'rgba(210, 244, 236, 0.95)');
        ctx.strokeStyle = pg; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    for (k = 0; k < nodes.length; k++) {
      nd = nodes[k];
      var rr = 1.3 + 1.4 * Math.pow(nd.z, 1.2) + 1.6 * nd.g;
      if (nd.g > 0.45) {
        ctx.fillStyle = 'rgba(130, 176, 170, ' + (0.12 * nd.g).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr * 4.2, 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = 'rgba(214, 238, 232, ' + (0.28 + 0.7 * nd.g).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, rr, 0, 6.2832); ctx.fill();
    }
  };

  root.FieldEngine = Field;
})(typeof self !== 'undefined' ? self : this);
