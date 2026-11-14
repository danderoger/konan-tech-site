/* Universo dos sistemas: ao rolar, as peças soltas se juntam num painel que funciona de verdade.
   As partículas acompanham a rolagem: saem de uma nuvem solta e cercam o painel montado.
   Tudo é fictício e está identificado na página. */

import { DASH } from '../content.js';
import { frame } from '../shapes.js';

const brl = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const pct = (v) => `${Math.abs(Math.round(v * 100))}% ${v >= 0 ? 'acima' : 'abaixo'} do período anterior`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => 1 - Math.pow(1 - t, 3);
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function series(period, unit) {
  const n = period === 30 ? 10 : period === 90 ? 13 : 12;
  const scale = (period === 30 ? 9000 : period === 90 ? 21000 : 88000) * DASH.units[unit];
  const r = rnd(period * 7 + unit.charCodeAt(0));
  const cur = [], old = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    cur.push(scale * (0.82 + 0.28 * t + 0.12 * Math.sin(i * 1.3 + period) + (r() - 0.5) * 0.12));
    old.push(scale * (0.78 + 0.16 * t + 0.1 * Math.sin(i * 1.1 + 2) + (r() - 0.5) * 0.12));
  }
  const labels = period === 365 ? DASH.months : Array.from({ length: n }, (_, i) => (period === 30 ? `dia ${1 + i * 3}` : `sem ${i + 1}`));
  return { cur, old, labels, r };
}

export function initUniverse(root, ctx) {
  const D = document;
  const pin = root.querySelector('#uni');
  const stick = root.querySelector('.uni-stick');
  const dash = root.querySelector('#dash');
  const pieces = [...dash.querySelectorAll('.u-p')];
  const srcs = [...root.querySelectorAll('.src')];
  const caps = [...root.querySelectorAll('#uni-caps li')];
  const kpiEls = [...root.querySelectorAll('#d-kpis .kpi')];
  const line = root.querySelector('#d-line');
  const bars = root.querySelector('#d-bars');
  const alerts = root.querySelector('#d-alerts');
  const repBtn = root.querySelector('#d-rep');
  const repT = root.querySelector('#d-rep-t');
  const reduced = ctx.reduced;
  let scat = [], p = reduced ? 1 : 0, live = false, inCh = false, scrubOn = false, period = 90, unit = 'all', data = null, capI = -1;

  /* posição solta de cada peça: espalhada no espaço, girada e menor */
  function scatter() {
    const r = rnd(77);
    const W = innerWidth, Hh = innerHeight, nar = W <= 760;
    scat = pieces.map(() => ({
      x: (r() - 0.5) * W * (nar ? 0.7 : 0.85), y: (r() - 0.5) * Hh * (nar ? 0.55 : 0.7), z: -380 + r() * 520,
      rx: (r() - 0.5) * 70, ry: (r() - 0.5) * 90, rz: (r() - 0.5) * 36, s: 0.5 + r() * 0.3
    }));
  }

  function progress() {
    const r = pin.getBoundingClientRect();
    const range = r.height - stick.offsetHeight;
    const top = parseFloat(getComputedStyle(stick).top) || 0;
    return range > 0 ? clamp((top - r.top) / range, 0, 1) : 1;
  }

  function apply() {
    pieces.forEach((el, i) => {
      const a = 0.05 + i * 0.034, b = a + 0.4;
      const k = reduced ? 1 : ease(clamp((p - a) / (b - a), 0, 1));
      const S = scat[i], v = 1 - k;
      el.style.transform = v < 0.0005 ? '' : `perspective(1200px) translate3d(${(S.x * v).toFixed(1)}px, ${(S.y * v).toFixed(1)}px, ${(S.z * v).toFixed(1)}px) rotateX(${(S.rx * v).toFixed(2)}deg) rotateY(${(S.ry * v).toFixed(2)}deg) rotateZ(${(S.rz * v).toFixed(2)}deg) scale(${(1 - (1 - S.s) * v).toFixed(3)})`;
      el.style.opacity = (0.3 + 0.7 * k).toFixed(3);
    });
    dash.style.setProperty('--bg', smooth(0.5, 0.78, p).toFixed(3));
    srcs.forEach((s, i) => {
      const k = smooth(0.08 + i * 0.03, 0.46 + i * 0.03, p);
      s.style.setProperty('--so', (1 - k).toFixed(3));
      s.style.setProperty('--ss', (1 - k * 0.5).toFixed(3));
    });
    const ci = p < 0.3 ? 0 : p < 0.72 ? 1 : 2;
    if (ci !== capI) { capI = ci; caps.forEach((c, i) => c.classList.toggle('on', i === ci)); }
    if (p > 0.8 && !live) { live = true; render(true); }
    const st = ctx.stage();
    if (inCh && st && scrubOn) st.scrub('@current', 'uframe', smooth(0.04, 0.82, p), { dur: 1, spread: 0.7, arc: 1.1 });
  }

  /* moldura de partículas do tamanho exato do painel, centrada nele */
  function defineFrame() {
    const st = ctx.stage();
    if (!st) return;
    const r = dash.getBoundingClientRect();
    const a = st.screenToWorld(r.left, r.bottom), b = st.screenToWorld(r.right, r.top);
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    st.defineShape('uframe', frame(st.N, { x0: a[0] - cx, y0: a[1] - cy, x1: b[0] - cx, y1: b[1] - cy }));
    st.setLayout({ x: cx, y: ctx.anchorY('#dash'), s: 1, o: 0.85 });
  }

  function enter() {
    inCh = true;
    const st = ctx.stage();
    if (!st) return;
    st.setCam({ lock: true });
    st.yK = 10;
    defineFrame();
    p = reduced ? 1 : progress();
    if (p > 0.6 || reduced) { scrubOn = false; st.setShape('uframe', { dur: 1.4, spread: 0.6, force: true, arc: 0.9 }); }
    else { scrubOn = true; st.mode = 'time'; }
    apply();
  }
  function leave() {
    inCh = false;
    const st = ctx.stage();
    if (st) st.setCam({ lock: false });
  }
  function scroll() {
    if (!reduced) p = progress();
    apply();
    const st = ctx.stage();
    if (inCh && st) st.setLayout({ y: ctx.anchorY('#dash') });
  }

  /* ---------- painel ---------- */
  let quiet = false;
  const anim = (el, kf, o) => (reduced || quiet || !el.animate ? null : el.animate(kf, o));
  function countTo(el, text) {
    const m = /^(R\$ )?([\d.]+)$/.exec(text);
    if (reduced || quiet || !m) { el.textContent = text; return; }
    const to = +m[2].replace(/\./g, ''), pre = m[1] || '';
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1100);
      el.textContent = pre + Math.round(to * ease(k)).toLocaleString('pt-BR');
      if (k < 1) requestAnimationFrame(tick); else el.textContent = text;
    };
    requestAnimationFrame(tick);
  }
  function render(first, q) {
    quiet = !!q;
    data = series(period, unit);
    const { cur, old, labels } = data;
    const sum = cur.reduce((a, b) => a + b, 0), sumOld = old.reduce((a, b) => a + b, 0);
    const orders = Math.round(sum / 340), ordersOld = Math.round(sumOld / 350);
    const late = Math.max(1, Math.round(orders * 0.018 * (unit === 'b' ? 1.6 : 1)));
    const K = [
      [brl(sum), (sum - sumOld) / sumOld],
      [orders.toLocaleString('pt-BR'), (orders - ordersOld) / ordersOld],
      [brl(sum / orders), (sum / orders - sumOld / ordersOld) / (sumOld / ordersOld)],
      [String(late), -0.12]
    ];
    kpiEls.forEach((el, i) => {
      countTo(el.querySelector('b'), K[i][0]);
      const em = el.querySelector('em');
      em.textContent = pct(K[i][1]);
      em.className = (i === 3 ? -K[i][1] : K[i][1]) >= 0 ? 'up' : 'dn';
    });
    const W = 600, Hh = 220, pad = 26, n = cur.length, proj = 3;
    const all = cur.concat(old);
    const max = Math.max(...all) * 1.18, min = Math.min(...all) * 0.7;
    const X = (i) => pad + (i / (n - 1 + proj)) * (W - pad * 2);
    const Y = (v) => Hh - pad - ((v - min) / (max - min)) * (Hh - pad * 2);
    const slope = (cur[n - 1] - cur[n - 4]) / 3;
    const pj = [cur[n - 1]]; for (let k = 1; k <= proj; k++) pj.push(cur[n - 1] + slope * k * 0.9);
    const P = cur.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const Po = old.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const Pp = pj.map((v, k) => `${X(n - 1 + k).toFixed(1)},${Y(v).toFixed(1)}`);
    const step = Math.ceil(n / 6);
    line.innerHTML = `<defs><linearGradient id="d-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#258cf8" stop-opacity=".28"/><stop offset="1" stop-color="#258cf8" stop-opacity="0"/></linearGradient></defs>` +
      [0.25, 0.5, 0.75].map((t) => `<line x1="${pad}" x2="${W - pad}" y1="${pad + t * (Hh - pad * 2)}" y2="${pad + t * (Hh - pad * 2)}" stroke="#e3ecf6"/>`).join('') +
      `<path d="M${P.join(' L')} L${X(n - 1)},${Hh - pad} L${X(0)},${Hh - pad} Z" fill="url(#d-a)" class="ar"/>` +
      `<polyline points="${Po.join(' ')}" fill="none" stroke="#a6b8cc" stroke-width="2" stroke-dasharray="5 6"/>` +
      `<polyline class="ln" points="${P.join(' ')}" fill="none" stroke="#1f6fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<polyline class="pj" points="${Pp.join(' ')}" fill="none" stroke="#6a55f5" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>` +
      `<circle cx="${X(n - 1)}" cy="${Y(cur[n - 1])}" r="5" fill="#fff" stroke="#1f6fff" stroke-width="3"/>` +
      `<text x="${X(n - 1 + proj) - 4}" y="${Y(pj[proj]) - 12}" text-anchor="end" fill="#6a55f5">projeção</text>` +
      labels.map((l, i) => (i % step === 0 ? `<text x="${X(i)}" y="${Hh - 4}" text-anchor="middle">${l}</text>` : '')).join('') +
      `<text x="${W - pad}" y="${pad - 8}" text-anchor="end">tracejado cinza: período anterior</text>`;
    const ln = line.querySelector('.ln');
    if (ln.getTotalLength) {
      const L = ln.getTotalLength();
      anim(ln, [{ strokeDasharray: L, strokeDashoffset: L }, { strokeDasharray: L, strokeDashoffset: 0 }], { duration: first ? 1500 : 900, easing: 'cubic-bezier(.22,.75,.12,1)' });
      anim(line.querySelector('.pj'), [{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: first ? 1900 : 1100 });
      anim(line.querySelector('.ar'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1200 });
    }
    const r = data.r;
    const share = [0.42, 0.27, 0.21, 0.1];
    const vc = share.map((s) => sum * s * (0.9 + r() * 0.2)), vo = share.map((s) => sumOld * s * (0.9 + r() * 0.2));
    const bm = Math.max(...vc, ...vo) * 1.1, BW = 320, BH = 220, bp = 24, gw = (BW - bp * 2) / 4;
    bars.innerHTML = DASH.cats.map((c, i) => {
      const x = bp + i * gw, h1 = (vo[i] / bm) * (BH - 60), h2 = (vc[i] / bm) * (BH - 60);
      return `<rect class="b" x="${x + gw * 0.16}" y="${BH - 30 - h1}" width="${gw * 0.3}" height="${h1}" rx="4" fill="#c3d6ea"/>` +
        `<rect class="b" x="${x + gw * 0.5}" y="${BH - 30 - h2}" width="${gw * 0.3}" height="${h2}" rx="4" fill="#1f6fff"/>` +
        `<text x="${x + gw / 2}" y="${BH - 10}" text-anchor="middle">${c}</text>`;
    }).join('') + `<text x="${bp}" y="14">cinza: anterior</text><text x="${BW - bp}" y="14" text-anchor="end" fill="#0b5fcc">azul: atual</text>`;
    bars.querySelectorAll('.b').forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'bottom'; anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 800, delay: i * 50, easing: 'cubic-bezier(.22,.75,.12,1)', fill: 'backwards' }); });
    const growth = (sum - sumOld) / sumOld;
    const goal = Math.round((pj[proj] / (cur[n - 1] * 1.05)) * 100);
    const unitName = unit === 'a' ? 'Unidade Norte' : 'Unidade Sul';
    const A = [
      [growth >= 0 ? 'ok' : 'bad', `Faturamento ${pct(growth)}.`],
      ['', `${late} ${late > 1 ? 'pedidos atrasados' : 'pedido atrasado'} na ${unitName}. Responsável já foi avisado.`],
      ['bad', 'Pedido 2297 lançado em duplicidade foi identificado e separado.'],
      ['ok', `Pela projeção, a meta do próximo período chega a ${goal}%.`]
    ];
    alerts.innerHTML = A.map((a, i) => `<li class="${a[0]}" style="animation-delay:${i * 90}ms">${a[1]}</li>`).join('');
    repT.textContent = 'Resumo pronto para enviar à diretoria.';
    const old2 = root.querySelector('.rep'); if (old2) old2.remove();
    repBtn.disabled = false;
    data.text = `Período: ${period === 365 ? '12 meses' : period + ' dias'}, ${unit === 'all' ? 'todas as unidades' : unit === 'a' ? 'Unidade Norte' : 'Unidade Sul'}. Faturamento de ${brl(sum)}, ${pct(growth)}, ${orders.toLocaleString('pt-BR')} pedidos e ticket médio de ${brl(sum / orders)}.`;
  }
  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    period = +b.dataset.p;
    root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    live = true; render();
  }));
  root.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => {
    unit = b.dataset.un;
    root.querySelectorAll('[data-un]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    live = true; render();
  }));
  repBtn.addEventListener('click', () => {
    if (!data) render();
    const pEl = root.querySelector('.rep') || D.createElement('p');
    pEl.className = 'rep';
    pEl.textContent = data.text;
    repT.textContent = 'Relatório gerado (dados fictícios):';
    repBtn.before(pEl);
  });

  scatter();
  render(false, true);
  if (reduced) live = true;
  apply();
  return {
    enter, leave, scroll,
    resize() { scatter(); if (inCh) defineFrame(); apply(); }
  };
}
