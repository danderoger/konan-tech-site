/* Konan Tech 3.0: comportamento da página.
   O conteúdo aparece primeiro; o palco 3D e cada demonstração carregam depois, só quando fazem falta.
   Sem WebGL, tudo funciona com a imagem de reserva. */

import { WA_DEFAULT, waLink, waContext, HERO_SCENES } from './content.js';
import { initKinetic } from './kinetic.js';
import { probeGL, pickTier, TIERS } from './perf.js';

const D = document, H = D.documentElement;
const REDUCED = H.classList.contains('rm');
const FINE = matchMedia('(pointer: fine)').matches;
const NARROW = () => innerWidth <= 760 || (innerWidth <= 1080 && innerWidth / innerHeight < 0.9);
const q = (s, r = D) => r.querySelector(s);
const qa = (s, r = D) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let stage = null, lenis = null, chapter = null;
const demos = {};

/* ---------- WhatsApp: todo link [data-wa] recebe a mensagem do contexto ---------- */
function setWa(a, frase) { a.href = waLink(frase ? waContext(frase) : WA_DEFAULT); }
qa('[data-wa]').forEach((a) => { if (a.id !== 'lab-send') setWa(a, a.dataset.msg); });

/* ---------- cabeçalho, menu e trilho de capítulos ---------- */
const hd = q('#hd');
const menuBtn = q('#menu-btn');
function setMenu(open) {
  hd.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.sr').textContent = open ? 'Fechar menu' : 'Abrir menu';
}
menuBtn.addEventListener('click', () => setMenu(!hd.classList.contains('open')));
D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hd.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
const NAV_OF = { solucoes: '#solucoes', projetos: '#projetos', ia: '#ia', automacao: '#ia', sistemas: '#ia', compare: '#ia', processo: '#processo', lab: '#diagnostico' };
const RAIL = qa('#rail a');
const RAIL_ORDER = RAIL.map((a) => a.dataset.r);
function markNav(name) {
  const href = NAV_OF[name];
  qa('.hd-nav > a:not(.btn)').forEach((a) => { const on = a.getAttribute('href') === href; a.classList.toggle('cur', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const idx = RAIL_ORDER.indexOf(name === 'duvidas' ? 'lab' : name);
  RAIL.forEach((a, i) => { a.classList.toggle('cur', i === idx); a.classList.toggle('past', idx > -1 && i < idx); if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  q('#rail ol').style.setProperty('--rp', idx > 0 ? (idx / (RAIL.length - 1)).toFixed(3) : 0);
}

/* ---------- rolagem suave e âncoras ---------- */
if (!REDUCED && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95, prevent: (node) => !!(node && node.closest && node.closest('[data-lenis-prevent], dialog')) });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  lenis.on('scroll', (e) => { if (stage) stage.velocity(e.velocity * 60); });
}
function scrollToTarget(el) {
  const off = -(hd.offsetHeight + 8);
  if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: REDUCED ? 'auto' : 'smooth' });
}
D.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#topo' ? D.body : q(id);
  if (!el) return;
  e.preventDefault();
  setMenu(false);
  if (id === '#topo') { if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }
  else scrollToTarget(el);
});

/* ---------- capítulos: forma, posição e ambiente do palco ---------- */
/* d = computador, m = celular: [x, y, escala, opacidade]. anchor segue um elemento na vertical; ax também na horizontal. */
const CH = {
  hero: { anchorM: '.hero-vis', d: [3.4, 0.15, 0.7, 1], m: [0, 0, 0.42, 1] },
  solucoes: { shape: 'blocks', d: [4.0, -0.1, 0.62, 0.95], m: [0, 2.4, 0.4, 0.32] },
  projetos: { shape: 'city', anchorD: '#pj-stage', ax: true, d: [0, 0, 0.9, 0.55], m: [0, 2.6, 0.42, 0.3] },
  ia: { shape: 'brain', anchorD: '#ai-bed', d: [3.0, 0, 0.92, 0.95], m: [0, 0.2, 0.55, 0.45] },
  automacao: { shape: 'flow', anchorD: '#au', d: [0.6, 0, 0.95, 0.42], m: [0, 2.4, 0.42, 0.28] },
  sistemas: { ctl: 'universe' },
  compare: { split: true, anchor: '#cmp', d: [0, 0, 1.12, 1], m: [0, 0, 0.5, 1] },
  processo: { shape: 'helix', anchorD: '#pr-h', d: [4.5, 0, 0.4, 0.5], m: [2.3, 0.8, 0.36, 0.14] },
  lab: { shape: 'blocks', d: [4.6, -1.4, 0.5, 0.34], m: [1.7, -2.6, 0.35, 0.22] },
  duvidas: { shape: 'neural', d: [-4.4, -0.2, 0.62, 0.3], m: [1.6, -2.8, 0.4, 0.22] },
  end: { ctl: 'finale', shape: 'logo', anchor: '#fin-mark', d: [0, 0, 0.86, 1], m: [0, 0, 0.44, 1] }
};
let svcShape = null, pjShape = null;

const anchorOf = (c) => c.anchor || (NARROW() ? c.anchorM : c.anchorD) || null;
const halfH = () => (stage ? stage.halfH() : 3.64);
/* centro de um elemento da página em coordenadas do mundo 3D */
function anchorY(sel) {
  const el = q(sel);
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return (1 - (r.top + r.bottom) / innerHeight) * halfH();
}
function anchorX(sel) {
  const el = q(sel);
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return ((r.left + r.right) / innerWidth - 1) * halfH() * (innerWidth / innerHeight);
}
function layoutOf(name) {
  const c = CH[name];
  const nar = NARROW();
  const L = nar ? c.m : c.d;
  const vw = stage.viewWidth();
  const k = nar ? clamp(vw / 3.7, 1, 1.6) : clamp(vw / 12.9, 0.7, 1.5);
  const an = anchorOf(c);
  const out = { x: L[0] * k, y: an ? anchorY(an) : L[1], s: L[2] * (nar ? k : clamp(k, 0.8, 1.15)), o: L[3] };
  if (an && c.ax && !nar) out.x = anchorX(an);
  return out;
}

function applyChapter(name, prev) {
  if (!stage || !CH[name]) return;
  const c = CH[name];
  if (prev && CH[prev] && CH[prev].ctl && demos[CH[prev].ctl] && demos[CH[prev].ctl].leave) demos[CH[prev].ctl].leave();
  if (name === 'hero') { heroShape(); return; }
  if (c.ctl === 'universe') { withDemo('universe', (d) => d.enter && d.enter()); return; }
  stage.setLayout(layoutOf(name));
  if (c.split) {
    withDemo('compare', (cmp) => {
      if (chapter !== 'compare') return;
      stage.beginSplit('chaosA', 'panel');
      cmp.refresh();
      cmp.invite();
    });
    return;
  }
  if (c.ctl === 'finale') { withDemo('finale', (d) => d.enter()); return; }
  const shape = name === 'solucoes' && svcShape ? svcShape : name === 'projetos' && pjShape ? pjShape : c.shape;
  stage.setShape(shape, { dur: 2.4, spread: 1.1 });
}

function setChapter(name) {
  if (name === chapter) return;
  const prev = chapter;
  chapter = name;
  markNav(name);
  applyChapter(name, prev);
}
const chIO = new IntersectionObserver((ents) => {
  ents.forEach((e) => { if (e.isIntersecting) setChapter(e.target.dataset.ch); });
}, { rootMargin: '-50% 0px -50% 0px' });
qa('[data-ch]').forEach((s) => chIO.observe(s));

/* ambiente escuro: cresce enquanto uma seção .dark cobre o centro da tela */
const darks = qa('.dark');
const prog = q('#prog');
const steps = q('#steps');
const stepItems = qa('.step');
function onScroll() {
  const vh = innerHeight;
  let env = 0;
  darks.forEach((s) => {
    const r = s.getBoundingClientRect();
    const top = r.top + 160, bot = r.bottom - 160;
    const ov = Math.min(bot, vh * 0.72) - Math.max(top, vh * 0.28);
    env = Math.max(env, clamp(ov / (vh * 0.44), 0, 1));
  });
  H.classList.toggle('dk', env > 0.5);
  if (stage) {
    stage.setEnv(env);
    const c = chapter && CH[chapter];
    const an = c && !c.ctl && anchorOf(c);
    if (c && c.ctl === 'finale') { stage.yK = 10; stage.setLayout({ y: anchorY('#fin-mark') }); }
    else if (an) { stage.yK = 10; stage.setLayout({ y: anchorY(an) }); if (c.ax && !NARROW()) stage.setLayout({ x: anchorX(an) }); }
    else if (!c || !c.ctl) stage.yK = 2.2;
  }
  if (demos.universe && demos.universe.scroll) demos.universe.scroll();
  const max = D.documentElement.scrollHeight - vh;
  prog.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  hd.classList.toggle('sc', scrollY > 8);
  H.classList.toggle('fab-on', scrollY > vh * 0.7);
  const rs = steps.getBoundingClientRect();
  const f = clamp((vh * 0.8 - rs.top) / (rs.height + vh * 0.2), 0, 1);
  steps.style.setProperty('--fill', f.toFixed(3));
  stepItems.forEach((s, i) => s.classList.toggle('lit', f >= i / (stepItems.length - 1) - 0.02));
}
let scrollQueued = false;
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(() => { scrollQueued = false; onScroll(); }); } }, { passive: true });

/* ---------- abertura: cinco cenas, legenda e controles ---------- */
const cap = q('#scn-cap');
const scnBtns = qa('#scn-rail button');
const scnPP = q('#scn-pp');
const LAST = HERO_SCENES.length - 1;
let heroIdx = REDUCED ? LAST : 0, heroT = 0, heroPaused = REDUCED, heroLast = 0, heroStarted = false;

function setCap(t) {
  if (REDUCED) { cap.textContent = t; return; }
  cap.style.opacity = 0;
  setTimeout(() => { cap.textContent = t; cap.style.opacity = 1; }, 220);
}
function heroShape() {
  if (!stage) return;
  const sc = HERO_SCENES[heroIdx];
  stage.setShape(sc.shape, sc.shape === 'logo' ? { dur: 3, spread: 0.9 } : { dur: 2.3, spread: 1.1 });
  if (chapter === 'hero' || !chapter) stage.setLayout(heroLayout());
}
/* no computador, as partículas ocupam o espaço livre à direita do título, medido na hora */
function heroLayout() {
  const L = layoutOf('hero');
  const sc = HERO_SCENES[heroIdx];
  if (NARROW()) { L.s *= sc.shape === 'logo' ? 1.1 : (sc.k || 1); return L; }
  const vw = stage.viewWidth(), half = vw / 2;
  let right = q('.hero-sub').getBoundingClientRect().right;
  const rg = D.createRange();
  rg.selectNodeContents(q('#hero-h'));
  right = Math.max(right, rg.getBoundingClientRect().right);
  const xr = (right / innerWidth - 0.5) * vw;
  const room = half - xr;
  L.x = (xr + half) / 2 + 0.1;
  L.y = sc.dy === undefined ? 0.15 : sc.dy;
  L.s = clamp(room / 7.2, 0.42, 0.8) * (sc.k || 1);
  if (sc.shape === 'logo') { L.s = clamp((room * 0.84) / 6.6, 0.36, 0.8); L.y = 0.3; }
  return L;
}
function heroScene(i, user) {
  heroIdx = clamp(i, 0, LAST);
  heroT = 0;
  scnBtns.forEach((b, k) => {
    b.classList.toggle('cur', k === heroIdx);
    b.classList.toggle('done', k < heroIdx);
    b.style.setProperty('--f', k === heroIdx && heroIdx === LAST ? 1 : 0);
    if (k === heroIdx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  setCap(HERO_SCENES[heroIdx].cap);
  if (heroIdx === LAST) setPaused(true, true);
  else if (user && heroPaused && !REDUCED) setPaused(false);
  if (chapter === 'hero' || !chapter) heroShape();
}
function heroTick(now) {
  const dt = Math.min(0.1, (now - heroLast) / 1000 || 0);
  heroLast = now;
  if (heroStarted && !heroPaused && (chapter === 'hero' || !chapter) && !D.hidden && stage) {
    heroT += dt;
    const dur = HERO_SCENES[heroIdx].dur;
    if (dur) {
      scnBtns[heroIdx].style.setProperty('--f', clamp(heroT / dur, 0, 1).toFixed(3));
      if (heroT >= dur) heroScene(heroIdx + 1);
    }
  }
  requestAnimationFrame(heroTick);
}
function setPaused(p, ended) {
  heroPaused = p;
  scnPP.setAttribute('aria-pressed', String(p && !ended));
  scnPP.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
  scnPP.querySelector('.sr').textContent = ended ? 'Animação concluída. Tocar de novo' : p ? 'Continuar a animação' : 'Pausar a animação';
  scnPP.classList.toggle('ended', !!ended);
}
scnBtns.forEach((b, k) => b.addEventListener('click', () => heroScene(k, true)));
scnPP.addEventListener('click', () => {
  if (heroIdx === LAST) { heroScene(0, true); setPaused(false); return; }
  setPaused(!heroPaused);
});
q('#scn-again').addEventListener('click', () => {
  if (!stage) return;
  stage.setShape('seed', { instant: true, force: true });
  heroScene(0, true);
  if (!REDUCED) setPaused(false);
  if (chapter !== 'hero') scrollToTarget(D.body);
});
setPaused(heroPaused, REDUCED);
scnBtns.forEach((b, k) => { b.classList.toggle('cur', k === heroIdx); b.classList.toggle('done', k < heroIdx); });
cap.textContent = HERO_SCENES[heroIdx].cap;
requestAnimationFrame(heroTick);

/* ---------- títulos que ganham forma, revelações e números ---------- */
initKinetic(qa('[data-k]'), { reduced: REDUCED });
qa('.svc-list, .pj-g, .ai, .au, .steps, .who, .lab-g, .faq').forEach((e) => e.classList.add('rv'));
const rvIO = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
qa('.rv').forEach((e) => rvIO.observe(e));
function count(el) {
  const to = +el.dataset.count, pre = el.dataset.pre || '';
  if (REDUCED) { el.textContent = pre + to; return; }
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 1600);
    el.textContent = pre + Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const numIO = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { count(e.target); numIO.unobserve(e.target); } }), { threshold: 0.6 });
qa('[data-count]').forEach((e) => numIO.observe(e));

/* ---------- soluções: cada frente muda a forma dos dados ---------- */
const svcItems = qa('.svc-i');
function svcOn(li) {
  svcItems.forEach((x) => x.classList.toggle('on', x === li));
  svcShape = li ? li.dataset.shape : null;
  if (stage && chapter === 'solucoes') stage.setShape(svcShape || CH.solucoes.shape, { dur: 1.7, spread: 0.8 });
}
svcItems.forEach((li) => {
  const a = q('.svc-a', li);
  a.addEventListener('mouseenter', () => svcOn(li));
  a.addEventListener('focus', () => svcOn(li));
});
if (svcItems[0]) svcItems[0].classList.add('on');
svcShape = svcItems[0] ? svcItems[0].dataset.shape : null;
if (!FINE) {
  const svIO = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) svcOn(e.target); }), { rootMargin: '-45% 0px -45% 0px' });
  svcItems.forEach((li) => svIO.observe(li));
}

/* o botão flutuante sai de cena quando outro botão de WhatsApp grande está na tela */
const fabSeen = new Set();
const fabIO = new IntersectionObserver((ents) => { ents.forEach((e) => { if (e.isIntersecting) fabSeen.add(e.target); else fabSeen.delete(e.target); }); H.classList.toggle('fab-hide', fabSeen.size > 0); }, { threshold: 0.2 });
qa('.fin-msg .hero-cta, .lab-out .btn, .cv-ask').forEach((el) => fabIO.observe(el));

/* ---------- perguntas frequentes ---------- */
qa('.fq').forEach((f) => {
  const b = q('.fq-q', f);
  b.addEventListener('click', () => { const open = !f.classList.contains('open'); f.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); });
});

/* ---------- demonstrações: cada uma carrega quando a seção se aproxima ---------- */
const ctx = {
  reduced: REDUCED, fine: FINE, narrow: NARROW, setWa, waLink, waContext,
  stage: () => stage, lenis: () => lenis, chapter: () => chapter, anchorY, anchorX, scrollTo: (el) => scrollToTarget(el),
  onProject: (shape) => { pjShape = shape; if (stage && chapter === 'projetos' && !NARROW()) stage.setShape(shape, { dur: 1.8, spread: 0.8 }); },
  refreshLayout: () => { if (stage && chapter && CH[chapter] && !CH[chapter].ctl) stage.setLayout(layoutOf(chapter)); }
};
const LOADERS = {
  cases: [() => import('./demos/cases.js'), (m) => m.initCases(q('#projetos'), ctx)],
  ai: [() => import('./demos/ai.js'), (m) => m.initAI(q('#ia'), ctx)],
  auto: [() => import('./demos/auto.js'), (m) => m.initAuto(q('#automacao'), ctx)],
  universe: [() => import('./demos/universe.js'), (m) => m.initUniverse(q('#sistemas'), ctx)],
  compare: [() => import('./demos/compare.js'), (m) => m.initCompare(q('#antes-depois'), { reduced: REDUCED, onMove: (x) => { if (stage) stage.setDivider(x); } })],
  lab: [() => import('./demos/lab.js'), (m) => m.initLab(q('#diagnostico'), ctx)],
  finale: [() => import('./demos/finale.js'), (m) => m.initFinale(q('#fim'), ctx)]
};
const loading = {};
function loadDemo(name) {
  if (!loading[name]) {
    const [imp, init] = LOADERS[name];
    loading[name] = imp().then((m) => { demos[name] = init(m) || {}; return demos[name]; }).catch((err) => { console.warn('demo', name, err); demos[name] = {}; return demos[name]; });
  }
  return loading[name];
}
function withDemo(name, fn) { if (demos[name]) fn(demos[name]); else loadDemo(name).then(fn); }
const SEC_DEMO = { projetos: 'cases', ia: 'ai', automacao: 'auto', sistemas: 'universe', 'antes-depois': 'compare', diagnostico: 'lab', fim: 'finale' };
const lzIO = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { loadDemo(SEC_DEMO[e.target.id]); lzIO.unobserve(e.target); } }), { rootMargin: '140% 0px 140% 0px' });
Object.keys(SEC_DEMO).forEach((id) => { const el = q('#' + id); if (el) lzIO.observe(el); });
if (/^#projeto-/.test(location.hash)) loadDemo('cases');

/* ---------- palco 3D (carrega depois do conteúdo) ---------- */
const PREWARM = ['dust', 'neural', 'circuit', 'iface', 'logo', 'blocks', 'screens', 'flow', 'brain', 'dashboard', 'globe', 'city', 'streams', 'panel', 'chaosA', 'helix', 'vortex'];
async function initStage() {
  const canvas = q('#stage');
  const gl = probeGL();
  if (!gl.ok) { H.classList.add('no-gl'); return; }
  const tier = pickTier(gl);
  H.classList.add('tier-' + tier);
  try {
    const { Stage } = await import('./stage.js');
    stage = new Stage(canvas, { count: TIERS[tier].count, dpr: TIERS[tier].dpr, tier, reduced: REDUCED });
    await stage.init('assets/konan-logo.png');
  } catch (err) {
    console.warn('palco 3D indisponível', err);
    stage = null;
    H.classList.add('no-gl');
    return;
  }
  H.classList.add('gl-on');
  const first = chapter || 'hero';
  if (first === 'hero' && !REDUCED) stage.setShape('seed', { instant: true });
  else if (!CH[first].ctl) stage.setShape(first === 'hero' ? 'logo' : CH[first].shape, { instant: true });
  stage.setLayout(Object.assign(first === 'hero' ? heroLayout() : CH[first].ctl ? { x: 0, y: 0, s: 1 } : layoutOf(first), { o: 0 }), true);
  stage.start();
  onScroll();
  stage.setEnv(stage.envT, true);
  setTimeout(() => {
    heroStarted = true;
    if (!chapter || chapter === 'hero') { stage.setLayout(heroLayout()); heroScene(heroIdx); } else applyChapter(chapter);
    stage.prewarm(PREWARM);
  }, REDUCED ? 0 : 420);
  if (FINE) {
    addEventListener('pointermove', (e) => stage.pointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });
  }
  /* toque rápido solta uma onda; clicar e segurar num espaço vazio atrai os dados; soltar reorganiza */
  let holdT = 0;
  const free = (t) => !t.closest('a, button, input, select, textarea, label, dialog, .cmp, .dash, .ai, .au, .lab-g, .pj-g, p, h1, h2, h3, li, figure, blockquote');
  addEventListener('pointerdown', (e) => {
    const x = (e.clientX / innerWidth) * 2 - 1, y = -(e.clientY / innerHeight) * 2 + 1;
    stage.pointer(x, y);
    if (!free(e.target)) return;
    stage.pulse(x, y);
    if (FINE && e.button === 0) { clearTimeout(holdT); holdT = setTimeout(() => { stage.attract(true); H.classList.add('attracting'); }, 170); }
  }, { passive: true });
  const release = () => { clearTimeout(holdT); if (stage) stage.attract(false); H.classList.remove('attracting'); };
  addEventListener('pointerup', release, { passive: true });
  addEventListener('pointercancel', release, { passive: true });
  addEventListener('blur', release);
  D.addEventListener('visibilitychange', () => { if (D.hidden) stage.stop(); else if (!H.classList.contains('cv-open')) stage.start(); });
}

let rzT;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (stage) {
      stage.resize();
      if (chapter === 'hero') stage.setLayout(heroLayout());
      else if (chapter && CH[chapter] && !CH[chapter].ctl) stage.setLayout(layoutOf(chapter));
      if (demos.compare && demos.compare.refresh) demos.compare.refresh();
      if (demos.universe && demos.universe.resize) demos.universe.resize();
      if (demos.finale && demos.finale.resize) demos.finale.resize();
    }
    onScroll();
  }, 140);
});

window.konan = { stage: () => stage, lenis: () => lenis, chapter: () => chapter, setChapter, demos, loadDemo };
onScroll();
markNav('hero');
const startStage = () => initStage();
if ('requestIdleCallback' in window) requestIdleCallback(startStage, { timeout: 900 }); else setTimeout(startStage, 200);
setTimeout(() => loadDemo('cases'), 1200);
window.__ktReady = true;
