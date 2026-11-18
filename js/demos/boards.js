/* Projetos como pranchas: cada projeto real numa folha com a maquete das telas.
   As pranchas mais parecidas com a planta do visitante sobem para o começo e ganham uma etiqueta azul.
   Cada projeto abre em tela cheia com rolagem própria e também por link direto: #projeto-nome. */

import { STAGE_STEPS, PROJ_TAGS, MODULOS, RAMOS } from '../content.js';
import { lc1 } from '../plan.js';

export function initBoards(root, ctx) {
  const D = document, H = D.documentElement;
  const list = root.querySelector('#boards');
  const items = [...root.querySelectorAll('.board')];
  const dlg = root.querySelector('#cv');
  const cin = dlg.querySelector('#cv-in');
  const $ = (id) => dlg.querySelector('#' + id);
  let viewing = 0, opener = null, closing = false;

  const vis = (li) => li.querySelector('template.pj-vis').content.cloneNode(true);
  const host = (li) => { const h = D.createElement('div'); h.className = 'mk-host'; h.append(vis(li)); return h; };

  items.forEach((li) => {
    /* o espaço da miniatura já existe no HTML (a página não pula quando ela aparece) */
    let th = li.querySelector('.bd-thumb');
    if (!th) { th = D.createElement('div'); th.className = 'bd-thumb'; th.setAttribute('aria-hidden', 'true'); li.prepend(th); }
    th.append(vis(li));
    const btn = li.querySelector('.pj-btn');
    btn.setAttribute('aria-controls', 'cv');
    btn.setAttribute('aria-label', 'Abrir projeto ' + li.querySelector('.pj-n').textContent);
    btn.addEventListener('click', (e) => open(items.indexOf(li), e));
  });

  /* ordem pelas partes em comum com a planta */
  function rank(st, Dv) {
    const mods = Dv && Dv.any && !st.example ? Dv.mods : [];
    const ramo = Dv && Dv.any && !st.example ? st.ramo : null;
    const scored = items.map((li, i) => {
      const tag = PROJ_TAGS[li.dataset.p] || { ramos: [], mods: [] };
      const common = tag.mods.filter((m) => mods.includes(m));
      const sameRamo = !!ramo && tag.ramos.includes(ramo);
      const like = li.querySelector('.bd-like');
      if (common.length) { like.textContent = 'Parecido com a sua planta: ' + lc1(MODULOS[common[0]].nome); like.hidden = false; }
      else if (sameRamo) { like.textContent = 'Mesmo ramo da sua planta: ' + lc1(RAMOS[ramo].nome); like.hidden = false; }
      else like.hidden = true;
      return { li, i, s: common.length * 2 + (sameRamo ? 1 : 0) };
    });
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
    const order = scored.map((x) => x.li);
    const same = order.every((li, k) => list.children[k] === li);
    if (same) return;
    /* troca de lugar com uma transição curta (as pranchas deslizam para a nova posição) */
    const first = new Map(order.map((li) => [li, li.getBoundingClientRect()]));
    order.forEach((li) => list.append(li));
    if (ctx.reduced) return;
    order.forEach((li) => {
      const a = first.get(li), b = li.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) < 2 || !li.animate) return;
      li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,.75,.12,1)' });
    });
  }

  /* visualizador em tela cheia */
  const cur = () => [...list.children];
  function fill(i) {
    const arr = cur();
    viewing = (i + arr.length) % arr.length;
    const li = arr[viewing];
    const name = li.querySelector('.pj-n').textContent;
    const stg = li.querySelector('.stg');
    const st = $('cv-stg');
    st.className = stg.className;
    st.innerHTML = stg.innerHTML;
    $('cv-h').textContent = name;
    $('cv-k').textContent = li.querySelector('.pj-k').textContent;
    const v = $('cv-vis');
    v.innerHTML = '';
    v.append(host(li));
    const more = li.querySelector('.pj-more');
    $('cv-p').textContent = more.querySelector('.pm-p').textContent;
    $('cv-s').textContent = more.querySelector('.pm-s').textContent;
    $('cv-f').innerHTML = more.querySelector('.pm-f').innerHTML;
    $('cv-n').textContent = more.querySelector('.pm-n').textContent;
    const g = $('cv-gal');
    g.innerHTML = '';
    const pg = more.querySelector('.pm-g');
    if (pg) pg.querySelectorAll('img').forEach((im) => { const c = im.cloneNode(true); c.loading = 'eager'; g.append(c); });
    const step = +li.dataset.step;
    const done = li.hasAttribute('data-done');
    $('cv-meter').querySelectorAll('li').forEach((m, k) => {
      m.classList.toggle('done', k < step);
      m.classList.toggle('now', k === step);
      m.textContent = k === 4 && done ? 'Entregue' : STAGE_STEPS[k];
      if (k === step) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    $('cv-i').textContent = viewing + 1;
    const msg = `vi o projeto ${name} no site e quero algo parecido para a minha empresa.`;
    ctx.setWa($('cv-wa'), msg);
    ctx.setWa($('cv-wa2'), msg);
    cin.scrollTop = 0;
    try { history.replaceState(null, '', '#projeto-' + li.dataset.p); } catch (e) { /* arquivo local */ }
  }

  function open(i, e) {
    if (dlg.open) { fill(i); return; }
    opener = D.activeElement;
    const x = e && e.clientX ? e.clientX : innerWidth / 2, y = e && e.clientY ? e.clientY : innerHeight / 2;
    dlg.style.setProperty('--ox', x + 'px');
    dlg.style.setProperty('--oy', y + 'px');
    fill(i);
    const l = ctx.lenis();
    if (l) l.stop();
    H.classList.add('cv-open');
    dlg.showModal();
    $('cv-x').focus({ preventScroll: true });
  }

  function close() {
    if (!dlg.open || closing) return;
    if (ctx.reduced) { dlg.close(); return; }
    closing = true;
    dlg.classList.add('closing');
    setTimeout(() => { dlg.classList.remove('closing'); closing = false; dlg.close(); }, 380);
  }

  dlg.addEventListener('close', () => {
    H.classList.remove('cv-open');
    const l = ctx.lenis();
    if (l) l.start();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* arquivo local */ }
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  $('cv-x').addEventListener('click', close);
  $('cv-prev').addEventListener('click', () => fill(viewing - 1));
  $('cv-next').addEventListener('click', () => fill(viewing + 1));
  dlg.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); fill(viewing + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); fill(viewing - 1); }
  });
  /* deslizar para o lado troca de projeto no celular */
  let sx = 0, sy = 0;
  const top = dlg.querySelector('.cv-top');
  top.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  top.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) fill(viewing + (dx < 0 ? 1 : -1));
  }, { passive: true });

  function fromHash() {
    const m = /^#projeto-([\w-]+)/.exec(location.hash);
    if (!m) return;
    const i = cur().findIndex((li) => li.dataset.p === m[1]);
    if (i > -1) open(i);
  }
  addEventListener('hashchange', fromHash);
  fromHash();

  return { rank, open: (slug) => { const i = cur().findIndex((li) => li.dataset.p === slug); if (i > -1) open(i); }, close };
}
