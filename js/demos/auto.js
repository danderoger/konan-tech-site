/* Simulador de automação: o visitante escolhe o ramo e vê cada etapa manual voar até o fluxo automático.
   Depois, um pedido percorre o fluxo e o registro mostra cada passo. Tudo é simulação. */

import { AUTO } from '../content.js';

const ICON = { WhatsApp: 'i-chat', IA: 'i-scan', Planilha: 'i-grid', Sistema: 'i-cpu', Pessoa: 'i-user', Painel: 'i-bars', Aviso: 'i-bell', Email: 'i-mail', Aplicativo: 'i-mobile', Tarefa: 'i-check' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initAuto(root, ctx) {
  const D = document;
  const box = root.querySelector('#au');
  const pick = [...root.querySelectorAll('#au-pick [role=radio]')];
  const man = root.querySelector('#au-man');
  const flowEl = root.querySelector('#au-flow');
  const nodes = root.querySelector('#au-nodes');
  const log = root.querySelector('#au-log');
  const pkt = root.querySelector('#au-pkt');
  const sum = root.querySelector('#au-sum');
  const run = root.querySelector('#au-run');
  const reduced = ctx.reduced;
  let ri = 0, token = 0, seen = false;

  const wait = (ms, t) => new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej(new Error('cancelado'))), reduced ? 0 : ms));

  function render() {
    ++token;
    const A = AUTO[ri];
    man.innerHTML = A.man.map((t, i) => `<li style="--r:${((i % 2 ? 1 : -1) * (0.5 + ((i * 37) % 10) / 12)).toFixed(2)}deg"><span>${esc(t)}</span><svg class="ic" aria-hidden="true"><use href="#i-user"/></svg></li>`).join('');
    nodes.innerHTML = A.auto.map(([t, tag, human]) => `<li class="${human ? 'human' : ''}"><span class="nd"><svg class="ic" aria-hidden="true"><use href="#${ICON[tag] || 'i-bolt'}"/></svg></span><span class="nt">${esc(t)}</span><span class="tg">${esc(tag === 'Pessoa' ? 'Decisão humana' : tag)}</span></li>`).join('');
    log.innerHTML = '';
    pkt.style.opacity = 0;
    sum.textContent = `Hoje: ${A.man.length} etapas feitas à mão.`;
    run.disabled = false;
  }

  function pulseAt(el) {
    const st = ctx.stage();
    if (!st || ctx.chapter() !== 'automacao') return;
    const r = el.getBoundingClientRect();
    st.pulse(((r.left + r.right) / 2 / innerWidth) * 2 - 1, -(((r.top + r.bottom) / 2) / innerHeight) * 2 + 1);
  }

  async function ghost(from, to, text, delay, t) {
    if (reduced || !D.body.animate) { from.classList.add('gone'); to.classList.add('in'); return; }
    await wait(delay, t);
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const g = D.createElement('div');
    g.className = 'ghost';
    g.textContent = text;
    Object.assign(g.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    D.body.append(g);
    from.classList.add('gone');
    const anim = g.animate([
      { transform: 'none', opacity: 1, borderRadius: '6px' },
      { transform: `translate(${(b.left - a.left) * 0.5}px, ${(b.top - a.top) * 0.5 - 30}px) rotate(-2deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${(b.width / a.width).toFixed(3)}, ${(b.height / a.height).toFixed(3)})`, opacity: 0.15, borderRadius: '14px' }
    ], { duration: 650, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    try { await anim.finished; } catch (e) { /* interrompido */ }
    g.remove();
    if (t === token) to.classList.add('in');
  }

  async function automate() {
    render();
    const t = token;
    const A = AUTO[ri];
    run.disabled = true;
    const mi = [...man.children], ni = [...nodes.children];
    try {
      await Promise.all(mi.map((li, i) => ghost(li, ni[i], A.man[i], i * 150, t)));
      await wait(180, t);
      const fr = flowEl.getBoundingClientRect();
      pkt.style.opacity = 1;
      let clock = 0;
      for (let j = 0; j < ni.length; j++) {
        const r = ni[j].getBoundingClientRect();
        pkt.style.setProperty('--py', (r.top - fr.top + r.height / 2 - 6) + 'px');
        await wait(reduced ? 0 : 330, t);
        ni[j].classList.add('hit');
        pulseAt(ni[j]);
        const human = !!A.auto[j][2];
        if (human) {
          log.insertAdjacentHTML('beforeend', `<li><b>+${clock.toFixed(1).replace('.', ',')} s</b>Aguardando a decisão de uma pessoa</li>`);
          await wait(700, t);
          clock += 1.1;
          log.insertAdjacentHTML('beforeend', `<li><b>+${clock.toFixed(1).replace('.', ',')} s</b>Aprovado com um toque</li>`);
        } else {
          log.insertAdjacentHTML('beforeend', `<li><b>+${clock.toFixed(1).replace('.', ',')} s</b>${esc(A.auto[j][0])}</li>`);
          clock += 0.3 + ((j * 7) % 5) / 10;
        }
        await wait(300, t);
        ni[j].classList.remove('hit');
      }
      pkt.style.opacity = 0;
      sum.textContent = `Etapas feitas à mão: ${A.man.length} antes, 1 depois, a decisão de uma pessoa.`;
      run.disabled = false;
      run.querySelector('span').textContent = 'Rodar de novo';
    } catch (e) { /* cancelado */ }
  }

  function choose(k, go) {
    ri = k;
    pick.forEach((b, i) => { b.setAttribute('aria-checked', String(i === k)); b.tabIndex = i === k ? 0 : -1; });
    run.querySelector('span').textContent = 'Automatizar este processo';
    render();
    if (go) setTimeout(automate, reduced ? 0 : 350);
  }
  pick.forEach((b, k) => {
    b.addEventListener('click', () => choose(k, true));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = (k + d + pick.length) % pick.length;
      pick[n].focus();
      choose(n, true);
    });
  });
  run.addEventListener('click', automate);
  root.querySelector('#au-reset').addEventListener('click', () => { run.querySelector('span').textContent = 'Automatizar este processo'; render(); });

  render();
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (e.isIntersecting && !seen) { seen = true; setTimeout(automate, reduced ? 0 : 900); io.disconnect(); }
  }), { threshold: 0.45 });
  io.observe(box);
  return {};
}
