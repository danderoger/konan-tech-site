/* Konan Tech 2.0 (versão clara): comportamento da página.
   O palco 3D carrega depois do conteúdo, para o site abrir rápido. Sem WebGL, tudo funciona com a imagem de reserva. */

import { WA_DEFAULT, waLink, waContext, HERO_SCENES, FLOW_STEPS, DASH, LAB } from './content.js';
import { initAI } from './demos/ai.js';
import { initFlow } from './demos/flow.js';
import { initDevices } from './demos/devices.js';
import { initDash } from './demos/dash.js';
import { initCompare } from './demos/compare.js';
import { initProjects } from './demos/projects.js';
import { initLab } from './demos/lab.js';

const D = document, H = D.documentElement;
const REDUCED = H.classList.contains('rm');
const FINE = matchMedia('(pointer: fine)').matches;
const MOBILE = () => innerWidth <= 760;
/* telas estreitas (celular e tablet em pé) usam o layout empilhado das partículas */
const NARROW = () => innerWidth <= 760 || (innerWidth <= 1080 && innerWidth / innerHeight < 0.9);
const q = (s, r = D) => r.querySelector(s);
const qa = (s, r = D) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let stage = null, lenis = null, chapter = null;

/* ---------- WhatsApp: todo link [data-wa] recebe a mensagem do contexto ---------- */
function setWa(a, frase) { a.href = waLink(frase ? waContext(frase) : WA_DEFAULT); }
qa('[data-wa]').forEach((a) => { if (a.id !== 'lab-send') setWa(a, a.dataset.msg); });

/* ---------- cabeçalho e menu ---------- */
const hd = q('#hd');
const menuBtn = q('#menu-btn');
function setMenu(open) {
  hd.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.sr').textContent = open ? 'Fechar menu' : 'Abrir menu';
}
menuBtn.addEventListener('click', () => setMenu(!hd.classList.contains('open')));
D.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hd.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
const NAV_OF = { solucoes: '#solucoes', ia: '#ia', automacao: '#ia', sistemas: '#ia', dashboards: '#ia', compare: '#ia', projetos: '#projetos', sobre: '#projetos', processo: '#processo', duvidas: '#duvidas' };
function markNav(name) {
  const href = NAV_OF[name];
  qa('.hd-nav > a:not(.btn)').forEach((a) => { const on = a.getAttribute('href') === href; a.classList.toggle('cur', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}

/* ---------- rolagem suave e âncoras ---------- */
if (!REDUCED && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  lenis.on('scroll', (e) => { if (stage) stage.velocity(e.velocity * 60); });
}
function scrollToTarget(el) {
  const off = -(hd.offsetHeight + 8);
  if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.3 });
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
  if (id === '#topo') { if (lenis) lenis.scrollTo(0, { duration: 1.3 }); else scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }
  else scrollToTarget(el);
  if (id !== '#topo') history.replaceState(null, '', id);
});

/* ---------- capítulos: forma, posição e ambiente do palco ---------- */
/* d = computador, m = celular: [x, y, escala, opacidade] */
const CH = {
  hero: { anchorM: '.hero-vis', d: [3.55, 0.15, 0.7, 1], m: [0, 0, 0.42, 1] },
  solucoes: { shape: 'streams', d: [1.4, -1.7, 1.0, 0.45], m: [0, -1.5, 0.6, 0.4] },
  ia: { shape: 'brain', anchorD: '#ia .sec-head', d: [3.4, 0, 0.82, 0.9], m: [0, 0.2, 0.55, 0.3] },
  automacao: { shape: 'flow', d: [3.3, 1.7, 0.72, 0.5], m: [0, 2.5, 0.46, 0.3] },
  sistemas: { shape: 'blocks', d: [4.3, 1.5, 0.6, 0.5], m: [0, 2.6, 0.45, 0.3] },
  dashboards: { shape: 'dashboard', d: [4, 1.6, 0.72, 0.4], m: [0, 2.5, 0.42, 0.3] },
  compare: { split: true, anchor: '#cmp', d: [0, 0, 1.12, 1], m: [0, 0, 0.5, 1] },
  projetos: { shape: 'terrain', d: [0, -2.5, 1, 0.65], m: [0, -2.9, 0.6, 0.55] },
  sobre: { shape: 'sphere', d: [3.6, 0, 0.8, 0.5], m: [0, 2.7, 0.5, 0.2] },
  processo: { shape: 'helix', d: [4.6, 1.5, 0.45, 0.45], m: [1.75, 0, 0.4, 0.2] },
  lab: { shape: 'vortex', d: [0, -1.7, 1.1, 0.35], m: [0, -2.3, 0.6, 0.3] },
  duvidas: { shape: 'network', d: [-4.2, 0, 0.75, 0.35], m: [1.6, -2.8, 0.4, 0.3] },
  end: { shape: 'logo', anchor: '.end-mark', d: [0, 0, 0.66, 1], m: [0, 0, 0.36, 1] }
};
let cmpInvited = false;

function layoutOf(name) {
  const c = CH[name];
  const nar = NARROW();
  const L = nar ? c.m : c.d;
  const vw = stage.viewWidth();
  const k = nar ? clamp(vw / 3.7, 1, 1.6) : clamp(vw / 12.9, 0.7, 1.5);
  const an = anchorOf(c);
  return { x: L[0] * k, y: an ? anchorY(an) : L[1], s: L[2] * (nar ? k : clamp(k, 0.8, 1.15)), o: L[3] };
}
const anchorOf = (c) => c.anchor || (NARROW() ? c.anchorM : c.anchorD) || null;
/* posição vertical (no mundo 3D) do centro de um elemento da página: a forma acompanha a rolagem */
function anchorY(sel) {
  const el = q(sel);
  if (!el || !stage) return 0;
  const r = el.getBoundingClientRect();
  const half = stage.camera.position.z * Math.tan((stage.camera.fov * Math.PI) / 360);
  return (1 - (r.top + r.bottom) / innerHeight) * half;
}

function applyChapter(name) {
  if (!stage || !CH[name]) return;
  const c = CH[name];
  if (name === 'hero') { heroShape(); return; }
  stage.setLayout(layoutOf(name));
  if (c.split) {
    stage.beginSplit('chaosA', 'panel');
    cmp.refresh();
    if (!cmpInvited) { cmpInvited = true; setTimeout(() => cmp.invite(), 900); }
  } else stage.setShape(c.shape, { dur: 2.4, spread: 1.1 });
}

function setChapter(name) {
  if (name === chapter) return;
  chapter = name;
  markNav(name);
  applyChapter(name);
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
    const top = r.top + 150, bot = r.bottom - 150;
    const ov = Math.min(bot, vh * 0.72) - Math.max(top, vh * 0.28);
    env = Math.max(env, clamp(ov / (vh * 0.44), 0, 1));
  });
  if (stage) {
    stage.setEnv(env);
    const c = chapter && CH[chapter];
    const an = c && anchorOf(c);
    stage.yK = an ? 10 : 2.2;
    if (an) stage.setLayout({ y: anchorY(an) });
  }
  const max = D.documentElement.scrollHeight - vh;
  prog.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  hd.classList.toggle('sc', scrollY > 8);
  H.classList.toggle('fab-on', scrollY > vh * 0.6);
  const rs = steps.getBoundingClientRect();
  const f = clamp((vh * 0.8 - rs.top) / (rs.height + vh * 0.2), 0, 1);
  steps.style.setProperty('--fill', f.toFixed(3));
  stepItems.forEach((s, i) => s.classList.toggle('lit', f >= i / (stepItems.length - 1) - 0.02));
}
let scrollQueued = false;
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(() => { scrollQueued = false; onScroll(); }); } }, { passive: true });

/* ---------- abertura: linha do tempo das partículas e título que muda ---------- */
const word = q('#hero-word');
const tlBtns = qa('#tl button');
const tlPP = q('#tl-pp');
let heroIdx = REDUCED ? HERO_SCENES.length - 1 : 0, heroT = 0, heroPaused = REDUCED, heroLast = 0;

function setWord(t) {
  if (REDUCED || !word.animate) { word.textContent = t; return; }
  word.innerHTML = t.split(' ').map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
  word.style.setProperty('--bw', word.offsetWidth + 'px');
  qa('.ch', word).forEach((s, i) => {
    s.style.setProperty('--bx', -s.offsetLeft + 'px');
    s.animate([{ opacity: 0, transform: 'translateY(0.38em) rotateX(-70deg)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 760, delay: i * 24, easing: 'cubic-bezier(.22,.75,.12,1)', fill: 'backwards' });
  });
}
function heroShape() {
  if (!stage) return;
  const sc = HERO_SCENES[heroIdx];
  stage.setShape(sc.shape, { dur: sc.shape === 'logo' ? 3 : 2.4, spread: 1.2 });
  if (chapter === 'hero' || !chapter) stage.setLayout(heroLayout());
}
/* no computador, as partículas ocupam o espaço livre à direita do título, medido na hora */
function heroLayout() {
  const L = layoutOf('hero');
  if (NARROW()) return L;
  const vw = stage.viewWidth(), half = vw / 2;
  const rg = D.createRange();
  let right = q('.hero-sub').getBoundingClientRect().right;
  ['.hh-a', '#hero-word'].forEach((sel) => { rg.selectNodeContents(q(sel)); right = Math.max(right, rg.getBoundingClientRect().right); });
  const xr = (right / innerWidth - 0.5) * vw;
  L.s = clamp((half - xr) / 7, 0.42, 0.75);
  L.x = (xr + half) / 2 + 0.15;
  const sc = HERO_SCENES[heroIdx];
  if (sc.d) Object.assign(L, { x: L.x + sc.d[0], y: sc.d[1], s: L.s * sc.d[2] });
  return L;
}
function heroScene(i) {
  heroIdx = (i + HERO_SCENES.length) % HERO_SCENES.length;
  heroT = 0;
  tlBtns.forEach((b, k) => {
    b.classList.toggle('cur', k === heroIdx);
    b.classList.toggle('done', k < heroIdx);
    b.style.setProperty('--f', 0);
    if (k === heroIdx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  setWord(HERO_SCENES[heroIdx].word);
  if (chapter === 'hero' || !chapter) heroShape();
}
function heroTick(now) {
  const dt = Math.min(0.1, (now - heroLast) / 1000 || 0);
  heroLast = now;
  if (!heroPaused && (chapter === 'hero' || !chapter) && !D.hidden && stage) {
    heroT += dt;
    const dur = HERO_SCENES[heroIdx].dur;
    tlBtns[heroIdx].style.setProperty('--f', clamp(heroT / dur, 0, 1).toFixed(3));
    if (heroT >= dur) heroScene(heroIdx + 1);
  }
  requestAnimationFrame(heroTick);
}
function setPaused(p) {
  heroPaused = p;
  tlPP.setAttribute('aria-pressed', String(p));
  tlPP.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
  tlPP.querySelector('.sr').textContent = p ? 'Continuar a animação' : 'Pausar a animação';
}
tlBtns.forEach((b, k) => b.addEventListener('click', () => heroScene(k)));
tlPP.addEventListener('click', () => setPaused(!heroPaused));
setPaused(heroPaused);
tlBtns.forEach((b, k) => { b.classList.toggle('cur', k === heroIdx); b.classList.toggle('done', k < heroIdx); });
if (REDUCED) word.textContent = HERO_SCENES[heroIdx].word;
requestAnimationFrame(heroTick);

/* ---------- revelações, números e inclinação dos cartões ---------- */
qa('.sec-head .lead, .sol-c, .ai, .fl, .dv, .db, .cmp-side ul, .pj, .nums li, .step, .pillars li, .lab, .lab-out, .fq, .end .lead, .end .hero-cta, .ab-tx > p, .quote').forEach((e) => e.classList.add('rv'));
const rvIO = new IntersectionObserver((ents) => {
  ents.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('rv')) : [];
    el.style.transitionDelay = (Math.max(0, sibs.indexOf(el)) * 70) + 'ms';
    el.classList.add('in');
    rvIO.unobserve(el);
  });
}, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
qa('.rv, [data-w]').forEach((e) => rvIO.observe(e));

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

if (FINE && !REDUCED) {
  qa('[data-tilt]').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(2) + 'deg');
      c.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 7).toFixed(2) + 'deg');
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });
}

/* ---------- perguntas frequentes ---------- */
qa('.fq').forEach((f) => {
  const b = q('.fq-q', f);
  b.addEventListener('click', () => { const open = !f.classList.contains('open'); f.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); });
});

/* ---------- demonstrações ---------- */
const ai = initAI(q('#ia'), { reduced: REDUCED });
const flow = initFlow(q('#automacao'), { steps: FLOW_STEPS, reduced: REDUCED });
const dev = initDevices(q('#sistemas'), { reduced: REDUCED, fine: FINE });
const dash = initDash(q('#dashboards'), { DASH, reduced: REDUCED });
const cmp = initCompare(q('#antes-depois'), { reduced: REDUCED, onMove: (x) => { if (stage) stage.setDivider(x); } });
initProjects(q('#projetos'), { fine: FINE, reduced: REDUCED, setWa });
initLab(q('#contato'), { LAB, waLink });
const DEMOS = [[q('#ai-demo'), ai], [q('#fl-demo'), flow], [q('#dv-demo'), dev], [q('#db-demo'), dash]];
const demoIO = new IntersectionObserver((ents) => ents.forEach((e) => {
  const d = DEMOS.find((x) => x[0] === e.target);
  if (d) { if (e.isIntersecting) d[1].wake(); else d[1].sleep(); }
}), { threshold: 0.3 });
DEMOS.forEach((d) => demoIO.observe(d[0]));

/* ---------- palco 3D (carrega depois do conteúdo) ---------- */
async function initStage() {
  const canvas = q('#stage');
  try {
    const { Stage } = await import('./stage.js');
    stage = new Stage(canvas, { count: MOBILE() ? 14000 : 30000, dpr: MOBILE() ? 1.6 : 1.75, reduced: REDUCED });
    await stage.init('assets/konan-logo.png');
  } catch (err) {
    stage = null;
    H.classList.add('no-gl');
    return;
  }
  H.classList.add('gl-on');
  const first = chapter || 'hero';
  stage.setShape(first === 'hero' && !REDUCED ? 'seed' : (CH[first].shape || 'logo'), { instant: true });
  stage.setLayout(Object.assign(first === 'hero' ? heroLayout() : layoutOf(first), { o: 0 }), true);
  stage.start();
  onScroll();
  stage.setEnv(stage.envT, true);
  setTimeout(() => {
    stage.setLayout((chapter || 'hero') === 'hero' ? heroLayout() : layoutOf(chapter));
    if (!chapter || chapter === 'hero') heroScene(heroIdx); else applyChapter(chapter);
  }, REDUCED ? 0 : 350);
  if (FINE) {
    addEventListener('pointermove', (e) => stage.pointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });
  }
  addEventListener('pointerdown', (e) => {
    const x = (e.clientX / innerWidth) * 2 - 1, y = -(e.clientY / innerHeight) * 2 + 1;
    stage.pointer(x, y);
    if (!e.target.closest('a, button, input, label, textarea, .cmp, dialog')) stage.pulse(x, y);
  }, { passive: true });
  D.addEventListener('visibilitychange', () => { if (D.hidden) stage.stop(); else stage.start(); });
}

let rzT;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (stage) { stage.resize(); if (chapter) stage.setLayout(chapter === 'hero' ? heroLayout() : layoutOf(chapter)); cmp.refresh(); }
    onScroll();
  }, 120);
});

window.konan = { stage: () => stage, lenis: () => lenis, chapter: () => chapter, setChapter };
onScroll();
markNav('hero');
const startStage = () => initStage();
if ('requestIdleCallback' in window) requestIdleCallback(startStage, { timeout: 900 }); else setTimeout(startStage, 200);
window.__ktReady = true;
