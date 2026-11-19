import { MODULOS, RAMOS, EQUIPES } from './content.js';

const scenarios = {
  planilhas: {
    title: 'Uma base para toda a operação.',
    benefit: 'Sua equipe registra cada informação uma vez e a gestão acompanha a mesma versão dos dados.',
    steps: ['Arquivo, e-mail e planilha', 'Registros integrados', 'Painel da operação'], detail: 'sistema'
  },
  equipe: {
    title: 'Acompanhe o campo em um só lugar.',
    benefit: 'A equipe atualiza o serviço pelo celular. Quem coordena vê o que está em andamento e o que já foi concluído.',
    steps: ['Solicitação do cliente', 'Ordem de serviço no celular', 'Acompanhamento pelo gestor'], detail: 'app'
  },
  documentos: {
    title: 'Passe da digitação à conferência.',
    benefit: 'A leitura do documento preenche os campos para que uma pessoa possa revisar os dados antes de aprovar.',
    steps: ['Nota ou recibo', 'Leitura e preenchimento', 'Conferência pela equipe'], detail: 'ia'
  },
  indicadores: {
    title: 'Veja o que mudou na operação.',
    benefit: 'Compare períodos e unidades para entender onde a equipe já avançou e onde precisa agir.',
    steps: ['Dados da operação', 'Indicadores organizados', 'Comparação por período'], detail: 'painel'
  },
  whatsapp: {
    title: 'Dê um destino a cada pedido.',
    benefit: 'Cada solicitação entra em um fluxo que distribui tarefas e permite acompanhar o status.',
    steps: ['Pedido recebido', 'Tarefa direcionada', 'Status atualizado'], detail: 'auto'
  },
  presenca: {
    title: 'Mostre seu trabalho e facilite o contato.',
    benefit: 'A pessoa encontra os serviços, vê exemplos e chega ao WhatsApp com uma ideia mais clara do que precisa.',
    steps: ['Pesquisa do cliente', 'Site com serviços e projetos', 'Contato pelo WhatsApp'], detail: 'site'
  }
};

const tracks = {
  obras: ['Compras e documentos', 'Canteiro e etapas', 'Custos e avanço da obra'],
  comercio: ['Pedidos e vendas', 'Estoque e entregas', 'Pagamentos e indicadores'],
  campo: ['Clientes e agenda', 'Ordens de serviço e técnicos', 'Conclusão dos atendimentos'],
  escritorio: ['Solicitações e documentos', 'Aprovações e registros', 'Acompanhamento e relatórios'],
  industria: ['Pedidos e materiais', 'Produção e controle de etapas', 'Estoque e expedição'],
  outro: ['Entradas e solicitações', 'Tarefas e responsáveis', 'Acompanhamento e gestão']
};
const trackLabels = ['Entrada', 'Operação', 'Acompanhamento'];

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

export function renderLabFlow(flow, state, result) {
  const title = state.nome || RAMOS[state.ramo]?.nome || 'Sua operação';
  const meta = [state.nome && RAMOS[state.ramo]?.nome, state.equipe !== null && EQUIPES[state.equipe]].filter(Boolean);
  const header = document.createElement('div');
  header.append(element('p', 'Mapa da operação', 'eyebrow'), element('h3', title));
  if (meta.length) header.append(element('p', meta.join(' · '), 'lab-note'));

  const track = document.createElement('ol');
  track.className = 'lab-track';
  (tracks[state.ramo] || tracks.outro).forEach((step, i) => {
    const node = document.createElement('li');
    node.append(element('small', trackLabels[i]), element('strong', step));
    track.append(node);
  });

  const summary = document.createElement('div');
  if (result.dores.length) {
    const pains = document.createElement('ul');
    pains.className = 'lab-pains';
    for (const pain of result.dores) pains.append(element('li', pain.nota));
    summary.append(element('h4', 'Dificuldades escolhidas', 'lab-subtitle'), pains);
  }
  if (result.mods.length) {
    const list = document.createElement('ul');
    list.className = 'lab-module-list';
    for (const key of result.mods) {
      const module = MODULOS[key];
      const item = document.createElement('li');
      const link = element('a', module.nome);
      link.href = '#detalhe-' + module.det;
      item.append(link);
      list.append(item);
    }
    summary.append(element('h4', 'Módulos sugeridos', 'lab-subtitle'), list);
  }
  if (!result.dores.length) summary.append(element('p', 'Marque as dificuldades para ver os módulos sugeridos.', 'lab-note'));
  flow.replaceChildren(header, track, summary);
}

export function initSolutions(track) {
  const buttons = [...document.querySelectorAll('[data-scenario]')];
  const title = document.querySelector('#scenario-title');
  const benefit = document.querySelector('#scenario-benefit');
  const diagram = document.querySelector('#scenario-flow');
  const labels = [...diagram.querySelectorAll('li span')];
  const link = document.querySelector('#scenario-demo');
  const lab = document.querySelector('#scenario-lab');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  for (const button of buttons) button.addEventListener('click', () => {
    const key = button.dataset.scenario;
    const item = scenarios[key];
    for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
    title.textContent = item.title;
    benefit.textContent = item.benefit;
    link.href = '#detalhe-' + item.detail;
    lab.dataset.labPain = key;
    labels.forEach((label, i) => { label.textContent = item.steps[i]; });
    if (!motion.matches) {
      [...diagram.children].forEach((node, index) => node.animate(
        [{ opacity: .5, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, delay: index * 65, easing: 'ease-out', fill: 'backwards' }));
    }
    track('problem_select', key);
  });

  const demo = document.querySelector('#system-demo');
  const run = document.querySelector('#system-run');
  const status = document.querySelector('#system-status');
  const cards = [...demo.querySelectorAll('li span')];
  const initial = cards.map((node) => node.textContent);
  const confirmed = ['Pedido confirmado', 'Tarefa disponível', 'Registro para conferência', 'Pedido incluído no painel'];
  run.addEventListener('click', () => {
    const active = demo.classList.toggle('confirmed');
    cards.forEach((card, i) => { card.textContent = (active ? confirmed : initial)[i]; });
    run.textContent = active ? 'Reiniciar demonstração' : 'Confirmar pedido de exemplo';
    status.textContent = active
      ? 'As quatro áreas já veem a atualização feita no pedido de exemplo.'
      : 'Pedido fictício para mostrar como as áreas usam a mesma informação.';
  });
}
