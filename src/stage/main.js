/*!
 * Ezequiel Brunner — escena 3D de marca: la señal.
 * Cientos de líneas finas, como una señal de datos, dibujan el retrato en relieve en la portada.
 * Al bajar, las mismas líneas se transforman según la sección (cada sección declara data-stage="…"):
 * ondas que enmarcan la nota destacada, un trazo propio para IA, Gastronomía y Personas,
 * del ruido al orden en el método y un foco que converge detrás del formulario. Three.js r187.
 *
 * Compilar:  npx esbuild src/stage/main.js --bundle --minify --format=iife --outfile=assets/js/stage.js
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Group, Mesh, PlaneGeometry, ShaderMaterial, BufferGeometry,
  Float32BufferAttribute, Points, AdditiveBlending, TextureLoader, LinearFilter, ACESFilmicToneMapping,
  WebGLRenderTarget, HalfFloatType, Vector2, Vector3, Vector4, BufferAttribute, DoubleSide
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const BG = 0x1e2225; // grafito antes del mapeo de tonos (#0c1013 en pantalla)

/* Formas de las líneas: 0 retrato · 1 campo de señal · 2 tres trazos · 3 paisaje · 4 del ruido al orden · 5 foco */
const STATES = {
  hero: { anchor: '.hero-visual', size: 1, type: 0, amp: 0.3, p3: [1.48, -0.1, 2.22, 0.028], alpha: 1, width: 1, bloom: 0.16, az: -0.16, el: 0.07 },
  pubs: { anchor: '.pub-cover', size: 0.9, type: 1, amp: 0.13, freq: 8.5, speed: 0.7, p3: [2.6, 0.86, 0, 0], alpha: 0.95, width: 0.95, bloom: 0.55, az: 0, el: 0, stride: 3 },
  services: { anchor: '.svc-tabs', size: 0.92, type: 2, amp: 0.2, p2: [0, 0, 0, 0], p3: [0, 0, 0, 0], alpha: 1, width: 1, bloom: 0.5, az: 0, el: 0.04, stride: 2 },
  'svc-ia': { anchor: '.svc-ia .svc-visual', size: 0.9, sizeM: 0.84, type: 3, variant: 0, amp: 0.34, alpha: 1, width: 1, bloom: 0.45, az: -0.22, el: 0.16, stride: 2 },
  'svc-gas': { anchor: '.svc-gas .svc-visual', size: 0.9, sizeM: 0.84, type: 3, variant: 1, amp: 0.36, alpha: 1, width: 1, bloom: 0.45, az: 0.22, el: 0.16, stride: 2 },
  'svc-per': { anchor: '.svc-per .svc-visual', size: 0.9, sizeM: 0.84, type: 3, variant: 2, amp: 0.3, alpha: 1, width: 1, bloom: 0.4, az: -0.16, el: 0.16, stride: 2 },
  metodo: { anchor: '.metodo-visual', size: 0.9, type: 4, amp: 0.2, alpha: 1, width: 1, bloom: 0.4, az: 0.18, el: 0.1, stride: 2 },
  about: { anchor: '.about .photo', size: 1.06, aspMul: 1.32, type: 1, amp: 0.05, freq: 6, speed: 0.4, p3: [1.6, 0.9, 0, 0], alpha: 0.4, width: 0.8, bloom: 0.4, az: 0, el: 0, stride: 3 },
  contact: { anchor: '.contact form', size: 1.02, aspMul: 1.12, type: 5, amp: 0.9, alpha: 0.75, alphaM: 0.55, width: 0.9, bloom: 0.6, az: 0, el: 0, stride: 3 },
  frame: { anchor: '.page-hero-media', size: 1.08, aspMul: 1.55, type: 1, amp: 0.09, freq: 7, speed: 0.6, p3: [2.2, 0.88, 0, 0], alpha: 0.75, width: 0.9, bloom: 0.5, az: 0, el: 0, stride: 3 },
  park: { anchor: null, pos: [0.5, 0.5], size: 0.9, type: 1, amp: 0.05, freq: 6, speed: 0.4, p3: [2, 0.9, 0, 0], alpha: 0, width: 0.8, bloom: 0.3, az: 0, el: 0, stride: 3 }
};
STATES.ambient = STATES.park;

const LINE_VS = `
attribute float aLine; attribute float aU; attribute float aSide;
uniform float uN, uDu, uTime, uMix, uWave, uDpr, uScale, uScanY, uScan, uMapOn, uSA, uSB;
uniform vec2 uRes;
uniform vec4 uA, uA2, uA3, uB, uB2, uB3;
uniform vec3 uPtr;
uniform sampler2D uMap;
varying vec3 vCol; varying float vAlpha; varying float vSide; varying float vHalf;

const vec3 TURQ = vec3(0.37, 0.92, 0.83);
const vec3 AMBER = vec3(0.95, 0.72, 0.5);
const vec3 IVORY = vec3(0.95, 0.91, 0.86);

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y) * 2.0 - 1.0;
}

struct S { vec3 p; float b; float w; vec3 c; };

S shape(vec4 P, vec4 P2, vec4 P3, float li, float u){
  S s;
  int type = int(P.x + 0.5);
  float asp = P.y, amp = P.z, t = uTime;
  float x = (u * 2.0 - 1.0) * asp, y = li * 2.0 - 1.0;
  float env = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
  s.p = vec3(x, y, 0.0); s.b = 0.4; s.w = 1.0; s.c = IVORY;
  if (type == 0) {
    // retrato: el tono decide el grosor y el brillo de cada línea (como un grabado); el relieve, la profundidad
    vec2 uv = vec2(x / P3.x + 0.5, (y - P3.y) / P3.z + 0.5);
    vec4 m = vec4(0.0); float eL = 0.0, eR = 0.0;
    if (uv.x > 0.001 && uv.x < 0.999 && uv.y > 0.001 && uv.y < 0.999) {
      m = texture2D(uMap, uv);
      eL = clamp(m.b - texture2D(uMap, uv + vec2(-0.035, 0.0)).b, 0.0, 1.0);
      eR = clamp(m.b - texture2D(uMap, uv + vec2(0.035, 0.0)).b, 0.0, 1.0);
    }
    float fadeY = smoothstep(0.02, 0.3, uv.y);
    float fadeX = smoothstep(0.02, 0.24, uv.x) * smoothstep(0.98, 0.76, uv.x);
    float mask = m.b * uMapOn * fadeY * mix(1.0, fadeX, smoothstep(0.62, 0.3, uv.y));
    float tn = smoothstep(0.06, 0.82, m.r), h = m.g;
    // fuera del retrato, una señal tenue que se apaga hacia los bordes
    float vig = smoothstep(1.08, 0.45, length(vec2(x / max(asp, 0.6) * 0.95, y * 1.02)));
    float sig = sin(u * 17.0 + t * 0.9 + li * 7.0) * 0.6 + sin(u * 6.0 - t * 0.55 + li * 3.0) * 0.4;
    float bg = (1.0 - mask) * env * vig;
    s.p.y += bg * 0.012 * sig + mask * h * P3.w;
    s.p.z = mask * h * amp;
    s.b = mix(0.1 * env * vig, 0.1 + 0.62 * tn * tn + 0.12 * tn, mask);
    s.w = mix(0.5, 0.16 + 3.1 * tn * tn * (3.0 - 2.0 * tn) * 0.92 + 0.12 * tn, mask);
    float side = clamp(uv.x, 0.0, 1.0);
    vec3 lit = mix(mix(IVORY, TURQ, 0.28), mix(IVORY, AMBER, 0.3), smoothstep(0.3, 0.7, side));
    s.c = mix(mix(TURQ, IVORY, 0.25), lit, mask);
    // luz de contorno: turquesa a la izquierda, ámbar a la derecha
    float rim = (eL + eR) * fadeY * mix(0.35, 1.0, smoothstep(0.5, 0.62, uv.y));
    s.c = mix(s.c, mix(TURQ, AMBER, step(0.5, eR - eL + 0.5)) * 1.25, clamp(rim * 1.6, 0.0, 0.85));
    s.b += rim * 0.45;
    s.w = max(s.w, mix(s.w, 1.4, clamp(rim * 2.0, 0.0, 1.0)));
  } else if (type == 1) {
    // campo de señal: ondas suaves y un pulso que recorre las líneas
    float ph = li * P3.x;
    float wv = sin(u * P2.z + t * P2.w + ph) * 0.62 + sin(u * P2.z * 0.43 - t * P2.w * 0.7 + li * 5.0) * 0.38;
    float pulse = exp(-pow((u - fract(t * 0.06 + li * 0.18)) * 8.0, 2.0));
    s.p.y = y * P3.y + amp * env * (wv * 0.5 + pulse * 0.55);
    s.p.z = amp * 0.6 * wv * env;
    s.b = (0.24 + 0.52 * env + pulse * 0.3 * env);
    s.w = 0.75 + pulse * 0.45;
    s.c = mix(TURQ, IVORY, clamp(li * 0.7 + pulse * 0.35, 0.0, 1.0));
  } else if (type == 2) {
    // tres trazos: IA (escalones de datos), Gastronomía (curvas suaves), Personas (líneas que se entrelazan)
    float gi = floor(min(li * 3.0, 2.999));
    float lj = clamp(li * 3.0 - gi, 0.0, 1.0);
    float colW = asp * 2.0 / 3.0;
    float cx = -asp + colW * (gi + 0.5);
    s.p.x = cx + (u * 2.0 - 1.0) * colW * 0.5 * 0.84;
    s.p.y = (lj * 2.0 - 1.0) * 0.72;
    float mid = 0.35 + 0.65 * sin(lj * 3.14159);
    float dy;
    if (gi < 0.5) {
      float v = sin(u * 12.566 + t * 1.1 + lj * 2.6);
      dy = floor(v * 2.5 + 0.5) / 2.5 * 0.55;
      s.c = TURQ;
    } else if (gi < 1.5) {
      dy = (sin(u * 9.42 + t * 0.75 + lj * 4.0) * 0.6 + sin(u * 3.1 - t * 0.5 + lj) * 0.4) * 0.5;
      s.c = AMBER;
    } else {
      dy = sin(u * 6.283 * (1.0 + lj * 0.55) + lj * 9.0 + t * 0.7) * 0.48;
      s.c = IVORY;
    }
    s.p.y += amp * dy * env * mid;
    s.p.z = amp * 0.5 * dy * env;
    s.b = 0.42 + 0.62 * env * mid;
    s.w = 1.0;
  } else if (type == 3) {
    // paisajes de líneas: cada servicio tiene su relieve
    float v = P.w;
    float H;
    if (v < 0.5) {
      float n = vnoise(vec2(x * 1.7 + t * 0.04, li * 3.6)) * 0.5 + 0.5;
      H = floor(n * 5.0) / 5.0 * exp(-x * x * 1.1) * smoothstep(0.0, 0.35, li) * smoothstep(1.0, 0.6, li);
      s.c = mix(TURQ, IVORY, H * 0.5);
    } else if (v < 1.5) {
      H = (sin(x * 2.6 + li * 5.0 + t * 0.22) * 0.5 + 0.5) * (sin(x * 1.2 - li * 3.0 - t * 0.12) * 0.5 + 0.5);
      H = pow(H, 0.6) * 1.15 * exp(-x * x * 0.7) * smoothstep(0.0, 0.3, li) * smoothstep(1.0, 0.65, li);
      s.c = mix(AMBER, IVORY, H * 0.45);
    } else {
      H = 0.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k);
        vec2 c = vec2(sin(fk * 2.4 + 0.6) * 0.62, 0.22 + 0.12 * fk + 0.05 * sin(t * 0.3 + fk));
        H += exp(-(pow(x - c.x * asp * 0.9, 2.0) * 9.0 + pow(li - c.y, 2.0) * 60.0));
      }
      H = min(H, 1.0);
      s.c = mix(IVORY, AMBER, H * 0.55);
    }
    float fade = smoothstep(0.0, 0.2, u) * smoothstep(1.0, 0.8, u) * smoothstep(0.0, 0.16, li) * smoothstep(1.0, 0.84, li);
    s.p.y = (li * 2.0 - 1.0) * 0.84 + H * amp * env;
    s.p.z = (0.5 - li) * 0.3 + H * amp * 0.4;
    s.b = (0.34 + 0.75 * H) * fade;
    s.w = 0.7 + 0.8 * H;
  } else if (type == 4) {
    // del ruido al orden: arriba el diagnóstico, en el medio el plan, abajo la implementación
    float chaos = smoothstep(0.3, 1.0, li);
    float n = vnoise(vec2(u * 5.5 + t * 0.12, li * 9.0)) * 0.7 + vnoise(vec2(u * 13.0 - t * 0.2, li * 4.0 + 7.0)) * 0.3;
    s.p.y = (li * 2.0 - 1.0) * 0.84 + chaos * amp * n * env;
    s.p.z = chaos * amp * 0.6 * vnoise(vec2(u * 4.0 - t * 0.1, li * 5.0 + 3.0));
    s.c = li > 0.62 ? mix(AMBER, TURQ, smoothstep(0.62, 0.85, li)) : mix(IVORY, AMBER, smoothstep(0.3, 0.6, li));
    s.b = 0.28 + 0.55 * env;
    s.w = 0.65 + 0.5 * (1.0 - chaos);
  } else {
    // foco: las líneas convergen hacia el centro
    float pinch = exp(-pow((u - 0.5) * 3.0, 2.0));
    s.p.y = (li * 2.0 - 1.0) * 0.9 * mix(1.0, 0.1, pinch * amp);
    s.p.z = pinch * 0.12 * sin(li * 6.283 + t * 0.8);
    s.b = (0.22 + 0.6 * pinch) * env;
    s.w = 0.7 + 0.6 * pinch;
    s.c = mix(IVORY, TURQ, pinch);
  }
  return s;
}

vec3 posAt(float li, float u, out float br, out float w, out vec3 col){
  S a = shape(uA, uA2, uA3, li, u);
  S b = shape(uB, uB2, uB3, li, u);
  vec3 p = mix(a.p, b.p, uMix);
  br = mix(a.b * uA2.x, b.b * uB2.x, uMix);
  w = mix(a.w * uA2.y, b.w * uB2.y, uMix);
  col = mix(a.c, b.c, uMix);
  // al pasar de una sección a otra, la señal ondula
  float sw = sin(3.14159 * u);
  p.y += uWave * 0.07 * sin(u * 8.0 - uTime * 2.6 + li * 11.0) * sw;
  p.z += uWave * 0.12 * sin(u * 5.0 + uTime * 1.7 + li * 7.0) * sw;
  // lente sutil bajo el cursor
  vec2 d = p.xy - uPtr.xy;
  float k = exp(-dot(d, d) / 0.05) * uPtr.z;
  p.y += d.y * k * 0.5; p.z += k * 0.1;
  br *= 1.0 + k * 0.5;
  // barrido de luz de entrada
  br *= 1.0 + uScan * 1.4 * exp(-pow((p.y - uScanY) * 7.0, 2.0));
  return p;
}

void main(){
  float keep = mix(1.0 - step(0.5, mod(aLine, uSA)), 1.0 - step(0.5, mod(aLine, uSB)), uMix);
  if (keep < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; vCol = vec3(0.0); vSide = 0.0; vHalf = 0.5; return; }
  float li = (aLine + 0.5) / uN;
  float br, w, br2, w2; vec3 col, col2;
  vec3 p = posAt(li, aU, br, w, col);
  bool last = aU > 1.0 - uDu * 0.5;
  vec3 q = posAt(li, last ? aU - uDu : aU + uDu, br2, w2, col2);
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
  vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 dir = last ? s0 - s1 : s1 - s0;
  float L = length(dir);
  dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wpx = max(w, 0.0) * uScale * uDpr;
  float hw = max(wpx, 1.0) * 0.5;
  c0.xy += nrm * aSide * (hw + 1.0) / (uRes * 0.5) * c0.w;
  gl_Position = c0;
  vSide = aSide; vHalf = hw;
  vAlpha = clamp(br, 0.0, 2.0) * min(wpx, 1.0) * keep;
  vCol = col;
}`;

const LINE_FS = `
varying vec3 vCol; varying float vAlpha; varying float vSide; varying float vHalf;
void main(){
  float d = abs(vSide) * (vHalf + 1.0);
  float a = clamp(vHalf + 0.5 - d, 0.0, 1.0) * vAlpha;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vCol * a, a);
}`;

const BACK_VS = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BACK_FS = `
uniform float uDim; varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5; float r = length(q * vec2(1.0, 1.15));
  vec3 base = vec3(0.0128, 0.0159, 0.0182);                         // = #0c1013 tras el mapeo de tonos
  vec3 halo = vec3(0.010, 0.015, 0.017) * smoothstep(0.42, 0.0, r);
  halo += vec3(0.0, 0.010, 0.009) * smoothstep(0.3, 0.0, length(q - vec2(-0.1, 0.05)));
  halo += vec3(0.012, 0.0065, 0.0017) * smoothstep(0.28, 0.0, length(q - vec2(0.12, -0.07)));
  gl_FragColor = vec4(base + halo * uDim, 1.0);
}`;

const DUST_VS = `
attribute float aSize; attribute float aSeed; attribute vec3 aColor;
uniform float uTime; uniform float uPx; uniform float uDim;
varying vec3 vColor; varying float vA;
void main(){
  vec3 p = position;
  p.y += sin(uTime * 0.18 + aSeed * 21.0) * 0.12;
  p.x += cos(uTime * 0.13 + aSeed * 17.0) * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPx / max(0.5, -mv.z), uPx * 0.14);
  vColor = aColor;
  vA = uDim * (0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.1 + aSeed * 40.0)));
}`;
const DUST_FS = `
varying vec3 vColor; varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, 1.6) * vA;
  gl_FragColor = vec4(vColor * a, a);
}`;

class Stage {
  constructor() {
    this.ready = false;
    this.states = [];
    this.s = 0;
    this.time = 0;
    this.alive = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0, px: -1, py: -1, on: 0 };
    this.onReady = null;
  }

  init(opts) {
    this.opts = opts;
    const canvas = (this.canvas = opts.canvas);
    const tier = (this.tier = opts.tier);
    const renderer = (this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve }));
    renderer.setClearColor(BG, 1);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    this.dprCap = tier >= 2 ? 2 : tier === 1 ? 1.75 : 1.3;

    const scene = (this.scene = new Scene());
    scene.background = new Color(BG);
    this.camera = new PerspectiveCamera(30, 1, 0.05, 80);
    this.rig = new Group(); scene.add(this.rig);

    // las líneas
    const N = (this.N = tier >= 2 ? 150 : tier === 1 ? 124 : 96);
    const P = (this.P = tier >= 2 ? 320 : tier === 1 ? 240 : 180);
    const nv = N * P * 2, aLine = new Float32Array(nv), aU = new Float32Array(nv), aSide = new Float32Array(nv), pos = new Float32Array(nv * 3);
    const idx = new Uint32Array(N * (P - 1) * 6);
    let v = 0, k = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < P; j++) {
        for (let s = 0; s < 2; s++) { aLine[v] = i; aU[v] = j / (P - 1); aSide[v] = s ? 1 : -1; v++; }
        if (j < P - 1) {
          const a = (i * P + j) * 2;
          idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2;
          idx[k++] = a + 1; idx[k++] = a + 3; idx[k++] = a + 2;
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aLine', new Float32BufferAttribute(aLine, 1));
    g.setAttribute('aU', new Float32BufferAttribute(aU, 1));
    g.setAttribute('aSide', new Float32BufferAttribute(aSide, 1));
    g.setIndex(new BufferAttribute(idx, 1));   // índice de 32 bits: hay más de 65.535 vértices
    this.lineMat = new ShaderMaterial({
      vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide,
      blending: AdditiveBlending, premultipliedAlpha: true,
      uniforms: {
        uN: { value: N }, uDu: { value: 1 / (P - 1) }, uTime: { value: 0 }, uMix: { value: 0 }, uWave: { value: 0 },
        uDpr: { value: 1 }, uScale: { value: 1 }, uScanY: { value: 9 }, uScan: { value: 0 }, uMapOn: { value: 0 }, uSA: { value: 1 }, uSB: { value: 1 },
        uRes: { value: new Vector2(1, 1) }, uPtr: { value: new Vector3(0, 0, 0) }, uMap: { value: null },
        uA: { value: new Vector4() }, uA2: { value: new Vector4() }, uA3: { value: new Vector4() },
        uB: { value: new Vector4() }, uB2: { value: new Vector4() }, uB3: { value: new Vector4() }
      }
    });
    this.lines = new Mesh(g, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
    this.rig.add(this.lines);

    // mapa del retrato (tono, relieve y silueta)
    if (opts.portrait) new TextureLoader().load(opts.portrait, (t) => {
      t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = false;
      this.lineMat.uniforms.uMap.value = t;
      this.portraitReady = true;
    });

    // fondo de estudio
    this.backMat = new ShaderMaterial({ vertexShader: BACK_VS, fragmentShader: BACK_FS, depthWrite: false, depthTest: false, uniforms: { uDim: { value: 1 } } });
    this.back = new Mesh(new PlaneGeometry(30, 30), this.backMat);
    this.back.position.set(0, 0, -6);
    this.back.renderOrder = -1;
    this.rig.add(this.back);

    // polvo en suspensión
    this.dust = this._dust(tier >= 2 ? 1100 : tier === 1 ? 700 : 380);
    this.rig.add(this.dust);

    // posproceso: brillo suave y salida con mapeo de tonos
    const size = this._size();
    const rt = new WebGLRenderTarget(size.w, size.h, { type: HalfFloatType, samples: tier >= 1 ? 4 : 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(size.w, size.h), 0.4, 0.45, 0.82);
    this.bloom.enabled = tier >= 1;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    this._frame = this._frame.bind(this);
    return true;
  }

  _dust(n) {
    const g = new BufferGeometry(), pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n), col = new Float32Array(n * 3);
    const t = new Color(0x5eead4), a = new Color(0xe8b98a), w = new Color(0xdfeaea);
    for (let i = 0; i < n; i++) {
      const r = 1.4 + Math.pow(Math.random(), 0.7) * 4.6, th = Math.random() * TAU, ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.5; pos[i * 3 + 1] = Math.cos(ph) * r * 0.8; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 1.2;
      size[i] = 0.5 + Math.random() * 2; seed[i] = Math.random();
      const c = Math.random() < 0.5 ? t : Math.random() < 0.6 ? w : a;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    g.setAttribute('aColor', new Float32BufferAttribute(col, 3));
    this.dustMat = new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: 30 }, uDim: { value: 1 } } });
    const p = new Points(g, this.dustMat);
    p.frustumCulled = false;
    return p;
  }

  _size() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap) * (this._dprScale || 1);
    return { cw: w, ch: h, w: Math.round(w * dpr), h: Math.round(h * dpr), dpr };
  }

  resize() {
    const s = this._size();
    if (s.cw === this.W && s.ch === this.H && s.dpr === this.dpr) return;
    this.W = s.cw; this.H = s.ch; this.dpr = s.dpr;
    this.renderer.setPixelRatio(s.dpr);
    this.renderer.setSize(s.cw, s.ch, false);
    this.composer.setPixelRatio(s.dpr);
    this.composer.setSize(s.cw, s.ch);
    this.camera.aspect = s.cw / s.ch;
    this.camera.updateProjectionMatrix();
    this.lineMat.uniforms.uRes.value.set(s.w, s.h);
    this.lineMat.uniforms.uDpr.value = s.dpr;
    this.dustMat.uniforms.uPx.value = 22 * s.dpr * (s.ch / 900);
  }

  /* -- estados a partir del DOM */
  setStates(els) {
    this.states = els.map((el) => {
      const name = el.getAttribute('data-stage');
      const def = STATES[name] || STATES.park;
      const st = Object.assign({ name, el }, def);
      const sel = el.getAttribute('data-stage-anchor') || def.anchor;
      st.anchorEl = sel ? el.querySelector(sel) || document.querySelector(sel) : null;
      st.lay = { cx: 0, cy: 0, r: 100, asp: 1 };
      return st;
    });
  }

  _layout(st, out) {
    const W = this.W, H = this.H, m = W <= 820;
    const size = (m && st.sizeM) || st.size || 1;
    if (st.anchorEl) {
      const r = st.anchorEl.getBoundingClientRect();
      out.r = Math.max(20, (r.height / 2) * size);
      out.cx = r.left + r.width / 2;
      out.cy = r.top + r.height / 2;
      out.asp = (r.width / Math.max(1, r.height)) * (st.aspMul || 1);
    } else {
      const p = (m && st.posM) || st.pos || [0.5, 0.5];
      out.r = (size * Math.min(W, H)) / 2;
      out.cx = p[0] * W; out.cy = p[1] * H;
      out.asp = st.aspMul || 1.6;
    }
  }

  _put(st, a, a2, a3, asp) {
    const m = this.W <= 820, p3 = st.p3 || [0, 0, 0, 0];
    a.set(st.type, asp, st.amp || 0, st.variant || 0);
    a2.set(m && st.alphaM != null ? st.alphaM : st.alpha, st.width || 1, st.freq || 0, st.speed || 0);
    a3.set(p3[0], p3[1], p3[2], p3[3]);
  }

  start() {
    if (this._running) return;
    this._running = true; this._last = performance.now();
    requestAnimationFrame(this._frame);
  }
  stop() { this._running = false; }

  _frame(now) {
    if (!this._running) return;
    requestAnimationFrame(this._frame);
    if (document.hidden) { this._last = now; return; }
    const dt = Math.min(0.05, (now - this._last) / 1000 || 0.016);
    this._last = now;
    this.render(dt);
    // calidad adaptativa: si cuesta sostener la fluidez, primero se apaga el brillo y después baja la resolución
    if (this.opts.adaptive) {
      this._ema = this._ema == null ? 16 : this._ema * 0.95 + dt * 1000 * 0.05;
      this._n = (this._n || 0) + 1;
      if (this._n % 120 === 0 && this._ema > 26) {
        if (this.bloom.enabled) this.bloom.enabled = false;
        else if (!this._dprScale || this._dprScale > 0.6) { this._dprScale = (this._dprScale || 1) * 0.8; this.resize(); }
        if (this.onDegrade) this.onDegrade();
      }
    }
  }

  render(dt) {
    const st = this.states;
    if (!st.length || !this.W) return;
    if (this.beforeRender) this.beforeRender(dt);
    const reduced = this.opts.reduced;
    const s = clamp(this.s, 0, st.length - 1), i0 = Math.floor(s), i1 = Math.min(i0 + 1, st.length - 1);
    const t = i0 === i1 ? 0 : s - i0, g = ease(t);
    const A = st[i0], B = st[i1];
    this._layout(A, A.lay); this._layout(B, B.lay);
    const cx = lerp(A.lay.cx, B.lay.cx, g), cy = lerp(A.lay.cy, B.lay.cy, g), rpx = lerp(A.lay.r, B.lay.r, g);
    if (!reduced) this.time += dt;

    // puntero suavizado (reacción sutil)
    const p = this.pointer, kp = 1 - Math.exp(-dt * 3);
    p.x += (p.tx - p.x) * kp; p.y += (p.ty - p.y) * kp;

    // cámara: desplazamiento de lente para ubicar las líneas sobre su ancla; una unidad = media altura del ancla
    const fov = (this.camera.fov * Math.PI) / 180;
    const d = (this.H / 2) / (rpx * Math.tan(fov / 2));
    const az = lerp(A.az || 0, B.az || 0, g) + p.x * 0.06;
    const el = lerp(A.el || 0, B.el || 0, g) - p.y * 0.045;
    const cam = this.camera;
    cam.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(this.W, this.H, this.W / 2 - cx, this.H / 2 - cy, this.W, this.H);
    cam.near = Math.max(0.02, d - 8); cam.far = d + 10; cam.updateProjectionMatrix();

    // formas de origen y destino, y la mezcla entre ambas
    const u = this.lineMat.uniforms;
    const asp = lerp(A.lay.asp, B.lay.asp, g);
    this._put(A, u.uA.value, u.uA2.value, u.uA3.value, asp);
    this._put(B, u.uB.value, u.uB2.value, u.uB3.value, asp);
    u.uMix.value = g;
    u.uSA.value = A.stride || 1; u.uSB.value = B.stride || 1;
    u.uWave.value = reduced ? 0 : Math.sin(Math.PI * t) * (A.name === 'hero' ? 1 : 0.6);
    u.uTime.value = this.time;
    u.uScale.value = clamp(rpx / 290, 0.7, 1.35);
    u.uMapOn.value = this.portraitReady ? 1 : 0;
    // el cursor dibuja una lente en las líneas (coordenadas locales de la forma)
    const on = p.px >= 0 && !reduced ? 1 : 0;
    p.on += (on - p.on) * kp;
    u.uPtr.value.set((p.px - cx) / rpx, -(p.py - cy) / rpx, p.on * 0.9);
    if (this._sweepT != null) {
      this._sweepT += dt;
      u.uScanY.value = 1.3 - this._sweepT * 1.25; u.uScan.value = Math.sin(Math.min(1, this._sweepT / 2.1) * Math.PI);
      if (this._sweepT > 2.1) { this._sweepT = null; u.uScan.value = 0; }
    }

    this.bloom.strength = lerp(A.bloom, B.bloom, g);
    this.dustMat.uniforms.uTime.value = this.time * 2.0;
    const a = lerp(A.alpha, B.alpha, g);
    const transit = 1 - 0.45 * Math.sin(Math.PI * t);   // al cruzar entre secciones, las líneas se atenúan y el texto manda
    u.uA2.value.x *= transit; u.uB2.value.x *= transit;
    this.dustMat.uniforms.uDim.value = 0.42 * (0.4 + 0.6 * a);
    this.backMat.uniforms.uDim.value = 0.55 + 0.45 * a;

    this.composer.render(dt);
    this._rw = (this._rw || 0) + dt;
    if (!this.ready && (this.portraitReady || !this.opts.portrait || this._rw > 3)) {
      this.ready = true;
      if (this.onReady) this.onReady();
    }
  }

  sweep() { this._sweepT = 0; }
}

/* ------------------------------------------------------------------ arranque */
const EBStage = {
  STATES,
  boot(opts) {
    try {
      const stage = new Stage();
      stage.init(opts);
      this.stage = stage;
      return stage;
    } catch (err) {
      if (window.console) console.warn('Escena 3D no disponible:', err);
      return null;
    }
  }
};
window.EBStage = EBStage;
