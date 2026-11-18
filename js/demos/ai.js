/* Laboratório de IA: um scanner percorre um documento fictício, cada informação voa até o seu campo,
   regras conferem tudo e o lançamento fica pronto para a aprovação de uma pessoa.
   Os campos são editáveis: mude o total ou a data e veja a conferência reagir. */

import { AI_DOCS, AI_STEPS } from '../content.js';

const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBrl = (s) => { const t = String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); const v = parseFloat(t); return Number.isFinite(v) ? v : NaN; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FIELDS = [['fornecedor', 'Fornecedor'], ['data', 'Data'], ['itens', 'Itens'], ['total', 'Total']];

/* conta como visto quando boa parte aparece, ou quando ocupa mais da metade da tela (blocos altos no celular) */
const seenEnough = (e, t) => e.isIntersecting && (e.intersectionRatio >= t || e.intersectionRect.height >= innerHeight * 0.5);
export function initAI(root, ctx) {
  const D = document;
  const box = root.querySelector('#ai');
  const bed = root.querySelector('#ai-bed');
  const doc = root.querySelector('#ai-doc');
  const boxes = root.querySelector('#ai-boxes');
  const statEl = root.querySelector('#ai-stat');
  const form = root.querySelector('#ai-form');
  const checksEl = root.querySelector('#ai-checks');
  const rh = root.querySelector('#ai-rh');
  const send = root.querySelector('#ai-send');
  const sheet = root.querySelector('#ai-sheet');
  const tabs = [...root.querySelectorAll('.ai-tabs [role=tab]')];
  const stepEls = [...root.querySelectorAll('#ai-steps li')];
  const playBtn = root.querySelector('#ai-play');
  const exploreBtn = root.querySelector('#ai-explore');
  const nav = root.querySelector('.ctl-nav');
  const F = (n) => form.elements[n];
  const reduced = ctx.reduced;
  let di = 0, step = -1, paused = false, explore = false, token = 0, awake = false, started = false, extracted = false;

  /* ---------- documento ---------- */
  function renderDoc() {
    const d = AI_DOCS[di];
    const sum = d.items.reduce((a, it) => a + it[2], 0);
    doc.innerHTML = `<span class="dk">Documento fictício</span>
      <div class="dh"><div><p class="dt">${esc(d.kind)}</p><p class="ds">${esc(d.num)}</p></div><div class="qr" aria-hidden="true"></div></div>
      <div data-f="fornecedor"><p class="lb">Emitente</p><p><b>${esc(d.emit)}</b></p><p class="ds">${esc(d.addr)}</p></div>
      <div class="row2"><div data-f="data"><p class="lb">Data de emissão</p><p>${esc(d.date)}</p></div><div><p class="lb">Destinatário</p><p>${esc(d.dest)}</p></div></div>
      <table data-f="itens"><thead><tr><th>Item</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${d.items.map((it) => `<tr><td>${esc(it[0])}</td><td>${esc(it[1])}</td><td>${brl(it[2])}</td></tr>`).join('')}</tbody></table>
      <div class="tot" data-f="total"><p class="lb">Valor total</p><p class="big">${brl(sum)}</p></div>`;
    doc.setAttribute('aria-label', `${d.kind} fictício usado na simulação`);
  }
  function resetForm() {
    const d = AI_DOCS[di];
    ['fornecedor', 'data', 'itens', 'total'].forEach((n) => { F(n).value = ''; });
    F('categoria').innerHTML = '<option value="">Aguardando</option>' + d.cats.map((c) => `<option>${esc(c)}</option>`).join('');
    F('centro').innerHTML = '<option value="">Aguardando</option>' + d.centros.map((c) => `<option>${esc(c)}</option>`).join('');
    form.querySelectorAll('.fld').forEach((f) => f.classList.remove('got', 'bad'));
    checksEl.innerHTML = '';
    boxes.innerHTML = '';
    rh.textContent = 'A conferência aparece aqui';
    send.disabled = true;
    send.querySelector('span').textContent = 'Enviar para aprovação';
    sheet.hidden = true;
    sheet.innerHTML = '';
    extracted = false;
    doc.querySelectorAll('.lit').forEach((e) => e.classList.remove('lit'));
  }
  const stat = (t) => { statEl.textContent = t; };
  function setStep(k) {
    step = k;
    stepEls.forEach((li, i) => { li.classList.toggle('done', i < k || (i === k && k === 5)); li.classList.toggle('cur', i === k); });
  }

  /* ---------- espera que respeita a pausa ---------- */
  const wait = (ms, t) => new Promise((res, rej) => {
    if (reduced) { res(); return; }
    let left = ms, last = performance.now();
    const tick = (now) => {
      if (t !== token) { rej(new Error('cancelado')); return; }
      if (!paused) left -= now - last;
      last = now;
      if (left <= 0) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  function pulseAt(el) {
    const st = ctx.stage();
    if (!st || ctx.chapter() !== 'ia') return;
    const r = el.getBoundingClientRect();
    st.pulse(((r.left + r.right) / 2 / innerWidth) * 2 - 1, -(((r.top + r.bottom) / 2) / innerHeight) * 2 + 1);
  }

  async function sweep(t) {
    bed.classList.add('scanning');
    const t0 = performance.now();
    let acc = 0, last = t0;
    await new Promise((res, rej) => {
      const tick = (now) => {
        if (t !== token) { bed.classList.remove('scanning'); rej(new Error('cancelado')); return; }
        if (!paused) acc += now - last;
        last = now;
        const k = Math.min(1, acc / 1300);
        const dr = doc.getBoundingClientRect(), br = bed.getBoundingClientRect();
        const y = dr.top - br.top + dr.height * k;
        bed.style.setProperty('--scan', y + 'px');
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    bed.classList.remove('scanning');
  }

  function boxFor(el, label) {
    const r = el.getBoundingClientRect(), br = bed.getBoundingClientRect();
    const b = D.createElement('span');
    b.className = 'bx';
    b.style.cssText = `left:${r.left - br.left - 4}px;top:${r.top - br.top - 3}px;width:${r.width + 8}px;height:${r.height + 6}px`;
    b.innerHTML = `<b>${esc(label)}</b>`;
    boxes.append(b);
  }

  async function fly(text, fromEl, toEl, t) {
    if (reduced || !D.body.animate) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const tok = D.createElement('span');
    tok.className = 'tok';
    tok.textContent = text.length > 34 ? text.slice(0, 32) + '…' : text;
    D.body.append(tok);
    const w = tok.offsetWidth, h = tok.offsetHeight;
    const x0 = a.left + Math.min(a.width / 2, 120) - w / 2, y0 = a.top + a.height / 2 - h / 2;
    const x1 = b.left + 10, y1 = b.top + b.height / 2 - h / 2;
    tok.style.left = '0px'; tok.style.top = '0px';
    const anim = tok.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0 - 14}px) scale(1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.05)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.9)`, opacity: 0.9 }
    ], { duration: 600, easing: 'cubic-bezier(.5,.05,.25,1)', fill: 'forwards' });
    try { await Promise.race([anim.finished, wait(760, t)]); } finally { tok.remove(); }
  }

  async function typeIn(input, value, t, instant) {
    if (instant || reduced) { input.value = value; return; }
    const ms = Math.min(320, 10 * value.length + 60);
    await new Promise((res, rej) => {
      let acc = 0, last = performance.now();
      const tick = (now) => {
        if (t !== token) { rej(new Error('cancelado')); return; }
        if (!paused) acc += now - last;
        last = now;
        const k = Math.min(1, acc / ms);
        input.value = value.slice(0, Math.ceil(value.length * k));
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }

  function values() {
    const d = AI_DOCS[di];
    const sum = d.items.reduce((a, it) => a + it[2], 0);
    return { fornecedor: d.emit, data: d.date, itens: `${d.items.length} itens`, total: brl(sum) };
  }

  /* ---------- conferência por regras ---------- */
  function runChecks() {
    if (!extracted) return true;
    const d = AI_DOCS[di];
    const sum = d.items.reduce((a, it) => a + it[2], 0);
    const tot = parseBrl(F('total').value);
    const okSum = Number.isFinite(tot) && Math.abs(tot - sum) < 0.005;
    const okDate = /^(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d{4}$/.test(F('data').value.trim());
    const known = d.known && F('fornecedor').value.trim() === d.emit;
    const L = [
      [okSum, okSum ? `A soma dos itens confere com o total (${brl(sum)}).` : `A soma dos itens (${brl(sum)}) não bate com o total informado${Number.isFinite(tot) ? ` (${brl(tot)})` : ''}.`],
      [okDate, okDate ? 'Data válida, dentro do período em aberto.' : 'Data em formato inválido. Use dia, mês e ano.'],
      [known ? true : 'info', known ? 'Fornecedor já cadastrado.' : 'Fornecedor novo: será cadastrado junto com a aprovação.'],
      [true, 'Nenhum documento igual lançado antes.']
    ];
    checksEl.innerHTML = L.map((c) => `<li class="${c[0] === true ? 'ok' : 'warn'}"><svg class="ic" aria-hidden="true"><use href="#${c[0] === true ? 'i-check' : 'i-warn'}"/></svg><span>${esc(c[1])}</span></li>`).join('');
    F('total').closest('.fld').classList.toggle('bad', !okSum);
    F('data').closest('.fld').classList.toggle('bad', !okDate);
    const warn = !okSum || !okDate;
    rh.textContent = warn ? 'Divergência encontrada: vai para conferência' : 'Tudo conferido: pronto para aprovação';
    if (!send.dataset.sent) send.querySelector('span').textContent = warn ? 'Enviar para conferência' : 'Enviar para aprovação';
    return !warn;
  }
  form.addEventListener('input', () => { if (extracted) { delete send.dataset.sent; send.disabled = step < 5; runChecks(); } });
  form.addEventListener('change', () => { if (extracted) runChecks(); });
  form.addEventListener('submit', (e) => e.preventDefault());

  send.addEventListener('click', () => {
    const ok = runChecks();
    const d = AI_DOCS[di];
    const dt = F('data').value.trim().slice(0, 5) || '--/--';
    const val = Number.isFinite(parseBrl(F('total').value)) ? brl(parseBrl(F('total').value)) : F('total').value;
    sheet.hidden = false;
    sheet.innerHTML = `<p><span>08/11</span><span>Cimento e areia</span><span>R$ 640,00</span></p><p><span>09/11</span><span>Locação de andaime</span><span>R$ 912,30</span></p><p class="new"><span>${esc(dt)}</span><span>${esc(F('categoria').value || d.cat)}</span><span>${esc(val)}</span></p>`;
    rh.textContent = ok ? 'Enviado. O responsável recebeu o aviso para aprovar (simulação).' : 'Enviado para conferência com a divergência destacada (simulação).';
    send.dataset.sent = '1';
    send.disabled = true;
    send.querySelector('span').textContent = 'Enviado';
  });

  /* ---------- etapas ---------- */
  async function runStep(k, t, instant) {
    const d = AI_DOCS[di];
    setStep(k);
    if (k === 0) {
      stat(AI_STEPS[0]);
      if (!instant && !reduced) { doc.classList.remove('enter'); void doc.offsetWidth; doc.classList.add('enter'); await wait(800, t); }
    } else if (k === 1) {
      stat('Identificando o documento e lendo o texto');
      if (!instant && !reduced) await sweep(t);
      stat(`${d.kind} identificado. Texto lido.`);
      if (!instant) await wait(250, t);
    } else if (k === 2) {
      stat('Extraindo os campos');
      const v = values();
      for (const [f, label] of FIELDS) {
        const el = doc.querySelector(`[data-f="${f}"]`);
        el.classList.add('lit');
        boxFor(el, label);
        if (!instant) { pulseAt(el); await wait(180, t); await fly(v[f], el, F(f), t); }
        await typeIn(F(f), v[f], t, instant);
        F(f).closest('.fld').classList.add('got');
        if (!instant) await wait(70, t);
      }
      extracted = true;
      stat(AI_STEPS[2]);
    } else if (k === 3) {
      stat('Aplicando as regras da empresa');
      for (const [n, val] of [['categoria', d.cat], ['centro', d.centro]]) {
        if (!instant) await wait(280, t);
        F(n).value = val;
        F(n).closest('.fld').classList.add('got');
      }
      stat(AI_STEPS[3]);
    } else if (k === 4) {
      stat('Conferindo os valores');
      if (!instant) await wait(350, t);
      runChecks();
      stat(AI_STEPS[4]);
    } else if (k === 5) {
      send.disabled = false;
      stat(AI_STEPS[5]);
    }
  }

  async function play(from = 0) {
    const t = ++token;
    started = true;
    try {
      if (from === 0) { resetForm(); }
      for (let k = from; k <= 5; k++) {
        await runStep(k, t, false);
        if (explore) return;
        if (k < 5) await wait(300, t);
      }
    } catch (e) { /* cancelado */ }
  }

  async function fastForward(k) {
    const t = ++token;
    renderDoc();
    resetForm();
    try { for (let i = 0; i <= k; i++) await runStep(i, t, true); } catch (e) { /* cancelado */ }
    setStep(k);
  }

  function setPaused(p) {
    paused = p;
    playBtn.setAttribute('aria-pressed', String(p));
    playBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
    playBtn.querySelector('span').textContent = p ? 'Continuar' : 'Pausar';
  }

  tabs.forEach((tb, k) => {
    tb.addEventListener('click', () => selectDoc(k, true));
    tb.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = (k + d + tabs.length) % tabs.length;
      tabs[n].focus();
      selectDoc(n, true);
    });
  });
  function selectDoc(k, user) {
    di = k;
    tabs.forEach((x, i) => { x.setAttribute('aria-selected', String(i === k)); x.tabIndex = i === k ? 0 : -1; });
    ++token;
    renderDoc();
    resetForm();
    setStep(-1);
    if (explore) { runStep(0, token, false).catch(() => {}); return; }
    if (user || awake) { setPaused(false); play(0); }
  }
  playBtn.addEventListener('click', () => {
    if (explore) { setExplore(false); return; }
    if (step === 5 && !paused) { play(0); return; }
    setPaused(!paused);
  });
  root.querySelector('#ai-reset').addEventListener('click', () => { setPaused(false); renderDoc(); if (explore) { fastForward(0); return; } play(0); });
  function setExplore(v) {
    explore = v;
    exploreBtn.setAttribute('aria-pressed', String(v));
    nav.hidden = !v;
    if (v) { setPaused(false); ++token; if (step < 0) { renderDoc(); resetForm(); runStep(0, token, false).catch(() => {}); } }
    else play(Math.max(0, step + 1 > 5 ? 0 : step + 1));
  }
  exploreBtn.addEventListener('click', () => setExplore(!explore));
  root.querySelector('#ai-next').addEventListener('click', () => { if (step < 5) { const t = ++token; runStep(step + 1, t, false).catch(() => {}); } });
  root.querySelector('#ai-prev').addEventListener('click', () => { if (step > 0) fastForward(step - 1); });

  renderDoc();
  resetForm();
  let autoPaused = false;
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    const was = awake;
    awake = seenEnough(e, 0.35);
    if (awake === was && started) return;
    if (awake && !started) { play(0); return; }
    if (!awake && started && !explore && !paused && step < 5) { autoPaused = true; setPaused(true); }
    if (awake && autoPaused) { autoPaused = false; setPaused(false); }
  }), { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
  io.observe(box);
  return {};
}
