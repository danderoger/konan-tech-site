const EXAMPLES = {
  pedidos: {
    route: ['Novo pedido', 'Organizar', 'Painel da equipe'],
    summary: 'Um pedido entra e vira uma tarefa para a equipe.',
    icon: 'chat', targetIcon: 'mobile', detail: 'app', action: 'Testar aplicativo', hue: 217
  },
  notas: {
    route: ['Nota recebida', 'Extrair', 'Dados para revisão'],
    summary: 'A inteligência artificial lê a nota e preenche os campos para conferência.',
    icon: 'scan', targetIcon: 'check', detail: 'ia', action: 'Testar leitura de notas', hue: 260
  },
  dados: {
    route: ['Dados das equipes', 'Consolidar', 'Indicadores'],
    summary: 'Informações de várias áreas chegam ao mesmo painel.',
    icon: 'grid', targetIcon: 'bars', detail: 'painel', action: 'Testar painel', hue: 182
  }
};

export function initIntro(flow) {
  const choices = flow.querySelector('.flow-choices');
  const route = ['origin', 'middle', 'target'].map((name) => flow.querySelector('#flow-' + name));
  const icon = flow.querySelector('#flow-icon');
  const targetIcon = flow.querySelector('#flow-target-icon');
  const summary = flow.querySelector('#flow-summary');
  const demo = flow.querySelector('#flow-demo');
  const canvas = flow.querySelector('canvas');
  const context = canvas.getContext('2d');
  const dotCount = matchMedia('(max-width: 760px)').matches ? 72 : 144;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const t = i * 2.39996;
    const density = 1 - (i * 7 % 139) / 139;
    return [t, density, (i * 13 % 67) / 67];
  });
  let frame = 0;
  let width = 0;
  let height = 0;
  let visible = false;
  let hue = EXAMPLES.pedidos.hue;
  let origin = null;
  let lastPaint = 0;

  function paint(time) {
    if (!context || width === 0 || height === 0) return;
    const angle = time / 4500;
    const radius = Math.min(width * 0.45, height * 0.62);
    context.clearRect(0, 0, width, height);
    for (const [t, density, speed] of dots) {
      const wave = t + angle * (0.4 + speed);
      const depth = Math.cos(wave);
      const x = width / 2 + Math.sin(wave) * density * radius * 1.3;
      const y = height * 0.49 + Math.cos(t * .65 + angle) * radius * density * .61;
      const alpha = 0.12 + (0.25 + depth * 0.22) * speed;
      context.fillStyle = `hsla(${hue + speed * 40},100%,${70 + speed * 21}%,${alpha})`;
      const size = 1 + 1.1 * speed + .3 * depth;
      context.fillRect(x, y, size, size);
    }
    for (let i = 0; i < 7; i++) {
      const progress = (time / 2000 + i / 7) % 1;
      const x = width * (0.15 + progress * 0.7);
      const y = height * .49;
      context.fillStyle = `hsla(${hue},96%,80%,.22)`;
      context.fillRect(x - 11, y - 1, 14, 2);
      context.fillStyle = `hsl(${hue},96%,88%)`;
      context.fillRect(x, y - 1, 3, 3);
    }
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches) return;
    if (origin === null) origin = now;
    if (now - lastPaint > 31 || !lastPaint) {
      lastPaint = now;
      paint(now - origin);
    }
    frame = requestAnimationFrame(tick);
  }

  function refresh() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!context) return;
    if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    else paint(800);
  }

  choices.addEventListener('click', (event) => {
    const button = event.target.closest('[data-flow]');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    const example = EXAMPLES[button.dataset.flow];
    choices.querySelector('[aria-pressed=true]').setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    route.forEach((label, index) => { label.textContent = example.route[index]; });
    icon.setAttribute('href', '#i-' + example.icon);
    targetIcon.setAttribute('href', '#i-' + example.targetIcon);
    summary.textContent = example.summary;
    demo.href = '#detalhe-' + example.detail;
    demo.textContent = example.action;
    flow.style.setProperty('--flow-hue', example.hue);
    hue = example.hue;
    paint(800);
  });
  choices.hidden = false;
  if (!context) return;

  new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(800);
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  }).observe(canvas);
  reduced.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
}


export function initHouseLook(figure) {
  const captions = {
    dia: 'Estudo ilustrativo da sala com luz natural.',
    noite: 'Estudo ilustrativo da mesma sala com iluminação de fim de dia.',
    maquete: 'Estudo ilustrativo em maquete para destacar volumes e aberturas.'
  };
  const controls = figure.querySelector('.house-look-controls');
  const buttons = Array.from(controls.querySelectorAll('button'));
  const images = Array.from(figure.querySelectorAll('[data-house-image]'));
  const caption = figure.querySelector('figcaption');
  controls.addEventListener('click', (event) => {
    const button = event.target.closest('[data-house-look]');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    const style = button.dataset.houseLook;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(button === item)));
    images.forEach((image) => { image.hidden = image.dataset.houseImage !== style; });
    caption.textContent = captions[style];
  });
  controls.hidden = false;
}
