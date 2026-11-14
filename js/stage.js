/* Konan Tech 2.0 (versão clara): palco 3D de partículas.
   Um único campo de partículas fica atrás da página inteira e muda de forma a cada capítulo.
   Funciona em ambiente claro (pontos azuis nítidos) e escuro (pontos que brilham), com transição contínua.
   Sem WebGL, o site continua funcionando com a imagem de reserva.
   API principal:
     stage.setShape(nome, { dur, spread, instant })   morfose até outra forma de shapes.js
     stage.setLayout({ x, y, s, o })                  posição, escala e opacidade do conjunto
     stage.setEnv(v)                                  0 = ambiente claro, 1 = ambiente escuro
     stage.beginSplit(antes, depois) / setDivider(px) / endSplit()   comparador que divide o mundo 3D
     stage.pointer(xNdc, yNdc) / stage.pulse(xNdc, yNdc)              interação com mouse e toque */

import {
  Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Points, LineSegments,
  ShaderMaterial, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, AddEquation, Color, Group, Vector2, Vector3
} from './vendor/three.min.js';
import { SHAPES } from './shapes.js';

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => (Number.isFinite(a) ? a + (b - a) * (1 - Math.exp(-k * dt)) : b);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* mistura pré-multiplicada: com alfa vira "normal" (fundo claro), sem alfa vira "aditiva" (fundo escuro) */
const BLEND = { blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, transparent: true, depthWrite: false, depthTest: false };

const VERT = /* glsl */`
attribute vec3 aTo;
attribute vec3 aAux;
attribute vec4 cFrom;
attribute vec4 cTo;
attribute vec4 cAux;
attribute vec4 aRnd;
uniform float uTime, uMorph, uDur, uSpread, uSwirl, uJitter, uWave, uSize, uPx, uOpacity, uAspect, uPointerOn, uPulseT, uMotion, uGain, uEnv, uFocus, uAperture, uSplit, uDivX;
uniform vec2 uPointer, uPulse;
uniform vec3 uHi;
varying vec4 vC;
varying float vSoft;
float ease(float t) { return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
void main() {
  float l = clamp((uMorph - aRnd.x * uSpread) / uDur, 0., 1.);
  float e = ease(l);
  vec3 p = mix(position, aTo, e);
  vec4 col = mix(cFrom, cTo, e);
  float t = uTime * uMotion;
  float ph = aRnd.z * 6.2831;
  float mid = sin(3.14159265 * l);
  float eS = 0.;
  float band = 0.;
  if (uSplit > 0.001) {
    eS = smoothstep(uDivX - .5, uDivX + .5, aAux.x + (aRnd.x - .5) * .55) * uSplit;
    p = mix(p, aAux, eS);
    col = mix(col, cAux, eS);
    band = (1. - abs(eS * 2. - 1.)) * uSplit;
    mid = max(mid, band);
  }
  p += vec3(sin(p.y * 1.7 + t * 1.3 + ph), sin(p.z * 1.9 + t * 1.1 + ph * 1.3), sin(p.x * 1.3 + t * .9 + ph * .7)) * mid * uSwirl;
  p += vec3(sin(t * aRnd.w + ph), cos(t * aRnd.w * 1.3 + ph), sin(t * aRnd.w * .7 + ph * 2.)) * uJitter * (.4 + aRnd.y * .6);
  p.y += (sin(p.x * 1.1 - t * 1.4 + p.z * .5) * .22 + sin(p.x * .45 + p.z * 1.3 - t * .8) * .14) * uWave;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dd = ndc - uPointer; dd.x *= uAspect;
  float dist = length(dd);
  float f = smoothstep(.32, 0., dist) * uPointerOn;
  vec2 dir = dist > 1e-4 ? dd / dist : vec2(0.);
  vec2 dq = ndc - uPulse; dq.x *= uAspect;
  float pd = length(dq);
  float ring = exp(-pow((pd - uPulseT * 1.5) * 6., 2.)) * max(0., 1. - uPulseT / 1.6);
  vec2 pdir = pd > 1e-4 ? dq / pd : vec2(0.);
  mv.xy += (dir * f * .5 + pdir * ring * .35) * (-mv.z) * .11;
  gl_Position = projectionMatrix * mv;
  float blur = abs(-mv.z - uFocus) * uAperture;
  float sz = uSize * (.55 + aRnd.y * .9) * (1. + blur * 2.2) * (1. + uEnv * .35);
  gl_PointSize = clamp(sz * uPx / -mv.z, 1., 64.);
  vSoft = clamp(blur * 1.6, 0., 1.);
  float lum = dot(col.rgb, vec3(.299, .587, .114));
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  vec3 neutral = mix(vec3(.5, .6, .74), vec3(.92, .96, 1.), clamp(1. - lum * 1.5, 0., 1.));
  vec3 vivid = 1. - (1. - col.rgb) * .55;
  vec3 c = mix(col.rgb, mix(neutral, vivid, smoothstep(.3, .5, sat)), uEnv);
  float hi = clamp(f * .35 + ring * .9 + band * .85 + mid * .2, 0., 1.);
  c = mix(c, mix(uHi, vec3(.75, .93, 1.), uEnv), hi);
  float tw = .8 + .2 * sin(uTime * uMotion * (1. + aRnd.w * 2.) + ph * 3.);
  float depth = smoothstep(28., 5., -mv.z);
  float a = uOpacity * uGain * col.a * tw * (.35 + .65 * depth) / (1. + blur * blur * 4.);
  vC = vec4(c, clamp(a, 0., 1.));
}`;

const FRAG = /* glsl */`
uniform float uEnv;
varying vec4 vC;
varying float vSoft;
void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  if (d > 1.) discard;
  float edge = mix(.22, .95, vSoft);
  float disc = 1. - smoothstep(1. - edge, 1., d);
  float glow = exp(-d * d * 3.5);
  float a = mix(disc, glow, uEnv * .8) * vC.a;
  gl_FragColor = vec4(vC.rgb * a, a * (1. - uEnv));
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
  vD = smoothstep(24., 6., -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const LINK_FRAG = /* glsl */`
uniform float uTime, uOpacity, uEnv;
uniform vec3 uBaseL, uBaseD, uPulseL, uPulseD;
varying float vT;
varying float vS;
varying float vD;
void main() {
  float w = fract(uTime * .3 + vS);
  float g = exp(-pow((vT - w) * 8., 2.));
  vec3 base = mix(uBaseL, uBaseD, uEnv);
  vec3 c = mix(base, mix(uPulseL, uPulseD, uEnv), g);
  float a = uOpacity * (mix(.16, .07, uEnv) + .8 * g) * vD;
  gl_FragColor = vec4(c * a, a * (1. - uEnv));
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

/* lê os pixels da logo oficial para as partículas formarem a marca */
export function sampleLogo(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const W = 1000, H = Math.round((img.naturalHeight / img.naturalWidth) * W);
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
          out.push(x / W, (0.5 - y / H) * (H / W), (0.299 * r + 0.587 * gg + 0.114 * b) / 255, blue);
        }
        resolve(new Float32Array(out));
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
    this.cache = {};
    this.logoPx = null;
    this.time = 0;
    this.morphT = 1e3;
    this.dur = 2.2;
    this.spread = 1.2;
    this.mode = 'time';
    this.shape = null;
    this.opts = {};
    this.spinAcc = 0;
    this.cur = { x: 0, y: 0, s: 1, o: 0 };
    this.tgt = { x: 0, y: 0, s: 1, o: 1 };
    this.env = 0;
    this.envT = 0;
    this.split = 0;
    this.splitT = 0;
    this.divSX = 0;
    this.ptr = new Vector2(9, 9);
    this.ptrT = new Vector2(9, 9);
    this.ptrOn = 0;
    this.ptrSeen = -10;
    this.vel = 0;
    this.linkO = 0;
    this.linkT = 0;
    this.linkAt = 0;
    this.running = false;
    this.frames = [];
    this.quality = 2;
    this.onQuality = null;
    this._v3 = new Vector3();
    const q = new URLSearchParams(location.search);
    this.dtMax = q.has('fast') ? 0.6 : 0.05;
    if (q.has('hq')) this.qualityLocked = true;
    this._loop = this._loop.bind(this);
  }

  async init(logoUrl) {
    this.logoPx = logoUrl ? await sampleLogo(logoUrl) : null;
    const r = this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprMax));
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.group = new Group();
    this.scene.add(this.group);
    this._buildPoints();
    this._buildLinks();
    this._buildMotes();
    this.resize(true);
    return this;
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
    this.u = {
      uTime: { value: 0 }, uMorph: { value: 1e3 }, uDur: { value: 2.2 }, uSpread: { value: 1.2 },
      uSwirl: { value: 0.32 }, uJitter: { value: 0.022 }, uWave: { value: 0 }, uSize: { value: this.N > 20000 ? 0.028 : 0.036 }, uGain: { value: 0.6 },
      uPx: { value: 500 }, uOpacity: { value: 0 }, uAspect: { value: 1 }, uPointerOn: { value: 0 },
      uPulseT: { value: 9 }, uMotion: { value: this.reduced ? 0 : 1 }, uEnv: { value: 0 },
      uFocus: { value: 10 }, uAperture: { value: 0.11 }, uSplit: { value: 0 }, uDivX: { value: 0 },
      uPointer: { value: this.ptr }, uPulse: { value: new Vector2(9, 9) }, uHi: { value: new Color(0x258cf8) }
    };
    const m = new ShaderMaterial(Object.assign({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }, BLEND));
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _buildLinks() {
    this.lu = {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uEnv: this.u.uEnv,
      uBaseL: { value: new Color(0x2b4a6e) }, uBaseD: { value: new Color(0x3ea6ff) },
      uPulseL: { value: new Color(0x258cf8) }, uPulseD: { value: new Color(0xd8f4ff) }
    };
    const m = new ShaderMaterial(Object.assign({ uniforms: this.lu, vertexShader: LINK_VERT, fragmentShader: LINK_FRAG }, BLEND));
    this.links = new LineSegments(new BufferGeometry(), m);
    this.links.frustumCulled = false;
    this.links.visible = false;
    this.group.add(this.links);
  }

  _setLinks(arr) {
    const g = new BufferGeometry();
    if (arr && arr.length) {
      const segs = arr.length / 6;
      const t = new Float32Array(segs * 2), sd = new Float32Array(segs * 2);
      for (let k = 0; k < segs; k++) { t[k * 2] = 0; t[k * 2 + 1] = 1; const v = Math.random(); sd[k * 2] = v; sd[k * 2 + 1] = v; }
      g.setAttribute('position', new BufferAttribute(arr, 3));
      g.setAttribute('aT', new BufferAttribute(t, 1));
      g.setAttribute('aSeed', new BufferAttribute(sd, 1));
    }
    this.links.geometry.dispose();
    this.links.geometry = g;
    this.links.visible = !!(arr && arr.length);
  }

  _buildMotes() {
    const n = this.N > 20000 ? 900 : 380;
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
      const fn = SHAPES[name] || SHAPES.sphere;
      const S = name === 'logo' ? fn(this.N, this.logoPx) : name === 'chaosA' ? fn(this.N, this.get('panel').pos) : fn(this.N);
      this.cache[name] = { pos: S.pos, col: S.col, links: S.links || null, opts: S.opts || {} };
    }
    return this.cache[name];
  }

  _flag() {
    const a = this.attr;
    a.from.needsUpdate = a.to.needsUpdate = a.cf.needsUpdate = a.ct.needsUpdate = true;
  }

  /* congela a posição atual de cada partícula como novo ponto de partida */
  _capture() {
    const n = this.N, T = this.morphT, D = this.dur, SP = this.spread;
    const sp = this.split > 0.001 ? this.split : 0;
    const dx = this.u.uDivX.value;
    if (T >= D + SP && !sp) {
      this.aFrom.set(this.aTo);
      this.cFrom.set(this.cTo);
      return;
    }
    for (let i = 0; i < n; i++) {
      let l = (T - this.rnd[i * 4] * SP) / D;
      l = l < 0 ? 0 : l > 1 ? 1 : l;
      const e = ease(l);
      const k = i * 3, c = i * 4;
      for (let j = 0; j < 3; j++) this.aFrom[k + j] += (this.aTo[k + j] - this.aFrom[k + j]) * e;
      for (let j = 0; j < 4; j++) this.cFrom[c + j] += (this.cTo[c + j] - this.cFrom[c + j]) * e;
      if (sp) {
        const es = smooth(dx - 0.5, dx + 0.5, this.aAux[k] + (this.rnd[i * 4] - 0.5) * 0.55) * sp;
        if (es > 0) {
          for (let j = 0; j < 3; j++) this.aFrom[k + j] += (this.aAux[k + j] - this.aFrom[k + j]) * es;
          for (let j = 0; j < 4; j++) this.cFrom[c + j] += (this.cAux[c + j] - this.cFrom[c + j]) * es;
        }
      }
    }
  }

  setShape(name, o = {}) {
    if (!this.renderer) return;
    if (name === this.shape && !this.splitOn && !o.force) return;
    if (this.splitOn) this.endSplit(true);
    const S = this.get(name);
    this._capture();
    this.aTo.set(S.pos);
    this.cTo.set(S.col);
    this._flag();
    this.dur = o.dur || 2.2;
    this.spread = o.spread === undefined ? 1.2 : o.spread;
    this.morphT = o.instant || this.reduced ? 1e3 : 0;
    this.shape = name;
    this.opts = S.opts;
    this._setLinks(S.links);
    this.linkO = 0;
    this.linkT = S.links ? 1 : 0;
    this.linkAt = this.time + (o.instant || this.reduced ? 0 : this.dur * 0.75 + this.spread * 0.5);
    if (this.reduced) this.render();
  }

  /* comparador: as partículas à direita da linha viram a forma "depois"; à esquerda ficam na forma "antes" */
  beginSplit(before, after) {
    if (!this.renderer) return;
    this.setShape(before, { dur: 1.8, spread: 0.9, force: true });
    const A = this.get(after);
    this.aAux.set(A.pos);
    this.cAux.set(A.col);
    this.attr.aux.needsUpdate = this.attr.ca.needsUpdate = true;
    this.splitOn = true;
    this.splitT = 1;
    this.opts = Object.assign({}, A.opts, { swing: 0, spin: 0, face: false });
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

  /* posição x (no espaço da forma) que corresponde a um ponto x da tela */
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
    this.envT = Math.max(0, Math.min(1, v));
    if (instant || this.reduced) { this.env = this.envT; this.u.uEnv.value = this.env; }
    if (this.reduced) this.render();
  }

  pointer(x, y) {
    this.ptrT.set(x, y);
    if (this.ptrOn < 0.01) this.ptr.set(x, y);
    this.ptrSeen = this.time;
  }

  pulse(x, y) {
    this.u.uPulse.value.set(x, y);
    this.u.uPulseT.value = 0;
  }

  velocity(v) { this.vel = v; }

  /* largura visível no plano z = 0, para encaixar formas no celular */
  viewWidth() {
    const h = 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360);
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
    this.camera.position.z = w / h < 0.8 ? 11 : 10;
    this.camera.updateProjectionMatrix();
    this.u.uFocus.value = this.camera.position.z;
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
    this.split = damp(this.split, this.splitOn ? this.splitT : 0, 3, dt);
    u.uSplit.value = this.split;
    u.uWave.value = damp(u.uWave.value, o.wave || 0, 1.5, dt);
    u.uGain.value = damp(u.uGain.value, this._gain(o, c), 2, dt);
    const v = Math.min(Math.abs(this.vel), 4000) / 4000;
    u.uJitter.value = damp(u.uJitter.value, 0.02 + v * 0.16, 4, dt);
    u.uSwirl.value = damp(u.uSwirl.value, (this.splitOn ? 0.45 : 0.3) + v * 0.5, 4, dt);
    this.vel *= Math.exp(-dt * 4);
    if (o.spin) this.spinAcc += o.spin * dt;
    else {
      const k = Math.round(this.spinAcc / TAU) * TAU;
      this.spinAcc = damp(this.spinAcc, k, 1.2, dt);
    }
    const sway = (o.swing ? Math.sin(this.time * 0.22) * o.swing : 0) + (o.face ? Math.sin(this.time * 0.3) * 0.1 : 0);
    this.group.rotation.y = this.spinAcc + (o.rotY || 0) + sway;
    this.group.rotation.x = damp(this.group.rotation.x, o.tiltX || 0, 1.4, dt);
    this.group.rotation.z = damp(this.group.rotation.z, o.tiltZ || 0, 1.4, dt);
    this.ptrOn = damp(this.ptrOn, this.time - this.ptrSeen < 2.5 ? 1 : 0, 3, dt);
    this.ptr.x = damp(this.ptr.x, this.ptrT.x, 8, dt);
    this.ptr.y = damp(this.ptr.y, this.ptrT.y, 8, dt);
    u.uPointerOn.value = this.splitOn ? this.ptrOn * 0.35 : this.ptrOn;
    const cam = this.camera;
    const calm = this.splitOn ? 0.25 : 1;
    const px = this.ptrOn * this.ptr.x, py = this.ptrOn * this.ptr.y;
    cam.position.x = damp(cam.position.x, (px * 0.5 + Math.sin(this.time * 0.07) * 0.3) * calm, 1.6, dt);
    cam.position.y = damp(cam.position.y, (py * 0.32 + Math.cos(this.time * 0.05) * 0.18) * calm, 1.6, dt);
    cam.lookAt(0, 0, 0);
    if (this.splitOn) u.uDivX.value = this.localXFromScreen(this.divSX);
    if (this.time >= this.linkAt) this.linkO = damp(this.linkO, this.linkT, 2, dt);
    else this.linkO = damp(this.linkO, 0, 8, dt);
    this.lu.uOpacity.value = this.linkO * c.o;
    this.lu.uTime.value = this.time;
    this.su.uTime.value = this.time;
    this.motes.position.x = -cam.position.x * 0.4;
  }

  render() {
    if (!this.renderer) return;
    if (this.reduced) {
      const c = this.cur, t = this.tgt;
      Object.assign(c, t);
      this.group.position.set(c.x, c.y, 0);
      this.group.scale.setScalar(c.s);
      this.u.uOpacity.value = c.o;
      this.u.uMorph.value = this.morphT;
      this.u.uDur.value = this.dur;
      this.u.uSpread.value = this.spread;
      this.env = this.envT;
      this.u.uEnv.value = this.env;
      this.u.uSplit.value = this.splitOn ? 1 : 0;
      const o = this.opts;
      this.group.rotation.set(o.tiltX || 0, (o.rotY || 0), o.tiltZ || 0);
      this.u.uWave.value = 0;
      this.u.uGain.value = this._gain(o, c);
      this.lu.uOpacity.value = this.linkT * c.o * 0.6;
      this.camera.lookAt(0, 0, 0);
      if (this.splitOn) this.u.uDivX.value = this.localXFromScreen(this.divSX);
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
    return g * ((1 - this.env) * 1.75 + this.env * dk);
  }

  /* se o aparelho estiver lento, reduz a resolução e depois a quantidade de partículas */
  _quality(dt) {
    if (this.qualityLocked || this.quality <= 0 || document.hidden) return;
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames = [];
    if (avg < 1 / 40) {
      this._okRuns = (this._okRuns || 0) + 1;
      if (this._okRuns > 5) this.qualityLocked = true;
      return;
    }
    if (this.quality === 2) {
      this.renderer.setPixelRatio(1);
      this.resize(true);
      this.quality = 1;
    } else if (this.quality === 1) {
      this.points.geometry.setDrawRange(0, Math.floor(this.N * 0.6));
      this.quality = 0;
    }
    if (this.onQuality) this.onQuality(this.quality);
  }
}
