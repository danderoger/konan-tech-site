/* Sistemas em 3D: notebook e celular com telas navegáveis e movimento de câmera. */

const CAM = [
  { rx: 7, ry: -13, tx: '0%', ty: '0%', tz: '0px' },
  { rx: 3, ry: -3, tx: '4%', ty: '2%', tz: '70px' },
  { rx: 9, ry: 17, tx: '-7%', ty: '0%', tz: '40px' },
  { rx: 15, ry: -24, tx: '3%', ty: '-3%', tz: '10px' }
];

export function initDevices(root, { reduced = false, fine = true } = {}) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const views = [...root.querySelectorAll('.ux-v')];
  const pviews = [...root.querySelectorAll('.pv')];
  const side = [...root.querySelectorAll('.ux-side i')];
  const rig = root.querySelector('#dv-rig');
  const scene = root.querySelector('#dv-scene');
  let cur = 0, auto = null, touched = false, awake = false;

  function select(i, focus) {
    i = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    views.forEach((v, k) => { v.classList.toggle('out', k === cur && k !== i); v.classList.toggle('on', k === i); });
    pviews.forEach((v, k) => v.classList.toggle('on', k === i));
    side.forEach((s, k) => s.classList.toggle('on', k === i));
    const c = CAM[i];
    rig.style.setProperty('--rx', c.rx + 'deg');
    rig.style.setProperty('--ry', c.ry + 'deg');
    rig.style.setProperty('--tx', c.tx);
    rig.style.setProperty('--ty', c.ty);
    rig.style.setProperty('--tz', c.tz);
    cur = i;
    if (focus) tabs[i].focus();
  }

  const stopAuto = () => { touched = true; clearInterval(auto); auto = null; };
  tabs.forEach((t, k) => {
    t.addEventListener('click', () => { stopAuto(); select(k); });
    t.addEventListener('keydown', (e) => {
      const m = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (m) { e.preventDefault(); stopAuto(); select(cur + m, true); }
      if (e.key === 'Home') { e.preventDefault(); stopAuto(); select(0, true); }
      if (e.key === 'End') { e.preventDefault(); stopAuto(); select(tabs.length - 1, true); }
    });
  });

  if (fine && !reduced) {
    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      rig.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2));
      rig.style.setProperty('--py', (-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2));
    });
    scene.addEventListener('pointerleave', () => { rig.style.setProperty('--px', 0); rig.style.setProperty('--py', 0); });
  }
  select(0);
  return {
    wake() { awake = true; if (!touched && !reduced && !auto) auto = setInterval(() => select(cur + 1), 5200); },
    sleep() { awake = false; clearInterval(auto); auto = null; }
  };
}
