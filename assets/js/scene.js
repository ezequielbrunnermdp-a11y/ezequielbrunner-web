/*!
 * Ezequiel Brunner — motor de escena WebGL2
 * Un único sistema de partículas que cambia de forma con el desplazamiento
 * (retrato, red, vapor, organigrama, nube, retícula, flujo, portal, firma)
 * y planos de imagen sincronizados con el DOM (refracción, disolución).
 * Código propio, sin dependencias: pesa una fracción de una librería 3D genérica.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var STRIDE = 11; // P(3) + A(4) + B(4)

  /* ---------------------------------------------------------------- utilidades */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function easeIO(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ------------------------------------------------------------------ shaders */
  var VS_PARTICLES = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 aSeed;',
    'in vec3 aP0; in vec4 aA0; in vec4 aB0;',
    'in vec3 aP1; in vec4 aA1; in vec4 aB1;',
    'uniform float uTime; uniform float uMix; uniform int uF0; uniform int uF1;',
    'uniform vec2 uView; uniform float uDpr; uniform vec2 uCenter; uniform float uUnit;',
    'uniform vec2 uRot; uniform float uPersp; uniform float uSwirl;',
    'uniform vec3 uPalA; uniform vec3 uPalB; uniform vec3 uPalC;',
    'uniform float uIntensity; uniform float uFocus; uniform float uDof; uniform float uSize;',
    'uniform vec2 uPointer; uniform vec2 uPointerVel; uniform float uLampR; uniform float uPush;',
    'uniform vec4 uPulse[4]; uniform float uVel; uniform float uScanY; uniform float uScanW; uniform float uFlash; uniform float uPull;',
    'out vec3 vCol; out float vAlpha; out float vStreak;',
    'const float PI = 3.14159265;',
    'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }',
    'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }',
    /* Comportamiento de cada forma. Devuelve posición, brillo, tamaño y tono. */
    'vec3 behave(int f, vec3 P, vec4 A, vec4 B, vec4 S, float t, out float lum, out float siz, out float tone){',
    '  vec3 p = P; lum = 1.0; siz = 1.0; tone = S.z;',
    '  if (f == 0) {',                                                         // retrato
    '    if (A.y > 0.5) {',
    '      float a = S.x*6.2831 + t*0.10*(0.4+S.y);',
    '      p = vec3(P.x + sin(a)*0.05, P.y + sin(t*0.3 + S.z*6.28)*0.04, P.z + cos(a)*0.05);',
    '      lum = 0.22 + 0.35*S.w; siz = 0.7 + 0.5*S.y; tone = 0.15;',
    '    } else {',
    '      p += vec3(sin(t*1.1 + S.y*40.0), cos(t*0.9 + S.z*30.0), sin(t*0.7 + S.w*20.0)) * 0.0035;',
    '      lum = 0.26 + 0.60*A.x; tone = clamp(A.x*0.86, 0.0, 1.0); siz = 0.8 + 0.45*A.x;',
    '    }',
    '  } else if (f == 1 || f == 3) {',                                       // red / organigrama
    '    float ty = A.w;',
    '    if (ty < 0.5) {',
    '      p = A.xyz; float pu = 0.5 + 0.5*sin(t*1.6 + S.x*40.0);',
    '      lum = 0.7 + 0.35*pu; siz = 1.7 + 0.5*pu; tone = 0.9;',
    '    } else if (ty < 1.5) {',
    '      float u = fract(S.y + t*0.10*B.w);',
    '      p = mix(A.xyz, B.xyz, u); p.z += sin(PI*u)*0.12*(S.w - 0.5);',
    '      lum = 0.45 + 0.75*sin(PI*u); siz = 0.85; tone = 0.28 + 0.3*S.z;',
    '    } else if (ty < 2.5) {',
    '      p = P + 0.05*vec3(sin(t*0.4 + S.x*30.0), cos(t*0.35 + S.y*30.0), sin(t*0.3 + S.z*30.0));',
    '      lum = 0.22 + 0.12*S.w; siz = 0.75; tone = S.z*0.55;',
    '    } else {',
    '      float a = B.z + t*B.y;',
    '      float pl = S.x*6.2831; p = A.xyz + (cos(a)*vec3(1.0, 0.0, 0.0) + sin(a)*vec3(0.0, cos(pl), sin(pl)))*B.x;',
    '      lum = 0.7; siz = 0.9; tone = 0.8;',
    '    }',
    '  } else if (f == 2) {',                                                 // vapor sobre el plato
    '    float ty = A.w;',
    '    if (ty < 0.5) {',
    '      p = P + vec3(0.0, sin(t*0.8 + S.x*30.0)*0.004, 0.0);',
    '      lum = 0.5 + 0.2*sin(t*1.5 + S.y*50.0); siz = 0.9; tone = 0.7;',
    '    } else if (ty < 1.5) {',
    '      float h = fract(A.y + t*0.06*B.x);',
    '      float st = floor(S.w*6.0); float fw = fract(S.w*6.0);',
    '      float r = A.z*(0.12 + 0.62*h)*(0.6 + 0.8*fw); float ang = A.x + st*1.0472 + h*4.0 + t*0.3;',
    '      p = vec3(cos(ang)*r, -0.55 + h*1.8, sin(ang)*r);',
    '      p.x += sin(h*5.0 + t*0.9 + st*1.7)*0.30*h; p.z += cos(h*4.0 + t*0.8 + st*2.3)*0.18*h;',
    '      lum = pow(sin(PI*h), 1.3)*(0.4 + 0.6*fw)*0.30; siz = 1.6 + h*2.6; tone = 0.22 + 0.5*h;',
    '    } else {',
    '      float h = fract(A.y + t*0.17*B.x);',
    '      float r = A.z*(0.12 + h*0.8); float ang = A.x + h*5.0 + t*0.6;',
    '      p = vec3(cos(ang)*r, -0.5 + h*1.55, sin(ang)*r); p.x += sin(t*3.0 + S.x*50.0)*0.01;',
    '      lum = (0.5 + 0.5*sin(t*9.0 + S.z*60.0))*pow(1.0 - h, 0.8)*1.1; siz = 0.75; tone = 1.0;',
    '    }',
    '  } else if (f == 4) {',                                                 // nube
    '    p = P + 0.07*vec3(sin(t*0.3 + S.x*30.0), cos(t*0.27 + S.y*30.0), sin(t*0.24 + S.z*30.0));',
    '    lum = 0.4 + 0.5*S.w; siz = 0.8 + 0.9*S.y; tone = S.z*0.75;',
    '  } else if (f == 5) {',                                                 // retícula
    '    p = P;',
    '    if (A.w < 0.5) {',
    '      float w = 0.5 + 0.5*sin(P.x*3.2 + P.y*3.2 + P.z*2.0 + t*0.8);',
    '      lum = 0.4 + 0.55*w*w; siz = 1.2 + 0.6*w; tone = 0.25 + 0.5*w;',
    '    } else if (A.w < 1.5) {',
    '      float u = fract(S.y + t*0.09*B.w); p = mix(A.xyz, B.xyz, u);',
    '      lum = 0.38 + 0.6*sin(PI*u); siz = 0.9; tone = 0.18 + 0.3*S.z;',
    '    } else {',
    '      p += 0.06*vec3(sin(t*0.5 + S.x*30.0), cos(t*0.45 + S.y*30.0), sin(t*0.4 + S.z*30.0));',
    '      lum = 0.2; siz = 0.7; tone = 0.4;',
    '    }',
    '    if (A.w < 1.5) { p.y += 0.03*sin(p.x*4.0 + t*1.1) + 0.03*sin(p.z*4.0 - t*0.9); }',
    '  } else if (f == 6) {',                                                 // flujo
    '    float u = fract(A.x + t*0.045*B.x);',
    '    float a = A.z + u*6.0 + A.y*1.7;',
    '    vec3 c = vec3((u - 0.5)*2.5, 0.28*sin(u*8.0 + A.y*2.0), 0.24*cos(u*6.0 + A.y));',
    '    p = c + vec3(0.0, cos(a), sin(a))*B.y*(0.4 + 0.6*S.w);',
    '    lum = pow(sin(PI*u), 0.6)*(0.5 + 0.5*S.y); siz = 0.95; tone = 0.12 + 0.76*u;',
    '  } else if (f == 7) {',                                                 // portal
    '    if (A.w < 0.5) {',
    '      float ang = A.y + t*B.x/(0.25 + A.x);',
    '      p = vec3(cos(ang)*A.x, (S.w - 0.5)*A.z + sin(ang*3.0 + t)*0.012, sin(ang)*A.x);',
    '      lum = mix(0.14, 0.62, smoothstep(1.05, 0.3, A.x)); siz = 0.85; tone = 1.0 - clamp((A.x - 0.3)/0.8, 0.0, 1.0);',
    '    } else if (A.w < 1.5) {',
    '      p = P + 0.025*vec3(sin(t*2.0 + S.x*40.0), cos(t*1.7 + S.y*40.0), sin(t*1.5 + S.z*40.0));',
    '      lum = 0.5; siz = 1.0; tone = 1.0;',
    '    } else {',
    '      float ang = A.y + t*0.9;',
    '      p = vec3(cos(ang)*A.x, (S.w - 0.5)*0.02, sin(ang)*A.x);',
    '      lum = 0.6; siz = 0.85; tone = 0.92;',
    '    }',
    '  } else {',                                                             // firma
    '    if (A.x > 0.5) {',
    '      p = P + 0.0025*vec3(sin(t + S.x*40.0), cos(t*1.1 + S.y*40.0), 0.0);',
    '      lum = 0.95; siz = 0.9; tone = 0.25 + 0.45*S.z;',
    '    } else {',
    '      p = P + 0.05*vec3(sin(t*0.3 + S.x*30.0), cos(t*0.27 + S.y*30.0), sin(t*0.25 + S.z*30.0));',
    '      lum = 0.22; siz = 0.8; tone = 0.4;',
    '    }',
    '  }',
    '  return p;',
    '}',
    'void main(){',
    '  float t = uTime;',
    '  float l0, s0, k0, l1, s1, k1;',
    '  vec3 p0 = behave(uF0, aP0, aA0, aB0, aSeed, t, l0, s0, k0);',
    '  vec3 p1 = behave(uF1, aP1, aA1, aB1, aSeed, t, l1, s1, k1);',
    '  float e = smoothstep(aSeed.x*0.42, aSeed.x*0.42 + 0.58, uMix);',
    '  float k = sin(PI*e);',
    '  vec3 p = mix(p0, p1, e);',
    '  vec3 q = p*1.35 + vec3(t*0.21, -t*0.17, t*0.13) + aSeed.yzw*5.0;',
    '  vec3 sw = vec3(sin(q.y*2.1) + sin(q.z*1.7), sin(q.z*2.3) + sin(q.x*1.9), sin(q.x*2.0) + sin(q.y*1.6));',
    '  p += sw*0.30*uSwirl*k;',
    '  float lum = mix(l0, l1, e);',
    '  float siz = mix(s0, s1, e)*(1.0 + 0.25*k);',
    '  float tone = mix(k0, k1, e);',
    '  p = rotY(uRot.x)*rotX(uRot.y)*p;',
    '  float persp = 1.0/(1.0 - p.z*uPersp);',
    '  vec2 px = p.xy*uUnit*persp + uCenter;',
    /* luz del cursor + empuje */
    '  float lamp = 0.0; float pf = 0.0;',
    '  vec2 d = px - uPointer; float r2 = dot(d, d);',
    '  float g = exp(-r2/(uLampR*uLampR));',
    '  px += (d/(sqrt(r2) + 1.0))*g*uPush + uPointerVel*g*0.9; lamp += g;',
    '  if (uPull > 0.002) {',                                               // mantener apretado: la nube se arremolina hacia el puntero
    '    float gb = exp(-r2/(uLampR*uLampR*6.0)); float inv = 1.0/(sqrt(r2) + 1.0);',
    '    px -= d*gb*uPull*0.62; px += vec2(-d.y, d.x)*inv*gb*uPull*38.0; pf = gb*uPull; lamp += pf*0.35;',
    '  }',
    '  for (int i = 0; i < 4; i++) {',
    '    vec4 pu = uPulse[i];',
    '    if (pu.w > 0.001) {',
    '      vec2 dd = px - pu.xy; float rr = length(dd); float fr = pu.z*520.0;',
    '      float w = exp(-((rr - fr)/46.0)*((rr - fr)/46.0))*pu.w*exp(-pu.z*1.6);',
    '      px += dd/(rr + 1.0)*w*26.0; lamp += w*0.8;',
    '    }',
    '  }',
    /* velocidad de scroll: estela vertical */
    '  float streak = clamp(abs(uVel), 0.0, 1.0);',
    '  px.y += uVel*(aSeed.w - 0.5)*70.0*persp;',
    /* barrido de escaneo */
    '  float scan = 0.0;',
    '  if (uScanW > 0.001) { float dy = p.y - uScanY; scan = exp(-dy*dy*55.0)*uScanW; }',
    /* profundidad de campo */
    '  float dof = 1.0 + abs(p.z - uFocus)*uDof;',
    '  float size = uSize*siz*persp*dof*(1.0 + lamp*0.55 + scan*0.22 - pf*0.3);',
    '  gl_PointSize = max(1.0, size*uDpr*(1.0 + streak*0.5));',
    '  gl_Position = vec4(px/(uView*0.5), 0.0, 1.0);',
    '  vec3 col = tone < 0.5 ? mix(uPalA, uPalB, tone*2.0) : mix(uPalB, uPalC, (tone - 0.5)*2.0);',
    '  col += vec3(0.85, 1.0, 1.0)*(lamp*0.30 + scan*0.4 + uFlash*0.10);',
    '  float a = clamp(lum, 0.0, 2.2)*uIntensity/(dof*dof*0.55 + 0.45);',
    '  a *= mix(1.0, 0.62, clamp(abs(p.z)*0.8, 0.0, 1.0));',
    '  vCol = col; vAlpha = a*(1.0 + lamp*0.8 + scan*0.9)*(1.0 - 0.52*k)*(1.0 - 0.7*pf); vStreak = streak;',
    '}'
  ].join('\n');

  var FS_PARTICLES = [
    '#version 300 es',
    'precision mediump float;',
    'in vec3 vCol; in float vAlpha; in float vStreak;',
    'out vec4 o;',
    'void main(){',
    '  vec2 c = gl_PointCoord*2.0 - 1.0;',
    '  c.y /= (1.0 + vStreak*2.2);',
    '  float d2 = dot(c, c);',
    '  if (d2 > 1.0) discard;',
    '  float soft = exp(-d2*3.4); float core = exp(-d2*16.0);',
    '  vec3 col = vCol*(soft*0.62 + core*0.62);',
    '  o = vec4(col*vAlpha, soft*vAlpha);',
    '}'
  ].join('\n');

  var VS_FULL = [
    '#version 300 es',
    'void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }'
  ].join('\n');

  var FS_BG = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec2 uViewPx; uniform vec3 uBg0; uniform vec3 uBg1; uniform vec3 uGlow; uniform vec2 uGlowC; uniform float uGlowI; uniform float uT; uniform float uFlash;',
    'out vec4 o;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uViewPx; float asp = uViewPx.x/uViewPx.y;',
    '  vec3 c = mix(uBg1, uBg0, uv.y);',
    '  float g = exp(-length((uv - uGlowC)*vec2(asp, 1.0))*2.3);',
    '  c += uGlow*g*uGlowI*(1.0 + uFlash*0.6);',
    '  c *= 1.0 - 0.38*smoothstep(0.35, 1.15, length((uv - 0.5)*vec2(asp, 1.0)));',
    '  c += (hash(gl_FragCoord.xy + fract(uT)*61.0) - 0.5)*(1.6/255.0);',
    '  o = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var VS_PLANE = [
    '#version 300 es',
    'precision highp float;',
    'uniform vec4 uRect; uniform vec2 uView; uniform float uVel;',
    'out vec2 vUv;',
    'void main(){',
    '  vec2 q = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));',
    '  vec2 px = uRect.xy + q*uRect.zw;',
    '  px.y += sin(q.x*3.14159)*uVel*14.0*(q.y - 0.5);',
    '  vUv = vec2(q.x, 1.0 - q.y);',
    '  gl_Position = vec4(px.x/uView.x*2.0 - 1.0, 1.0 - px.y/uView.y*2.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_PLANE = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uTex; uniform vec4 uRect; uniform vec2 uImg; uniform vec2 uPointer; uniform float uLamp;',
    'uniform float uReveal; uniform float uVel; uniform float uPar; uniform float uRadius; uniform float uGray; uniform vec3 uTint; uniform float uOpacity; uniform float uZoom; uniform float uParAmt;',
    'in vec2 vUv; out vec4 o;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }',
    'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'void main(){',
    '  float ia = uImg.x/uImg.y, ra = uRect.z/uRect.w;',
    '  vec2 sc = ra > ia ? vec2(1.0, ia/ra) : vec2(ra/ia, 1.0);',
    '  vec2 uv = (vUv - 0.5)*sc + 0.5;',
    '  uv = (uv - 0.5)/uZoom + 0.5; uv.y += uPar*uParAmt;',
    '  vec2 pxp = uRect.xy + vec2(vUv.x, 1.0 - vUv.y)*uRect.zw;',
    '  vec2 d = pxp - uPointer; float r = length(d);',
    '  float f = exp(-r*r/(150.0*150.0))*uLamp;',
    '  uv -= (d/uRect.zw)*f*0.22;',
    '  vec2 dir = d/(r + 1.0);',
    '  float ca = f*0.012 + abs(uVel)*0.006;',
    '  vec3 c = vec3(texture(uTex, uv + dir*ca).r, texture(uTex, uv).g, texture(uTex, uv - dir*ca).b);',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '  c = mix(vec3(l), c, 1.0 - uGray*(1.0 - clamp(f*1.6, 0.0, 1.0)));',
    '  c *= vec3(0.93, 0.99, 1.0);',
    '  c *= 1.0 - 0.38*smoothstep(0.32, 0.95, length(vUv - 0.5));',
    '  float n = vnoise(vUv*vec2(6.0, 8.0) + 3.0);',
    '  float tr = uReveal*1.3 - 0.15;',
    '  float m = smoothstep(n, n + 0.10, tr);',
    '  float edge = smoothstep(0.0, 0.08, tr - n)*(1.0 - smoothstep(0.08, 0.2, tr - n));',
    '  c += uTint*edge*1.4;',
    '  vec2 q = (vUv - 0.5)*uRect.zw; vec2 b = uRect.zw*0.5 - uRadius;',
    '  float dist = length(max(abs(q) - b, 0.0)) - uRadius;',
    '  float aa = 1.0 - smoothstep(-1.0, 1.0, dist);',
    '  float al = m*aa*uOpacity;',
    '  o = vec4(c*al, al);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------- formaciones */
  var F = { portrait: 0, network: 1, steam: 2, org: 3, cloud: 4, lattice: 5, flow: 6, ring: 7, wordmark: 8 };

  function setP(a, i, x, y, z, a0, a1, a2, a3, b0, b1, b2, b3) {
    var o = i * STRIDE;
    a[o] = x; a[o + 1] = y; a[o + 2] = z;
    a[o + 3] = a0; a[o + 4] = a1; a[o + 5] = a2; a[o + 6] = a3;
    a[o + 7] = b0; a[o + 8] = b1; a[o + 9] = b2; a[o + 10] = b3;
  }
  function lowerBound(cdf, v) {
    var lo = 0, hi = cdf.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < v) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function sphereDir(R) {
    var u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(ph), u, s * Math.sin(ph)];
  }

  function genCloud(N, R) {
    var a = new Float32Array(N * STRIDE);
    for (var i = 0; i < N; i++) {
      var d = sphereDir(R), r = 1.6 * Math.pow(R(), 0.6);
      setP(a, i, d[0] * r * 1.15, d[1] * r * 0.85, d[2] * r * 0.8, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    return a;
  }

  function genPortrait(N, R, map) {
    var a = new Float32Array(N * STRIDE), i = 0, d;
    var nP = Math.floor(N * 0.86);
    if (map) {
      var PW = 2 * map.w / map.h;
      for (; i < nP; i++) {
        var idx = lowerBound(map.cdf, R());
        var ix = idx % map.w, iy = (idx / map.w) | 0;
        var u = (ix + R()) / map.w, v = (iy + R()) / map.h;
        setP(a, i, (u - 0.5) * PW, (0.5 - v) * 2, (map.g[idx] / 255 - 0.35) * 0.38 + (R() - 0.5) * 0.015,
          map.r[idx] / 255, 0, 0, 0, 0, 0, 0, 0);
      }
    } else {
      for (; i < nP; i++) {          // reemplazo elíptico mientras llega el mapa
        d = sphereDir(R);
        var rr = Math.sqrt(R());
        setP(a, i, d[0] * rr * 0.55, d[1] * rr * 0.75 + 0.2, d[2] * rr * 0.2, 0.6, 0, 0, 0, 0, 0, 0, 0);
      }
    }
    for (; i < N; i++) {              // polvo alrededor
      d = sphereDir(R);
      var q = 0.85 + 1.15 * Math.pow(R(), 0.7);
      setP(a, i, d[0] * q * 0.95, d[1] * q * 1.0, d[2] * q * 0.7, 0, 1, 0, 0, 0, 0, 0, 0);
    }
    return a;
  }

  function fillGraph(N, R, nodes, edges, sh) {
    var a = new Float32Array(N * STRIDE), i = 0, k;
    var wsum = 0, ncdf = new Float32Array(nodes.length);
    for (k = 0; k < nodes.length; k++) { wsum += nodes[k].w; ncdf[k] = wsum; }
    for (k = 0; k < nodes.length; k++) ncdf[k] /= wsum;
    var esum = 0, ecdf = new Float32Array(edges.length);
    for (k = 0; k < edges.length; k++) { esum += edges[k].len; ecdf[k] = esum; }
    for (k = 0; k < edges.length; k++) ecdf[k] /= esum;
    var nNode = Math.floor(N * sh.node), nAura = Math.floor(N * sh.aura), nEdge = Math.floor(N * sh.edge), nd, e, u;
    for (k = 0; k < nNode; k++, i++) {
      nd = nodes[lowerBound(ncdf, R())];
      setP(a, i, nd.x, nd.y, nd.z, nd.x, nd.y, nd.z, 0, 0, 0, 0, 0);
    }
    for (k = 0; k < nAura; k++, i++) {
      nd = nodes[lowerBound(ncdf, R())];
      var rad = (0.04 + 0.08 * R()) * nd.s;
      setP(a, i, nd.x + rad, nd.y, nd.z, nd.x, nd.y, nd.z, 3, rad, 0.4 + 0.9 * R(), R() * TAU, 0);
    }
    for (k = 0; k < nEdge; k++, i++) {
      e = edges[lowerBound(ecdf, R())]; u = R();
      setP(a, i, lerp(e.ax, e.bx, u), lerp(e.ay, e.by, u), lerp(e.az, e.bz, u), e.ax, e.ay, e.az, 1, e.bx, e.by, e.bz, 0.6 + 0.8 * R());
    }
    for (; i < N; i++) {
      var d = sphereDir(R), q = sh.haloR * (0.55 + 0.7 * Math.pow(R(), 0.8));
      setP(a, i, d[0] * q * 1.25, d[1] * q * 0.8, d[2] * q * 0.7, 0, 0, 0, 2, 0, 0, 0, 0);
    }
    return a;
  }
  function mkEdge(n1, n2) {
    var dx = n2.x - n1.x, dy = n2.y - n1.y, dz = n2.z - n1.z;
    return { ax: n1.x, ay: n1.y, az: n1.z, bx: n2.x, by: n2.y, bz: n2.z, len: Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01 };
  }

  function genNetwork(N, R) {
    var layers = [5, 9, 12, 12, 9, 5], L = layers.length, nodes = [], byLayer = [], l, i;
    for (l = 0; l < L; l++) {
      var arr = [], n = layers[l], x0 = -1.15 + 2.3 * l / (L - 1);
      for (i = 0; i < n; i++) {
        var ang = i * 2.39996 + l * 0.7, rad = 0.66 * Math.sqrt((i + 0.5) / n) * (0.6 + 0.4 * Math.sin(Math.PI * (l + 0.5) / L));
        var nd = { x: x0 + (R() - 0.5) * 0.06, y: rad * Math.cos(ang) * 1.05, z: rad * Math.sin(ang) * 0.9, w: 1, s: 1 };
        arr.push(nd); nodes.push(nd);
      }
      byLayer.push(arr);
    }
    var edges = [];
    for (l = 0; l < L - 1; l++) {
      byLayer[l].forEach(function (n1) {
        var sorted = byLayer[l + 1].slice().sort(function (p, q) {
          function dd(m) { return (m.y - n1.y) * (m.y - n1.y) + (m.z - n1.z) * (m.z - n1.z); }
          return dd(p) - dd(q);
        });
        for (var j = 0; j < 3; j++) edges.push(mkEdge(n1, sorted[j]));
        edges.push(mkEdge(n1, byLayer[l + 1][(R() * byLayer[l + 1].length) | 0]));
      });
    }
    return fillGraph(N, R, nodes, edges, { node: 0.03, aura: 0, edge: 0.78, haloR: 1.2 });
  }

  function genOrg(N, R) {
    var nodes = [], edges = [], level = [], i;
    var leaves = 18, lx = [];
    for (i = 0; i < leaves; i++) lx.push(-1.2 + 2.4 * i / (leaves - 1));
    var l3 = lx.map(function (x, k) { var n = { x: x, y: -0.8, z: Math.sin(k * 1.7) * 0.28, w: 0.5, s: 0.7 }; nodes.push(n); return n; });
    var l2 = [];
    for (i = 0; i < 9; i++) {
      var ch = [l3[i * 2], l3[i * 2 + 1]], n2 = { x: (ch[0].x + ch[1].x) / 2, y: -0.25, z: Math.cos(i * 1.3) * 0.3, w: 1.2, s: 1 };
      nodes.push(n2); l2.push(n2); ch.forEach(function (c) { edges.push(mkEdge(n2, c)); });
    }
    var l1 = [];
    for (i = 0; i < 3; i++) {
      var ch1 = [l2[i * 3], l2[i * 3 + 1], l2[i * 3 + 2]];
      var n1 = { x: (ch1[0].x + ch1[2].x) / 2, y: 0.3, z: Math.sin(i * 2.1) * 0.25, w: 2.6, s: 1.3 };
      nodes.push(n1); l1.push(n1); ch1.forEach(function (c) { edges.push(mkEdge(n1, c)); });
    }
    var root = { x: 0, y: 0.85, z: 0, w: 6, s: 1.8 };
    nodes.push(root); l1.forEach(function (c) { edges.push(mkEdge(root, c)); });
    level = nodes;
    return fillGraph(N, R, level, edges, { node: 0.02, aura: 0.38, edge: 0.5, haloR: 1.25 });
  }

  function genSteam(N, R) {
    var a = new Float32Array(N * STRIDE), i = 0;
    var nPlate = Math.floor(N * 0.14), nEmber = Math.floor(N * 0.06);
    var radii = [0.66, 0.66, 0.6, 0.46, 0.3, 0.12];
    for (; i < nPlate; i++) {
      var rr = radii[(R() * radii.length) | 0] + (R() - 0.5) * 0.02, an = R() * TAU;
      setP(a, i, Math.cos(an) * rr, -0.62 + (rr > 0.6 ? 0.02 : 0), Math.sin(an) * rr, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    for (var k = 0; k < nEmber; k++, i++) setP(a, i, 0, 0, 0, R() * TAU, R(), 0.1 + 0.18 * R(), 2, 0.8 + 1.2 * R(), 0, 0, 0);
    for (; i < N; i++) setP(a, i, 0, 0, 0, R() * TAU, R(), 0.12 + 0.2 * R(), 1, 0.6 + 0.8 * R(), 0, 0, 0);
    return a;
  }

  function genLattice(N, R) {
    var a = new Float32Array(N * STRIDE), n = N >= 30000 ? 12 : N >= 16000 ? 10 : 8, S = 0.85, i, k;
    function pos(ix) { return (ix / (n - 1) * 2 - 1) * S; }
    var nNode = Math.floor(N * 0.28), nEdge = Math.floor(N * 0.70);
    for (i = 0; i < nNode; i++) {
      var x = pos((R() * n) | 0), y = pos((R() * n) | 0), z = pos((R() * n) | 0);
      setP(a, i, x + (R() - 0.5) * 0.014, y + (R() - 0.5) * 0.014, z + (R() - 0.5) * 0.014, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    for (k = 0; k < nEdge; k++, i++) {
      var ax = (R() * n) | 0, ay = (R() * n) | 0, az = (R() * n) | 0, axis = (R() * 3) | 0;
      var bx = ax, by = ay, bz = az;
      if (axis === 0) { if (ax < n - 1) bx++; else bx--; } else if (axis === 1) { if (ay < n - 1) by++; else by--; } else { if (az < n - 1) bz++; else bz--; }
      var u = R();
      setP(a, i, lerp(pos(ax), pos(bx), u), lerp(pos(ay), pos(by), u), lerp(pos(az), pos(bz), u), pos(ax), pos(ay), pos(az), 1, pos(bx), pos(by), pos(bz), 0.6 + 0.8 * R());
    }
    for (; i < N; i++) setP(a, i, (R() * 2 - 1) * 1.1, (R() * 2 - 1) * 1.1, (R() * 2 - 1) * 1.1, 0, 0, 0, 2, 0, 0, 0, 0);
    return a;
  }

  function genFlow(N, R) {
    var a = new Float32Array(N * STRIDE);
    for (var i = 0; i < N; i++) {
      var lane = (R() * 7) | 0;
      setP(a, i, 0, 0, 0, R(), lane, R() * TAU, 1, 0.7 + 0.6 * lane / 6, 0.06 + 0.012 * lane, 0, 0);
    }
    return a;
  }

  function genRing(N, R) {
    var a = new Float32Array(N * STRIDE), i = 0, nCore = Math.floor(N * 0.04), nPhoton = Math.floor(N * 0.08);
    for (; i < N - nCore - nPhoton; i++) {
      var r = 0.36 + 0.72 * Math.pow(R(), 1.5);
      setP(a, i, 0, 0, 0, r, R() * TAU, 0.05 + 0.05 * r, 0, 0.55, 0, 0, 0);
    }
    for (var k = 0; k < nCore; k++, i++) setP(a, i, (R() - 0.5) * 0.06, (R() - 0.5) * 0.06, (R() - 0.5) * 0.06, 0, 0, 0, 1, 0, 0, 0, 0);
    for (k = 0; k < nPhoton; k++, i++) setP(a, i, 0, 0, 0, 0.335 + (R() - 0.5) * 0.016, R() * TAU, 0, 2, 0, 0, 0, 0);
    return a;
  }

  function genWordmark(N, R, spec) {
    var a = new Float32Array(N * STRIDE), i = 0, pts = [];
    if (spec && spec.parts) {
      var cv = document.createElement('canvas'), W = 1800, H = 420;
      cv.width = W; cv.height = H;
      var cx = cv.getContext('2d'), fs = 250, fam = spec.family || 'Fraunces, Georgia, serif';
      var ls = spec.letterSpacing == null ? -0.05 : spec.letterSpacing, widths = [];
      function setFont(p, size) {
        cx.font = (p.italic ? 'italic ' : '') + (spec.weight || 300) + ' ' + size + 'px ' + fam;
        if ('letterSpacing' in cx) cx.letterSpacing = (ls * size) + 'px';
      }
      spec.parts.forEach(function (p) { setFont(p, fs); widths.push(cx.measureText(p.t).width); });
      var total = widths.reduce(function (s, w) { return s + w; }, 0), scale = Math.min(1, (W - 60) / total);
      fs = Math.floor(fs * scale);
      widths = [];
      spec.parts.forEach(function (p) { setFont(p, fs); widths.push(cx.measureText(p.t).width); });
      total = widths.reduce(function (s, w) { return s + w; }, 0);
      var x = (W - total) / 2, base = H * 0.66;
      cx.textBaseline = 'alphabetic'; cx.fillStyle = '#fff';
      spec.parts.forEach(function (p, idx) { setFont(p, fs); cx.fillText(p.t, x, base); x += widths[idx]; });
      var m = cx.measureText('Ezequiel');
      var asc = m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : fs * 0.95, desc = m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent : fs * 0.25;
      var data = cx.getImageData(0, 0, W, H).data, px, py;
      for (py = 0; py < H; py += 2) for (px = 0; px < W; px += 2) {
        if (data[(py * W + px) * 4 + 3] > 128) pts.push(px, py);
      }
      // el ancho del elemento del DOM es el avance del texto; su centro vertical queda (asc - desc)/2 sobre la línea base
      var cxm = (W - total) / 2 + total / 2, cym = base - (asc - desc) / 2, half = total / 2 || 1;
      var count = pts.length / 2, nT = Math.floor(N * 0.55);
      for (; i < nT && count; i++) {
        var q = (R() * count) | 0;
        setP(a, i, (pts[q * 2] - cxm + (R() - 0.5) * 2) / half, -(pts[q * 2 + 1] - cym + (R() - 0.5) * 2) / half, (R() - 0.5) * 0.03, 1, 0, 0, 0, 0, 0, 0, 0);
      }
    }
    for (; i < N; i++) setP(a, i, (R() * 2 - 1) * 1.25, (R() * 2 - 1) * 0.5, (R() * 2 - 1) * 0.4, 0, 0, 0, 0, 0, 0, 0, 0);
    return a;
  }

  /* ----------------------------------------------------------------- el motor */
  function Engine() {
    this.ok = false;
    this.scenes = [];
    this.planes = [];
    this.state = { s: 0, vel: 0, scrollVel: 0, flash: 0, pointerActive: false, pull: 0, pulling: false };
    this.cfg = { N: 36000, dprMax: 2, adaptive: true, reduced: false, size: 1.7 };
    this.time = 0;
    this._formations = {};
    this._bufs = {};
    this._portrait = null;
    this._wordmark = null;
    this._pulses = [];
    for (var i = 0; i < 4; i++) this._pulses.push({ x: 0, y: 0, age: 9, amp: 0 });
    this._pi = 0;
    this._pd = new Float32Array(16);
    this._ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    this._frac = 1;
    this._ema = 16;
    this._frames = 0;
    this._hooks = [];
    this._running = false;
    this._boundFrame = this._frame.bind(this);
  }

  Engine.prototype.init = function (opts) {
    var self = this;
    opts = opts || {};
    for (var k in opts) if (opts.hasOwnProperty(k) && k !== 'canvas') this.cfg[k] = opts[k];
    var canvas = this.canvas = opts.canvas;
    var gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    if (!gl) return false;
    try {
      this._progP = this._program(VS_PARTICLES, FS_PARTICLES, ['aSeed', 'aP0', 'aA0', 'aB0', 'aP1', 'aA1', 'aB1']);
      this._progBg = this._program(VS_FULL, FS_BG, []);
      this._progPl = this._program(VS_PLANE, FS_PLANE, []);
    } catch (err) {
      if (global.console) console.error(err);
      return false;
    }
    this._uP = this._uniforms(this._progP, ['uTime', 'uMix', 'uF0', 'uF1', 'uView', 'uDpr', 'uCenter', 'uUnit', 'uRot', 'uPersp', 'uSwirl', 'uPalA', 'uPalB', 'uPalC', 'uIntensity', 'uFocus', 'uDof', 'uSize', 'uPointer', 'uPointerVel', 'uLampR', 'uPush', 'uPulse', 'uVel', 'uScanY', 'uScanW', 'uFlash', 'uPull']);
    this._uB = this._uniforms(this._progBg, ['uViewPx', 'uBg0', 'uBg1', 'uGlow', 'uGlowC', 'uGlowI', 'uT', 'uFlash']);
    this._uL = this._uniforms(this._progPl, ['uRect', 'uView', 'uVel', 'uTex', 'uImg', 'uPointer', 'uLamp', 'uReveal', 'uPar', 'uRadius', 'uGray', 'uTint', 'uOpacity', 'uZoom', 'uParAmt']);
    this._vao = gl.createVertexArray();
    this._vaoEmpty = gl.createVertexArray();
    gl.bindVertexArray(this._vao);
    this._seedBuf = gl.createBuffer();
    var N = this.cfg.N, seeds = new Float32Array(N * 4), R = mulberry32(90210);
    for (var i = 0; i < seeds.length; i++) seeds[i] = R();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    for (var a = 1; a < 7; a++) gl.enableVertexAttribArray(a);
    gl.bindVertexArray(null);
    this._bound = [-1, -1];
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.stop(); self.lost = true; if (self.onLost) self.onLost(); }, false);
    canvas.addEventListener('webglcontextrestored', function () { self.lost = false; if (self.onRestored) self.onRestored(); }, false);
    this.ok = true;
    return true;
  };

  Engine.prototype._program = function (vs, fs, attribs) {
    var gl = this.gl;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attribs.forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    return p;
  };
  Engine.prototype._uniforms = function (prog, names) {
    var gl = this.gl, o = {};
    names.forEach(function (n) { o[n] = gl.getUniformLocation(prog, n); });
    return o;
  };

  /* ---- retrato: mapa de densidad ---- */
  Engine.prototype.loadPortrait = function (url) {
    var self = this;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
          c.width = w; c.height = h;
          var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
          var d = x.getImageData(0, 0, w, h).data, r = new Uint8Array(w * h), g = new Uint8Array(w * h), cdf = new Float32Array(w * h), sum = 0, i;
          for (i = 0; i < w * h; i++) {
            r[i] = d[i * 4]; g[i] = d[i * 4 + 1];
            var v = r[i] / 255; sum += Math.pow(v, 1.3) + 0.00001; cdf[i] = sum;
          }
          for (i = 0; i < cdf.length; i++) cdf[i] /= sum;
          self._portrait = { w: w, h: h, r: r, g: g, cdf: cdf };
          if (self._formations[F.portrait]) { delete self._formations[F.portrait]; self._upload(F.portrait); }
        } catch (err) { if (global.console) console.warn('Retrato:', err); }
        resolve();
      };
      img.onerror = function () { resolve(); };
      img.src = url;
    });
  };
  Engine.prototype.setWordmark = function (spec) {
    this._wordmark = spec;
    if (this._formations[F.wordmark]) { delete this._formations[F.wordmark]; this._upload(F.wordmark); }
  };

  Engine.prototype._build = function (f) {
    var N = this.cfg.N, R = mulberry32(1000 + f * 77);
    switch (f) {
      case F.portrait: return genPortrait(N, R, this._portrait);
      case F.network: return genNetwork(N, R);
      case F.steam: return genSteam(N, R);
      case F.org: return genOrg(N, R);
      case F.cloud: return genCloud(N, R);
      case F.lattice: return genLattice(N, R);
      case F.flow: return genFlow(N, R);
      case F.ring: return genRing(N, R);
      default: return genWordmark(N, R, this._wordmark);
    }
  };
  Engine.prototype._upload = function (f) {
    var gl = this.gl;
    if (!this._formations[f]) this._formations[f] = this._build(f);
    if (!this._bufs[f]) this._bufs[f] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bufs[f]);
    gl.bufferData(gl.ARRAY_BUFFER, this._formations[f], gl.STATIC_DRAW);
    this._formations[f] = true;           // liberar memoria de JS: ya vive en la GPU
    this._bound = [-1, -1];
  };
  Engine.prototype.ensure = function (f) { if (!this._bufs[f] || this._formations[f] !== true) this._upload(f); };
  Engine.prototype.prewarm = function (list) {
    var self = this, q = list.slice();
    (function step() {
      if (!q.length || !self.ok) return;
      self.ensure(q.shift());
      setTimeout(step, 50);
    })();
  };
  Engine.prototype._bind = function (f0, f1) {
    var gl = this.gl;
    if (this._bound[0] === f0 && this._bound[1] === f1) return;
    gl.bindVertexArray(this._vao);
    var stride = STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bufs[f0]);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 28);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._bufs[f1]);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribPointer(6, 4, gl.FLOAT, false, stride, 28);
    this._bound = [f0, f1];
  };

  /* ---- escenas ---- */
  Engine.prototype.setScenes = function (list) {
    var d = { f: 4, pal: [[.05, .5, .46], [.37, .92, .83], [.49, .83, .99]], bg: { glow: [.1, .45, .42], c: [.5, .5], i: .12 }, rot: [0, 0], intensity: 1, focus: 0, dof: .5, size: 1, swirl: 1, scan: 0, scanY: 0, layout: null };
    this.scenes = list.map(function (s) {
      var o = {}; for (var k in d) o[k] = d[k]; for (k in s) o[k] = s[k];
      o._lay = { cx: 0, cy: 0, unit: 300 };
      return o;
    });
  };

  Engine.prototype.resize = function (w, h) {
    var gl = this.gl, dpr = Math.min(global.devicePixelRatio || 1, this.cfg.dprMax) * (this._dprScale || 1);
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  Engine.prototype.pointer = function (x, y, active) {
    var p = this._ptr;
    if (!active) { p.tx = p.ty = -9999; this.state.pointerActive = false; return; }
    p.tx = x - this.W / 2; p.ty = this.H / 2 - y; this.state.pointerActive = true;
    this._clientX = x; this._clientY = y;
    if (p.x < -9000) { p.x = p.tx; p.y = p.ty; }
  };
  Engine.prototype.pulse = function (x, y, amp) {
    var p = this._pulses[this._pi++ & 3];
    p.x = x - this.W / 2; p.y = this.H / 2 - y; p.age = 0; p.amp = amp == null ? 1 : amp;
  };
  Engine.prototype.flash = function (v) { this.state.flash = Math.max(this.state.flash, v == null ? 1 : v); };
  Engine.prototype.onFrame = function (cb) { this._hooks.push(cb); };

  /* ---- planos de imagen ---- */
  Engine.prototype.addPlane = function (el, opts) {
    var self = this, gl = this.gl, img = el.querySelector('img');
    if (!img) return null;
    var pl = { el: el, img: img, tex: null, w: 1, h: 1, reveal: 1, gray: 0, par: 0, opacity: 1, lamp: 0, tint: [.37, .92, .83], ready: false, radius: 0, zoom: 1.14, parAmt: 0.065 };
    for (var k in (opts || {})) pl[k] = opts[k];
    function upload() {
      try {
        pl.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, pl.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        pl.w = img.naturalWidth; pl.h = img.naturalHeight; pl.ready = true;
        el.classList.add('gl-ready');
      } catch (err) { if (global.console) console.warn('Plano:', err); }
    }
    if (img.complete && img.naturalWidth) upload();
    else img.addEventListener('load', upload, { once: true });
    this.planes.push(pl);
    return pl;
  };

  /* ---- bucle ---- */
  Engine.prototype.start = function () { if (this._running || !this.ok) return; this._running = true; this._last = 0; this._raf = requestAnimationFrame(this._boundFrame); };
  Engine.prototype.stop = function () { this._running = false; cancelAnimationFrame(this._raf); };
  Engine.prototype.renderOnce = function () { this._draw(0.016); };
  Engine.prototype._frame = function (now) {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._boundFrame);
    if (document.hidden) { this._last = 0; return; }
    var dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
    this._last = now;
    this._draw(dt);
    // calidad adaptativa
    if (this.cfg.adaptive && !this.cfg.reduced) {
      this._ema = this._ema * 0.94 + dt * 1000 * 0.06;
      if (++this._frames % 90 === 0) {
        if (this._ema > 27 && this._frac > 0.4) {
          this._frac = Math.max(0.4, this._frac * 0.8);
          if (this._frac < 0.6 && !this._dprScale) { this._dprScale = 0.75; this.resize(this.W, this.H); }
          if (this.onDegrade) this.onDegrade(this._frac);
        } else if (this._ema < 15 && this._frac < 1) this._frac = Math.min(1, this._frac * 1.1);
      }
    }
  };

  var tmpLay = { cx: 0, cy: 0, unit: 300 };
  Engine.prototype._draw = function (dt) {
    var gl = this.gl, st = this.state, sc = this.scenes, ptr = this._ptr, i, k;
    if (!sc.length || !this.W) return;
    if (this.beforeDraw) this.beforeDraw(dt);
    this.time += this.cfg.reduced ? 0 : dt;
    var kP = 1 - Math.exp(-dt * 12);
    if (ptr.tx > -9000) {
      var nx = ptr.x + (ptr.tx - ptr.x) * kP, ny = ptr.y + (ptr.ty - ptr.y) * kP;
      ptr.vx = lerp(ptr.vx, (nx - ptr.x) / Math.max(dt, 0.001) * 0.02, 0.2);
      ptr.vy = lerp(ptr.vy, (ny - ptr.y) / Math.max(dt, 0.001) * 0.02, 0.2);
      ptr.x = nx; ptr.y = ny;
    } else { ptr.x = ptr.y = -9999; ptr.vx *= 0.9; ptr.vy *= 0.9; }
    st.vel = lerp(st.vel, clamp(st.scrollVel, -1, 1), 1 - Math.exp(-dt * 7));
    st.flash *= Math.exp(-dt * 2.4);
    st.pull = lerp(st.pull, st.pulling && !this.cfg.reduced ? 1 : 0, 1 - Math.exp(-dt * (st.pulling ? 5 : 11)));
    for (i = 0; i < 4; i++) { var pu = this._pulses[i]; if (pu.amp > 0) { pu.age += dt; if (pu.age > 3) pu.amp = 0; } }

    var s = clamp(st.s, 0, sc.length - 1), i0 = Math.floor(s), i1 = Math.min(i0 + 1, sc.length - 1), t = i0 === i1 ? 0 : s - i0;
    if (this.cfg.reduced) t = t < 0.5 ? 0 : 1;
    var g = ease(t), A = sc[i0], B = sc[i1];
    this.ensure(A.f); this.ensure(B.f);
    var la = A._lay, lb = B._lay;
    if (A.layout) A.layout(la, this.W, this.H); if (B.layout) B.layout(lb, this.W, this.H);
    var cx = lerp(la.cx, lb.cx, g), cy = lerp(la.cy, lb.cy, g), unit = lerp(la.unit, lb.unit, g);
    var yaw = lerp(A.rot[0], B.rot[0], g), pitch = lerp(A.rot[1], B.rot[1], g);
    var mx = ptr.x > -9000 ? clamp(ptr.x / (this.W * 0.5), -1, 1) : 0, my = ptr.y > -9000 ? clamp(ptr.y / (this.H * 0.5), -1, 1) : 0;
    yaw += mx * 0.24 + Math.sin(this.time * 0.25) * 0.05;
    pitch += -my * 0.13 + Math.sin(this.time * 0.21) * 0.025;
    var intensity = lerp(A.intensity, B.intensity, g), swirl = lerp(A.swirl, B.swirl, g);

    // ---- fondo
    var bgA = A.bg, bgB = B.bg;
    gl.disable(gl.BLEND);
    gl.useProgram(this._progBg);
    gl.bindVertexArray(this._vaoEmpty);
    var u = this._uB;
    gl.uniform2f(u.uViewPx, this.canvas.width, this.canvas.height);
    gl.uniform3f(u.uBg0, 0.024, 0.036, 0.043); gl.uniform3f(u.uBg1, 0.016, 0.022, 0.028);
    gl.uniform3f(u.uGlow, lerp(bgA.glow[0], bgB.glow[0], g), lerp(bgA.glow[1], bgB.glow[1], g), lerp(bgA.glow[2], bgB.glow[2], g));
    var gcx = lerp(la.cx, lb.cx, g) / this.W + 0.5, gcy = lerp(la.cy, lb.cy, g) / this.H + 0.5;
    gl.uniform2f(u.uGlowC, gcx, gcy);
    gl.uniform1f(u.uGlowI, lerp(bgA.i, bgB.i, g));
    gl.uniform1f(u.uT, this.time); gl.uniform1f(u.uFlash, st.flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- planos de imagen
    if (this.planes.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this._progPl);
      var ul = this._uL;
      gl.uniform2f(ul.uView, this.W, this.H); gl.uniform1f(ul.uVel, st.vel); gl.uniform1i(ul.uTex, 0);
      gl.uniform2f(ul.uPointer, ptr.x > -9000 ? ptr.x + this.W / 2 : -9999, ptr.x > -9000 ? this.H / 2 - ptr.y : -9999);
      gl.activeTexture(gl.TEXTURE0);
      for (i = 0; i < this.planes.length; i++) {
        var pl = this.planes[i];
        if (!pl.ready || pl.reveal <= 0.001) continue;
        var r = pl.el.getBoundingClientRect();
        if (r.bottom < -40 || r.top > this.H + 40 || r.width < 2) { pl.lamp = 0; continue; }
        var inside = this._clientX >= r.left && this._clientX <= r.right && this._clientY >= r.top && this._clientY <= r.bottom && this.state.pointerActive ? 1 : 0;
        pl.lamp = lerp(pl.lamp, inside, 1 - Math.exp(-dt * 6));
        if (!pl.radius) pl.radius = parseFloat(getComputedStyle(pl.el).borderTopLeftRadius) || 0;
        gl.bindTexture(gl.TEXTURE_2D, pl.tex);
        gl.uniform4f(ul.uRect, r.left, r.top, r.width, r.height);
        gl.uniform2f(ul.uImg, pl.w, pl.h);
        gl.uniform1f(ul.uLamp, this.cfg.reduced ? 0 : pl.lamp);
        gl.uniform1f(ul.uReveal, pl.reveal);
        gl.uniform1f(ul.uPar, clamp((r.top + r.height / 2 - this.H / 2) / this.H, -1, 1));
        gl.uniform1f(ul.uRadius, pl.radius);
        gl.uniform1f(ul.uGray, pl.gray);
        gl.uniform3f(ul.uTint, pl.tint[0], pl.tint[1], pl.tint[2]);
        gl.uniform1f(ul.uOpacity, pl.opacity);
        gl.uniform1f(ul.uZoom, pl.zoom); gl.uniform1f(ul.uParAmt, pl.parAmt);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    // ---- partículas
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this._progP);
    this._bind(A.f, B.f);
    gl.bindVertexArray(this._vao);
    var p = this._uP;
    gl.uniform1f(p.uTime, this.time + 12.0);
    gl.uniform1f(p.uMix, t);
    gl.uniform1i(p.uF0, A.f); gl.uniform1i(p.uF1, B.f);
    gl.uniform2f(p.uView, this.W, this.H);
    gl.uniform1f(p.uDpr, this.dpr);
    gl.uniform2f(p.uCenter, cx, cy);
    gl.uniform1f(p.uUnit, unit);
    gl.uniform2f(p.uRot, yaw, pitch);
    gl.uniform1f(p.uPersp, 0.42);
    gl.uniform1f(p.uSwirl, swirl);
    var pa = A.pal, pb = B.pal;
    gl.uniform3f(p.uPalA, lerp(pa[0][0], pb[0][0], g), lerp(pa[0][1], pb[0][1], g), lerp(pa[0][2], pb[0][2], g));
    gl.uniform3f(p.uPalB, lerp(pa[1][0], pb[1][0], g), lerp(pa[1][1], pb[1][1], g), lerp(pa[1][2], pb[1][2], g));
    gl.uniform3f(p.uPalC, lerp(pa[2][0], pb[2][0], g), lerp(pa[2][1], pb[2][1], g), lerp(pa[2][2], pb[2][2], g));
    gl.uniform1f(p.uIntensity, intensity * (this.cfg.intensity || 1));
    gl.uniform1f(p.uFocus, lerp(A.focus, B.focus, g));
    gl.uniform1f(p.uDof, lerp(A.dof, B.dof, g));
    var sizeScale = this.cfg.size * Math.pow(unit / 330, 0.9) * Math.sqrt(36000 / this.cfg.N);
    gl.uniform1f(p.uSize, lerp(A.size, B.size, g) * sizeScale * 1.7);
    var touch = ptr.x > -9000;
    gl.uniform2f(p.uPointer, touch ? ptr.x : -9999, touch ? ptr.y : -9999);
    gl.uniform2f(p.uPointerVel, ptr.vx, ptr.vy);
    gl.uniform1f(p.uLampR, this.cfg.lampR || 130);
    gl.uniform1f(p.uPush, this.cfg.reduced ? 0 : 20);
    var pd = this._pd;
    for (i = 0; i < 4; i++) { var q = this._pulses[i]; pd[i * 4] = q.x; pd[i * 4 + 1] = q.y; pd[i * 4 + 2] = q.age; pd[i * 4 + 3] = q.amp; }
    gl.uniform4fv(p.uPulse, pd);
    gl.uniform1f(p.uVel, this.cfg.reduced ? 0 : st.vel);
    var scanW = lerp(A.scan, B.scan, g);
    gl.uniform1f(p.uScanY, Math.sin(this.time * 0.55) * 0.9);
    gl.uniform1f(p.uScanW, scanW);
    gl.uniform1f(p.uFlash, st.flash);
    gl.uniform1f(p.uPull, st.pull);
    gl.drawArrays(gl.POINTS, 0, Math.floor(this.cfg.N * this._frac));

    for (k = 0; k < this._hooks.length; k++) this._hooks[k](dt, this);
  };

  global.EBScene = new Engine();
  global.EBScene.F = F;
  global.EBScene.util = { clamp: clamp, lerp: lerp, ease: ease, easeIO: easeIO };
})(window);
