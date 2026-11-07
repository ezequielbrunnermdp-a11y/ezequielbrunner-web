/*!
 * Ezequiel Brunner — escena 3D de marca: el giroscopio.
 * Tres anillos orbitan alrededor del retrato: datos (vidrio turquesa), operación
 * (metal grafito con marcas ámbar) y personas (cerámica marfil con nodos cálidos).
 * Al bajar, la cámara se mueve y los anillos cambian de formación según la sección
 * (cada sección declara data-stage="…"). Three.js r187.
 *
 * Compilar:  npx esbuild src/stage/main.js --bundle --minify --format=iife --outfile=assets/js/stage.js
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, Group, Mesh, TorusGeometry, PlaneGeometry, SphereGeometry,
  BoxGeometry, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, InstancedMesh, Object3D,
  Quaternion, Euler, Vector3, DirectionalLight, PointLight, PMREMGenerator, BackSide, DoubleSide, TextureLoader,
  SRGBColorSpace, ACESFilmicToneMapping, BufferGeometry, Float32BufferAttribute, Points, AdditiveBlending,
  WebGLRenderTarget, HalfFloatType, Vector2
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const C = { bg: 0x1e2225, turq: 0x5eead4, amber: 0xe8b98a, ivory: 0xefe6d8, metal: 0x30383d };

/* ------------------------------------------------------------------ estados
   rings: [rx, ry, rz, escala, brillo, dx, dy, dz]  (orientación, tamaño, luz y desplazamiento de cada anillo)
   orden de los anillos: 0 datos · 1 operación · 2 personas                                                  */
const STATES = {
  hero: {
    anchor: '.hero-visual', fit: 'min', size: 1, ref: 1.66, center: [0, 0.02], az: -0.3, el: 0.24, portrait: 1, dim: 1, bloom: 0.42, spin: 1,
    rings: [[-1.42, 0.1, 0.06, 0.86, 1, 0, -0.42, 0], [-1.5, -0.12, -0.05, 0.84, 1, 0, -0.5, 0], [-1.36, 0.14, 0.08, 0.8, 1, 0, -0.36, 0]]
  },
  pubs: {
    anchor: '.pub-cover', fit: 'min', size: 0.96, ref: 1.62, center: [0, 0], az: 0, el: 0, portrait: 0, dim: 1, bloom: 0.8, spin: 0.55,
    rings: [[0, 0, 0, 1.08, 1.5, 0, 0, 0], [0.42, 0.5, 0.15, 1.12, 0.7, 0, 0, -0.3], [-0.5, -0.55, 0.35, 1.18, 0.6, 0, 0, -0.5]]
  },
  services: {
    anchor: '.svc-tabs', fit: 'w', size: 1, ref: 3.6, center: [0, 0], az: 0, el: 0.05, portrait: 0, dim: 0.85, bloom: 0.55, spin: 0.5,
    rings: [[0.25, 0.3, 0, 0.56, 1, -2.4, 0, 0], [0.3, -0.2, 0.2, 0.56, 1, 0, 0, 0], [0.2, 0.35, -0.2, 0.56, 1, 2.4, 0, 0]]
  },
  'svc-ia': {
    anchor: '.svc-ia .svc-visual', fit: 'min', size: 1, sizeM: 0.86, ref: 2.0, center: [0, 0], az: -0.3, el: 0.1, portrait: 0, dim: 1, bloom: 0.75, spin: 0.8,
    rings: [[0.5, 0.45, 0.1, 1.1, 1.6, 0, 0, 0.4], [1.2, -0.5, -0.3, 0.9, 0.35, 0.3, -0.3, -1.2], [1.0, 0.3, 0.7, 0.85, 0.3, -0.3, 0.3, -1.5]]
  },
  'svc-gas': {
    anchor: '.svc-gas .svc-visual', fit: 'min', size: 1, sizeM: 0.86, ref: 2.0, center: [0, 0], az: 0.3, el: 0.08, portrait: 0, dim: 1, bloom: 0.7, spin: 0.8,
    rings: [[1.15, 0.4, 0.2, 0.95, 0.35, -0.3, 0.3, -1.4], [0.45, -0.4, -0.15, 0.92, 1.6, 0, 0, 0.4], [1.0, 0.2, 0.8, 0.85, 0.3, 0.3, -0.3, -1.6]]
  },
  'svc-per': {
    anchor: '.svc-per .svc-visual', fit: 'min', size: 1, sizeM: 0.86, ref: 2.0, center: [0, 0], az: -0.2, el: 0.12, portrait: 0, dim: 1, bloom: 0.75, spin: 0.8,
    rings: [[1.15, 0.4, 0.2, 0.95, 0.3, 0.3, 0.3, -1.4], [1.4, -0.6, -0.3, 0.82, 0.3, -0.3, -0.3, -1.6], [0.4, 0.3, 0.25, 0.8, 1.6, 0, 0, 0.4]]
  },
  metodo: {
    anchor: '.metodo-visual', fit: 'min', size: 1, ref: 2.15, center: [0, 0], az: 0.62, el: 0.28, portrait: 0, dim: 0.9, bloom: 0.6, spin: 0.45,
    rings: [[0.18, 0.1, 0, 0.82, 1, 0, 0, 0], [0.18, 0.1, 0, 0.92, 1, 0, 0, 0], [0.18, 0.1, 0, 1.0, 1, 0, 0, 0]]
  },
  about: {
    anchor: '.about .photo', fit: 'h', size: 1, sizeM: 0.8, ref: 1.75, center: [0, 0], az: 0.15, el: 0.05, portrait: 0, dim: 0.85, bloom: 0.55, spin: 0.7,
    rings: [[0.1, 1.22, 0.1, 1.36, 0.9, 0, 0, 0], [-0.08, -1.28, -0.12, 1.26, 0.8, 0, 0, 0], [0.06, 1.34, 0.16, 1.17, 0.8, 0, 0, 0]]
  },
  contact: {
    anchor: '.contact form', fit: 'min', size: 1, ref: 2.0, center: [0, 0], az: 0, el: 0, portrait: 0, dim: 1, dimM: 0.6, bloom: 0.9, spin: 0.9,
    rings: [[0, 0, 0, 0.8, 1.2, 0, 0, 0.2], [0, 0, 0.5, 0.95, 1.1, 0, 0, 0], [0, 0, 1.0, 1.1, 1.2, 0, 0, -0.2]]
  },
  frame: {
    anchor: '.page-hero-media', fit: 'h', size: 1, ref: 2.05, center: [0, 0], az: -0.3, el: 0.1, portrait: 0, dim: 0.9, bloom: 0.6, spin: 0.8,
    rings: [[1.2, 0.42, 0.22, 1.02, 1, 0, 0, 0], [1.42, -0.62, -0.36, 1.08, 0.9, 0, 0, 0], [0.98, 0.18, 0.78, 1.14, 0.9, 0, 0, 0]]
  },
  park: {
    anchor: null, pos: [1.1, 0.2], posM: [1.16, 0.16], size: 0.5, sizeM: 0.62, ref: 1.6, center: [0, 0], az: 0.35, el: 0.12, portrait: 0, dim: 0.34, dimM: 0.3, bloom: 0.4, spin: 0.4,
    rings: [[1.2, 0.42, 0.22, 1, 0.6, 0, 0, 0], [1.42, -0.62, -0.36, 1, 0.6, 0, 0, 0], [0.98, 0.18, 0.78, 1, 0.6, 0, 0, 0]]
  },
  ambient: {
    anchor: null, pos: [0.88, 0.32], posM: [0.86, 0.18], size: 0.42, sizeM: 0.4, ref: 1.6, center: [0, 0], az: 0.4, el: 0.18, portrait: 0, dim: 0.6, dimM: 0.4, bloom: 0.5, spin: 0.5,
    rings: [[1.2, 0.42, 0.22, 1, 0.8, 0, 0, 0], [1.42, -0.62, -0.36, 1, 0.8, 0, 0, 0], [0.98, 0.18, 0.78, 1, 0.8, 0, 0, 0]]
  }
};

/* ------------------------------------------------------------------ utilidades de escena */
function makeEnvironment(renderer) {
  const env = new Scene();
  env.add(new Mesh(new BoxGeometry(24, 14, 24), new MeshBasicMaterial({ color: 0x07090b, side: BackSide })));
  const panel = (w, h, color, k, pos, rot) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), side: DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]); env.add(m);
  };
  panel(10, 3.5, 0xffffff, 3.2, [0, 6.8, 0], [Math.PI / 2, 0, 0]);       // softbox cenital
  panel(1.6, 9, C.turq, 4.2, [-11.5, 0.5, -2], [0, Math.PI / 2, 0]);       // franja turquesa
  panel(1.6, 9, C.amber, 3.6, [11.5, -0.5, -2], [0, -Math.PI / 2, 0]);     // franja ámbar
  panel(7, 2.2, 0xffffff, 1.1, [0, 1.2, -11.5], [0, 0, 0]);               // relleno trasero
  panel(9, 2, 0xdfe9ea, 0.9, [0, 0.4, 11.5], [0, Math.PI, 0]);            // relleno frontal
  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

const PORTRAIT_VS = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTRAIT_FS = `
uniform sampler2D map; uniform float uOpacity; uniform vec3 uRimL; uniform vec3 uRimR; uniform vec2 uTexel; uniform float uSweep; uniform float uExposure;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(map, vUv);
  float aL = texture2D(map, vUv + vec2(-uTexel.x*7.0, 0.0)).a;
  float aR = texture2D(map, vUv + vec2( uTexel.x*7.0, 0.0)).a;
  float aU = texture2D(map, vUv + vec2(0.0, uTexel.y*7.0)).a;
  float eL = clamp(c.a - aL, 0.0, 1.0), eR = clamp(c.a - aR, 0.0, 1.0), eU = clamp(c.a - aU, 0.0, 1.0);
  vec3 col = c.rgb * uExposure * mix(0.45, 1.0, smoothstep(0.35, 0.98, c.a));
  col *= mix(vec3(0.86, 1.03, 1.03), vec3(1.06, 0.98, 0.9), smoothstep(0.15, 0.85, vUv.x));
  col *= 1.0 - 0.35 * smoothstep(0.18, 0.62, length((vUv - vec2(0.5, 0.66)) * vec2(1.3, 1.0)));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.82);                                   // un poco menos de saturación
  col *= mix(vec3(0.86, 0.95, 1.0), vec3(1.04, 1.0, 0.96), smoothstep(0.0, 0.35, l)); // sombras frías, luces cálidas
  col += uRimL * eL * 0.5 + uRimR * eR * 0.45 + vec3(0.8, 0.95, 1.0) * eU * 0.05;   // luz de contorno de marca
  col *= mix(0.5, 1.0, smoothstep(0.04, 0.42, vUv.y));                // el torso se apaga hacia abajo
  float sweep = exp(-pow((vUv.x + vUv.y * 0.35 - uSweep) * 8.0, 2.0)) * smoothstep(0.35, 0.6, vUv.y);  // barrido de luz sobre el rostro
  col *= 1.0 + sweep * 0.55;
  col += vec3(0.55, 0.95, 0.88) * sweep * 0.035;
  float fade = smoothstep(0.0, 0.3, vUv.y);                         // el torso se funde en el grafito
  float side = smoothstep(0.02, 0.3, vUv.x) * smoothstep(0.98, 0.7, vUv.x);
  fade *= mix(1.0, side, smoothstep(0.5, 0.2, vUv.y));              // y los hombros, en óvalo
  float a = c.a * uOpacity * fade;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
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
  p.y += sin(uTime * 0.18 + aSeed * 21.0) * 0.18;
  p.x += cos(uTime * 0.13 + aSeed * 17.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPx / max(0.5, -mv.z), uPx * 0.16);
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

/* ------------------------------------------------------------------ la escena */
class Stage {
  constructor() {
    this.ready = false;
    this.states = [];
    this.s = 0;
    this.time = 0;
    this.alive = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scrollVel = 0;
    this.onReady = null;
    this._tmpQ = new Quaternion();
    this._e = new Euler();
  }

  init(opts) {
    this.opts = opts;
    const canvas = (this.canvas = opts.canvas);
    const tier = (this.tier = opts.tier);
    const renderer = (this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve }));
    renderer.setClearColor(C.bg, 1);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = SRGBColorSpace;
    this.dprCap = tier >= 2 ? 1.8 : tier === 1 ? 1.5 : 1.15;

    const scene = (this.scene = new Scene());
    scene.background = new Color(C.bg);
    scene.fog = new FogExp2(C.bg, 0.045);
    scene.environment = makeEnvironment(renderer);
    scene.environmentIntensity = 0.95;

    this.camera = new PerspectiveCamera(30, 1, 0.1, 80);

    // luces
    const key = new DirectionalLight(0xfff4e8, 1.5); key.position.set(-3, 4, 6); scene.add(key);
    this.lightT = new PointLight(C.turq, 26, 14, 2); this.lightT.position.set(-4.2, 1.2, -1.5); scene.add(this.lightT);
    this.lightA = new PointLight(C.amber, 22, 14, 2); this.lightA.position.set(4.2, -0.8, -1.2); scene.add(this.lightA);
    this.lightF = new PointLight(0xdfffff, 6, 10, 2); this.lightF.position.set(0, 0.5, 4.5); scene.add(this.lightF);

    // el giroscopio
    this.rig = new Group(); scene.add(this.rig);
    this.rings = [this._dataRing(tier), this._opsRing(), this._peopleRing()];
    this.rings.forEach((r) => this.rig.add(r.group));

    // retrato recortado
    this.portraitMat = new ShaderMaterial({
      vertexShader: PORTRAIT_VS, fragmentShader: PORTRAIT_FS, transparent: true, depthWrite: true,
      uniforms: {
        map: { value: null }, uOpacity: { value: 0 }, uRimL: { value: new Color(C.turq).multiplyScalar(0.55) },
        uRimR: { value: new Color(C.amber).multiplyScalar(0.5) }, uTexel: { value: new Vector2(1 / 697, 1 / 1046) },
        uSweep: { value: -1 }, uExposure: { value: 1.12 }
      }
    });
    this.portrait = new Mesh(new PlaneGeometry(2.27, 3.4), this.portraitMat);
    this.portrait.position.set(0, -0.13, 0);
    this.portrait.renderOrder = 1;
    this.rig.add(this.portrait);
    if (opts.portrait) new TextureLoader().load(opts.portrait, (t) => {
      t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
      this.portraitMat.uniforms.map.value = t;
      this.portraitReady = true;
    });

    // fondo de estudio que acompaña al giroscopio
    this.backMat = new ShaderMaterial({ vertexShader: BACK_VS, fragmentShader: BACK_FS, depthWrite: false, uniforms: { uDim: { value: 1 } } });
    this.back = new Mesh(new PlaneGeometry(26, 26), this.backMat);
    this.back.position.set(0, 0, -7);
    this.back.renderOrder = -1;
    this.rig.add(this.back);

    // polvo en suspensión
    this.dust = this._dust(tier >= 2 ? 1600 : tier === 1 ? 900 : 500);
    scene.add(this.dust);

    // posproceso: brillo (bloom) y salida con mapeo de tonos
    const size = this._size();
    const rt = new WebGLRenderTarget(size.w, size.h, { type: HalfFloatType, samples: tier >= 1 ? 4 : 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(size.w, size.h), 0.42, 0.5, 0.9);
    this.bloom.enabled = tier >= 1;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    this._frame = this._frame.bind(this);
    return true;
  }

  /* -- anillo de datos: vidrio turquesa con un núcleo de luz y paquetes que viajan */
  _dataRing(tier) {
    const group = new Group(), spin = new Group(); group.add(spin);
    const R = 1.48;
    const glass = tier >= 2
      ? new MeshPhysicalMaterial({ color: 0xc8fff6, transmission: 1, thickness: 0.5, roughness: 0.06, ior: 1.45, attenuationColor: new Color(C.turq), attenuationDistance: 0.55, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new Color(C.turq), emissiveIntensity: 0.08 })
      : new MeshPhysicalMaterial({ color: 0x86efe0, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55, emissive: new Color(C.turq), emissiveIntensity: 0.22 });
    spin.add(new Mesh(new TorusGeometry(R, 0.05, 24, 220), glass));
    const coreMat = new MeshBasicMaterial({ color: new Color(C.turq).multiplyScalar(1.2) });
    spin.add(new Mesh(new TorusGeometry(R, 0.009, 8, 220), coreMat));
    const n = 16, packets = new InstancedMesh(new BoxGeometry(0.06, 0.06, 0.06), new MeshStandardMaterial({ color: C.turq, emissive: new Color(C.turq), emissiveIntensity: 2.4, roughness: 0.35, metalness: 0.2 }), n);
    spin.add(packets);
    return { group, spin, packets, n, R, core: coreMat, base: new Color(C.turq).multiplyScalar(1.2), speed: 0.16, kind: 'data' };
  }

  /* -- anillo de operación: metal grafito con marcas ámbar, como un instrumento de medición */
  _opsRing() {
    const group = new Group(), spin = new Group(); group.add(spin);
    const R = 1.74;
    spin.add(new Mesh(new TorusGeometry(R, 0.028, 20, 240), new MeshStandardMaterial({ color: C.metal, metalness: 1, roughness: 0.3 })));
    const n = 120, ticks = new InstancedMesh(new BoxGeometry(0.009, 1, 0.009), new MeshStandardMaterial({ color: C.amber, emissive: new Color(C.amber), emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.35 }), n);
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, long = i % 10 === 0, len = long ? 0.13 : 0.055;
      o.position.set(Math.cos(a) * (R + 0.05 + len / 2), Math.sin(a) * (R + 0.05 + len / 2), 0);
      o.rotation.set(0, 0, a - Math.PI / 2);
      o.scale.set(long ? 1.6 : 1, len, long ? 1.6 : 1);
      o.updateMatrix(); ticks.setMatrixAt(i, o.matrix);
    }
    spin.add(ticks);
    return { group, spin, ticks, R, speed: -0.07, kind: 'ops', tickMat: ticks.material };
  }

  /* -- anillo de personas: cerámica marfil con nodos cálidos (equipos) */
  _peopleRing() {
    const group = new Group(), spin = new Group(); group.add(spin);
    const R = 2.02;
    spin.add(new Mesh(new TorusGeometry(R, 0.042, 24, 240), new MeshPhysicalMaterial({ color: C.ivory, roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.6, sheenColor: new Color(C.amber) })));
    const angles = [0.1, 0.22, 0.3, 1.3, 1.42, 2.4, 2.48, 2.6, 2.7, 3.6, 3.75, 4.7, 4.8, 5.5, 5.6, 5.72];
    const n = angles.length, nodes = new InstancedMesh(new SphereGeometry(0.046, 20, 14), new MeshStandardMaterial({ color: C.amber, emissive: new Color(C.amber), emissiveIntensity: 0.9, roughness: 0.3 }), n);
    const o = new Object3D();
    angles.forEach((a, i) => { o.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); o.scale.setScalar(i % 3 === 0 ? 1.25 : 0.85); o.updateMatrix(); nodes.setMatrixAt(i, o.matrix); });
    spin.add(nodes);
    return { group, spin, nodes, R, speed: 0.05, kind: 'people', nodeMat: nodes.material };
  }

  _dust(n) {
    const g = new BufferGeometry(), pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n), col = new Float32Array(n * 3);
    const t = new Color(C.turq), a = new Color(C.amber), w = new Color(0xdfeaea);
    for (let i = 0; i < n; i++) {
      const r = 2.4 + Math.pow(Math.random(), 0.7) * 7, th = Math.random() * TAU, ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.4; pos[i * 3 + 1] = Math.cos(ph) * r * 0.75; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 1.5;
      size[i] = 0.6 + Math.random() * 2.4; seed[i] = Math.random();
      const c = Math.random() < 0.55 ? t : Math.random() < 0.6 ? w : a;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    g.setAttribute('aColor', new Float32BufferAttribute(col, 3));
    this.dustMat = new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: 30 }, uDim: { value: 1 } } });
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
    this.dustMat.uniforms.uPx.value = 26 * s.dpr * (s.ch / 900);
  }

  /* -- estados a partir del DOM */
  setStates(els) {
    this.states = els.map((el) => {
      const name = el.getAttribute('data-stage');
      const def = STATES[name] || STATES.ambient;
      const st = Object.assign({ name, el }, def);
      st.q = def.rings.map((r) => new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2])));
      const sel = el.getAttribute('data-stage-anchor') || def.anchor;
      st.anchorEl = sel ? el.querySelector(sel) || document.querySelector(sel) : null;
      st.lay = { cx: 0, cy: 0, r: 100 };
      return st;
    });
  }

  _layout(st, out) {
    const W = this.W, H = this.H, m = W <= 820;
    if (st.anchorEl) {
      const r = st.anchorEl.getBoundingClientRect();
      const base = st.fit === 'h' ? r.height / 2 : st.fit === 'w' ? r.width / 2 : Math.min(r.width, r.height) / 2;
      out.r = Math.max(20, base * ((m && st.sizeM) || st.size));
      out.cx = r.left + r.width / 2 + st.center[0] * out.r;
      out.cy = r.top + r.height / 2 + st.center[1] * out.r;
    } else {
      const p = (m && st.posM) || st.pos || [0.5, 0.5], sz = (m && st.sizeM) || st.size;
      out.r = sz * Math.min(W, H) / 2;
      out.cx = p[0] * W; out.cy = p[1] * H;
    }
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
      if (++this._n % 120 === 0 && this._ema > 26) {
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
    this.alive = Math.min(1, this.alive + dt * 0.7);
    const s = clamp(this.s, 0, st.length - 1), i0 = Math.floor(s), i1 = Math.min(i0 + 1, st.length - 1);
    const t = i0 === i1 ? 0 : s - i0, g = ease(t);
    const A = st[i0], B = st[i1];
    this._layout(A, A.lay); this._layout(B, B.lay);
    const m = this.W <= 820;
    const cx = lerp(A.lay.cx, B.lay.cx, g), cy = lerp(A.lay.cy, B.lay.cy, g), rpx = lerp(A.lay.r, B.lay.r, g);
    const ref = lerp(A.ref, B.ref, g);

    // puntero suavizado (reacción sutil)
    const p = this.pointer, kp = 1 - Math.exp(-dt * 3);
    p.x += (p.tx - p.x) * kp; p.y += (p.ty - p.y) * kp;
    const spinK = lerp(A.spin, B.spin, g) * (reduced ? 0 : 1) * (0.25 + 0.75 * ease(this.alive));
    this.time += dt * spinK;

    // cámara: órbita alrededor del giroscopio + desplazamiento de lente para ubicarlo sobre su ancla
    const fov = this.camera.fov * Math.PI / 180;
    let d = ref * (this.H / 2) / (rpx * Math.tan(fov / 2));
    if (A.name === 'hero' && B.name === 'pubs') d *= 1 - 0.5 * Math.sin(Math.PI * t);    // la cámara atraviesa el anillo de datos
    const az = lerp(A.az, B.az, g) + p.x * 0.07 + (reduced ? 0 : Math.sin(this.time * 0.35) * 0.04);
    const el = lerp(A.el, B.el, g) - p.y * 0.05;
    const cam = this.camera;
    cam.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(this.W, this.H, this.W / 2 - cx, this.H / 2 - cy, this.W, this.H);
    cam.near = Math.max(0.05, d - 9); cam.far = d + 12; cam.updateProjectionMatrix();
    this.scene.fog.density = 0.32 / Math.max(4, d);

    // el giroscopio reacciona un poco al cursor
    this.rig.rotation.set(-p.y * 0.08, p.x * 0.12, 0);

    // anillos: orientación (slerp), tamaño, desplazamiento, giro propio y brillo
    const dim = lerp((m && A.dimM) || A.dim, (m && B.dimM) || B.dim, g);
    for (let k = 0; k < 3; k++) {
      const R = this.rings[k], ra = A.rings[k], rb = B.rings[k];
      this._tmpQ.slerpQuaternions(A.q[k], B.q[k], g);
      R.group.quaternion.copy(this._tmpQ);
      R.group.scale.setScalar(lerp(ra[3], rb[3], g));
      R.group.position.set(lerp(ra[5], rb[5], g), lerp(ra[6], rb[6], g), lerp(ra[7], rb[7], g));
      R.spin.rotation.z = this.time * R.speed * 6;
      const glow = lerp(ra[4], rb[4], g) * dim;
      if (R.kind === 'data') {
        R.core.color.copy(R.base).multiplyScalar(0.1 + glow * 0.95);
        const o = this._o || (this._o = new Object3D());
        for (let i = 0; i < R.n; i++) {
          const a = (i / R.n) * TAU + this.time * (0.9 + (i % 3) * 0.25) * 0.6;
          o.position.set(Math.cos(a) * R.R, Math.sin(a) * R.R, 0);
          o.rotation.set(a, a * 0.7, 0);
          o.scale.setScalar((i % 4 === 0 ? 1.3 : 0.75) * (0.4 + 0.6 * ease(this.alive)));
          o.updateMatrix(); R.packets.setMatrixAt(i, o.matrix);
        }
        R.packets.instanceMatrix.needsUpdate = true;
        R.packets.material.emissiveIntensity = 0.25 + glow * 1.6;
      } else if (R.kind === 'ops') {
        R.tickMat.emissiveIntensity = 0.15 + glow * 0.4;
      } else {
        R.nodeMat.emissiveIntensity = 0.3 + glow * 0.8;
      }
    }

    // retrato
    const po = lerp(A.portrait, B.portrait, A.portrait > B.portrait ? Math.min(1, t * 3.2) : Math.max(0, t * 1.6 - 0.6));   // el retrato se va antes de que la cámara atraviese el anillo
    this.portraitMat.uniforms.uOpacity.value = this.portraitReady ? po : 0;
    this.portrait.visible = po > 0.01;
    const sw = this.portraitMat.uniforms.uSweep;
    if (this._sweepT != null) { this._sweepT += dt; sw.value = -0.6 + this._sweepT * 1.25; if (this._sweepT > 2.4) this._sweepT = null; }

    // luces y brillo
    const L = dim * (0.55 + 0.45 * ease(this.alive));
    this.lightT.intensity = 26 * L; this.lightA.intensity = 22 * L;
    this.scene.environmentIntensity = 0.95 * (0.6 + 0.4 * dim);
    this.bloom.strength = lerp(A.bloom, B.bloom, g) * (0.6 + 0.4 * dim);
    this.dustMat.uniforms.uTime.value = this.time * 2.0;
    this.dustMat.uniforms.uDim.value = 0.55 * dim;
    this.backMat.uniforms.uDim.value = 0.4 + 0.6 * dim;

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
