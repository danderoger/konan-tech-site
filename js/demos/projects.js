/* Portfólio: cartões com profundidade e apresentação completa de cada projeto. */

export function initProjects(root, { fine = true, reduced = false, setWa } = {}) {
  const cards = [...root.querySelectorAll('.pj[data-p]')];
  const dlg = root.querySelector('#pj-dlg');
  const vis = dlg.querySelector('#pjd-vis');
  const body = dlg.querySelector('#pjd-body');
  let cur = 0, opener = null;

  function fill(i) {
    cur = (i + cards.length) % cards.length;
    const c = cards[cur];
    const name = c.querySelector('h3').textContent;
    const stg = c.querySelector('.stg');
    const st = dlg.querySelector('#pjd-stg');
    st.className = stg.className;
    st.innerHTML = stg.innerHTML;
    dlg.querySelector('#pjd-h').textContent = name;
    dlg.querySelector('#pjd-k').textContent = c.querySelector('.pj-k').textContent;
    const more = c.querySelector('.pj-more');
    body.innerHTML = '';
    vis.innerHTML = '';
    [...more.children].forEach((n) => { if (n.classList.contains('pm-g')) vis.appendChild(n.cloneNode(true)); else body.appendChild(n.cloneNode(true)); });
    if (!vis.children.length) { const v = c.querySelector('.pj-vis').cloneNode(true); v.removeAttribute('aria-hidden'); vis.appendChild(v); }
    vis.querySelectorAll('img').forEach((im) => { im.loading = 'eager'; });
    if (setWa) setWa(dlg.querySelector('#pjd-wa'), `vi o projeto ${name} no site e quero algo parecido para a minha empresa.`);
    dlg.scrollTop = 0;
  }

  cards.forEach((c, i) => {
    c.querySelector('.pj-open').addEventListener('click', (e) => { opener = e.currentTarget; fill(i); dlg.showModal(); dlg.querySelector('#pjd-x').focus(); });
    if (fine && !reduced) {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
        c.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2) + 'deg');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    }
  });
  dlg.querySelector('#pjd-x').addEventListener('click', () => dlg.close());
  dlg.querySelector('#pjd-prev').addEventListener('click', () => fill(cur - 1));
  dlg.querySelector('#pjd-next').addEventListener('click', () => fill(cur + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('dlg-open'); if (opener) opener.focus(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') fill(cur + 1); if (e.key === 'ArrowLeft') fill(cur - 1); });
  return {};
}
