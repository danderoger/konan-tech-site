const phases = {
  entrada: ['Dados de entrada', 'Pedidos, documentos e registros chegam por diferentes canais.'],
  processo: ['Informação organizada', 'As regras do fluxo juntam os dados e encaminham cada tarefa.'],
  controle: ['Operação acompanhada', 'A equipe vê o que avançou e o que precisa de atenção.']
};

export function initSignal(studio, track) {
  const controls = studio.querySelector('.signal-controls');
  const buttons = [...controls.querySelectorAll('button')];
  const label = studio.querySelector('#signal-label');
  const text = studio.querySelector('#signal-text');
  function select(button) {
    const phase = button.dataset.phase;
    if (studio.dataset.phase === phase) return;
    studio.dataset.phase = phase;
    const [title, description] = phases[phase];
    label.textContent = title;
    text.textContent = description;
    for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
    track('hero_phase', phase);
  }
  for (const button of buttons) button.addEventListener('click', () => select(button));
  controls.addEventListener('keydown', (event) => {
    const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const current = buttons.indexOf(event.target);
    if (!direction || current < 0) return;
    event.preventDefault();
    const next = buttons[(current + direction + buttons.length) % buttons.length];
    next.focus();
    select(next);
  });
}
