/* Demonstração de IA: a nota fiscal fictícia passa por seis etapas.
   Controles: pausar, reiniciar e explorar etapa por etapa. */

export function initAI(root, { reduced = false } = {}) {
  const doc = root.querySelector('#ai-doc');
  const items = [...root.querySelectorAll('#ai-steps li')];
  const btnPlay = root.querySelector('#ai-play');
  const btnReset = root.querySelector('#ai-reset');
  const btnExplore = root.querySelector('#ai-explore');
  const nav = root.querySelector('.ctl-nav');
  const f = (k) => doc.querySelectorAll(`[data-f="${k}"]`);
  const o = (k) => root.querySelector(`[data-o="${k}"]`);
  let cur = -1, playing = !reduced, explore = false, awake = false, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduced ? 0 : ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  /* estado final de cada etapa (usado quando pulamos direto para uma etapa) */
  const FIELDS = ['fornecedor', 'data', 'itens', 'valor'];
  const STEPS = [
    { dur: 1700, run() { doc.classList.remove('recv'); void doc.offsetWidth; if (!reduced) doc.classList.add('recv'); } },
    { dur: 2700, run() { if (!reduced) doc.classList.add('scan'); later(() => doc.classList.remove('scan'), 2500); }, end() { doc.classList.remove('scan'); } },
    {
      dur: 3900,
      run() {
        FIELDS.forEach((k, j) => {
          later(() => f(k).forEach((e) => e.classList.add('hl')), 200 + j * 800);
          later(() => { f(k).forEach((e) => { e.classList.remove('hl'); e.classList.add('got'); }); o(k).classList.add('show'); }, 800 + j * 800);
        });
      },
      end() { FIELDS.forEach((k) => { f(k).forEach((e) => { e.classList.remove('hl'); e.classList.add('got'); }); o(k).classList.add('show'); }); }
    },
    { dur: 2300, run() { later(() => o('categoria').classList.add('show'), 300); later(() => o('centro').classList.add('show'), 1000); }, end() { o('categoria').classList.add('show'); o('centro').classList.add('show'); } },
    { dur: 2300, run() { later(() => o('planilha').classList.add('show'), 300); }, end() { o('planilha').classList.add('show'); } },
    { dur: 4200, run() { later(() => o('aprovacao').classList.add('show'), 300); }, end() { o('aprovacao').classList.add('show'); } }
  ];

  function wipe() {
    clear();
    doc.classList.remove('scan', 'recv');
    root.querySelectorAll('[data-f]').forEach((e) => e.classList.remove('hl', 'got'));
    root.querySelectorAll('[data-o]').forEach((e) => e.classList.remove('show'));
    items.forEach((li) => li.classList.remove('cur', 'done'));
  }

  function go(i) {
    wipe();
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    for (let k = 0; k < cur; k++) { items[k].classList.add('done'); if (STEPS[k].end) STEPS[k].end(); }
    items[cur].classList.add('cur');
    STEPS[cur].run();
    if (playing && !explore && awake) later(next, STEPS[cur].dur);
  }

  function next() {
    if (cur >= STEPS.length - 1) {
      items[cur].classList.remove('cur');
      items[cur].classList.add('done');
      if (STEPS[cur].end) STEPS[cur].end();
      if (playing && !explore) later(() => go(0), 3200);
      return;
    }
    go(cur + 1);
  }

  function setPlaying(v) {
    playing = v;
    root.querySelector('.ai').classList.toggle('paused', !v);
    btnPlay.setAttribute('aria-pressed', String(!v));
    btnPlay.querySelector('use').setAttribute('href', v ? '#i-pause' : '#i-play');
    btnPlay.querySelector('span').textContent = v ? 'Pausar' : 'Continuar';
    clear();
    if (v && !explore && awake) later(next, 900);
  }

  btnPlay.addEventListener('click', () => { if (explore) setExplore(false); setPlaying(!playing); });
  btnReset.addEventListener('click', () => { go(0); });
  function setExplore(v) {
    explore = v;
    root.querySelector('.ai').classList.toggle('explore', v);
    btnExplore.setAttribute('aria-pressed', String(v));
    nav.hidden = !v;
    if (v) { clear(); } else if (playing && awake) later(next, 900);
  }
  btnExplore.addEventListener('click', () => { setExplore(!explore); if (explore && cur < 0) go(0); });
  root.querySelector('#ai-prev').addEventListener('click', () => go(cur - 1));
  root.querySelector('#ai-next').addEventListener('click', () => go(cur + 1));
  items.forEach((li, i) => li.querySelector('button').addEventListener('click', () => { if (!explore) setExplore(true); go(i); }));

  return {
    wake() {
      if (awake) return;
      awake = true;
      root.querySelector('.ai').classList.add('on');
      if (cur < 0) go(0); else if (playing && !explore) { clear(); later(next, 1200); }
    },
    sleep() { awake = false; clear(); }
  };
}
