/* Portfólio imersivo: lista com prévia grande e cada projeto em tela cheia.
   A tela cheia tem rolagem própria (não depende da posição da página) e abre também por link direto: #projeto-nome. */

import { STAGE_STEPS } from '../content.js';

export function initCases(root, ctx) {
  const D = document, H = D.documentElement;
  const items = [...root.querySelectorAll('.pj')];
  const stageBox = root.querySelector('#pj-stage');
  const capK = root.querySelector('#pj-cap-k');
  const openBtn = root.querySelector('#pj-open');
  const dlg = root.querySelector('#cv');
  const cin = dlg.querySelector('#cv-in');
  const $ = (id) => dlg.querySelector('#' + id);
  let cur = -1, viewing = 0, opener = null, closing = false;

  const vis = (i) => items[i].querySelector('template.pj-vis').content.cloneNode(true);
  const host = (i) => { const h = D.createElement('div'); h.className = 'mk-host'; h.append(vis(i)); return h; };

  /* prévia grande ao lado da lista (computador) */
  function select(i) {
    if (i === cur) return;
    cur = i;
    items.forEach((li, k) => li.classList.toggle('on', k === i));
    const slide = D.createElement('div');
    slide.className = 'pj-slide' + (ctx.reduced ? '' : ' in');
    slide.append(host(i));
    stageBox.querySelectorAll('.pj-slide').forEach((s) => { s.classList.remove('in'); s.classList.add('out'); setTimeout(() => s.remove(), 520); });
    stageBox.append(slide);
    capK.textContent = items[i].querySelector('.pj-k').textContent;
    openBtn.setAttribute('aria-label', 'Abrir projeto ' + items[i].querySelector('.pj-n').textContent);
    if (ctx.onProject) ctx.onProject(items[i].dataset.shape);
  }

  items.forEach((li, i) => {
    const btn = li.querySelector('.pj-btn');
    btn.setAttribute('aria-controls', 'cv');
    btn.addEventListener('mouseenter', () => select(i));
    btn.addEventListener('focus', () => select(i));
    btn.addEventListener('click', (e) => open(i, e));
    const om = D.createElement('span');
    om.className = 'pj-open-m';
    om.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-open"/></svg>Abrir projeto';
    btn.append(om);
    const th = host(i);
    th.className = 'pj-thumb';
    th.setAttribute('aria-hidden', 'true');
    th.addEventListener('click', (e) => open(i, e));
    li.append(th);
  });
  select(0);
  openBtn.addEventListener('click', (e) => open(cur, e));
  stageBox.addEventListener('click', (e) => open(cur, e));
  stageBox.style.cursor = 'pointer';
  if (ctx.fine && !ctx.reduced) {
    stageBox.addEventListener('pointermove', (e) => {
      const r = stageBox.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      stageBox.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
      const s = stageBox.querySelector('.pj-slide:last-child');
      if (s) s.style.transform = `rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
    });
    stageBox.addEventListener('pointerleave', () => { const s = stageBox.querySelector('.pj-slide:last-child'); if (s) s.style.transform = ''; });
  }

  /* visualizador em tela cheia */
  function fill(i) {
    viewing = (i + items.length) % items.length;
    const li = items[viewing];
    const name = li.querySelector('.pj-n').textContent;
    const stg = li.querySelector('.stg');
    const st = $('cv-stg');
    st.className = stg.className;
    st.innerHTML = stg.innerHTML;
    $('cv-h').textContent = name;
    $('cv-k').textContent = li.querySelector('.pj-k').textContent;
    const v = $('cv-vis');
    v.innerHTML = '';
    v.append(host(viewing));
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
    const st = ctx.stage();
    if (st) setTimeout(() => { if (dlg.open) st.stop(); }, ctx.reduced ? 0 : 760);
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
    const st = ctx.stage();
    if (st && !D.hidden) st.start();
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
    const i = items.findIndex((li) => li.dataset.p === m[1]);
    if (i > -1) open(i);
  }
  addEventListener('hashchange', fromHash);
  fromHash();

  return { select, open, close };
}
