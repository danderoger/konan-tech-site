/* Konan Tech 3.0: palco 3D da "matéria inteligente".
   Um único campo de partículas fica atrás da página inteira e ganha uma forma por capítulo.
   As partículas são pérolas iluminadas (luz, brilho e profundidade de campo) no ambiente claro
   e pontos de luz no ambiente escuro, com transição contínua entre os dois.
   Sem WebGL, o site continua funcionando com a imagem de reserva.
   API principal:
     stage.setShape(nome, { dur, spread, sweep, arc, instant })  morfose até uma forma de shapes.js
     stage.defineShape(nome, dados)                              registra uma forma montada na hora
     stage.scrub(de, para, progresso)                            morfose controlada pela rolagem
     stage.setLayout({ x, y, s, o })                             posição, escala e opacidade
     stage.setEnv(v) / stage.setAdd(v)                           ambiente (0 claro, 1 escuro) e brilho somado
     stage.setSpin(extra) / stage.setCam({ z, lock })            giro extra e câmera
     stage.beginSplit(antes, depois) / setDivider(px) / endSplit()  comparador
     stage.pointer(x, y) / stage.attract(on) / stage.pulse(x, y)    mouse e toque (coordenadas -1 a 1) */

import {
  Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Points, LineSegments,
  ShaderMaterial, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, AddEquation, Color, Group, Vector2, Vector3
} from './vendor/three.min.js';
import { SHAPES } from './shapes.js';

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => (Number.isFinite(a) ? a + (b - a) * (1 - Math.exp(-k * dt)) : b);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* mistura pré-multiplicada: com alfa vira "normal" (fundo claro), sem alfa vira "aditiva" (brilho no escuro) */
const BLEND = { blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, transparent: true, depthWrite: false, depthTest: false };

const VERT = /* glsl */`
attribute vec3 aTo;
attribute vec3 aAux;
attribute vec4 cFrom;
attribute vec4 cTo;
attribute vec4 cAux;
attribute vec4 aRnd;
uniform float uTime, uMorph, uDur, uSpread, uSweep, uArc, uSwirl, uJitter, uNoise, uWave, uSize, uPx, uOpacity, uAspect, uTanHalf;
uniform float uPointerOn, uPulseT, uMotion, uGain, uEnv, uFocus, uAperture, uSplit, uDivX, uCrisp, uAttract, uLens;
uniform vec2 uPointer, uPulse;
uniform vec3 uHi;
varying vec4 vC;
varying float vSoft;
float ease(float t) { return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
vec3 field(vec3 q, float t) {
  return vec3(sin(q.y * 1.31 + t * .83 + sin(q.z * .71 + t * .29)),
              sin(q.z * 1.17 + t * .67 + sin(q.x * .93 - t * .41)),
              sin(q.x * 1.23 - t * .79 + sin(q.y * .81 + t * .53)));
}
void main() {
  float sw = clamp(aTo.x * .11 + .5, 0., 1.);
  float delay = mix(aRnd.x, sw * .82 + aRnd.x * .18, uSweep);
  float l = clamp((uMorph - delay * uSpread) / uDur, 0., 1.);
  float e = ease(l);
  vec3 p = mix(position, aTo, e);
  vec4 col = mix(cFrom, cTo, e);
  float mid = sin(3.14159265 * l);
  vec3 d = aTo - position;
  float dl = length(d);
  vec3 cz = cross(d, vec3(0., 0., 1.));
  float cl = length(cz);
  vec3 side = cl > 1e-4 ? cz / cl : vec3(1., 0., 0.);
  p += (side * (aRnd.y - .5) * 2. + vec3(0., 0., aRnd.z - .5) * 1.4) * mid * uArc * min(dl, 5.) * .3;
  float t = uTime * uMotion;
  float ph = aRnd.z * 6.2831;
  float band = 0.;
  if (uSplit > .001) {
    float eS = smoothstep(uDivX - .5, uDivX + .5, aAux.x + (aRnd.x - .5) * .55) * uSplit;
    p = mix(p, aAux, eS);
    col = mix(col, cAux, eS);
    band = (1. - abs(eS * 2. - 1.)) * uSplit;
    mid = max(mid, band);
  }
  float live = 1. - uCrisp;
  p += field(p * .75 + aRnd.zyx * 3., t * .6) * (uNoise * live + mid * uSwirl);
  p += vec3(sin(t * aRnd.w + ph), cos(t * aRnd.w * 1.3 + ph), sin(t * aRnd.w * .7 + ph * 2.)) * uJitter * (.4 + aRnd.y * .6) * (live * .85 + .15);
  p.y += (sin(p.x * 1.1 - t * 1.4 + p.z * .5) * .22 + sin(p.x * .45 + p.z * 1.3 - t * .8) * .14) * uWave;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float z = max(.5, -mv.z);
  float unit = z * uTanHalf;
  vec2 pv = vec2(uPointer.x * uAspect, uPointer.y) * unit;
  vec2 dv = pv - mv.xy;
  float dist = length(dv) / unit;
  float f = smoothstep(.36, 0., dist) * uPointerOn;
  vec2 away = dist > 1e-4 ? -dv / max(length(dv), 1e-6) : vec2(0.);
  mv.xy += away * f * unit * .055;
  float fa = uAttract * exp(-dist * dist * 2.2);
  mv.xy += dv * fa * (.3 + aRnd.y * .5);
  mv.xy += vec2(-dv.y, dv.x) * fa * .6 * (aRnd.w - .55);
  vec2 pp = vec2(uPulse.x * uAspect, uPulse.y) * unit;
  vec2 dq = mv.xy - pp;
  float pd = length(dq) / unit;
  float ring = exp(-pow((pd - uPulseT * 1.5) * 6., 2.)) * max(0., 1. - uPulseT / 1.6);
  mv.xy += (pd > 1e-4 ? dq / max(length(dq), 1e-6) : vec2(0.)) * ring * unit * .04;
  gl_Position = projectionMatrix * mv;
  float blur = abs(z - uFocus) * uAperture * live;
  float var = mix(.55 + aRnd.y * .9, 1., uCrisp * .7);
  float sz = uSize * var * (1. + blur * 2.2) * (1. + uEnv * .3) * (1. + f * uLens * (1. - uAttract)) * (1. - uCrisp * .12);
  gl_PointSize = clamp(sz * uPx / z, 1., 48.);
  vSoft = clamp(blur * 1.6, 0., 1.);
  float lum = dot(col.rgb, vec3(.299, .587, .114));
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  vec3 neutral = mix(vec3(.5, .6, .74), vec3(.93, .96, 1.), clamp(1. - lum * 1.5, 0., 1.));
  vec3 vivid = 1. - (1. - col.rgb) * .55;
  vec3 c = mix(col.rgb, mix(neutral, vivid, smoothstep(.3, .5, sat)), uEnv);
  float hi = clamp(f * .4 + ring * .9 + band * .85 + mid * .2 + fa * .55, 0., 1.);
  c = mix(c, mix(uHi, vec3(.75, .93, 1.), uEnv), hi);
  float tw = mix(.8 + .2 * sin(uTime * uMotion * (1. + aRnd.w * 2.) + ph * 3.), 1., uCrisp);
  float depth = smoothstep(30., 5., z);
  float a = uOpacity * uGain * col.a * tw * (.35 + .65 * depth) / (1. + blur * blur * 4.);
  vC = vec4(c, clamp(a, 0., 1.));
}`;

const FRAG = /* glsl */`
uniform float uEnv, uAdd;
uniform vec3 uLight;
varying vec4 vC;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord * 2. - 1.;
  c.y = -c.y;
  float r2 = dot(c, c);
  if (r2 > 1.) discard;
  float r = sqrt(r2);
  vec3 n = vec3(c, sqrt(1. - r2));
  float diff = max(dot(n, uLight), 0.);
  vec3 h = normalize(uLight + vec3(0., 0., 1.));
  float spec = pow(max(dot(n, h), 0.), 28.);
  float sharp = 1. - vSoft;
  vec3 base = vC.rgb;
  vec3 lit = base * (.42 + .7 * diff) + spec * .55 * vec3(.92, .97, 1.);
  vec3 col = mix(mix(base, lit, sharp), base + spec * .22 * sharp, uEnv);
  float edge = mix(.2, .95, vSoft);
  float disc = 1. - smoothstep(1. - edge, 1., r);
  float glow = exp(-r2 * 3.5);
  float a = mix(disc, glow, uEnv * uAdd * .8) * vC.a;
  gl_FragColor = vec4(col * a, a * (1. - uAdd));
}`;

const LINK_VERT = /* glsl */`
attribute float aT;
attribute float aSeed;
varying float vT;
varying float vS;
varying float vD;
void main() {
  vT = aT; vS = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vD = smoothstep(26., 6., -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const LINK_FRAG = /* glsl */`
uniform float uTime, uOpacity, uEnv, uAdd, uDraw;
uniform vec3 uBaseL, uBaseD, uPulseL, uPulseD;
varying float vT;
varying float vS;
varying float vD;
void main() {
  float k = clamp(uDraw * 1.6 - vS * .6, 0., 1.);
  if (vT > k) discard;
  float w = fract(uTime * .32 + vS);
  float g = exp(-pow((vT - w) * 9., 2.));
  vec3 base = mix(uBaseL, uBaseD, uEnv);
  vec3 c = mix(base, mix(uPulseL, uPulseD, uEnv), g);
  float a = uOpacity * (mix(.14, .07, uEnv) + .8 * g) * vD;
  gl_FragColor = vec4(c * a, a * (1. - uAdd));
}`;

const MOTE_VERT = /* glsl */`
attribute float aS;
uniform float uTime, uPx, uMotion, uOpacity, uEnv;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(.03 * uPx / -mv.z * (.5 + aS) * (1. + (1. - uEnv) * 5.), 1., 26.);
  vA = uOpacity * (.3 + .3 * sin(uTime * uMotion * (.4 + aS) + aS * 40.));
}`;

const MOTE_FRAG = /* glsl */`
uniform float uEnv;
varying float vA;
void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  if (d > 1.) discard;
  float aL = (1. - smoothstep(.15, 1., d)) * vA * .12 * (1. - uEnv);
  float aD = smoothstep(1., 0., d) * vA * uEnv;
  vec3 c = mix(vec3(.15, .45, .85), vec3(.66, .78, .92), uEnv);
  float a = aL + aD;
  gl_FragColor = vec4(c * a, aL);
}`;

/* lê os pixels da logo oficial: 6 números por pixel de tinta (x, y, luz, azul, coluna, linha) */
export function sampleLogo(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const W = Math.min(1000, img.naturalWidth), H = Math.round((img.naturalHeight / img.naturalWidth) * W);
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data;
        const out = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const k = (y * W + x) * 4;
          if (d[k + 3] < 110) continue;
          const r = d[k], gg = d[k + 1], b = d[k + 2];
          const blue = b > r + 40 && b > 110 ? 1 : 0;
          out.push(x / W, (0.5 - y / H) * (H / W), (0.299 * r + 0.587 * gg + 0.114 * b) / 255, blue, x, y);
        }
        resolve({ data: new Float32Array(out), w: W, h: H });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export class Stage {
  constructor(canvas, o = {}) {
    this.canvas = canvas;
    this.reduced = !!o.reduced;
    this.N = o.count || 30000;
    this.dprMax = o.dpr || 1.75;
    this.tier = o.tier === undefined ? 2 : o.tier;
    this.cache = {};
    this.logoPx = null;
    this.time = 0;
    this.morphT = 1e3;
    this.dur = 2.2;
    this.spread = 1.2;
    this.sweep = 0;
    this.arc = 0.5;
    this.mode = 'time';
    this.shape = null;
    this.fromName = null;
    this.opts = {};
    this.spinAcc = 0;
    this.spinW = 0;
    this.spinExtra = 0;
    this.settleTo = null;
    this.cur = { x: 0, y: 0, s: 1, o: 0 };
    this.tgt = { x: 0, y: 0, s: 1, o: 1 };
    this.env = 0;
    this.envT = 0;
    this.addOverride = null;
    this.split = 0;
    this.splitT = 0;
    this.divSX = 0;
    this.ptr = new Vector2(9, 9);
    this.ptrT = new Vector2(9, 9);
    this.ptrOn = 0;
    this.ptrSeen = -10;
    this.attractT = 0;
    this.vel = 0;
    this.linkO = 0;
    this.linkT = 0;
    this.linkAt = 0;
    this.draw = 0;
    this.camZ = 10;
    this.camT = { z: 0, lock: false, orbit: 0 };
    this.camO = { z: 0, orbit: 0, lock: 0 };
    this.kick = 0;
    this.running = false;
    this.frames = [];
    this.quality = 3;
    this.onQuality = null;
    this.idleQueue = [];
    this._v3 = new Vector3();
    const q = new URLSearchParams(location.search);
    this.dtMax = q.has('fast') ? 0.6 : 0.05;
    if (q.has('hq')) this.qualityLocked = true;
    this._loop = this._loop.bind(this);
  }

  async init(logoUrl) {
    this.logoPx = logoUrl ? await sampleLogo(logoUrl) : null;
    const r = this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false, depth: false });
    r.setClearColor(0x000000, 0);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    r.setPixelRatio(this.dpr);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    this.group = new Group();
    this.scene.add(this.group);
    this._buildPoints();
    this._buildLinks();
    this._buildMotes();
    this.resize(true);
    return this;
  }

  /* placa de vídeo sem aceleração (renderização por software): o site usa a versão leve */
  softwareGL() {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      return /swiftshader|llvmpipe|software|softpipe/i.test(name || '');
    } catch (e) { return false; }
  }

  _buildPoints() {
    const n = this.N;
    const g = new BufferGeometry();
    this.aFrom = new Float32Array(n * 3);
    this.aTo = new Float32Array(n * 3);
    this.aAux = new Float32Array(n * 3);
    this.cFrom = new Float32Array(n * 4);
    this.cTo = new Float32Array(n * 4);
    this.cAux = new Float32Array(n * 4);
    this.rnd = new Float32Array(n * 4);
    let s = 7;
    const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      this.rnd[i * 4] = rr();
      this.rnd[i * 4 + 1] = rr();
      this.rnd[i * 4 + 2] = rr();
      this.rnd[i * 4 + 3] = 0.25 + rr() * 0.9;
    }
    this.attr = {
      from: new BufferAttribute(this.aFrom, 3),
      to: new BufferAttribute(this.aTo, 3),
      aux: new BufferAttribute(this.aAux, 3),
      cf: new BufferAttribute(this.cFrom, 4),
      ct: new BufferAttribute(this.cTo, 4),
      ca: new BufferAttribute(this.cAux, 4)
    };
    g.setAttribute('position', this.attr.from);
    g.setAttribute('aTo', this.attr.to);
    g.setAttribute('aAux', this.attr.aux);
    g.setAttribute('cFrom', this.attr.cf);
    g.setAttribute('cTo', this.attr.ct);
    g.setAttribute('cAux', this.attr.ca);
    g.setAttribute('aRnd', new BufferAttribute(this.rnd, 4));
    const size = clamp(0.028 * Math.sqrt(30000 / n), 0.024, 0.042);
    this.u = {
      uTime: { value: 0 }, uMorph: { value: 1e3 }, uDur: { value: 2.2 }, uSpread: { value: 1.2 }, uSweep: { value: 0 }, uArc: { value: 0.5 },
      uSwirl: { value: 0.3 }, uJitter: { value: 0.02 }, uNoise: { value: 0.03 }, uWave: { value: 0 }, uSize: { value: size }, uGain: { value: 0.6 },
      uPx: { value: 500 }, uOpacity: { value: 0 }, uAspect: { value: 1 }, uTanHalf: { value: this.tanHalf }, uPointerOn: { value: 0 },
      uPulseT: { value: 9 }, uMotion: { value: this.reduced ? 0 : 1 }, uEnv: { value: 0 }, uAdd: { value: 0 },
      uFocus: { value: 10 }, uAperture: { value: this.tier >= 2 ? 0.11 : this.tier === 1 ? 0.07 : 0 }, uSplit: { value: 0 }, uDivX: { value: 0 },
      uCrisp: { value: 0 }, uAttract: { value: 0 }, uLens: { value: 0.6 },
      uPointer: { value: this.ptr }, uPulse: { value: new Vector2(9, 9) }, uHi: { value: new Color(0x1f6fff) },
      uLight: { value: new Vector3(-0.45, 0.6, 0.66).normalize() }
    };
    const m = new ShaderMaterial(Object.assign({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }, BLEND));
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _buildLinks() {
    this.lu = {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uEnv: this.u.uEnv, uAdd: this.u.uAdd, uDraw: { value: 0 },
      uBaseL: { value: new Color(0x34506e) }, uBaseD: { value: new Color(0x3ea6ff) },
      uPulseL: { value: new Color(0x1f6fff) }, uPulseD: { value: new Color(0xd8f4ff) }
    };
    const m = new ShaderMaterial(Object.assign({ uniforms: this.lu, vertexShader: LINK_VERT, fragmentShader: LINK_FRAG }, BLEND));
    this.links = new LineSegments(new BufferGeometry(), m);
    this.links.frustumCulled = false;
    this.links.visible = false;
    this.group.add(this.links);
  }

  _setLinks(arr) {
    const g = new BufferGeometry();
    if (arr && arr.length && this.tier > 0) {
      const segs = arr.length / 6;
      const t = new Float32Array(segs * 2), sd = new Float32Array(segs * 2);
      let s = 3;
      for (let k = 0; k < segs; k++) { s = (s * 16807) % 2147483647; const v = s / 2147483647; t[k * 2] = 0; t[k * 2 + 1] = 1; sd[k * 2] = v; sd[k * 2 + 1] = v; }
      g.setAttribute('position', new BufferAttribute(arr, 3));
      g.setAttribute('aT', new BufferAttribute(t, 1));
      g.setAttribute('aSeed', new BufferAttribute(sd, 1));
    }
    this.links.geometry.dispose();
    this.links.geometry = g;
    this.links.visible = !!(arr && arr.length && this.tier > 0);
  }

  _buildMotes() {
    const n = this.tier >= 2 ? 900 : this.tier === 1 ? 420 : 200;
    const p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = (Math.random() - 0.5) * 36;
      p[i * 3 + 2] = -6 - Math.random() * 30;
      s[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(p, 3));
    g.setAttribute('aS', new BufferAttribute(s, 1));
    this.su = { uTime: { value: 0 }, uPx: { value: 500 }, uMotion: { value: this.reduced ? 0 : 1 }, uOpacity: { value: 1 }, uEnv: this.u.uEnv };
    const m = new ShaderMaterial(Object.assign({ uniforms: this.su, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG }, BLEND));
    this.motes = new Points(g, m);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  get(name) {
    if (!this.cache[name]) {
      const fn = SHAPES[name] || SHAPES.globe;
      const S = name === 'logo' ? fn(this.N, this.logoPx) : name === 'chaosA' ? fn(this.N, this.get('panel').pos) : fn(this.N);
      this.cache[name] = { pos: S.pos, col: S.col, links: S.links || null, opts: S.opts || {} };
    }
    return this.cache[name];
  }

  has(name) { return !!this.cache[name]; }

  defineShape(name, S) {
    this.cache[name] = { pos: S.pos, col: S.col, links: S.links || null, opts: S.opts || {} };
    if (this.shape === name) this.shape = null;
  }

  /* prepara formas nos momentos ociosos, para a troca de capítulo não travar */
  prewarm(names) {
    names.forEach((n) => { if (!this.cache[n] && !this.idleQueue.includes(n)) this.idleQueue.push(n); });
    if (this._idleOn) return;
    this._idleOn = true;
    const ric = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 60));
    const work = (dl) => {
      while (this.idleQueue.length && dl.timeRemaining() > 6) {
        const n = this.idleQueue.shift();
        if (!this.cache[n]) this.get(n);
      }
      if (this.idleQueue.length) ric(work, { timeout: 1200 }); else this._idleOn = false;
    };
    ric(work, { timeout: 1200 });
  }

  _flag() {
    const a = this.attr;
    a.from.needsUpdate = a.to.needsUpdate = a.cf.needsUpdate = a.ct.needsUpdate = true;
  }

  /* congela a posição exibida de cada partícula como novo ponto de partida (inclui a curva do caminho) */
  _capture() {
    const n = this.N, T = this.morphT, D = this.dur, SP = this.spread, SW = this.sweep, AR = this.arc;
    const sp = this.split > 0.001 ? this.split : 0;
    const dx = this.u.uDivX.value;
    if (T >= D + SP && !sp) {
      this.aFrom.set(this.aTo);
      this.cFrom.set(this.cTo);
      return;
    }
    const F = this.aFrom, To = this.aTo, R = this.rnd;
    for (let i = 0; i < n; i++) {
      const k = i * 3, c = i * 4;
      const sw = clamp(To[k] * 0.11 + 0.5, 0, 1);
      const delay = R[c] + ((sw * 0.82 + R[c] * 0.18) - R[c]) * SW;
      let l = (T - delay * SP) / D;
      l = l < 0 ? 0 : l > 1 ? 1 : l;
      const e = ease(l);
      const ddx = To[k] - F[k], ddy = To[k + 1] - F[k + 1], ddz = To[k + 2] - F[k + 2];
      let ax = 0, ay = 0, az = 0;
      if (AR > 0 && l > 0 && l < 1) {
        const mid = Math.sin(Math.PI * l);
        const dl = Math.hypot(ddx, ddy, ddz);
        const cl = Math.hypot(ddy, ddx);
        const sx = cl > 1e-4 ? ddy / cl : 1, sy = cl > 1e-4 ? -ddx / cl : 0;
        const amp = mid * AR * Math.min(dl, 5) * 0.3;
        const sa = (R[c + 1] - 0.5) * 2;
        ax = sx * sa * amp; ay = sy * sa * amp; az = (R[c + 2] - 0.5) * 1.4 * amp;
      }
      F[k] += ddx * e + ax; F[k + 1] += ddy * e + ay; F[k + 2] += ddz * e + az;
      for (let j = 0; j < 4; j++) this.cFrom[c + j] += (this.cTo[c + j] - this.cFrom[c + j]) * e;
      if (sp) {
        const es = smooth(dx - 0.5, dx + 0.5, this.aAux[k] + (R[c] - 0.5) * 0.55) * sp;
        if (es > 0) {
          for (let j = 0; j < 3; j++) F[k + j] += (this.aAux[k + j] - F[k + j]) * es;
          for (let j = 0; j < 4; j++) this.cFrom[c + j] += (this.cAux[c + j] - this.cFrom[c + j]) * es;
        }
      }
    }
  }

  setShape(name, o = {}) {
    if (!this.renderer) return;
    if (name === this.shape && this.mode === 'time' && !this.splitOn && !o.force) return;
    if (this.splitOn) this.endSplit(true);
    const S = this.get(name);
    this._capture();
    this.aTo.set(S.pos);
    this.cTo.set(S.col);
    this._flag();
    this.mode = 'time';
    this.dur = o.dur || 2.2;
    this.spread = o.spread === undefined ? 1.2 : o.spread;
    this.sweep = o.sweep === undefined ? (S.opts.sweep || 0) : o.sweep;
    this.arc = o.arc === undefined ? (S.opts.arc === undefined ? 0.5 : S.opts.arc) : o.arc;
    this.morphT = o.instant || this.reduced ? 1e3 : 0;
    this.fromName = this.shape;
    this.shape = name;
    this.opts = S.opts;
    this._setLinks(S.links);
    this.linkO = 0;
    this.draw = o.instant || this.reduced ? 1 : 0;
    this.linkT = S.links ? 1 : 0;
    this.linkAt = this.time + (o.instant || this.reduced ? 0 : this.dur * 0.55 + this.spread * 0.4);
    this.u.uCrisp.value = 0;
    if (!o.instant && !this.reduced) this.kick = o.kick === undefined ? 0.5 : o.kick;
    if (this.reduced) this.render();
  }

  /* morfose presa à rolagem: progresso 0 = forma "de", 1 = forma "para" */
  scrub(from, to, p, o = {}) {
    if (!this.renderer) return;
    if (this.splitOn) this.endSplit(true);
    if (this.mode !== 'scrub' || this.fromName !== from || this.shape !== to) {
      const B = this.get(to);
      if (from === '@current') this._capture();
      else { const A = this.get(from); this.aFrom.set(A.pos); this.cFrom.set(A.col); }
      this.aTo.set(B.pos); this.cTo.set(B.col);
      this._flag();
      this.mode = 'scrub';
      this.fromName = from;
      this.shape = to;
      this.opts = B.opts;
      this.dur = o.dur || 1;
      this.spread = o.spread === undefined ? 0.6 : o.spread;
      this.sweep = o.sweep || 0;
      this.arc = o.arc === undefined ? 0.8 : o.arc;
      this._setLinks(null);
      this.linkT = 0;
    }
    this.morphT = clamp(p, 0, 1) * (this.dur + this.spread);
    if (this.reduced) this.render();
  }

  /* comparador: à direita da linha as partículas viram a forma "depois"; à esquerda ficam na forma "antes" */
  beginSplit(before, after) {
    if (!this.renderer) return;
    this.setShape(before, { dur: 1.8, spread: 0.9, force: true, arc: 0.6 });
    const A = this.get(after);
    this.aAux.set(A.pos);
    this.cAux.set(A.col);
    this.attr.aux.needsUpdate = this.attr.ca.needsUpdate = true;
    this.splitOn = true;
    this.splitT = 1;
    this.opts = Object.assign({}, A.opts, { swing: 0, spin: 0, face: true, noise: 0.02 });
    if (this.reduced) { this.split = 1; this.u.uSplit.value = 1; this.render(); }
  }

  setDivider(screenX) {
    this.divSX = screenX;
    if (this.reduced) this.render();
  }

  endSplit(silent) {
    if (!this.splitOn) return;
    if (this.split > 0.001) {
      this._capture();
      this.morphT = 1e3;
      this.aTo.set(this.aFrom);
      this.cTo.set(this.cFrom);
      this._flag();
    }
    this.splitOn = false;
    this.splitT = 0;
    this.split = 0;
    this.u.uSplit.value = 0;
    this.shape = null;
    if (!silent && this.reduced) this.render();
  }

  /* conversões tela para mundo, considerando a câmera centrada (usada nas formas montadas na hora) */
  halfH() { return this.camZ * this.tanHalf; }
  screenToWorld(sx, sy) {
    const W = this._w || innerWidth, H = this._h || innerHeight;
    const hh = this.halfH(), hw = hh * (W / H);
    return [((sx / W) * 2 - 1) * hw, (1 - (sy / H) * 2) * hh];
  }
  rectToWorld(r) {
    const a = this.screenToWorld(r.left, r.bottom), b = this.screenToWorld(r.right, r.top);
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
  }

  localXFromScreen(sx) {
    const W = this._w || window.innerWidth;
    const ndcX = (sx / W) * 2 - 1;
    const cam = this.camera;
    const v = this._v3.set(ndcX, 0, 0.5).unproject(cam).sub(cam.position).normalize();
    const t = v.z !== 0 ? -cam.position.z / v.z : 0;
    const wx = cam.position.x + v.x * t;
    return (wx - this.group.position.x) / (this.group.scale.x || 1);
  }

  setLayout(l, instant) {
    for (const k in l) if (Number.isFinite(l[k])) this.tgt[k] = l[k];
    if (instant || this.reduced) Object.assign(this.cur, this.tgt);
    if (this.reduced) this.render();
  }

  setEnv(v, instant) {
    this.envT = clamp(v, 0, 1);
    if (instant || this.reduced) { this.env = this.envT; this.u.uEnv.value = this.env; this.u.uAdd.value = this.addOverride === null ? this.env : this.addOverride * this.env; }
    if (this.reduced) this.render();
  }

  /* brilho somado no escuro: null segue o ambiente; 0 deixa os pontos nítidos (logo legível) */
  setAdd(v) { this.addOverride = v; if (this.reduced) this.render(); }
  setSpin(extra) { this.spinExtra = extra || 0; }
  setCam(o) { Object.assign(this.camT, o); }

  pointer(x, y) {
    this.ptrT.set(x, y);
    if (this.ptrOn < 0.01) this.ptr.set(x, y);
    this.ptrSeen = this.time;
  }

  attract(on) { this.attractT = on ? 1 : 0; }

  pulse(x, y) {
    this.u.uPulse.value.set(x, y);
    this.u.uPulseT.value = 0;
  }

  velocity(v) { this.vel = v; }

  viewWidth() {
    const h = 2 * this.camZ * this.tanHalf;
    const a = this.camera.aspect;
    return h * (Number.isFinite(a) && a > 0 ? a : window.innerWidth / Math.max(1, window.innerHeight) || 1);
  }

  resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) { this._w = 0; return; }
    if (!force && this._w === w && Math.abs(this._h - h) < 140) return;
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camZ = w / h < 0.8 ? 11 : 10;
    this.camera.updateProjectionMatrix();
    this.u.uFocus.value = this.camZ;
    const ph = this.renderer.getDrawingBufferSize(new Vector2()).y;
    const px = ph * 0.5 * this.camera.projectionMatrix.elements[5];
    this.u.uPx.value = px;
    this.su.uPx.value = px;
    this.u.uAspect.value = w / h;
    if (this.reduced) this.render();
  }

  start() {
    if (this.running || !this.renderer) return;
    this.running = true;
    this.last = performance.now();
    if (this.reduced) { this.render(); return; }
    this.renderer.setAnimationLoop(this._loop);
  }

  stop() {
    this.running = false;
    if (this.renderer) this.renderer.setAnimationLoop(null);
  }

  _loop(now) {
    const dt = Math.min(this.dtMax, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this._quality(dt);
    this.update(dt);
    if (this.cur.o < 0.004 && this.tgt.o < 0.004) return;
    this.render();
  }

  update(dt) {
    if (!this._w) this.resize(true);
    this.time += dt;
    const u = this.u;
    if (this.mode === 'time') this.morphT = Math.min(this.morphT + dt, 1e3);
    u.uTime.value = this.time;
    u.uMorph.value = this.morphT;
    u.uDur.value = this.dur;
    u.uSpread.value = this.spread;
    u.uSweep.value = this.sweep;
    u.uArc.value = this.arc;
    u.uPulseT.value = Math.min(u.uPulseT.value + dt, 9);
    const o = this.opts;
    const c = this.cur, t = this.tgt;
    c.x = damp(c.x, t.x, 2.2, dt);
    c.y = damp(c.y, t.y, this.yK || 2.2, dt);
    c.s = damp(c.s, t.s, 2.2, dt);
    c.o = damp(c.o, t.o, 2.6, dt);
    this.group.position.set(c.x, c.y, 0);
    this.group.scale.setScalar(c.s);
    u.uOpacity.value = c.o;
    this.env = damp(this.env, this.envT, 6, dt);
    u.uEnv.value = this.env;
    const addT = this.addOverride === null ? this.env : this.addOverride * this.env;
    u.uAdd.value = damp(u.uAdd.value, addT, 3, dt);
    this.split = damp(this.split, this.splitOn ? this.splitT : 0, 3, dt);
    u.uSplit.value = this.split;
    const done = this.mode === 'time' && this.morphT >= this.dur + this.spread;
    u.uCrisp.value = damp(u.uCrisp.value, o.crisp && done ? 1 : 0, o.crisp && done ? 1.6 : 6, dt);
    u.uWave.value = damp(u.uWave.value, o.wave || 0, 1.5, dt);
    u.uNoise.value = damp(u.uNoise.value, o.noise === undefined ? 0.03 : o.noise, 1.5, dt);
    u.uGain.value = damp(u.uGain.value, this._gain(o, c), 2, dt);
    const v = Math.min(Math.abs(this.vel), 4000) / 4000;
    u.uJitter.value = damp(u.uJitter.value, 0.018 + v * 0.16, 4, dt);
    u.uSwirl.value = damp(u.uSwirl.value, (this.splitOn ? 0.45 : 0.3) + v * 0.5, 4, dt);
    this.vel *= Math.exp(-dt * 4);
    this._spin(o, dt);
    const sway = (o.swing ? Math.sin(this.time * 0.22) * o.swing : 0) + (o.face ? Math.sin(this.time * 0.3) * 0.06 * (1 - u.uCrisp.value * 0.6) : 0);
    this.group.rotation.y = this.spinAcc + (o.rotY || 0) + sway;
    this.group.rotation.x = damp(this.group.rotation.x, o.tiltX || 0, 1.4, dt);
    this.group.rotation.z = damp(this.group.rotation.z, o.tiltZ || 0, 1.4, dt);
    this.ptrOn = damp(this.ptrOn, this.time - this.ptrSeen < 2.5 ? 1 : 0, 3, dt);
    this.ptr.x = damp(this.ptr.x, this.ptrT.x, 8, dt);
    this.ptr.y = damp(this.ptr.y, this.ptrT.y, 8, dt);
    u.uPointerOn.value = this.splitOn ? this.ptrOn * 0.35 : this.ptrOn;
    u.uAttract.value = damp(u.uAttract.value, this.attractT, this.attractT ? 2.2 : 3.2, dt);
    this._cam(dt);
    if (this.splitOn) u.uDivX.value = this.localXFromScreen(this.divSX);
    if (this.time >= this.linkAt) { this.linkO = damp(this.linkO, this.linkT, 2, dt); this.draw = Math.min(1, this.draw + dt / 1.6); }
    else this.linkO = damp(this.linkO, 0, 8, dt);
    this.lu.uOpacity.value = this.linkO * c.o;
    this.lu.uDraw.value = this.draw;
    this.lu.uTime.value = this.time;
    this.su.uTime.value = this.time;
    this.motes.position.x = -this.camera.position.x * 0.4;
  }

  /* giro: velocidade com aceleração; sem giro, uma mola leva a forma de volta de frente */
  _spin(o, dt) {
    const target = (o.spin || 0) + this.spinExtra;
    if (target) {
      this.settleTo = null;
      this.spinW = damp(this.spinW, target, this.spinExtra ? 0.9 : 1.6, dt);
      this.spinAcc += this.spinW * dt;
      return;
    }
    if (this.settleTo === null) {
      const turns = this.spinAcc / TAU;
      this.settleTo = (this.spinW > 0.4 ? Math.ceil(turns + 0.15) : Math.round(turns)) * TAU;
    }
    const x = this.spinAcc - this.settleTo;
    const k = 5.5, cdamp = 2 * Math.sqrt(k);
    this.spinW += (-x * k - this.spinW * cdamp) * dt;
    this.spinAcc += this.spinW * dt;
  }

  /* câmera: paralaxe com o mouse, deriva lenta, empurrão nas trocas de capítulo e travamento para alinhar formas à página */
  _cam(dt) {
    const cam = this.camera, T = this.camT, O = this.camO;
    O.z = damp(O.z, T.z || 0, 1.6, dt);
    O.orbit = damp(O.orbit, T.orbit || 0, 1.2, dt);
    O.lock = damp(O.lock, T.lock ? 1 : 0, 3, dt);
    this.kick = damp(this.kick, 0, 2.4, dt);
    const free = (1 - O.lock) * (this.splitOn ? 0.25 : 1);
    const px = this.ptrOn * this.ptr.x, py = this.ptrOn * this.ptr.y;
    const tx = (px * 0.5 + Math.sin(this.time * 0.07) * 0.3) * free;
    const ty = (py * 0.32 + Math.cos(this.time * 0.05) * 0.18) * free;
    const z = this.camZ + O.z - this.kick;
    const ox = Math.sin(O.orbit) * z, oz = Math.cos(O.orbit) * z;
    cam.position.x = damp(cam.position.x, tx + ox, 1.6, dt);
    cam.position.y = damp(cam.position.y, ty, 1.6, dt);
    cam.position.z = damp(cam.position.z, oz, 2.4, dt);
    cam.lookAt(0, 0, 0);
  }

  render() {
    if (!this.renderer) return;
    if (this.reduced) {
      const c = this.cur, t = this.tgt;
      Object.assign(c, t);
      this.group.position.set(c.x, c.y, 0);
      this.group.scale.setScalar(c.s);
      const u = this.u;
      u.uOpacity.value = c.o;
      u.uMorph.value = this.morphT;
      u.uDur.value = this.dur;
      u.uSpread.value = this.spread;
      u.uSweep.value = this.sweep;
      u.uArc.value = this.arc;
      this.env = this.envT;
      u.uEnv.value = this.env;
      u.uAdd.value = this.addOverride === null ? this.env : this.addOverride * this.env;
      u.uSplit.value = this.splitOn ? 1 : 0;
      const o = this.opts;
      this.group.rotation.set(o.tiltX || 0, (o.rotY || 0), o.tiltZ || 0);
      u.uWave.value = 0;
      u.uNoise.value = 0;
      u.uCrisp.value = o.crisp ? 1 : 0;
      u.uGain.value = this._gain(o, c);
      this.lu.uOpacity.value = this.linkT * c.o * 0.6;
      this.lu.uDraw.value = 1;
      this.camera.position.set(0, 0, this.camZ);
      this.camera.lookAt(0, 0, 0);
      if (this.splitOn) u.uDivX.value = this.localXFromScreen(this.divSX);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /* força dos pontos: no claro os pontos são tinta; no escuro eles somam luz,
     então formas pequenas e densas (como a logo) recebem menos ganho para não estourar */
  _gain(o, c) {
    const g = (o.gain || 0.55) * (this.N > 20000 ? 1 : 1.12);
    const ppu = (this._w || window.innerWidth) / this.viewWidth();
    const dens = this.N / Math.pow(Math.max(0.05, c.s) * ppu, 2);
    const dk = Math.min(1, Math.max(0.1, 2 / dens));
    const add = this.u ? this.u.uAdd.value : this.env;
    return g * ((1 - this.env) * 1.75 + this.env * (dk * add + (1 - add) * 1.25));
  }

  /* se o aparelho estiver lento: primeiro reduz a resolução, depois a quantidade de partículas */
  _quality(dt) {
    if (this.qualityLocked || this.quality <= 0 || document.hidden) return;
    this.frames.push(dt);
    if (this.frames.length < 60) return;
    const s = this.frames.slice().sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    this.frames = [];
    if (med < 1 / 45) {
      this._okRuns = (this._okRuns || 0) + 1;
      if (this._okRuns > 6) this.qualityLocked = true;
      return;
    }
    this._okRuns = 0;
    if (this.quality === 3 && this.dpr > 1.25) { this.dpr = 1.25; this.renderer.setPixelRatio(1.25); this.resize(true); }
    else if (this.quality >= 2 && this.dpr > 1) { this.dpr = 1; this.renderer.setPixelRatio(1); this.resize(true); this.quality = 2; }
    else if (this.quality >= 1) { this.points.geometry.setDrawRange(0, Math.floor(this.N * (this.quality === 2 ? 0.66 : 0.45))); }
    this.quality--;
    if (this.onQuality) this.onQuality(this.quality);
  }
}
