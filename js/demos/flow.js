/* Demonstração de automação: um pedido percorre as etapas ligadas pelo visitante. */

export function initFlow(root, { steps, reduced = false } = {}) {
  const track = root.querySelector('#fl-track');
  const svg = root.querySelector('#fl-svg');
  const prev = root.querySelector('#fl-prev');
  const log = root.querySelector('#fl-log');
  const sum = root.querySelector('#fl-sum');
  const chips = [...root.querySelectorAll('.fl-pick .chip')];
  const btnRun = root.querySelector('#fl-run');
  const NS = 'http://www.w3.org/2000/svg';
  const on = steps.map(() => true);
  let pts = [], running = false, timers = [], raf = 0;

  const nodes = steps.map((s) => {
    const n = document.createElement('div');
    n.className = 'fn';
    n.innerHTML = `<i></i>${s.label}`;
    track.appendChild(n);
    return n;
  });
  const pkt = document.createElement('span');
  pkt.className = 'pkt';
  track.appendChild(pkt);
  svg.innerHTML = '<defs><linearGradient id="fl-grad" x1="0" x2="1"><stop offset="0" stop-color="#258cf8"/><stop offset="1" stop-color="#39d5ff"/></linearGradient></defs>';
  const base = document.createElementNS(NS, 'path');
  base.setAttribute('class', 'w');
  const lit = document.createElementNS(NS, 'path');
  lit.setAttribute('class', 'w lit');
  svg.append(base, lit);

  /* posições dos nós: duas linhas em zigue-zague no computador, coluna em ziguezague no celular */
  function layout() {
    const W = track.clientWidth, H = track.clientHeight;
    const narrow = W < 560;
    pts = nodes.map((n, i) => {
      let x, y;
      if (narrow) { x = i % 2 ? 0.7 : 0.3; y = 0.08 + (i / (nodes.length - 1)) * 0.84; }
      else if (i < 4) { x = 0.12 + i * 0.255; y = i % 2 ? 0.36 : 0.22; }
      else { const k = i - 4; x = 0.76 - k * 0.27; y = k % 2 ? 0.66 : 0.8; }
      n.style.left = (x * 100) + '%';
      n.style.top = (y * 100) + '%';
      return [x * W, y * H];
    });
    draw();
  }

  function pathThrough(P) {
    if (P.length < 2) return '';
    let d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  function draw() {
    const P = pts.filter((p, i) => on[i]);
    const d = pathThrough(P);
    base.setAttribute('d', d);
    lit.setAttribute('d', d);
    const L = lit.getTotalLength ? lit.getTotalLength() : 0;
    lit.style.strokeDasharray = L;
    lit.style.strokeDashoffset = L;
    nodes.forEach((n, i) => n.classList.toggle('off', !on[i]));
  }

  const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
  function reset() {
    clear();
    running = false;
    nodes.forEach((n) => n.classList.remove('act', 'done'));
    log.innerHTML = '';
    prev.innerHTML = '<p class="fl-idle">Clique em simular para ver um pedido percorrer o fluxo.</p>';
    sum.textContent = '';
    pkt.style.opacity = 0;
    draw();
    btnRun.disabled = false;
  }

  const fmt = (t) => '+' + t.toFixed(1).replace('.', ',') + ' s';
  function addLog(t, text, skip) {
    const li = document.createElement('li');
    if (skip) li.className = 'sk';
    li.innerHTML = `<b>${fmt(t)}</b><span>${text}</span>`;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }

  /* move o pacote ao longo do caminho, do comprimento a até b */
  function travel(a, b, ms, done) {
    if (reduced) { lit.style.strokeDashoffset = lit.getTotalLength() - b; done(); return; }
    const L = lit.getTotalLength();
    const t0 = performance.now();
    pkt.style.opacity = 1;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const s = a + (b - a) * e;
      const p = lit.getPointAtLength(s);
      pkt.style.transform = `translate(${p.x}px, ${p.y}px)`;
      lit.style.strokeDashoffset = L - s;
      if (k < 1) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
  }

  /* comprimento do caminho até cada nó ligado */
  function lengths() {
    const P = pts.filter((p, i) => on[i]);
    const out = [0];
    const tmp = document.createElementNS(NS, 'path');
    svg.appendChild(tmp);
    for (let k = 1; k < P.length; k++) { tmp.setAttribute('d', pathThrough(P.slice(0, k + 1))); out.push(tmp.getTotalLength()); }
    tmp.remove();
    return out;
  }

  function run() {
    reset();
    running = true;
    btnRun.disabled = true;
    const L = lengths();
    const idx = steps.map((s, i) => i);
    let t = 0, k = 0, li = 0;
    const visit = () => {
      if (k >= idx.length) {
        const auto = on.filter(Boolean).length - 1, man = on.filter((v) => !v).length;
        sum.textContent = man ? `${auto} etapas automáticas e ${man} ${man > 1 ? 'continuam manuais' : 'continua manual'}.` : `Todas as ${auto} etapas depois do pedido aconteceram sem digitação.`;
        pkt.style.opacity = 0;
        running = false;
        btnRun.disabled = false;
        return;
      }
      const i = idx[k++];
      if (!on[i]) { addLog(t, `Etapa manual: ${steps[i].label.toLowerCase()}`, true); timers.push(setTimeout(visit, reduced ? 0 : 250)); return; }
      const arrive = () => {
        nodes.forEach((n) => n.classList.remove('act'));
        nodes[i].classList.add('act');
        prev.innerHTML = steps[i].prev;
        addLog(t, steps[i].log);
        timers.push(setTimeout(() => { nodes[i].classList.remove('act'); nodes[i].classList.add('done'); visit(); }, reduced ? 0 : 900));
      };
      if (li === 0) { li++; arrive(); return; }
      t += 0.3 + ((i * 7) % 5) * 0.12;
      travel(L[li - 1], L[li], 700, arrive);
      li++;
    };
    visit();
  }

  chips.forEach((c) => c.addEventListener('click', () => {
    const k = +c.dataset.k;
    if (k === 0) return;
    on[k] = !on[k];
    c.classList.toggle('on', on[k]);
    c.setAttribute('aria-pressed', String(on[k]));
    reset();
  }));
  btnRun.addEventListener('click', run);
  root.querySelector('#fl-reset').addEventListener('click', reset);
  let rz;
  new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (!running) layout(); }); }).observe(track);
  layout();
  return { wake() {}, sleep() {} };
}
