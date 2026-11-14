/* Final: os dados vistos ao longo do site saem das interfaces, viram partículas, giram cada vez mais rápido
   e se reorganizam na marca Konan Tech. A animação desacelera, a marca fica legível e a mensagem aparece.
   Botão para rever a transformação. Sem 3D ou com movimento reduzido, a marca e a mensagem aparecem direto. */

import { fragments } from '../shapes.js';

const TAU = Math.PI * 2;
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function initFinale(root, ctx) {
  const D = document;
  const chips = [...root.querySelectorAll('#fin-chips li')];
  const mark = root.querySelector('#fin-mark');
  const again = root.querySelector('#fin-again');
  const reduced = ctx.reduced;
  let played = false, running = false, token = 0, inCh = false, ramp = 0;

  function layout() {
    const r = rnd(5);
    const nar = innerWidth <= 760;
    chips.forEach((c, i) => {
      const a = (i / chips.length) * TAU + 0.35;
      const rx = (nar ? 30 : 36) * (0.8 + r() * 0.35), ry = (nar ? 24 : 22) * (0.8 + r() * 0.4);
      c.style.setProperty('--cx', (50 + Math.cos(a) * rx).toFixed(2) + '%');
      c.style.setProperty('--cy', (34 + Math.sin(a) * ry).toFixed(2) + '%');
      c.dataset.r = ((r() - 0.5) * 16).toFixed(1);
    });
  }

  const wait = (ms, t) => new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(new Error('cancelado'))), ms));

  function spinRamp(st, to, ms) {
    cancelAnimationFrame(ramp);
    const from = st.spinExtra, t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      st.setSpin(from + (to - from) * (k * k * (3 - 2 * k)));
      if (k < 1) ramp = requestAnimationFrame(tick);
    };
    ramp = requestAnimationFrame(tick);
  }

  function finish() {
    root.classList.add('done');
    running = false;
  }

  /* partículas nascendo dentro de cada cartão, em coordenadas relativas ao ponto onde a marca se forma */
  function fragmentShape(st) {
    const L = st.tgt;
    const rects = chips.map((c) => {
      const r = c.getBoundingClientRect();
      const a = st.screenToWorld(r.left, r.bottom), b = st.screenToWorld(r.right, r.top);
      return { x0: (a[0] - L.x) / L.s, y0: (a[1] - L.y) / L.s, x1: (b[0] - L.x) / L.s, y1: (b[1] - L.y) / L.s, accent: c.classList.contains('ac') };
    });
    st.defineShape('frags', fragments(st.N, rects));
  }

  async function play() {
    const st = ctx.stage();
    if (!st || reduced) { finish(); return; }
    const t = ++token;
    played = true;
    running = true;
    root.classList.add('arm');
    root.classList.remove('done');
    chips.forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
    try {
      st.setAdd(1);
      st.setCam({ lock: true, z: 0, orbit: 0 });
      st.setLayout({ o: 0 });
      /* 1. os dados chegam de todos os lados, como se saíssem das telas anteriores */
      chips.forEach((c, i) => {
        const a = (i / chips.length) * TAU + 0.35;
        const dx = Math.cos(a) * innerWidth * 0.7, dy = Math.sin(a) * innerHeight * 0.7 + (i % 2 ? 240 : -240);
        c.animate([
          { opacity: 0, transform: `translate(-50%, -50%) translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) scale(0.6) rotate(${c.dataset.r * 3}deg)`, filter: 'blur(6px)' },
          { opacity: 1, transform: `translate(-50%, -50%) rotate(${c.dataset.r}deg)`, filter: 'blur(0)' }
        ], { duration: 1150, delay: i * 55, easing: 'cubic-bezier(.16,.8,.2,1)', fill: 'forwards' });
      });
      await wait(1650, t);
      /* 2. cada cartão se desfaz em partículas */
      fragmentShape(st);
      st.setShape('frags', { instant: true, force: true });
      st.setLayout({ o: 1 });
      chips.forEach((c, i) => c.animate([
        { opacity: 1, transform: `translate(-50%, -50%) rotate(${c.dataset.r}deg)`, filter: 'blur(0)' },
        { opacity: 0, transform: `translate(-50%, -50%) rotate(${c.dataset.r}deg) scale(1.25)`, filter: 'blur(10px)' }
      ], { duration: 650, delay: i * 25, easing: 'ease-out', fill: 'forwards' }));
      await wait(380, t);
      /* 3. os dados atravessam o espaço e giram cada vez mais rápido */
      st.setShape('vortex', { dur: 2.3, spread: 0.6, arc: 1.5 });
      spinRamp(st, 3.4, 2300);
      st.setCam({ lock: true, z: -2.4, orbit: 0.22 });
      await wait(2350, t);
      /* 4. tudo se reorganiza na marca; o giro desacelera e a marca fica nítida */
      st.setShape('logo', { dur: 3.0, spread: 0.9, sweep: 1, arc: 0.9 });
      spinRamp(st, 0, 1300);
      st.setCam({ lock: true, z: 0, orbit: 0 });
      setTimeout(() => { if (t === token) st.setAdd(0.18); }, 1500);
      await wait(2900, t);
      finish();
    } catch (e) { /* interrompido */ }
  }

  function settle() {
    const st = ctx.stage();
    if (!st) return;
    st.setAdd(0.18);
    st.setSpin(0);
    st.setCam({ lock: true, z: 0, orbit: 0 });
    st.setLayout({ o: 1 });
    st.setShape('logo', { dur: 2.2, spread: 0.8, sweep: 1 });
  }

  function enter() {
    inCh = true;
    const st = ctx.stage();
    if (!st) { finish(); return; }
    const nar = innerWidth <= 760;
    const px = nar ? innerWidth * 0.84 : Math.min(780, innerWidth * 0.6);
    const s = (px / innerWidth) * st.viewWidth() / 6.6;
    st.yK = 10;
    st.setLayout({ x: 0, y: ctx.anchorY('#fin-mark'), s });
    if (!played) { st.setLayout({ o: 0 }); armWhenVisible(); }
    else if (!running) settle();
  }
  function leave() {
    inCh = false;
    ++token;
    cancelAnimationFrame(ramp);
    const st = ctx.stage();
    if (st) { st.setAdd(null); st.setSpin(0); st.setCam({ lock: false, z: 0, orbit: 0 }); }
    if (running) { running = false; finish(); chips.forEach((c) => c.getAnimations().forEach((a) => a.finish())); }
  }

  let armIO = null;
  function armWhenVisible() {
    if (armIO) return;
    armIO = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting && inCh && !played) { armIO.disconnect(); armIO = null; play(); }
    }), { threshold: 0.55 });
    armIO.observe(mark);
  }

  again.addEventListener('click', () => {
    if (!ctx.stage() || reduced) return;
    played = false;
    if (ctx.scrollTo) ctx.scrollTo(root);
    setTimeout(play, ctx.reduced ? 0 : 450);
  });

  layout();
  if (!ctx.stage() || reduced) finish(); else root.classList.add('arm');
  return { enter, leave, resize: layout };
}
