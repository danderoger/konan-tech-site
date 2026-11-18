/* Final: "Vamos tirar a sua planta do papel?"
   A planta do visitante (ou o exemplo) aparece numa folha. Quando a seção entra na tela,
   cada traço vira partícula no mesmo lugar, as partículas saem do papel em direção a quem olha
   e se reorganizam na marca Konan Tech; no fim a logo de verdade aparece por baixo e o 3D desliga.
   Sem WebGL ou com movimento reduzido: a folha sobe e a marca aparece, sem partículas. */

const hexRgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const INK = hexRgb(0x1f2b38), INK2 = hexRgb(0x4a5b6f), RED = hexRgb(0xd6293b), BLUE = hexRgb(0x1b5fd9), CYAN = hexRgb(0x0fa3d8), GREY = hexRgb(0x8394a9);

/* conta como visto quando boa parte aparece, ou quando ocupa mais da metade da tela (blocos altos no celular) */
const seenEnough = (e, t) => e.isIntersecting && (e.intersectionRatio >= t || e.intersectionRect.height >= innerHeight * 0.5);
export function initLiftoff(root, ctx) {
  const D = document, H = D.documentElement;
  const stageBox = root.querySelector('#fin-stage');
  const sheetBox = root.querySelector('#fin-sheet');
  const logo = root.querySelector('.fin-logo');
  const again = root.querySelector('#fin-again');
  const reduced = ctx.reduced;
  let token = 0, played = false, running = false, svg = null, live = false, top0 = 0, scrollFollow = null;

  /* copia a planta atual (ou o exemplo) para a folha do final */
  function snap() {
    /* sempre a folha deitada: no celular ela fica baixa e o convite aparece logo embaixo */
    const st = ctx.finalState();
    sheetBox.innerHTML = '';
    svg = ctx.plan.snapshot('land', st, '-f', sheetBox);
  }

  const wait = (ms, t) => new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(new Error('cancelado'))), ms));

  /* amostra os traços da folha: cada ponto guarda a posição na tela e a cor da tinta */
  function sample(N) {
    const els = [];
    const add = (sel, col, w, kind) => svg.querySelectorAll(sel).forEach((el) => els.push({ el, col, w, kind }));
    add('.wall', INK, 1.7, 'fill');
    add('.car', INK, 0.7, 'rect');
    add('.car-l', INK2, 0.5, 'line');
    add('.cloud', RED, 1.25, 'path');
    add('.note-t', RED, 1.2, 'text');
    add('.mod-r', BLUE, 1.35, 'rect');
    add('.mod-t', BLUE, 1, 'text');
    add('.det-mk circle', BLUE, 1.3, 'path');
    add('.flow, .base-rail', CYAN, 0.9, 'path');
    add('.door-arc, .door-leaf', INK2, 0.7, 'path');
    add('.curb, .lane, .ext-p', GREY, 0.45, 'path');
    add('.ext-r', INK2, 0.6, 'rect');
    add('.room-t, .car-title, .car-val, .dim-t', INK, 0.9, 'text');
    const r = rng(77);
    const seg = els.map((o) => {
      let len = 0;
      try {
        if (o.kind === 'text' || o.kind === 'fill') { const b = o.el.getBBox(); len = b.width + b.height; }
        else if (o.kind === 'rect') { const b = o.el.getBBox(); len = 2 * (b.width + b.height); }
        else if (o.kind === 'line') { len = Math.hypot(o.el.x2.baseVal.value - o.el.x1.baseVal.value, o.el.y2.baseVal.value - o.el.y1.baseVal.value); }
        else len = o.el.getTotalLength();
      } catch (e) { len = 0; }
      return { ...o, len: len * o.w };
    }).filter((o) => o.len > 0);
    const total = seg.reduce((a, o) => a + o.len, 0) || 1;
    const pts = [];
    const pt = svg.createSVGPoint();
    seg.forEach((o) => {
      const n = Math.max(1, Math.round((o.len / total) * N));
      const m = o.el.getScreenCTM();
      if (!m) return;
      let b = null;
      try { b = o.el.getBBox(); } catch (e) { /* sem caixa */ }
      for (let i = 0; i < n; i++) {
        let x, y;
        if (o.kind === 'fill' || o.kind === 'text') { x = b.x + r() * b.width; y = b.y + (o.kind === 'text' ? b.height * (0.25 + r() * 0.6) : r() * b.height); }
        else if (o.kind === 'rect') {
          const p = r() * 2 * (b.width + b.height);
          if (p < b.width) { x = b.x + p; y = b.y; } else if (p < b.width + b.height) { x = b.x + b.width; y = b.y + p - b.width; }
          else if (p < 2 * b.width + b.height) { x = b.x + (p - b.width - b.height); y = b.y + b.height; } else { x = b.x; y = b.y + (p - 2 * b.width - b.height); }
        } else if (o.kind === 'line') { const t = r(); x = o.el.x1.baseVal.value + (o.el.x2.baseVal.value - o.el.x1.baseVal.value) * t; y = o.el.y1.baseVal.value + (o.el.y2.baseVal.value - o.el.y1.baseVal.value) * t; }
        else { const L = o.el.getTotalLength(); const q = o.el.getPointAtLength(r() * L); x = q.x; y = q.y; }
        pt.x = x; pt.y = y;
        const s = pt.matrixTransform(m);
        pts.push(s.x, s.y, o.col);
      }
    });
    return pts;
  }

  function buildShapes(st, N) {
    const pts = sample(N);
    const cnt = pts.length / 3;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 4);
    const lift = new Float32Array(N * 3);
    const r = rng(19);
    const box = sheetBox.getBoundingClientRect();
    const c = st.screenToWorld(box.left + box.width / 2, box.top + box.height / 2);
    for (let i = 0; i < N; i++) {
      const k = (i % cnt) * 3;
      const w = st.screenToWorld(pts[k], pts[k + 1]);
      const cc = pts[k + 2];
      const jit = i >= cnt ? 0.012 : 0;
      pos[i * 3] = w[0] + (r() - 0.5) * jit; pos[i * 3 + 1] = w[1] + (r() - 0.5) * jit; pos[i * 3 + 2] = (r() - 0.5) * 0.01;
      col[i * 4] = cc[0]; col[i * 4 + 1] = cc[1]; col[i * 4 + 2] = cc[2]; col[i * 4 + 3] = i >= cnt ? 0.55 : 1;
      /* a folha "levanta": os pontos sobem em direção a quem olha e abrem um pouco a partir do centro */
      const dx = w[0] - c[0], dy = w[1] - c[1];
      const z = 0.8 + r() * 2.6;
      lift[i * 3] = w[0] + dx * (0.08 + r() * 0.16) + (r() - 0.5) * 0.25;
      lift[i * 3 + 1] = w[1] + dy * (0.08 + r() * 0.16) + 0.25 + r() * 0.5;
      lift[i * 3 + 2] = z;
    }
    st.defineShape('finPlan', { pos, col, opts: { face: true, gain: 0.62, noise: 0.006 } });
    st.defineShape('finLift', { pos: lift, col, opts: { face: true, gain: 0.66, noise: 0.05 } });
    /* a marca no lugar exato da logo da página */
    const L = st.get('logo');
    const lr = logo.getBoundingClientRect();
    const lc = st.screenToWorld(lr.left + lr.width / 2, lr.top + lr.height / 2);
    const s = (lr.width / innerWidth) * st.viewWidth() / 6.6;
    const lp = new Float32Array(L.pos.length);
    for (let i = 0; i < N; i++) { lp[i * 3] = L.pos[i * 3] * s + lc[0]; lp[i * 3 + 1] = L.pos[i * 3 + 1] * s + lc[1]; lp[i * 3 + 2] = L.pos[i * 3 + 2] * s; }
    st.defineShape('finLogo', { pos: lp, col: L.col, opts: Object.assign({}, L.opts, { face: true }) });
  }

  function follow(st) {
    top0 = sheetBox.getBoundingClientRect().top;
    st.yK = 40;
    scrollFollow = () => {
      const dy = sheetBox.getBoundingClientRect().top - top0;
      st.setLayout({ y: -dy * (2 * st.halfH() / innerHeight) });
    };
    addEventListener('scroll', scrollFollow, { passive: true });
  }
  function unfollow() { if (scrollFollow) removeEventListener('scroll', scrollFollow); scrollFollow = null; }

  function finishFlat() {
    root.classList.add('flat');
    setTimeout(() => root.classList.add('done'), reduced ? 0 : 500);
  }

  async function play() {
    const t = ++token;
    played = true;
    running = true;
    root.classList.remove('lift', 'flat', 'done');
    snap();
    if (reduced) { finishFlat(); running = false; return; }
    let st = null;
    try { st = await ctx.getStage(); } catch (e) { st = null; }
    if (t !== token) return;
    if (!st) { await new Promise((r) => setTimeout(r, 300)); if (t === token) finishFlat(); running = false; return; }
    try {
      st.resize(true);
      st.setEnv(0, true);
      st.setAdd(0);
      st.setSpin(0);
      st.setCam({ lock: true, z: 0, orbit: 0 });
      st.setLayout({ x: 0, y: 0, s: 1, o: 0 }, true);
      buildShapes(st, st.N);
      st.setShape('finPlan', { instant: true, force: true });
      follow(st);
      H.classList.add('fin-live');
      live = true;
      st.start();
      st.setLayout({ o: 1 });
      root.classList.add('lift');
      await wait(650, t);
      st.setShape('finLift', { dur: 1.6, spread: 0.7, arc: 0.5 });
      await wait(1650, t);
      st.setShape('finLogo', { dur: 2.6, spread: 1, sweep: 1, arc: 0.9 });
      await wait(3000, t);
      root.classList.add('done');
      await wait(700, t);
      st.setLayout({ o: 0 });
      await wait(1300, t);
      stopStage(st);
    } catch (e) { /* interrompido */ }
    running = false;
  }

  function stopStage(st) {
    unfollow();
    if (st) { st.setLayout({ o: 0 }, true); st.stop(); }
    H.classList.remove('fin-live');
    live = false;
  }

  /* começa quando a folha do final está quase toda na tela */
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (seenEnough(e, 0.7) && !played) play();
  }), { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
  io.observe(sheetBox);
  /* saiu da seção no meio da animação: termina direto na marca */
  const out = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting && running) {
      ++token;
      running = false;
      ctx.getStage().then((st) => stopStage(st)).catch(() => {});
      root.classList.add('lift', 'done');
    }
  }), { threshold: 0 });
  out.observe(root);

  again.addEventListener('click', () => {
    played = false;
    if (live) ctx.getStage().then((st) => stopStage(st));
    if (ctx.scrollTo) ctx.scrollTo(stageBox);
    setTimeout(play, reduced ? 0 : 500);
  });

  snap();
  /* o palco 3D começa a carregar enquanto o visitante ainda está chegando no final */
  if (!reduced) {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
    idle(() => { ctx.getStage().catch(() => {}); }, { timeout: 1500 });
  }
  return { refresh() { if (!running && !root.classList.contains('lift')) snap(); } };
}
