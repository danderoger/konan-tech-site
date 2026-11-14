/* Konan Tech v2: comportamento da página.
   Organiza a abertura, a rolagem suave (Lenis), as animações de rolagem (GSAP ScrollTrigger)
   e diz ao palco 3D (stage.js) qual forma mostrar em cada capítulo.
   Textos editáveis ficam em content.js. Formas das partículas ficam em shapes.js. */

import { Stage } from './stage.js';
import { HERO_SCENES, SOLUTIONS, CHALLENGES, waLink } from './content.js';

const D = document;
const H = D.documentElement;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
const mq = (q) => window.matchMedia && window.matchMedia(q).matches;

const REDUCED = mq('(prefers-reduced-motion: reduce)');
const COARSE = mq('(pointer: coarse)');
const FINE = mq('(pointer: fine)') && !COARSE;
const gsap = window.gsap;
const ST = window.ScrollTrigger;
const HAS_GSAP = !!(gsap && ST);
const PIN = HAS_GSAP && !REDUCED && !COARSE && window.innerWidth > 1080 && window.innerHeight > 700;
const isWide = () => window.innerWidth > 1080;
const CHECK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

H.classList.add(PIN ? 'pin' : 'no-pin');
if (HAS_GSAP) gsap.registerPlugin(ST);

let stage = null;
let lenis = null;
let ready = false;
let chapter = '';
let heroIdx = 0;
let heroTimer = null;
let solIdx = 0;

/* ---------------------------------------------------------------- palco 3D */

function webglOK() {
  try {
    const c = D.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

async function initStage() {
  if (!webglOK()) { H.classList.add('no-gl'); return null; }
  const small = COARSE || window.innerWidth < 760;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const count = small ? (lowMem ? 9000 : 14000) : (lowMem ? 22000 : 34000);
  try {
    const s = new Stage($('#stage'), { count, dpr: small ? 1.5 : 1.75, reduced: REDUCED, bloom: true });
    await s.init('assets/konan-logo.png');
    s.setShape(REDUCED ? 'logo' : 'seed', { instant: true });
    s.setLayout({ x: 0, y: 0, s: 1, o: 0 }, true);
    return s;
  } catch (e) {
    H.classList.add('no-gl');
    return null;
  }
}

/* posição da escultura em cada capítulo: d = computador, m = celular e tablet (fit = largura a encaixar) */
const LAYOUT = {
  heroLogo: { d: { x: 1.2, y: 1.45, s: 0.95, o: 1 }, m: { x: 0, y: 2.25, fit: 8.4, o: 1 } },
  hero3d: { d: { x: 2.75, y: 1.15, s: 0.85, o: 1 }, m: { x: 0, y: 2.0, fit: 5.6, o: 1 } },
  visao: { d: { x: 0, y: 0, s: 1, o: 0.75 }, m: { x: 0, y: 0, s: 1, o: 0.6 } },
  sobre: { d: { x: 2.9, y: -0.2, s: 0.95, o: 0.95 }, m: { x: 0, y: 1.2, fit: 5.6, o: 0.4 } },
  solucoes: { d: { x: 1.65, y: 0.55, s: 0.78, o: 1 }, m: { x: 0, y: 1.9, fit: 6, o: 0.5 } },
  transformacao: { d: { x: 0, y: -0.2, s: 0.82, o: 1 }, m: { x: 0, y: 0.1, fit: 7.4, o: 0.7 } },
  projetos: { d: { x: 0, y: -3.1, s: 1, o: 0.85 }, m: { x: 0, y: -3.9, s: 1, o: 0.5 } },
  processo: { d: { x: 3.2, y: 0, s: 1, o: 0.9 }, m: { x: 1.5, y: 0, fit: 3.6, o: 0.32 } },
  duvidas: { d: { x: 0, y: 0, s: 1, o: 0.5 }, m: { x: 0, y: 0, s: 1, o: 0.35 } },
  contato: { d: { x: 2.45, y: 0.1, s: 1, o: 1 }, m: { x: 0, y: -1.4, fit: 8.5, o: 0.55 } },
  rodape: { d: { x: 0, y: 1.25, s: 0.7, o: 0.55 }, m: { x: 0, y: 3.1, fit: 9.5, o: 0.3 } }
};

function lay(key) {
  const l = LAYOUT[key] || LAYOUT.visao;
  if (isWide()) return l.d;
  const m = Object.assign({}, l.m);
  if (m.fit) { m.s = stage ? Math.min(1, (stage.viewWidth() * 0.92) / m.fit) : 0.5; delete m.fit; }
  return m;
}

const SHAPE_OF = { visao: 'dust', sobre: 'sphere', transformacao: 'chaos', projetos: 'terrain', processo: 'helix', duvidas: 'dust', contato: 'vortex', rodape: 'logo' };

function setChapter(name) {
  if (name === 'rodape' && !isWide()) name = 'contato';
  if (!name || name === chapter) return;
  chapter = name;
  $$('.nav-links a').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  $$('#rail a').forEach((a) => a.classList.toggle('on', a.dataset.go === name));
  applyChapter();
}

function applyChapter() {
  if (!stage || !ready) return;
  const name = chapter;
  if (name === 'topo') { startHero(); return; }
  stopHero();
  if (name === 'solucoes') { applySol._done = false; applySol(solIdx, false, true); return; }
  if (name === 'transformacao' && (stage.mode === 'scrub' || PIN)) { stage.setLayout(lay(name)); return; }
  stage.setShape(SHAPE_OF[name] || 'dust', { dur: 2, spread: 1 });
  stage.setLayout(lay(name));
}

/* ciclo de formas da primeira tela */
function buildHud() {
  const seg = $('#hud-seg');
  if (!seg) return;
  seg.innerHTML = HERO_SCENES.map(() => '<span><i></i></span>').join('');
}

function hud(i) {
  const sc = HERO_SCENES[i];
  scrambleTo($('#hud-cap'), sc.cap);
  $$('#hud-seg span').forEach((s, k) => {
    s.className = k < i ? 'done' : '';
    const bar = s.firstChild;
    bar.style.animation = 'none';
    if (k === i) {
      void bar.offsetWidth;
      s.className = 'on';
      bar.style.animation = '';
      bar.style.animationDuration = sc.hold + 's';
    }
  });
}

function startHero() {
  stopHero();
  const run = () => {
    const sc = HERO_SCENES[heroIdx];
    stage.setShape(sc.shape, { dur: 2.4, spread: 1.4 });
    stage.setLayout(lay(sc.shape === 'logo' ? 'heroLogo' : 'hero3d'));
    hud(heroIdx);
    if (REDUCED) return;
    heroTimer = setTimeout(() => {
      heroIdx = (heroIdx + 1) % HERO_SCENES.length;
      run();
    }, sc.hold * 1000);
  };
  run();
}

function stopHero() {
  clearTimeout(heroTimer);
  heroTimer = null;
}

/* ---------------------------------------------------------------- efeitos de texto */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/+=#%';

function scrambleTo(el, text) {
  if (!el) return;
  if (REDUCED) { el.textContent = text; return; }
  cancelAnimationFrame(el._raf);
  const from = el.textContent;
  const len = Math.max(from.length, text.length);
  const t0 = performance.now();
  const dur = 420 + text.length * 24;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const rev = Math.floor(p * len);
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = text[i] || '';
      if (i < rev) out += c;
      else if (c === ' ') out += ' ';
      else if (i < rev + 6) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += from[i] || '';
    }
    el.textContent = out;
    if (p < 1) el._raf = requestAnimationFrame(step);
    else el.textContent = text;
  };
  el._raf = requestAnimationFrame(step);
}

function splitWords(el) {
  if (!el || el._split) return [];
  el._split = true;
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w) => '<span class="w" aria-hidden="true">' + w + '</span>').join(' ');
  return $$('.w', el);
}

/* ---------------------------------------------------------------- soluções */

function demoRows(demo) {
  if (demo.kind === 'rows') return demo.rows.map((r) => '<div class="dr"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  if (demo.kind === 'steps') return demo.rows.map((r) => '<div class="dr dr-step"><span>' + r + '</span><em class="ok">' + CHECK + '</em></div>').join('');
  return demo.rows.map((r) => '<div class="dr dr-kpi"><span>' + r[0] + '</span><b data-to="' + r[1] + '" data-suf="' + r[2] + '">0' + r[2] + '</b></div>').join('');
}

function playRows(host, timers) {
  const rows = $$('.dr', host);
  const end = $('.demo-end', host) || $('#demo-end');
  const gap = REDUCED ? 0 : 280;
  rows.forEach((r, k) => {
    timers.push(setTimeout(() => {
      r.classList.add('in');
      const b = r.querySelector('b[data-to]');
      if (b && !b._done) { b._done = true; countUp(b, +b.dataset.to, b.dataset.suf); }
    }, 160 + k * gap));
  });
  if (end) timers.push(setTimeout(() => end.classList.add('in'), 200 + rows.length * gap + 200));
}

function renderDemo(i) {
  const S = SOLUTIONS[i];
  const demo = S.demo;
  const body = $('#demo-body');
  const end = $('#demo-end');
  $('#demo-i').textContent = (i + 1) + ' de ' + SOLUTIONS.length;
  scrambleTo($('#demo-title'), demo.title);
  clearTimeout(renderDemo._t);
  (renderDemo._ts || []).forEach(clearTimeout);
  renderDemo._ts = [];
  end.classList.remove('in');
  end.textContent = demo.end;
  body.innerHTML = demoRows(demo);
  playRows($('#demo'), renderDemo._ts);
}

function countUp(el, to, suf = '', pre = '') {
  if (REDUCED || !HAS_GSAP) { el.textContent = pre + to + suf; return; }
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: () => { el.textContent = pre + Math.round(o.v) + suf; } });
}

function applySol(i, fromUser, forceStage) {
  const changed = i !== solIdx || !applySol._done;
  solIdx = i;
  applySol._done = true;
  $$('#sol-list .so').forEach((li, k) => {
    li.classList.toggle('on', k === i);
    if (PIN) li.querySelector('.so-h').setAttribute('aria-expanded', k === i ? 'true' : 'false');
  });
  $$('#sol-prog i').forEach((d, k) => d.classList.toggle('on', k <= i));
  if (PIN) { if (changed) renderDemo(i); }
  else {
    const m = $$('#sol-list .so')[i].querySelector('.demo-m');
    if (m && !m._played) { m._played = true; playRows(m, []); }
  }
  if (stage && ready && (chapter === 'solucoes' || forceStage)) {
    stage.setShape(SOLUTIONS[i].shape, { dur: 1.9, spread: 1 });
    stage.setLayout(lay('solucoes'));
  }
}

/* ---------------------------------------------------------------- contato */

let typeTok = 0;

function runConsole(i) {
  const C = CHALLENGES[i];
  const tok = ++typeTok;
  $$('#chips .chip').forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
  const msg = 'Olá, vim pelo site da Konan Tech. ' + C.msg.charAt(0).toUpperCase() + C.msg.slice(1);
  $('#console-msg').textContent = msg;
  $('#wa-send').href = waLink(msg);
  const body = $('#console-body');
  body.innerHTML = '';
  let li = 0;
  const next = () => {
    if (tok !== typeTok || li >= C.lines.length) return;
    const p = D.createElement('p');
    p.className = 'cl typing';
    body.appendChild(p);
    const text = C.lines[li++];
    if (REDUCED) { p.textContent = text; p.classList.remove('typing'); next(); return; }
    let k = 0;
    const tick = () => {
      if (tok !== typeTok) return;
      k += 2;
      p.textContent = text.slice(0, k);
      if (k < text.length) setTimeout(tick, 16);
      else { p.classList.remove('typing'); setTimeout(next, 260); }
    };
    tick();
  };
  next();
  if (stage && chapter === 'contato') stage.pulse(0.45, 0);
}

/* ---------------------------------------------------------------- interface geral */

function initButtons() {
  $$('.btn-t').forEach((t) => {
    if (t.firstElementChild) return;
    t.innerHTML = '<span class="btn-r" data-t="' + t.dataset.t + '">' + t.textContent + '</span>';
  });
}

function initMenu() {
  const burger = $('#burger');
  const menu = $('#menu');
  const set = (open) => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  burger.addEventListener('click', () => set(!menu.classList.contains('open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
  D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { set(false); burger.focus(); } });
}

function scrollToTarget(hash) {
  const el = hash === '#topo' ? 0 : $(hash);
  if (el === null) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.6, offset: 0 });
  else if (el === 0) window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
}

function initAnchors() {
  D.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href');
    if (h.length < 2) return;
    e.preventDefault();
    scrollToTarget(h);
    if (h !== '#topo') history.replaceState(null, '', h);
  });
}

function buildRail() {
  const rail = $('#rail');
  rail.innerHTML = $$('main [data-ch]').map((s) => '<a href="#' + s.id + '" data-go="' + s.dataset.ch + '"><i></i><span>' + s.dataset.name + '</span></a>').join('');
}

function initFaq() {
  $$('#faq-list .fq').forEach((fq) => {
    fq.querySelector('.fq-q').addEventListener('click', () => {
      const open = !fq.classList.contains('open');
      $$('#faq-list .fq').forEach((o) => { o.classList.remove('open'); o.querySelector('.fq-q').setAttribute('aria-expanded', 'false'); });
      if (open) { fq.classList.add('open'); fq.querySelector('.fq-q').setAttribute('aria-expanded', 'true'); }
      setTimeout(() => HAS_GSAP && ST.refresh(), 600);
    });
  });
}

function initChips() {
  $$('#chips .chip').forEach((b) => b.addEventListener('click', () => runConsole(+b.dataset.i)));
}

function buildMobileDemos() {
  $('#sol-list').classList.add('sol-static');
  $$('#sol-list .so').forEach((li, i) => {
    const S = SOLUTIONS[i];
    const d = D.createElement('div');
    d.className = 'demo demo-m glass';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="demo-top"><span class="demo-live"><i></i>Simulação ilustrativa</span><span class="demo-i">' + (i + 1) + ' de ' + SOLUTIONS.length + '</span></div>' +
      '<p class="demo-title">' + S.demo.title + '</p><div class="demo-body">' + demoRows(S.demo) + '</div><p class="demo-end">' + S.demo.end + '</p>';
    li.querySelector('.so-bi').appendChild(d);
    li.querySelector('.so-h').setAttribute('aria-expanded', 'true');
  });
}

function initSolutions() {
  if (!PIN) { buildMobileDemos(); return; }
  $$('#sol-list .so-h').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (PIN && solTrigger) {
        const st = solTrigger;
        lenis ? lenis.scrollTo(st.start + ((i + 0.5) / SOLUTIONS.length) * (st.end - st.start), { duration: 1.2 }) : window.scrollTo(0, st.start + ((i + 0.5) / SOLUTIONS.length) * (st.end - st.start));
      } else applySol(i, true, true);
    });
  });
  applySol(0, false, false);
}

function initCursor() {
  if (!FINE || REDUCED || !HAS_GSAP) return;
  const c = $('#cursor');
  H.classList.add('has-cursor');
  const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  D.addEventListener('pointerover', (e) => { c.classList.toggle('hov', !!e.target.closest('a, button, .chip, [data-mag]')); });
  D.addEventListener('pointerleave', () => { c.style.opacity = '0'; });
  D.addEventListener('pointerenter', () => { c.style.opacity = ''; });
}

function initMagnetic() {
  if (!FINE || REDUCED || !HAS_GSAP) return;
  $$('[data-mag]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

function initTilt() {
  if (!FINE || REDUCED) return;
  $$('.pj').forEach((pj) => {
    const t = pj.querySelector('.tilt');
    if (!t) return;
    pj.addEventListener('pointermove', (e) => {
      const r = pj.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      t.style.transform = 'rotateY(' + (x * 12).toFixed(2) + 'deg) rotateX(' + (-y * 9).toFixed(2) + 'deg)';
    });
    pj.addEventListener('pointerleave', () => { t.style.transform = ''; });
  });
}

function initPointer() {
  if (!stage) return;
  const ndc = (e) => [(e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1];
  window.addEventListener('pointermove', (e) => { const p = ndc(e); stage.pointer(p[0], p[1]); }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, .console, .demo, .pj')) return;
    const p = ndc(e);
    stage.pulse(p[0], p[1]);
  }, { passive: true });
}

function initProjectsObserver() {
  if (!('IntersectionObserver' in window)) { $$('.pj').forEach((p) => p.classList.add('on')); return; }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) en.target.classList.add('on'); }), { threshold: 0.35 });
  $$('.pj').forEach((p) => io.observe(p));
}

/* ---------------------------------------------------------------- rolagem */

let solTrigger = null;

function initScroll() {
  if (!HAS_GSAP) { fallbackChapters(); return; }

  if (!REDUCED && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', (e) => { ST.update(); if (stage) stage.velocity(e.velocity * 60); });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const nav = $('#nav');
  const fab = $('#fab');
  let lastY = 0;
  ST.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      $('#progress').style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
      nav.classList.toggle('solid', y > 40);
      const menuOpen = $('#menu').classList.contains('open');
      nav.classList.toggle('hide', !menuOpen && y > 160 && y > lastY + 2);
      if (y < lastY - 2) nav.classList.remove('hide');
      lastY = y;
      fab.classList.toggle('show', y > window.innerHeight * 0.65);
    }
  });

  /* soluções: a seção fica parada e cada trecho da rolagem mostra uma solução */
  if (PIN) {
    solTrigger = ST.create({
      trigger: '#solucoes', start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 0.75 * SOLUTIONS.length),
      pin: true, anticipatePin: 1,
      onUpdate: (self) => {
        const i = Math.min(SOLUTIONS.length - 1, Math.floor(self.progress * SOLUTIONS.length));
        if (i !== solIdx) applySol(i);
      }
    });
  } else {
    $$('#sol-list .so').forEach((li, i) => {
      ST.create({ trigger: li, start: 'top 60%', end: 'bottom 60%', onToggle: (self) => { if (self.isActive) applySol(i, false, false); } });
    });
  }

  /* transformação: a rolagem controla a passagem do caos para a ordem */
  const meter = (p) => {
    $('#tr-pct').textContent = Math.round(p * 100) + '%';
    $('#tr-bar').style.transform = 'scaleX(' + p.toFixed(3) + ')';
    if (PIN) {
      $('#tr-before').style.opacity = String(Math.max(0.28, 1 - p * 1.1));
      $('#tr-after').style.opacity = String(Math.min(1, 0.28 + Math.max(0, p - 0.35) * 1.4));
    } else {
      $('#tr-before').style.opacity = String(Math.max(0, Math.min(1, 1 - p * 2.2)));
      $('#tr-after').style.opacity = String(Math.max(0, Math.min(1, (p - 0.5) * 2.2)));
    }
  };
  const trCfg = {
    trigger: '#transformacao',
    onEnter: () => stage && ready && stage.beginScrub('chaos', 'panel', 0.3, false),
    onEnterBack: () => stage && ready && stage.beginScrub('chaos', 'panel', 0.3, true),
    onLeave: () => stage && stage.endScrub(),
    onLeaveBack: () => stage && stage.endScrub(),
    onUpdate: (self) => {
      const p = Math.min(1, Math.max(0, (self.progress - 0.04) / 0.86));
      if (stage) stage.scrub(p);
      meter(Math.max(0, (p - 0.3) / 0.7));
    }
  };
  if (PIN) ST.create(Object.assign(trCfg, { start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 1.6), pin: true, anticipatePin: 1 }));
  else ST.create(Object.assign(trCfg, { start: 'top top', end: 'bottom bottom' }));
  meter(0);

  /* projetos: galeria horizontal no computador */
  if (PIN) {
    const track = $('#proj-track');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '#proj-pin', start: 'center center', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 }
    });
  }

  /* processo: a linha acende etapa por etapa */
  gsap.fromTo('#steps-line', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#steps', start: 'top 65%', end: 'bottom 60%', scrub: true } });
  $$('#steps .step').forEach((s) => ST.create({ trigger: s, start: 'top 66%', onEnter: () => s.classList.add('on'), onLeaveBack: () => s.classList.remove('on') }));

  /* capítulos: cada seção diz ao palco qual forma mostrar */
  $$('[data-ch]').forEach((sec) => {
    const trg = sec.parentElement && sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
    const st = sec.dataset.ch === 'rodape' ? 'top 85%' : 'top 55%';
    ST.create({ trigger: trg, start: st, end: 'bottom 55%', onToggle: (self) => { if (self.isActive) setChapter(sec.dataset.ch); } });
  });

  /* revelações */
  if (!REDUCED) {
    $$('.h2').forEach((h) => {
      const w = splitWords(h);
      gsap.from(w, { opacity: 0, yPercent: 40, filter: 'blur(10px)', duration: 1.1, ease: 'expo.out', stagger: 0.045, scrollTrigger: { trigger: h, start: 'top 82%' } });
    });
    const mfw = splitWords($('#mf-t'));
    gsap.fromTo(mfw, { opacity: 0.12 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '#mf-t', start: 'top 78%', end: 'bottom 42%', scrub: true } });
    gsap.from('.about-txt > p, .quote', { opacity: 0, y: 30, duration: 1.1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.about-txt', start: 'top 70%' } });
    gsap.from('.principles li', { opacity: 0, y: 30, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.principles', start: 'top 85%' } });
    gsap.from('.ro', { opacity: 0, x: 24, duration: 1.1, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: '.readouts', start: 'top 75%' } });
    gsap.from('.faq-list .fq', { opacity: 0, y: 20, duration: 0.9, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '.faq-list', start: 'top 80%' } });
    gsap.from('.console, .chips .chip', { opacity: 0, y: 26, duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '#contato', start: 'top 65%' } });
  }
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    const pre = el.dataset.pre || '';
    ST.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => countUp(el, to, '', pre) });
  });

  window.addEventListener('load', () => ST.refresh());
  D.fonts && D.fonts.ready.then(() => ST.refresh());
}

function fallbackChapters() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) setChapter(en.target.dataset.ch); }), { rootMargin: '-45% 0px -45% 0px' });
  $$('[data-ch]').forEach((s) => io.observe(s));
  window.addEventListener('scroll', () => $('#fab').classList.toggle('show', window.scrollY > window.innerHeight * 0.65), { passive: true });
}

/* ---------------------------------------------------------------- abertura */

async function boot(stagePromise) {
  const booted = H.classList.contains('booted');
  const num = $('#boot-n');
  const bar = $('#boot-bar');
  let shown = 0;
  let target = 8;
  let done = false;
  const tick = () => {
    shown += (target - shown) * 0.09;
    const v = Math.min(100, Math.round(shown));
    if (num) num.textContent = String(v).padStart(3, '0');
    if (bar) bar.style.transform = 'scaleX(' + (shown / 100).toFixed(3) + ')';
    if (!done) requestAnimationFrame(tick);
  };
  if (!REDUCED) requestAnimationFrame(tick);
  const t0 = performance.now();
  const minT = REDUCED ? 0 : booted ? 350 : 1700;
  const fonts = (D.fonts ? D.fonts.ready : Promise.resolve()).then(() => { target = Math.max(target, 38); });
  const s = await stagePromise;
  target = 86;
  await fonts;
  const wait = minT - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  target = 100;
  if (!REDUCED && !booted) await new Promise((r) => setTimeout(r, 420));
  done = true;
  if (num) num.textContent = '100';
  if (bar) bar.style.transform = 'scaleX(1)';
  try { sessionStorage.setItem('kt-boot', '1'); } catch (e) {}
  return s;
}

function reveal() {
  const bootEl = $('#boot');
  if (stage) {
    stage.start();
    stage.setLayout(Object.assign({}, lay('heroLogo'), { o: 1 }), true);
    stage.setShape('logo', { dur: 2.8, spread: 1.6 });
  }
  if (REDUCED || !HAS_GSAP) {
    if (bootEl) bootEl.style.display = 'none';
    return Promise.resolve();
  }
  const tl = gsap.timeline();
  tl.to(bootEl, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' })
    .set(bootEl, { display: 'none' })
    .fromTo('.h1 .li', { yPercent: 110, '--w': '62%', '--wg': 600, opacity: 0 }, { yPercent: 0, '--w': '125%', '--wg': 250, opacity: 1, duration: 1.8, ease: 'expo.out', stagger: 0.12 }, 0.45)
    .from('.lead, .acts .btn, .hud', { opacity: 0, y: 24, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, 0.9)
    .from('.nav', { opacity: 0, y: -20, duration: 1, ease: 'expo.out' }, 0.7);
  return new Promise((r) => tl.eventCallback('onComplete', r));
}

/* ---------------------------------------------------------------- início */

async function main() {
  buildHud();
  buildRail();
  initButtons();
  initMenu();
  initAnchors();
  initFaq();
  initChips();
  initSolutions();
  initProjectsObserver();
  const sp = initStage();
  stage = await boot(sp);
  window.__ktReady = true;
  initScroll();
  window.konan = { stage: () => stage, lenis: () => lenis, chapter: () => chapter };
  initCursor();
  initMagnetic();
  initTilt();
  initPointer();
  if (!chapter) setChapter('topo');
  const intro = reveal();
  setTimeout(() => {
    ready = true;
    heroIdx = 0;
    applyChapter();
  }, REDUCED ? 0 : 3200);
  await intro;
  if (HAS_GSAP) ST.refresh();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!stage) return;
      stage.resize();
      if (chapter === 'topo') stage.setLayout(lay(HERO_SCENES[heroIdx].shape === 'logo' ? 'heroLogo' : 'hero3d'));
      else stage.setLayout(lay(chapter));
    }, 150);
  });
  D.addEventListener('visibilitychange', () => {
    if (!stage) return;
    if (D.hidden) stage.stop(); else stage.start();
  });
}

main().catch(() => {
  window.__ktReady = true;
  const b = $('#boot');
  if (b) b.style.display = 'none';
});

