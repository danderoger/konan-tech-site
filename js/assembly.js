const ms = 4900;
const labels = {
  final: ['Operação conectada', 'Mova o mouse sobre a cena ou abra a exploração em 3D.'],
  build: ['Construindo a operação', 'As peças são montadas na mesma cena que você vê no resultado.'],
  orbit: ['Exploração em 3D', 'Mova o mouse, arraste com o dedo ou use as setas para girar.']
};

export function initAssembly(root, track) {
  const visual = root.querySelector('.assembly-visual');
  const canvas = root.querySelector('canvas');
  const caption = root.querySelector('#assembly-title');
  const hint = root.querySelector('#assembly-hint');
  const progress = root.querySelector('.assembly-progress');
  const controls = [...root.querySelectorAll('[data-assembly]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const autoplay = matchMedia('(hover: hover) and (pointer: fine)');
  const canAutoplay = () => autoplay.matches && !motion.matches && !navigator.connection?.saveData && !document.hidden;
  const point = { x: 0, y: 0 };
  const desired = { x: 0, y: 0 };
  let model, loading, mode = 'final', command = 0, raf = 0, elapsed = 0, last = 0;
  let visible = false, readyToAutoPlay = false, lastMilestone = -1, drag = null;

  function show(next, note) {
    mode = next;
    root.dataset.view = next;
    caption.textContent = labels[next][0];
    const touchHint = next === 'final' && !autoplay.matches
      ? 'Toque em Montagem ou em Girar em 3D para explorar.'
      : labels[next][1];
    hint.textContent = note || touchHint;
    canvas.tabIndex = next === 'orbit' ? 0 : -1;
    canvas.setAttribute('aria-hidden', String(next !== 'orbit'));
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.assembly === next));
    if (next !== 'build') progress.style.setProperty('--built', '100%');
  }

  function update(now) {
    raf = 0;
    if (!model || !visible || document.hidden) return;
    const delta = last ? Math.min(80, now - last) : 0;
    last = now;
    if (mode === 'build' && !motion.matches) {
      elapsed += delta;
      const fraction = Math.min(1, elapsed / ms);
      model.draw(Math.max(.038, fraction));
      progress.style.setProperty('--built', `${Math.round(fraction * 100)}%`);
      const milestone = fraction < .30 ? 0 : fraction < .62 ? 1 : 2;
      if (milestone !== lastMilestone) {
        caption.textContent = ['Montando a base de dados', 'Conectando as áreas', 'Unindo tudo no painel'][milestone];
        lastMilestone = milestone;
      }
      if (fraction < 1) schedule();
      else show('final');
    } else if (mode === 'orbit') {
      point.x += (desired.x - point.x) * .16;
      point.y += (desired.y - point.y) * .16;
      model.draw(1, point.x, point.y, true);
      if (Math.abs(desired.x - point.x) + Math.abs(desired.y - point.y) > .005) schedule();
    }
  }
  function schedule() {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(update);
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = last = 0;
  }

  function getModel() {
    if (!loading) {
      const context = canvas.getContext('webgl2', { antialias: true, alpha: true, powerPreference: 'low-power' });
      const create = context
        ? import('./assembly-scene.js').then((scene) => scene.createAssemblyScene(canvas, context))
        : import('./assembly-software.js').then((scene) => scene.createSoftwareAssembly(canvas));
      loading = create.then((instance) => {
        model = instance;
        root.dataset.engine = context ? 'webgl' : 'projecao';
        return model;
      });
    }
    return loading;
  }

  async function select(next, manual = false) {
    const token = ++command;
    readyToAutoPlay = false;
    pause();
    if (manual) track('assembly_view', next);
    if (next === 'final') {
      show('final');
      return;
    }
    if (!model && manual) hint.textContent = 'Preparando a cena em 3D…';
    try {
      await getModel();
      if (token !== command) return;
      model.resize();
      point.x = desired.x = 0;
      point.y = desired.y = 0;
      elapsed = 0;
      lastMilestone = -1;
      if (next === 'build') {
        const still = motion.matches;
        model.draw(still ? .68 : .038);
        progress.style.setProperty('--built', still ? '68%' : '0%');
        show('build', still ? 'Montagem em um quadro estático. Selecione Realismo para ver o resultado.' : '');
      } else {
        model.draw(1, 0, 0, true);
        show('orbit');
      }
      schedule();
    } catch {
      if (token !== command) return;
      show('final', 'O navegador exibiu a versão renderizada da cena.');
      for (const button of controls) if (button.dataset.assembly !== 'final') button.disabled = true;
    }
  }

  show('final');

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      if (readyToAutoPlay && !command && canAutoplay()) select('build');
      else schedule();
    } else pause();
  }, { threshold: .16 });
  io.observe(visual);
  addEventListener('load', () => {
    readyToAutoPlay = true;
    if (visible && !command && canAutoplay()) {
      const start = () => { if (visible && readyToAutoPlay && !command && canAutoplay()) select('build'); };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 800 });
      else setTimeout(start, 360);
    }
  }, { once: true });

  for (const button of controls) button.addEventListener('click', () => select(button.dataset.assembly, true));
  new ResizeObserver(() => {
    if (!model || mode === 'final') return;
    model.resize();
    if (mode === 'build' && motion.matches) model.draw(.68);
    else schedule();
  }).observe(visual);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else schedule(); });
  motion.addEventListener('change', () => { if (motion.matches && mode === 'build') select('final'); });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    select('final');
    hint.textContent = 'A cena continua disponível como imagem.';
    for (const button of controls) if (button.dataset.assembly !== 'final') button.disabled = true;
  });

  visual.addEventListener('pointermove', (event) => {
    const rect = visual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    if (mode === 'final' && event.pointerType === 'mouse' && !motion.matches) {
      visual.style.setProperty('--parallax-x', `${(x * 18).toFixed(2)}px`);
      visual.style.setProperty('--parallax-y', `${(y * 12).toFixed(2)}px`);
    } else if (mode === 'orbit') {
      if (event.pointerType === 'mouse' && !drag && !motion.matches) {
        desired.x = x * .90;
        desired.y = y * -2.3;
        schedule();
      } else if (drag?.id === event.pointerId) {
        desired.x = drag.angle + (event.clientX - drag.x) / rect.width * 2.2;
        schedule();
      }
    }
  });
  visual.addEventListener('pointerleave', () => {
    visual.style.removeProperty('--parallax-x');
    visual.style.removeProperty('--parallax-y');
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (mode !== 'orbit') return;
    drag = { x: event.clientX, angle: desired.x, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  });
  function endDrag(event) { if (drag?.id === event.pointerId) drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('keydown', (event) => {
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!direction || mode !== 'orbit') return;
    event.preventDefault();
    desired.x += direction * .17;
    schedule();
  });
}
