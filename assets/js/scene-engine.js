/* Ezequiel Brunner — escena 3D de la portada: «la operación y su capa de información».
   Una maqueta de una operación gastronómica (depósito, cocina, barra, salón, caja y oficina). Por el piso circulan
   pedidos, servicio, abastecimiento y cobros (cobre). Encima, la capa de información que arma la tecnología: los
   datos suben desde cada sector, viajan en arcos hasta el procesamiento y, cuando algo se desvía, una alerta baja
   hasta el escritorio de la caja, donde decide una persona (luz blanca cálida).
   WebGL2 y GLSL propios, sin bibliotecas: corre en un Worker con OffscreenCanvas o en la página. */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function approach(cur, tgt, dt, k) { return cur + (tgt - cur) * (1 - Math.exp(-dt * k)); }

  // ---------------------------------------------------------------- matrices (columna mayor)
  function perspective(o, fovy, aspect, near, far, sx, sy) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    for (var i = 0; i < 16; i++) o[i] = 0;
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    o[8] = -sx; o[9] = -sy;   // desplazamiento de lente: corre la escena en pantalla sin deformar la perspectiva
    return o;
  }
  function lookAt(o, e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.sqrt(zx * zx + zy * zy + zz * zz);
    zx /= l; zy /= l; zz /= l;
    var xx = zz, xz = -zx; l = Math.sqrt(xx * xx + xz * xz); xx /= l; xz /= l;   // arriba = +Y
    var yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = 0; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xz * e[2]);
    o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
    o[15] = 1;
    return o;
  }
  function mul(o, a, b) {
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }

  // ---------------------------------------------------------------- shaders
  var BG_VS = '#version 300 es\nconst vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));void main(){gl_Position=vec4(P[gl_VertexID],0.,1.);}';
  var BG_FS = ['#version 300 es', 'precision mediump float;',
    'uniform vec2 uRes,uW,uC;uniform vec3 uBg;uniform float uWarm,uCool,uSeed;out vec4 o;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    'void main(){vec2 uv=gl_FragCoord.xy/uRes;float a=uRes.x/uRes.y;vec3 c=uBg;',
    'vec2 p=(uv-uW)*vec2(a,1.);c+=vec3(.80,.44,.21)*exp(-dot(p,p)*2.4)*(.03+.09*uWarm);',
    'vec2 q=(uv-uC)*vec2(a,1.);c+=vec3(.16,.58,.56)*exp(-dot(q,q)*2.4)*(.03+.09*uCool);',
    'vec2 v=uv-.5;c*=1.-dot(v,v)*.45;c+=(h(gl_FragCoord.xy+uSeed)-.5)/255.;o=vec4(c,1.);}'].join('\n');

  var BOX_VS = ['#version 300 es',
    'layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;',
    'layout(location=2) in vec3 iC;layout(location=3) in vec3 iS;layout(location=4) in vec4 iT;',
    'uniform mat4 uVP;uniform float uRise;out vec3 vW;out vec3 vN;out vec4 vT;out vec3 vL;out vec3 vS;',
    'void main(){float k=iT.a,r=1.;',
    // las piezas crecen desde la base, de izquierda (operación) a derecha; la base no crece
    'if(k<.5||k>1.5){r=clamp(uRise*1.8-(iC.x+5.)/10.*.8,0.,1.);r=r*r*(3.-2.*r);}',
    'float hh=max(iS.y*r,.0006);vec3 w=vec3(iC.x+aP.x*iS.x,iC.y-iS.y*.5+(aP.y+.5)*hh,iC.z+aP.z*iS.z);',
    'vW=w;vN=aN;vT=iT;vL=aP;vS=vec3(iS.x,hh,iS.z);gl_Position=uVP*vec4(w,1.);}'].join('\n');
  // luz de cine: dos focos (cobre sobre la operación, turquesa sobre la información), cantos que atrapan la luz
  // como en una maqueta de arquitectura, sombra de contacto y niebla hacia el negro
  var BOX_FS = ['#version 300 es', 'precision highp float;',
    'in vec3 vW;in vec3 vN;in vec4 vT;in vec3 vL;in vec3 vS;',
    'uniform vec3 uEye,uBg,uPw,uPc;uniform float uWarm,uCool,uFog,uDecide,uGas;out vec4 o;',
    'vec3 lit(vec3 N,vec3 V,vec3 P,vec3 L,vec3 col,float I){vec3 d=L-P;float r2=dot(d,d);vec3 l=d*inversesqrt(r2);',
    'float att=I/(1.+r2*.05);return col*att*(max(dot(N,l),0.)+pow(max(dot(N,normalize(l+V)),0.),48.)*.45);}',
    'void main(){vec3 N=normalize(vN),V=normalize(uEye-vW);float k=vT.a,top=step(.5,N.y);',
    'vec3 alb=vT.rgb*mix(.7,1.45,top);',
    'vec3 CW=vec3(1.,.58,.30),CC=vec3(.28,.86,.80);',
    'vec3 li=vec3(.05)+lit(N,V,vW,uPw,CW,.3+2.2*uWarm)+lit(N,V,vW,uPc,CC,.3+2.2*uCool);',
    'vec3 c=alb*li*3.;',
    // cantos: distancia al borde de la cara, en unidades reales
    'vec3 a=abs(N);vec2 e2=a.x>.5?vec2(.5-abs(vL.y),.5-abs(vL.z))*vS.yz:a.y>.5?vec2(.5-abs(vL.x),.5-abs(vL.z))*vS.xz:vec2(.5-abs(vL.x),.5-abs(vL.y))*vS.xy;',
    'float ed=1.-smoothstep(0.,.022,min(e2.x,e2.y));',
    'float sd=smoothstep(-4.5,4.5,vW.x);vec3 ec=mix(CW*(.3+uWarm),CC*(.3+uCool),sd);',
    'if(k<.5||k>1.5)c+=ed*ec*(.16+.3*top);',
    'c*=mix(.42,1.,smoothstep(0.,.32,vW.y+.02));',
    'if(k>.5&&k<1.5&&top>.5){vec2 g=vW.xz/.6,f=abs(fract(g-.5)-.5)/fwidth(g);float ln=1.-min(min(f.x,f.y),1.);',
    'c+=ln*.06*ec*.6;c+=CW*uGas*.03;c+=ed*ec*.7;}',
    'if(k>1.5){c+=vec3(1.,.88,.72)*uDecide*.8;}',
    'float d=length(uEye-vW);c=mix(c,uBg,1.-exp(-pow(d*uFog,2.)));o=vec4(c,1.);}'].join('\n');

  var LN_VS = ['#version 300 es',
    'layout(location=0) in vec3 aP;layout(location=1) in vec4 aC;',
    'uniform mat4 uVP;uniform vec3 uEye;uniform float uFog,uAlpha,uGrow;out vec4 vC;',
    'void main(){float d=length(uEye-aP);float g=clamp(uGrow*1.7-(aP.x+5.)/10.*.7,0.,1.);',
    'vC=vec4(aC.rgb,aC.a*uAlpha*g*exp(-pow(d*uFog,2.)));gl_Position=uVP*vec4(aP,1.);}'].join('\n');
  var LN_FS = '#version 300 es\nprecision mediump float;in vec4 vC;out vec4 o;void main(){o=vec4(vC.rgb*vC.a,vC.a);}';

  var PT_VS = ['#version 300 es',
    'layout(location=0) in vec3 aP;layout(location=1) in vec4 aC;layout(location=2) in float aS;',
    'uniform mat4 uVP;uniform vec3 uEye;uniform float uFog,uScale,uA,uGrow;out vec4 vC;',
    'void main(){vec4 c=uVP*vec4(aP,1.);gl_Position=c;gl_PointSize=clamp(aS*uScale/c.w,1.,64.);',
    'float g=clamp(uGrow*1.7-(aP.x+5.)/10.*.7,0.,1.);',
    'float d=length(uEye-aP);vC=vec4(aC.rgb,aC.a*uA*g*exp(-pow(d*uFog,2.)));}'].join('\n');
  var PT_FS = ['#version 300 es', 'precision mediump float;in vec4 vC;out vec4 o;',
    'void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;',
    'float a=vC.a*(exp(-r*5.)*.85+(1.-smoothstep(0.,.14,r))*.7);o=vec4(vC.rgb*a,a);}'].join('\n');

  function shader(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }
  function program(gl, vs, fs, names) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program');
    var u = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { p: p, u: u };
  }

  // ---------------------------------------------------------------- la maqueta
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  var COPPER = [1, .62, .34], AMBER = [1, .76, .48], TEAL = [.40, .9, .84], WHITE = [1, .93, .82];

  function buildBlocks() {
    var B = [], R = rng(7);
    function b(x, z, sx, sz, h, tone, kind) { B.push([x, h / 2, z, sx, h, sz, tone * .94, tone, tone * 1.06, kind || 0]); }
    B.push([0, -.08, 0, 9.8, .16, 6.2, .05, .053, .056, 1]);   // la base
    // depósito: estanterías
    b(-4.45, -1.85, .16, 1.5, .95, .1); b(-4.05, -1.85, .16, 1.5, .95, .1); b(-3.65, -1.85, .16, 1.5, .95, .1);
    // cocina: mesada, isla y pase
    b(-1.7, -2.55, 2.6, .36, .46, .11); b(-1.75, -1.85, 1.4, .55, .4, .115); b(-1.7, -1.12, 2.2, .2, .52, .12);
    // barra: estante, mostrador y retorno
    b(2.1, -2.6, 3.0, .26, .72, .1); b(2.0, -1.62, 2.6, .34, .56, .12); b(3.38, -2.0, .34, .62, .56, .12);
    // caja y oficina: el escritorio donde decide una persona (kind 2) y un panel
    b(4.15, -1.2, .7, .45, .42, .13, 2); b(4.15, -2.2, .9, .12, .95, .095);
    // salón: mesas con un pasillo central
    var xs = [-3.9, -3.0, -2.1, -1.2, 1.2, 2.1, 3.0, 3.9], zs = [-.2, .6, 1.4, 2.2];
    for (var i = 0; i < zs.length; i++) for (var j = 0; j < xs.length; j++) {
      var big = R() > .8;
      b(xs[j] + (R() - .5) * .08, zs[i] + (R() - .5) * .08, big ? .62 : .46, .46, .3, .11);
    }
    // entrada
    b(-.5, 2.85, .08, .08, .6, .13); b(.5, 2.85, .08, .08, .6, .13);
    return B;
  }

  // recorridos del piso (y = 0): pedidos, servicio, barra, abastecimiento, cobro e ingreso
  var PATHS = [
    { p: [[-3.0, 1.0], [-.3, 1.0], [-.3, -.78], [-1.7, -.78]], n: 3, v: .7 },
    { p: [[-1.0, -.78], [.3, -.78], [.3, 1.8], [2.1, 1.8]], n: 3, v: .75 },
    { p: [[1.62, -1.32], [1.62, .2], [3.5, .2]], n: 2, v: .62 },
    { p: [[-3.42, -2.25], [-2.55, -2.25], [-2.55, -1.85]], n: 2, v: .4 },
    { p: [[3.0, 1.0], [3.55, 1.0], [3.55, -.86], [4.15, -.86]], n: 2, v: .55 },
    { p: [[0, 2.95], [0, 1.0], [-.3, 1.0]], n: 2, v: .5 },
    { p: [[-2.1, 1.8], [-.3, 1.8], [-.3, 2.6]], n: 1, v: .52 }
  ];

  // capa de información: un plano de datos sobre la maqueta, un nodo sobre cada sector y el procesamiento
  var LAYER = 2.35;
  var ZONES = [[-4.05, .95, -1.85], [-1.75, .4, -1.85], [2.0, .56, -1.62], [-2.1, .3, 1.4], [2.1, .3, .6], [4.15, .95, -2.2]];
  var HUB = [.25, 3.15, -.55];
  var DESK = [4.15, .44, -1.2];
  // volumen de la maqueta y de su capa de información (para encuadrarla)
  var BOUNDS = [[-4.9, 0, -3.1], [4.9, 0, -3.1], [-4.9, 0, 3.1], [4.9, 0, 3.1], [-4.2, 3.2, -2.8], [4.2, 3.2, -2.8], [-4.2, 3.2, 2.8], [4.2, 3.2, 2.8]];
  var TARGET = [.1, .95, -.3], AZ = .5, EL = .54;

  function node(z) { return [z[0], LAYER, z[2]]; }
  function bez(a, c, b, n) {   // arco cuadrático muestreado
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]]);
    }
    return out;
  }
  function arcUp(a, b) { return bez(a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + .7, (a[2] + b[2]) / 2], b, 22); }
  var ALERT_ARC = bez(HUB, [3.9, 3.6, -.9], [DESK[0], DESK[1] + .1, DESK[2]], 26);

  function bounds(M, pts) {
    var x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
      var x = (M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / w, y = (M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0: x0, x1: x1, y0: y0, y1: y1 };
  }
  function eyeAt(e, R, az, el) {
    e[0] = TARGET[0] + R * Math.sin(az) * Math.cos(el); e[1] = TARGET[1] + R * Math.sin(el); e[2] = TARGET[2] + R * Math.cos(az) * Math.cos(el);
    return e;
  }

  function seg(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
  function route(points) {   // un recorrido 3D con largo acumulado
    var L = [0];
    for (var i = 1; i < points.length; i++) L.push(L[i - 1] + seg(points[i - 1], points[i]));
    return { p: points, L: L, len: L[L.length - 1] };
  }
  function at(r, d, out) {
    d = clamp(d, 0, r.len);
    var lo = 1, hi = r.p.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (r.L[mid] < d) lo = mid + 1; else hi = mid; }
    var a = r.p[lo - 1], b = r.p[lo], t = (d - r.L[lo - 1]) / ((r.L[lo] - r.L[lo - 1]) || 1);
    out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }

  // ---------------------------------------------------------------- motor
  function Engine(gl, opt) {
    opt = opt || {};
    this.gl = gl; this.lite = !!opt.lite; this.still = !!opt.still;
    this.w = 1; this.h = 1; this.dpr = 1; this.t = 0; this.seed = 0;
    this.warm = .62; this.cool = .62; this.tw = .62; this.tc = .62;
    this.floor = .85; this.tfloor = .85; this.info = .85; this.tinfo = .85; this.gas = 0; this.tgas = 0;
    this.rate = 1; this.trate = 1; this.side = 0;
    this.px = 0; this.py = 0; this.tpx = 0; this.tpy = 0; this.scroll = 0; this.tscroll = 0;
    this.az = 0; this.el = 0; this.decide = 0; this.alert = 0;
    this.intro = this.still ? 4 : 0;
    this.rect = { l: .44, r: .97, t: .14, b: .9 }; this.mobile = false; this.R0 = 0; this.fov = .5; this.sx = 0; this.sy = 0;
    this.V = new Float32Array(16); this.P = new Float32Array(16); this.VP = new Float32Array(16); this.eye = [0, 0, 0];
    this.pulses = []; this.spawn = 0; this.count = 0; this.tmp = [0, 0, 0];
    this.init();
  }

  Engine.prototype.init = function () {
    var gl = this.gl, self = this;
    this.bg = program(gl, BG_VS, BG_FS, ['uRes', 'uW', 'uC', 'uBg', 'uWarm', 'uCool', 'uSeed']);
    this.box = program(gl, BOX_VS, BOX_FS, ['uVP', 'uRise', 'uEye', 'uBg', 'uWarm', 'uCool', 'uFog', 'uDecide', 'uGas', 'uPw', 'uPc']);
    this.ln = program(gl, LN_VS, LN_FS, ['uVP', 'uEye', 'uFog', 'uAlpha', 'uGrow']);
    this.pt = program(gl, PT_VS, PT_FS, ['uVP', 'uEye', 'uFog', 'uScale', 'uA', 'uGrow']);
    this.bgVao = gl.createVertexArray();

    // cubo unitario (posición y normal) e instancias de la maqueta
    var F = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], cube = [];
    F.forEach(function (n) {
      var u = n[1] !== 0 ? [1, 0, 0] : [0, 1, 0], v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      function c(a, b) { return [(n[0] + a * u[0] + b * v[0]) / 2, (n[1] + a * u[1] + b * v[1]) / 2, (n[2] + a * u[2] + b * v[2]) / 2]; }
      [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]].forEach(function (q) { var p = c(q[0], q[1]); cube.push(p[0], p[1], p[2], n[0], n[1], n[2]); });
    });
    var blocks = buildBlocks(), inst = [];
    blocks.forEach(function (b) { for (var i = 0; i < 10; i++) inst.push(b[i]); });
    this.nInst = blocks.length; this.nCube = cube.length / 6;
    this.boxVao = gl.createVertexArray(); gl.bindVertexArray(this.boxVao);
    var cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inst), gl.STATIC_DRAW);
    [[2, 3, 0], [3, 3, 12], [4, 4, 24]].forEach(function (a) {
      gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, 40, a[2]); gl.vertexAttribDivisor(a[0], 1);
    });

    // recorridos de los datos: del sector a su nodo (hilo) y del nodo al procesamiento (arco)
    this.dataRoutes = ZONES.map(function (z) { return route([z, node(z)].concat(arcUp(node(z), HUB).slice(1))); });
    this.alertRoute = route(ALERT_ARC);

    // líneas: recorridos del piso, hilos, arcos, arco de alerta y borde de la base
    var L = [], groups = {};
    function line(a, b, ca, cb2, al, bl) { L.push(a[0], a[1], a[2], ca[0], ca[1], ca[2], al, b[0], b[1], b[2], cb2[0], cb2[1], cb2[2], bl === undefined ? al : bl); }
    function poly(pts, c0, c1, a0, a1) {
      for (var i = 1; i < pts.length; i++) {
        var t0 = (i - 1) / (pts.length - 1), t1 = i / (pts.length - 1);
        line(pts[i - 1], pts[i], [c0[0] + (c1[0] - c0[0]) * t0, c0[1] + (c1[1] - c0[1]) * t0, c0[2] + (c1[2] - c0[2]) * t0],
          [c0[0] + (c1[0] - c0[0]) * t1, c0[1] + (c1[1] - c0[1]) * t1, c0[2] + (c1[2] - c0[2]) * t1], a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1);
      }
    }
    function group(name, fn) { var s = L.length / 7; fn(); groups[name] = [s, L.length / 7 - s]; }
    group('floor', function () {
      PATHS.forEach(function (pa) { poly(pa.p.map(function (q) { return [q[0], .012, q[1]]; }), COPPER, COPPER, .55, .55); });
    });
    group('threads', function () { ZONES.forEach(function (z) { line(z, node(z), COPPER, TEAL, .2, .7); }); });
    group('arcs', function () { ZONES.forEach(function (z) { poly(arcUp(node(z), HUB), TEAL, TEAL, .55, .35); }); });
    group('alert', function () { poly(ALERT_ARC, TEAL, WHITE, .2, .45); });
    group('rim', function () {
      var x = 4.9, z = 3.1;
      line([-x, .003, z], [x, .003, z], COPPER, TEAL, .95); line([-x, .003, -z], [x, .003, -z], COPPER, TEAL, .5);
      line([-x, .003, -z], [-x, .003, z], COPPER, COPPER, .75); line([x, .003, -z], [x, .003, z], TEAL, TEAL, .75);
      line([-x, -.16, z], [x, -.16, z], COPPER, TEAL, .22);
    });
    this.groups = groups;
    this.lnVao = gl.createVertexArray(); gl.bindVertexArray(this.lnVao);
    var lb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);

    // el plano de datos: una retícula fina de puntos sobre la maqueta (estática)
    var G = [];
    for (var gx = -4.2; gx <= 4.21; gx += .6) for (var gz = -2.7; gz <= 2.71; gz += .6) G.push(gx, LAYER, gz, TEAL[0], TEAL[1], TEAL[2], .32, .032);
    this.nGrid = G.length / 8;
    this.gridVao = gl.createVertexArray(); gl.bindVertexArray(this.gridVao);
    var gb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(G), gl.STATIC_DRAW);
    this.ptAttribs(gl);

    // puntos dinámicos: fichas del piso, nodos, pulsos de datos y alertas
    this.floorRoutes = PATHS.map(function (pa) { return route(pa.p.map(function (q) { return [q[0], .035, q[1]]; })); });
    this.tokens = [];
    PATHS.forEach(function (pa, i) {
      var n = self.lite ? Math.max(1, pa.n - 1) : pa.n;
      for (var k = 0; k < n; k++) self.tokens.push({ r: i, ph: k / n + i * .13, v: pa.v });
    });
    this.maxPts = 200; this.pts = new Float32Array(this.maxPts * 8); this.nPts = 0;
    this.ptVao = gl.createVertexArray(); gl.bindVertexArray(this.ptVao);
    this.ptBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf); gl.bufferData(gl.ARRAY_BUFFER, this.pts.byteLength, gl.DYNAMIC_DRAW);
    this.ptAttribs(gl);
    gl.bindVertexArray(null);

    // la escena siempre arranca igual: los pulsos iniciales salen de una semilla fija
    this.rand = rng(11);
    for (var i = 0; i < (this.still ? 7 : 3); i++) this.addPulse(.15 + this.rand() * .7);
    if (this.still) { this.pulses.push({ r: this.alertRoute, d: this.alertRoute.len * .55, v: 0, kind: 1 }); this.decide = .55; this.alert = .4; }
  };
  Engine.prototype.ptAttribs = function (gl) {
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
  };

  Engine.prototype.addPulse = function (progress) {
    var r = this.dataRoutes[Math.floor(this.rand() * this.dataRoutes.length)];
    this.count++;
    this.pulses.push({ r: r, d: (progress || 0) * r.len, v: 1.5, kind: 0, alert: this.count % 4 === 0 });
  };

  Engine.prototype.resize = function (w, h, dpr) {
    this.w = Math.max(1, w); this.h = Math.max(1, h); this.dpr = dpr || 1;
    var c = this.gl.canvas; c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
    this.fit();
  };
  // dónde va la escena dentro del cuadro: un rectángulo (fracciones del lienzo) que define el CSS de la página
  Engine.prototype.layout = function (o) {
    if (!o) return;
    this.rect = { l: o.l !== undefined ? o.l : .44, r: o.r !== undefined ? o.r : .97, t: o.t !== undefined ? o.t : .14, b: o.b !== undefined ? o.b : .9 };
    this.mobile = !!o.mobile;
    this.fit();
  };
  // encuadre: busca la distancia de cámara para que la maqueta llene el rectángulo y corre la lente hasta su centro
  Engine.prototype.fit = function () {
    var rc = this.rect, aspect = this.w / this.h;
    var fov = (this.mobile ? 32 : 28) * Math.PI / 180, V = new Float32Array(16), P = new Float32Array(16), M = new Float32Array(16), e = [0, 0, 0];
    var tw = (rc.r - rc.l) * 2, th = (rc.b - rc.t) * 2, lo = 9, hi = 200, bx = null;
    perspective(P, fov, aspect, .5, 400, 0, 0);
    for (var i = 0; i < 26; i++) {
      var R = (lo + hi) / 2;
      lookAt(V, eyeAt(e, R, AZ, EL), TARGET); mul(M, P, V); bx = bounds(M, BOUNDS);
      if ((bx.x1 - bx.x0) > tw || (bx.y1 - bx.y0) > th) lo = R; else hi = R;
    }
    lookAt(V, eyeAt(e, hi, AZ, EL), TARGET); mul(M, P, V); bx = bounds(M, BOUNDS);
    this.R0 = hi; this.fov = fov;
    this.sx = (rc.l + rc.r - 1) - (bx.x0 + bx.x1) / 2;
    this.sy = (1 - rc.t - rc.b) - (bx.y0 + bx.y1) / 2;
  };
  Engine.prototype.pointer = function (x, y, k) { this.tpx = k ? clamp(x, -1, 1) : 0; this.tpy = k ? clamp(y, -1, 1) : 0; };
  Engine.prototype.setScroll = function (v) { this.tscroll = clamp(v, 0, 1); };
  // -1 gastronomía (la operación), 1 automatización (la información), 0 equilibrio
  Engine.prototype.setSide = function (s) {
    this.side = s;
    if (s < 0) { this.tw = 1; this.tc = .22; this.tfloor = 1; this.tinfo = .28; this.tgas = 1; this.trate = .75; }
    else if (s > 0) { this.tw = .22; this.tc = 1; this.tfloor = .4; this.tinfo = 1; this.tgas = 0; this.trate = 2.2; }
    else { this.tw = .62; this.tc = .62; this.tfloor = .85; this.tinfo = .85; this.tgas = 0; this.trate = 1; }
  };

  Engine.prototype.camera = function () {
    if (!this.R0) this.fit();
    var aspect = this.w / this.h, intro = ease(this.intro / 2.8);
    var az = AZ + this.px * .085 + this.az + (1 - intro) * .2;
    var el = EL + this.py * .045 + this.el + this.scroll * .22 + (1 - intro) * .3;
    var R = this.R0 * (1 + this.scroll * .16 + (1 - intro) * .3);
    lookAt(this.V, eyeAt(this.eye, R, az, el), TARGET);
    perspective(this.P, this.fov, aspect, .5, 400, this.sx, this.sy);
    mul(this.VP, this.P, this.V);
    this.uScale = this.h * this.dpr * .5 / Math.tan(this.fov / 2);
  };

  Engine.prototype.points = function (dt) {
    var a = this.pts, n = 0, self = this, tmp = this.tmp, max = this.maxPts;
    function put(p, c, al, s) {
      if (n >= max || al <= .003) return;
      var o = n * 8; a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2]; a[o + 3] = c[0]; a[o + 4] = c[1]; a[o + 5] = c[2]; a[o + 6] = al; a[o + 7] = s; n++;
    }
    var floorA = this.floor * ease(this.intro / 1.4), infoA = this.info;
    // fichas que circulan por el piso: pedidos, servicio, abastecimiento, cobros
    this.tokens.forEach(function (tk) {
      var r = self.floorRoutes[tk.r], u = (self.t * tk.v * .2 / (r.len / 4) + tk.ph) % 1;
      var fade = Math.min(1, u * 8, (1 - u) * 8);
      at(r, u * r.len, tmp); put(tmp, AMBER, fade * floorA, .13);
    });
    // nodos: uno sobre cada sector y el procesamiento
    ZONES.forEach(function (z) { put(node(z), TEAL, .8 * infoA, .1); });
    put(HUB, TEAL, infoA, .22 + this.alert * .1);
    put(HUB, WHITE, this.alert * .9, .3);
    // pulsos: suben desde cada sector, viajan al procesamiento y, a veces, generan una alerta que baja a la persona
    if (!this.still) {
      this.spawn -= dt * this.rate;
      if (this.spawn <= 0 && this.intro > 1.8) { this.addPulse(0); this.spawn = (this.lite ? .9 : .6) * (.7 + this.rand() * .6); }
    }
    for (var i = this.pulses.length - 1; i >= 0; i--) {
      var pu = this.pulses[i];
      if (!this.still) pu.d += dt * pu.v * (pu.kind ? 1 : this.rate);
      if (pu.d >= pu.r.len) {
        this.pulses.splice(i, 1);
        if (pu.kind === 0 && pu.alert) { this.alert = 1; this.pulses.push({ r: this.alertRoute, d: 0, v: 1.25, kind: 1 }); }
        else if (pu.kind === 1) this.decide = 1;
        continue;
      }
      var col = pu.kind ? WHITE : TEAL, s = pu.kind ? .14 : .1, A = pu.kind ? Math.max(infoA, .6) : infoA;
      at(pu.r, pu.d, tmp); put(tmp, col, A, s);
      at(pu.r, pu.d - .2, tmp); put(tmp, col, .4 * A, s * .7);
      at(pu.r, pu.d - .4, tmp); put(tmp, col, .16 * A, s * .5);
    }
    // la persona que decide: la luz del escritorio
    put([DESK[0], DESK[1] + .08, DESK[2]], WHITE, this.decide * .95, .26);
    this.nPts = n;
  };

  Engine.prototype.frame = function (ms) {
    var dt = Math.min(.064, (ms || 16) / 1000), gl = this.gl;
    if (!this.still) { this.t += dt * (.6 + this.rate * .4); this.intro = Math.min(4, this.intro + dt); }
    var k = this.still ? 99 : 3.2;
    this.warm = approach(this.warm, this.tw, dt, k); this.cool = approach(this.cool, this.tc, dt, k);
    this.floor = approach(this.floor, this.tfloor, dt, k); this.info = approach(this.info, this.tinfo, dt, k);
    this.gas = approach(this.gas, this.tgas, dt, k); this.rate = approach(this.rate, this.trate, dt, 2);
    this.px = approach(this.px, this.tpx, dt, 2.4); this.py = approach(this.py, this.tpy, dt, 2.4);
    this.scroll = approach(this.scroll, this.tscroll, dt, 6);
    this.az = approach(this.az, this.side * .07, dt, 1.6); this.el = approach(this.el, this.side > 0 ? .05 : this.side < 0 ? -.03 : 0, dt, 1.6);
    if (!this.still) { this.alert = Math.max(0, this.alert - dt * .9); this.decide = Math.max(0, this.decide - dt * .5); }
    this.seed = (this.seed + 1) % 97;
    this.camera();
    this.points(dt);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
    var BG = [.02, .023, .026];
    var b = this.bg; gl.useProgram(b.p); gl.bindVertexArray(this.bgVao);
    gl.uniform2f(b.u.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    var rc = this.rect, cx = (rc.l + rc.r) / 2, cy = 1 - (rc.t + rc.b) / 2, sp = (rc.r - rc.l) * .3;   // las luces acompañan a la maqueta
    gl.uniform2f(b.u.uW, cx - sp, cy + .02); gl.uniform2f(b.u.uC, cx + sp, cy + .08);
    gl.uniform3fv(b.u.uBg, BG); gl.uniform1f(b.u.uWarm, this.warm); gl.uniform1f(b.u.uCool, this.cool); gl.uniform1f(b.u.uSeed, this.seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    var fog = .026;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    var x = this.box; gl.useProgram(x.p); gl.bindVertexArray(this.boxVao);
    gl.uniformMatrix4fv(x.u.uVP, false, this.VP); gl.uniform1f(x.u.uRise, Math.min(1, this.intro / 1.5));
    gl.uniform3fv(x.u.uEye, this.eye); gl.uniform3fv(x.u.uBg, BG); gl.uniform1f(x.u.uWarm, this.warm); gl.uniform1f(x.u.uCool, this.cool);
    gl.uniform1f(x.u.uFog, fog); gl.uniform1f(x.u.uDecide, this.decide); gl.uniform1f(x.u.uGas, this.gas);
    gl.uniform3f(x.u.uPw, -3.2, 3.3, 2.3); gl.uniform3f(x.u.uPc, 3.6, 3.9, -1.3);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.nCube, this.nInst);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    var grow = ease((this.intro - .7) / 1.7), G = this.groups;
    var l = this.ln; gl.useProgram(l.p); gl.bindVertexArray(this.lnVao);
    gl.uniformMatrix4fv(l.u.uVP, false, this.VP); gl.uniform3fv(l.u.uEye, this.eye); gl.uniform1f(l.u.uFog, fog);
    var alphas = { floor: [this.floor, ease(this.intro / 1.4) * 2], threads: [this.info, grow], arcs: [this.info, grow], alert: [this.info * .5 + this.alert * .8 + this.decide * .4, grow], rim: [1, 1] };
    for (var g in G) { gl.uniform1f(l.u.uAlpha, alphas[g][0]); gl.uniform1f(l.u.uGrow, alphas[g][1]); gl.drawArrays(gl.LINES, G[g][0], G[g][1]); }

    var p = this.pt; gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uVP, false, this.VP); gl.uniform3fv(p.u.uEye, this.eye); gl.uniform1f(p.u.uFog, fog); gl.uniform1f(p.u.uScale, this.uScale);
    gl.bindVertexArray(this.gridVao); gl.uniform1f(p.u.uA, this.info); gl.uniform1f(p.u.uGrow, grow);
    gl.drawArrays(gl.POINTS, 0, this.nGrid);
    gl.bindVertexArray(this.ptVao); gl.uniform1f(p.u.uA, 1); gl.uniform1f(p.u.uGrow, 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    if (this.nPts) gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pts, 0, this.nPts * 8);
    gl.drawArrays(gl.POINTS, 0, this.nPts);
    gl.depthMask(true); gl.bindVertexArray(null);
  };

  root.SceneEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
