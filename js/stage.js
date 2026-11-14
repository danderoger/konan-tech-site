/* Konan Tech v2: palco 3D de partículas.
   Um único campo de partículas fica atrás da página inteira e muda de forma a cada capítulo.
   Usa Three.js com brilho (bloom). Sem WebGL, o site continua funcionando com a imagem de reserva.
   API principal:
     stage.setShape(nome, { dur, spread, instant })   morfose até outra forma de shapes.js
     stage.setLayout({ x, y, s, o })                  posição, escala e opacidade do conjunto
     stage.beginScrub(nome) / stage.scrub(p) / stage.endScrub()   morfose controlada pela rolagem
     stage.pointer(xNdc, yNdc) / stage.pulse(xNdc, yNdc)          interação com mouse e toque */

import {
  Scene, PerspectiveCamera, WebGLRenderer, BufferGeometry, BufferAttribute, Points, LineSegments,
  ShaderMaterial, AdditiveBlending, Color, Group, Vector2,
  EffectComposer, RenderPass, UnrealBloomPass, OutputPass
} from './vendor/three.min.js';
import { SHAPES } from './shapes.js';

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => (Number.isFinite(a) ? a + (b - a) * (1 - Math.exp(-k * dt)) : b);

const VERT = /* glsl */`
attribute vec3 aTo;
attribute vec3 cFrom;
attribute vec3 cTo;
attribute vec4 aRnd;
uniform float uTime, uMorph, uDur, uSpread, uSwirl, uJitter, uWave, uSize, uPx, uOpacity, uAspect, uPointerOn, uPulseT, uMotion, uGain;
uniform vec2 uPointer, uPulse;
varying vec3 vCol;
varying float vA;
float ease(float t) { return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
void main() {
  float l = clamp((uMorph - aRnd.x * uSpread) / uDur, 0., 1.);
  float e = ease(l);
  vec3 p = mix(position, aTo, e);
  float mid = sin(3.14159265 * l);
  float t = uTime * uMotion;
  float ph = aRnd.z * 6.2831;
  p += vec3(sin(p.y * 1.7 + t * 1.3 + ph), sin(p.z * 1.9 + t * 1.1 + ph * 1.3), sin(p.x * 1.3 + t * .9 + ph * .7)) * mid * uSwirl;
  p += vec3(sin(t * aRnd.w + ph), cos(t * aRnd.w * 1.3 + ph), sin(t * aRnd.w * .7 + ph * 2.)) * uJitter * (.4 + aRnd.y * .6);
  p.y += (sin(p.x * 1.1 - t * 1.4 + p.z * .5) * .22 + sin(p.x * .45 + p.z * 1.3 - t * .8) * .14) * uWave;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 dd = ndc - uPointer; dd.x *= uAspect;
  float dist = length(dd);
  float f = smoothstep(.34, 0., dist) * uPointerOn;
  vec2 dir = dist > 1e-4 ? dd / dist : vec2(0.);
  vec2 dq = ndc - uPulse; dq.x *= uAspect;
  float pd = length(dq);
  float band = exp(-pow((pd - uPulseT * 1.5) * 6., 2.)) * max(0., 1. - uPulseT / 1.6);
  vec2 pdir = pd > 1e-4 ? dq / pd : vec2(0.);
  mv.xy += (dir * f * .5 + pdir * band * .35) * (-mv.z) * .11;
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (.55 + aRnd.y * .9);
  gl_PointSize = clamp(sz * uPx / -mv.z, 1., 48.);
  vCol = mix(cFrom, cTo, e) * (1. + f * .9 + band * 1.6 + mid * .35);
  float tw = .74 + .26 * sin(uTime * uMotion * (1. + aRnd.w * 2.) + ph * 3.);
  float depth = smoothstep(26., 5., -mv.z);
  vA = uOpacity * uGain * tw * (.3 + .7 * depth);
}`;

const FRAG = /* glsl */`
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - .5;
  float d = length(c);
  if (d > .5) discard;
  float a = smoothstep(.5, 0., d);
  a *= a;
  gl_FragColor = vec4(vCol, a * vA);
  #include <colorspace_fragment>
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
uniform float uTime, uOpacity;
uniform vec3 uA, uB;
varying float vT;
varying float vS;
varying float vD;
void main() {
  float w = fract(uTime * .32 + vS);
  float g = exp(-pow((vT - w) * 8., 2.));
  vec3 c = mix(uA, uB, g);
  gl_FragColor = vec4(c, uOpacity * (.06 + .9 * g) * vD);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */`
attribute float aS;
uniform float uTime, uPx, uMotion, uOpacity;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(.03 * uPx / -mv.z * (.5 + aS), 1., 6.);
  vA = uOpacity * (.25 + .35 * sin(uTime * uMotion * (.4 + aS) + aS * 40.)) ;
}`;

const STAR_FRAG = /* glsl */`
varying float vA;
void main() {
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  gl_FragColor = vec4(vec3(.62, .72, .85), smoothstep(.5, 0., d) * max(vA, 0.));
  #include <colorspace_fragment>
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
    this.useBloom = o.bloom !== false;
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
    const q = new URLSearchParams(location.search);
    this.dtMax = q.has('fast') ? 0.6 : 0.05;
    if (q.has('hq')) this.qualityLocked = true;
    this._loop = this._loop.bind(this);
  }

  async init(logoUrl) {
    this.logoPx = logoUrl ? await sampleLogo(logoUrl) : null;
    const r = this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    r.setClearColor(0x000000, 1);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprMax));
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.group = new Group();
    this.scene.add(this.group);
    this._buildPoints();
    this._buildLinks();
    this._buildStars();
    if (this.useBloom) {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.9, 0.28, 0.42);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize(true);
    return this;
  }

  _buildPoints() {
    const n = this.N;
    const g = new BufferGeometry();
    this.aFrom = new Float32Array(n * 3);
    this.aTo = new Float32Array(n * 3);
    this.cFrom = new Float32Array(n * 3);
    this.cTo = new Float32Array(n * 3);
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
      cf: new BufferAttribute(this.cFrom, 3),
      ct: new BufferAttribute(this.cTo, 3)
    };
    g.setAttribute('position', this.attr.from);
    g.setAttribute('aTo', this.attr.to);
    g.setAttribute('cFrom', this.attr.cf);
    g.setAttribute('cTo', this.attr.ct);
    g.setAttribute('aRnd', new BufferAttribute(this.rnd, 4));
    this.u = {
      uTime: { value: 0 }, uMorph: { value: 1e3 }, uDur: { value: 2.2 }, uSpread: { value: 1.2 },
      uSwirl: { value: 0.32 }, uJitter: { value: 0.025 }, uWave: { value: 0 }, uSize: { value: this.N > 20000 ? 0.03 : 0.04 }, uGain: { value: 0.5 },
      uPx: { value: 500 }, uOpacity: { value: 0 }, uAspect: { value: 1 }, uPointerOn: { value: 0 },
      uPulseT: { value: 9 }, uMotion: { value: this.reduced ? 0 : 1 },
      uPointer: { value: this.ptr }, uPulse: { value: new Vector2(9, 9) }
    };
    const m = new ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  _buildLinks() {
    this.lu = { uTime: { value: 0 }, uOpacity: { value: 0 }, uA: { value: new Color(0x3ea6ff) }, uB: { value: new Color(0xd8f4ff) } };
    const m = new ShaderMaterial({ uniforms: this.lu, vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
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

  _buildStars() {
    const n = this.N > 20000 ? 1400 : 600;
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
    this.su = { uTime: { value: 0 }, uPx: { value: 500 }, uMotion: { value: this.reduced ? 0 : 1 }, uOpacity: { value: 1 } };
    const m = new ShaderMaterial({ uniforms: this.su, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
    this.stars = new Points(g, m);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  get(name) {
    if (!this.cache[name]) {
      const fn = SHAPES[name] || SHAPES.sphere;
      const S = name === 'logo' ? fn(this.N, this.logoPx) : fn(this.N);
      const col = new Float32Array(S.col.length);
      const c = new Color();
      for (let i = 0; i < S.col.length; i += 3) {
        c.setRGB(S.col[i], S.col[i + 1], S.col[i + 2]).convertSRGBToLinear();
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
      }
      this.cache[name] = { pos: S.pos, col, links: S.links || null, opts: S.opts || {} };
    }
    return this.cache[name];
  }

  /* congela a posição atual de cada partícula como novo ponto de partida */
  _capture() {
    const n = this.N, T = this.morphT, D = this.dur, SP = this.spread;
    if (T >= D + SP) {
      this.aFrom.set(this.aTo);
      this.cFrom.set(this.cTo);
    } else {
      for (let i = 0; i < n; i++) {
        let l = (T - this.rnd[i * 4] * SP) / D;
        l = l < 0 ? 0 : l > 1 ? 1 : l;
        const e = ease(l);
        if (e === 0) continue;
        const k = i * 3;
        this.aFrom[k] += (this.aTo[k] - this.aFrom[k]) * e;
        this.aFrom[k + 1] += (this.aTo[k + 1] - this.aFrom[k + 1]) * e;
        this.aFrom[k + 2] += (this.aTo[k + 2] - this.aFrom[k + 2]) * e;
        this.cFrom[k] += (this.cTo[k] - this.cFrom[k]) * e;
        this.cFrom[k + 1] += (this.cTo[k + 1] - this.cFrom[k + 1]) * e;
        this.cFrom[k + 2] += (this.cTo[k + 2] - this.cFrom[k + 2]) * e;
      }
    }
  }

  setShape(name, o = {}) {
    if (!this.renderer) return;
    if (name === this.shape && this.mode === 'time' && !o.force) return;
    const S = this.get(name);
    this._capture();
    this.aTo.set(S.pos);
    this.cTo.set(S.col);
    this.attr.from.needsUpdate = this.attr.to.needsUpdate = this.attr.cf.needsUpdate = this.attr.ct.needsUpdate = true;
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

  /* morfose controlada pela rolagem em dois trechos: forma atual, forma intermediária, forma final.
     backward = true quando o visitante entra de baixo para cima, para não haver salto. */
  beginScrub(via, to, split = 0.3, backward = false) {
    if (!this.renderer) return;
    this._capture();
    const A = { pos: this.aFrom.slice(), col: this.cFrom.slice(), opts: this.opts };
    const V = this.get(via), T = this.get(to);
    this.segs = backward ? [[V, T], [T, A]] : [[A, V], [V, T]];
    this.split = split;
    this.seg = -1;
    this.mode = 'scrub';
    this.dur = 1.3;
    this.spread = 1.5;
    this.shape = null;
    this._setLinks(null);
    this.linkT = 0;
    this.scrub(backward ? 1 : 0);
  }

  _seg(k) {
    if (k === this.seg) return;
    this.seg = k;
    const F = this.segs[k][0], T = this.segs[k][1];
    this.aFrom.set(F.pos); this.cFrom.set(F.col);
    this.aTo.set(T.pos); this.cTo.set(T.col);
    this.attr.from.needsUpdate = this.attr.to.needsUpdate = this.attr.cf.needsUpdate = this.attr.ct.needsUpdate = true;
    this.opts = T.opts || {};
  }

  scrub(p) {
    if (this.mode !== 'scrub' || !this.segs) return;
    p = Math.max(0, Math.min(1, p));
    const s = this.split, TT = this.dur + this.spread;
    if (p < s) { this._seg(0); this.morphT = (p / s) * TT; }
    else { this._seg(1); this.morphT = ((p - s) / (1 - s)) * TT; }
    if (this.reduced) this.render();
  }

  endScrub() {
    if (this.mode !== 'scrub') return;
    this.mode = 'time';
    this.segs = null;
  }

  setLayout(l, instant) {
    for (const k in l) if (Number.isFinite(l[k])) this.tgt[k] = l[k];
    if (instant || this.reduced) Object.assign(this.cur, this.tgt);
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
    const ph = this.renderer.getDrawingBufferSize(new Vector2()).y;
    const px = ph * 0.5 * this.camera.projectionMatrix.elements[5];
    this.u.uPx.value = px;
    this.su.uPx.value = px;
    this.u.uAspect.value = w / h;
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
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
    c.y = damp(c.y, t.y, 2.2, dt);
    c.s = damp(c.s, t.s, 2.2, dt);
    c.o = damp(c.o, t.o, 2.6, dt);
    this.group.position.set(c.x, c.y, 0);
    this.group.scale.setScalar(c.s);
    u.uOpacity.value = c.o;
    u.uWave.value = damp(u.uWave.value, o.wave || 0, 1.5, dt);
    u.uGain.value = damp(u.uGain.value, (o.gain || 0.55) * (this.N > 20000 ? 1 : 1.12), 2, dt);
    const v = Math.min(Math.abs(this.vel), 4000) / 4000;
    u.uJitter.value = damp(u.uJitter.value, 0.022 + v * 0.16, 4, dt);
    u.uSwirl.value = damp(u.uSwirl.value, 0.3 + v * 0.5, 4, dt);
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
    u.uPointerOn.value = this.ptrOn;
    const cam = this.camera;
    const px = this.ptrOn * this.ptr.x, py = this.ptrOn * this.ptr.y;
    cam.position.x = damp(cam.position.x, px * 0.5 + Math.sin(this.time * 0.07) * 0.3, 1.6, dt);
    cam.position.y = damp(cam.position.y, py * 0.32 + Math.cos(this.time * 0.05) * 0.18, 1.6, dt);
    cam.lookAt(0, 0, 0);
    if (this.time >= this.linkAt) this.linkO = damp(this.linkO, this.linkT, 2, dt);
    else this.linkO = damp(this.linkO, 0, 8, dt);
    this.lu.uOpacity.value = this.linkO * c.o;
    this.lu.uTime.value = this.time;
    this.su.uTime.value = this.time;
    this.stars.position.x = -cam.position.x * 0.4;
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
      const o = this.opts;
      this.group.rotation.set(o.tiltX || 0, (o.rotY || 0), o.tiltZ || 0);
      this.u.uWave.value = 0;
      this.u.uGain.value = (o.gain || 0.55) * (this.N > 20000 ? 1 : 1.12);
      this.lu.uOpacity.value = this.linkT * c.o * 0.6;
      this.camera.lookAt(0, 0, 0);
    }
    if (this.composer && this.quality > 0) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /* se o aparelho estiver lento, reduz resolução, depois brilho, depois quantidade */
  _quality(dt) {
    if (this.qualityLocked || this.quality <= -1 || document.hidden) return;
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
      this.quality = 0;
    } else if (this.quality === 0) {
      this.points.geometry.setDrawRange(0, Math.floor(this.N * 0.55));
      this.quality = -1;
    }
    if (this.onQuality) this.onQuality(this.quality);
  }
}
