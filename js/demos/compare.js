/* Antes e depois: a linha divide a página e o mundo de partículas ao mesmo tempo. */

export function initCompare(root, { reduced = false, onMove } = {}) {
  const box = root.querySelector('#cmp');
  const h = root.querySelector('#cmp-h-ctl');
  let p = 50, drag = false, touched = false, hint = 0;

  function set(v, user) {
    p = Math.max(0, Math.min(100, v));
    box.style.setProperty('--p', p + '%');
    h.setAttribute('aria-valuenow', String(Math.round(p)));
    h.setAttribute('aria-valuetext', p < 8 ? 'Tudo depois' : p > 92 ? 'Tudo antes' : `${Math.round(p)}% antes, ${100 - Math.round(p)}% depois`);
    if (user) { touched = true; cancelAnimationFrame(hint); }
    if (onMove) onMove(screenX());
  }
  const screenX = () => { const r = box.getBoundingClientRect(); return r.left + (r.width * p) / 100; };
  const fromEvent = (e) => { const r = box.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };

  box.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = true;
    box.setPointerCapture(e.pointerId);
    set(fromEvent(e), true);
  });
  box.addEventListener('pointermove', (e) => { if (drag) set(fromEvent(e), true); });
  const up = () => { drag = false; };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  h.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
    if (d) { e.preventDefault(); set(p + d, true); }
    if (e.key === 'Home') { e.preventDefault(); set(0, true); }
    if (e.key === 'End') { e.preventDefault(); set(100, true); }
  });

  /* convite: a linha passeia sozinha uma vez, até a primeira interação */
  function invite() {
    if (touched || reduced) return;
    const t0 = performance.now();
    const step = (now) => {
      if (touched) return;
      const t = (now - t0) / 1000;
      if (t > 4.2) { set(50); return; }
      set(50 + Math.sin(t * 1.5) * 26 * Math.sin(Math.min(1, t / 4.2) * Math.PI));
      hint = requestAnimationFrame(step);
    };
    hint = requestAnimationFrame(step);
  }
  set(50);
  return { screenX, invite, refresh() { if (onMove) onMove(screenX()); } };
}
