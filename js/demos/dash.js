/* Dashboard: a tabela bruta vira indicadores, gráficos, alertas e relatório. Tudo fictício. */

const brl = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const pct = (v) => `${Math.abs(Math.round(v * 100))}% ${v >= 0 ? 'acima' : 'abaixo'} do período anterior`;

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* série fictícia: pontos do período escolhido e do período anterior */
function series(period, unit, DASH) {
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

export function initDash(root, { DASH, reduced = false } = {}) {
  const box = root.querySelector('#db-demo');
  const kpis = root.querySelector('#db-kpis');
  const line = root.querySelector('#db-line');
  const bars = root.querySelector('#db-bars');
  const alerts = root.querySelector('#db-alerts');
  const raw = root.querySelector('#db-raw');
  const mode = root.querySelector('#db-mode');
  const repBtn = root.querySelector('#db-rep');
  const repT = root.querySelector('#db-rep-t');
  let period = 90, unit = 'all', isRaw = true, did = false, data = null;

  raw.innerHTML = '<table><thead><tr><th>Data</th><th>Unidade</th><th>Registro</th><th>Categoria</th><th>Valor</th><th>Situação</th></tr></thead><tbody>' +
    DASH.raw.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody></table>';

  const anim = (el, kf, o) => (reduced || !el.animate ? null : el.animate(kf, o));

  function render(first) {
    data = series(period, unit, DASH);
    const { cur, old, labels } = data;
    const sum = cur.reduce((a, b) => a + b, 0), sumOld = old.reduce((a, b) => a + b, 0);
    const orders = Math.round(sum / 340), ordersOld = Math.round(sumOld / 350);
    const late = Math.max(1, Math.round(orders * 0.018 * (unit === 'b' ? 1.6 : 1)));
    const K = [
      ['Faturamento', brl(sum), (sum - sumOld) / sumOld],
      ['Pedidos', orders.toLocaleString('pt-BR'), (orders - ordersOld) / ordersOld],
      ['Ticket médio', brl(sum / orders), (sum / orders - sumOld / ordersOld) / (sumOld / ordersOld)],
      ['Pedidos atrasados', String(late), -0.12]
    ];
    kpis.innerHTML = K.map((k, i) => `<div class="kpi"><span>${k[0]}</span><b>${k[1]}</b><em class="${(i === 3 ? -k[2] : k[2]) >= 0 ? 'up' : 'dn'}">${pct(k[2])}</em></div>`).join('');

    /* linha com área e projeção */
    const W = 600, H = 220, pad = 26, n = cur.length, proj = 3;
    const all = cur.concat(old);
    const max = Math.max(...all) * 1.18, min = Math.min(...all) * 0.7;
    const X = (i) => pad + (i / (n - 1 + proj)) * (W - pad * 2);
    const Y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    const slope = (cur[n - 1] - cur[n - 4]) / 3;
    const pj = [cur[n - 1]]; for (let k = 1; k <= proj; k++) pj.push(cur[n - 1] + slope * k * 0.9);
    const P = cur.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const Po = old.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const Pp = pj.map((v, k) => `${X(n - 1 + k).toFixed(1)},${Y(v).toFixed(1)}`);
    const step = Math.ceil(n / 6);
    line.innerHTML = `<defs><linearGradient id="db-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#258cf8" stop-opacity=".28"/><stop offset="1" stop-color="#258cf8" stop-opacity="0"/></linearGradient></defs>` +
      [0.25, 0.5, 0.75].map((t) => `<line x1="${pad}" x2="${W - pad}" y1="${pad + t * (H - pad * 2)}" y2="${pad + t * (H - pad * 2)}" stroke="#e3ecf6"/>`).join('') +
      `<path d="M${P.join(' L')} L${X(n - 1)},${H - pad} L${X(0)},${H - pad} Z" fill="url(#db-a)" class="ar"/>` +
      `<polyline points="${Po.join(' ')}" fill="none" stroke="#a9bcd0" stroke-width="2" stroke-dasharray="5 6"/>` +
      `<polyline class="ln" points="${P.join(' ')}" fill="none" stroke="#258cf8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<polyline class="pj" points="${Pp.join(' ')}" fill="none" stroke="#6e5bf5" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>` +
      `<circle cx="${X(n - 1)}" cy="${Y(cur[n - 1])}" r="5" fill="#fff" stroke="#258cf8" stroke-width="3"/>` +
      `<text x="${X(n - 1 + proj) - 4}" y="${Y(pj[proj]) - 12}" text-anchor="end" fill="#6e5bf5">projeção</text>` +
      labels.map((l, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 4}" text-anchor="middle">${l}</text>` : '')).join('') +
      `<text x="${W - pad}" y="${pad - 8}" text-anchor="end">tracejado cinza: período anterior</text>`;
    const ln = line.querySelector('.ln');
    if (ln.getTotalLength) {
      const L = ln.getTotalLength();
      anim(ln, [{ strokeDasharray: L, strokeDashoffset: L }, { strokeDasharray: L, strokeDashoffset: 0 }], { duration: first ? 1500 : 900, easing: 'cubic-bezier(.22,.75,.12,1)' });
      anim(line.querySelector('.pj'), [{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: first ? 1900 : 1100 });
      anim(line.querySelector('.ar'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1200 });
    }

    /* barras por categoria: anterior e atual */
    const r = data.r;
    const share = [0.42, 0.27, 0.21, 0.1];
    const vc = share.map((s) => sum * s * (0.9 + r() * 0.2)), vo = share.map((s) => sumOld * s * (0.9 + r() * 0.2));
    const bm = Math.max(...vc, ...vo) * 1.1, BW = 320, BH = 220, bp = 24, gw = (BW - bp * 2) / 4;
    bars.innerHTML = DASH.cats.map((c, i) => {
      const x = bp + i * gw, h1 = (vo[i] / bm) * (BH - 60), h2 = (vc[i] / bm) * (BH - 60);
      return `<rect class="b" x="${x + gw * 0.16}" y="${BH - 30 - h1}" width="${gw * 0.3}" height="${h1}" rx="4" fill="#c3d6ea"/>` +
        `<rect class="b" x="${x + gw * 0.5}" y="${BH - 30 - h2}" width="${gw * 0.3}" height="${h2}" rx="4" fill="#258cf8"/>` +
        `<text x="${x + gw / 2}" y="${BH - 10}" text-anchor="middle">${c}</text>`;
    }).join('') + `<text x="${bp}" y="14">cinza: anterior</text><text x="${BW - bp}" y="14" text-anchor="end" fill="#0b66d0">azul: atual</text>`;
    bars.querySelectorAll('.b').forEach((b, i) => { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'bottom'; anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 800, delay: i * 50, easing: 'cubic-bezier(.22,.75,.12,1)', fill: 'backwards' }); });

    /* alertas derivados dos números fictícios */
    const growth = (sum - sumOld) / sumOld;
    const goal = Math.round((pj[proj] / (cur[n - 1] * 1.05)) * 100);
    const unitName = unit === 'a' ? 'Unidade Norte' : unit === 'b' ? 'Unidade Sul' : 'Unidade Sul';
    const A = [
      [growth >= 0 ? 'ok' : 'bad', `Faturamento ${pct(growth)}.`],
      ['', `${late} ${late > 1 ? 'pedidos atrasados' : 'pedido atrasado'} na ${unitName}. Responsável já foi avisado.`],
      ['bad', 'Pedido 2297 lançado em duplicidade foi identificado e separado.'],
      ['ok', `Pela projeção, a meta do próximo período chega a ${goal}%.`]
    ];
    alerts.innerHTML = A.map((a, i) => `<li class="${a[0]}" style="animation-delay:${i * 90}ms">${a[1]}</li>`).join('');
    repT.textContent = 'Resumo pronto para enviar à diretoria.';
    const old2 = root.querySelector('.rep'); if (old2) old2.remove();
    data.text = `Período: ${period === 365 ? '12 meses' : period + ' dias'}, ${unit === 'all' ? 'todas as unidades' : unit === 'a' ? 'Unidade Norte' : 'Unidade Sul'}. Faturamento de ${brl(sum)}, ${pct(growth)}, ${orders.toLocaleString('pt-BR')} pedidos e ticket médio de ${brl(sum / orders)}. ${A.length} alertas acompanhados.`;
  }

  function setRaw(v) {
    isRaw = v;
    mode.querySelector('span').textContent = v ? 'Transformar em painel' : 'Ver dados brutos';
    raw.setAttribute('aria-hidden', String(!v));
    if (v) { box.classList.add('raw'); return; }
    /* as linhas da tabela voam para os indicadores antes do painel aparecer */
    const target = kpis.getBoundingClientRect();
    raw.querySelectorAll('tbody tr').forEach((tr, i) => {
      const r = tr.getBoundingClientRect();
      tr.style.setProperty('--fx', (target.left + target.width * ((i % 4) + 0.5) / 4 - (r.left + r.width / 2)) + 'px');
      tr.style.setProperty('--fy', (target.top + target.height / 2 - (r.top + r.height / 2)) + 'px');
      tr.style.transitionDelay = (i * 35) + 'ms';
    });
    box.classList.add('fold');
    box.classList.remove('raw');
    setTimeout(() => { box.classList.remove('fold'); render(true); }, reduced ? 0 : 900);
  }

  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    period = +b.dataset.p;
    root.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (isRaw) setRaw(false); else render();
  }));
  root.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
    unit = b.dataset.u;
    root.querySelectorAll('[data-u]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (isRaw) setRaw(false); else render();
  }));
  mode.addEventListener('click', () => setRaw(!isRaw));
  repBtn.addEventListener('click', () => {
    const p = root.querySelector('.rep') || document.createElement('p');
    p.className = 'rep';
    p.textContent = data.text;
    repT.textContent = 'Relatório gerado (fictício):';
    repBtn.before(p);
  });

  render(true);
  box.classList.add('raw');
  mode.querySelector('span').textContent = 'Transformar em painel';
  raw.setAttribute('aria-hidden', 'false');
  return {
    wake() { if (!did) { did = true; setTimeout(() => { if (isRaw) setRaw(false); }, reduced ? 0 : 1400); } },
    sleep() {}
  };
}
