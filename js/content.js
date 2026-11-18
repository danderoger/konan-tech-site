/* Konan Tech 5.0: textos e dados da planta viva e das demonstrações.
   Os textos fixos das seções ficam no index.html (para o Google ler).
   Tudo o que aparece nas demonstrações é fictício e está identificado assim na página. */

export const WA_NUMBER = '5561982270780';
export const WA_DEFAULT = 'Olá, vim pelo site da Konan Tech e quero conversar sobre uma solução para a minha empresa.';
export const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg || WA_DEFAULT)}`;
export const waContext = (frase) => `Olá, vim pelo site da Konan Tech: ${frase}`;

/* ---------- planta viva ----------
   Cada ramo tem cinco áreas dentro da empresa e uma área de fora.
   in = onde as coisas chegam, ops = operação, sup = apoio, fin = financeiro, mgmt = gestão, ext = fora da empresa. */
export const RAMOS = {
  obras: { nome: 'Obras e construção', rooms: { in: 'Compras', ops: 'Engenharia', sup: 'Almoxarifado', fin: 'Financeiro', mgmt: 'Diretoria' }, ext: 'Canteiro de obras', auto: 0 },
  comercio: { nome: 'Comércio e vendas', rooms: { in: 'Atendimento', ops: 'Vendas', sup: 'Estoque', fin: 'Financeiro', mgmt: 'Gestão' }, ext: 'Entregas', auto: 2 },
  campo: { nome: 'Serviços em campo', rooms: { in: 'Atendimento', ops: 'Agenda e rotas', sup: 'Materiais', fin: 'Financeiro', mgmt: 'Gestão' }, ext: 'Equipe em campo', auto: 1 },
  escritorio: { nome: 'Escritório e serviços', rooms: { in: 'Documentos', ops: 'Contas a pagar', sup: 'Arquivo', fin: 'Contas a receber', mgmt: 'Diretoria' }, ext: 'Visitas a clientes', auto: 3 },
  industria: { nome: 'Indústria e produção', rooms: { in: 'Pedidos', ops: 'Produção', sup: 'Estoque', fin: 'Financeiro', mgmt: 'Gestão' }, ext: 'Expedição', auto: 2 },
  outro: { nome: 'Outro ramo', rooms: { in: 'Atendimento', ops: 'Operação', sup: 'Apoio', fin: 'Financeiro', mgmt: 'Gestão' }, ext: 'Equipe externa', auto: 0 }
};
export const RAMO_ORDER = ['obras', 'comercio', 'campo', 'escritorio', 'industria', 'outro'];

/* ---------- a obra que o visitante descreve (quartos, banheiros, sala, cozinha, metros quadrados) ----------
   Vira uma casa desenhada dentro do canteiro de obras da planta. Tudo é número inteiro; 0 = não falou. */
export const OBRA_KEYS = ['quarto', 'suite', 'banheiro', 'lavabo', 'sala', 'cozinha', 'garagem', 'varanda', 'servico'];
/* letra de cada item no link da planta (m = metros quadrados) */
const OBRA_LETRA = { quarto: 'q', suite: 'u', banheiro: 'b', lavabo: 'l', sala: 's', cozinha: 'c', garagem: 'g', varanda: 'v', servico: 'w' };
const OBRA_NOME = {
  quarto: ['quarto', 'quartos'], suite: ['suíte', 'suítes'], banheiro: ['banheiro', 'banheiros'], lavabo: ['lavabo', 'lavabos'],
  sala: ['sala', 'salas'], cozinha: ['cozinha', 'cozinhas'], garagem: ['garagem', 'garagens'], varanda: ['varanda', 'varandas'], servico: ['área de serviço', 'áreas de serviço']
};
const OBRA_MAX = { quarto: 12, suite: 6, banheiro: 10, lavabo: 4, sala: 3, cozinha: 3, garagem: 3, varanda: 3, servico: 2 };
/* limpa o que veio da conversa ou do link: números inteiros dentro de limites; devolve null se não sobrou nada */
export function obraClean(o) {
  if (!o || typeof o !== 'object') return null;
  const out = { area: 0 };
  let any = false;
  OBRA_KEYS.forEach((k) => {
    const n = Math.floor(Number(o[k]) || 0);
    out[k] = Math.max(0, Math.min(OBRA_MAX[k], n));
    if (out[k]) any = true;
  });
  const a = Math.round(Number(o.area) || 0);
  out.area = a >= 8 && a <= 99999 ? a : 0;
  return any || out.area ? out : null;
}
export function obraSig(o) {
  const c = obraClean(o);
  if (!c) return '';
  return OBRA_KEYS.filter((k) => c[k]).map((k) => OBRA_LETRA[k] + c[k]).concat(c.area ? ['m' + c.area] : []).join('');
}
export function obraFromSig(s) {
  const o = {};
  String(s || '').replace(/([a-z])(\d{1,5})/g, (_, l, n) => {
    if (l === 'm') o.area = +n;
    else { const k = OBRA_KEYS.find((x) => OBRA_LETRA[x] === l); if (k) o[k] = +n; }
    return '';
  });
  return obraClean(o);
}
const obraItem = (k, n) => (n === 1 && ['sala', 'cozinha', 'garagem', 'varanda', 'servico'].includes(k) ? OBRA_NOME[k][0] : n + ' ' + OBRA_NOME[k][n === 1 ? 0 : 1]);
/* frase da obra. curto = só área, quartos e banheiros (cabe na folha); completo = tudo o que foi entendido */
export function obraFrase(o, curto) {
  const c = obraClean(o);
  if (!c) return '';
  const keys = curto ? ['quarto', 'suite', 'banheiro'] : OBRA_KEYS;
  const parts = keys.filter((k) => c[k]).map((k) => obraItem(k, c[k]));
  const area = c.area ? c.area.toLocaleString('pt-BR') + ' m²' : '';
  return (curto ? [area].concat(parts) : parts.concat([area])).filter(Boolean).join(', ');
}
/* a casa só pode ser desenhada se tem pelo menos um cômodo */
export const obraTemComodos = (o) => { const c = obraClean(o); return !!c && OBRA_KEYS.some((k) => c[k]); };

export const EQUIPES = ['Até 5 pessoas', '6 a 20 pessoas', '21 a 50 pessoas', 'Mais de 50 pessoas'];
export const EQUIPES_CURTO = ['Até 5', '6 a 20', '21 a 50', 'Mais de 50'];

/* o que trava: chip (botão), nota (texto vermelho na planta), áreas marcadas e módulos propostos */
export const DORES = [
  { k: 'planilhas', chip: 'Tudo em planilhas', nota: 'Planilhas soltas', rooms: ['mgmt', 'fin'], mods: ['base'] },
  { k: 'documentos', chip: 'Notas digitadas à mão', nota: 'Notas digitadas à mão', rooms: ['in'], mods: ['ia'] },
  { k: 'whatsapp', chip: 'Pedidos se perdem no WhatsApp', nota: 'Pedidos se perdem', rooms: ['in'], mods: ['pedidos'] },
  { k: 'equipe', chip: 'Não sei o que a equipe faz fora', nota: 'Sem notícia da equipe', rooms: ['ext'], mods: ['app', 'gestor'] },
  { k: 'retrabalho', chip: 'Tarefas repetidas todo dia', nota: 'Retrabalho todo dia', rooms: ['ops'], mods: ['auto'] },
  { k: 'indicadores', chip: 'Decido sem números', nota: 'Decisão sem números', rooms: ['mgmt'], mods: ['painel'] },
  { k: 'financeiro', chip: 'Contas e cobranças à mão', nota: 'Cobranças à mão', rooms: ['fin'], mods: ['fin'] },
  { k: 'presenca', chip: 'Cliente não me encontra', nota: 'Cliente não encontra', rooms: ['street'], mods: ['site'] }
];
export const DOR = Object.fromEntries(DORES.map((d) => [d.k, d]));

/* módulos da proposta (tinta azul). det = detalhe que mostra o módulo funcionando */
export const MODULOS = {
  base: { nome: 'Sistema web com uma base só', room: 'cor', det: 'painel' },
  ia: { nome: 'Leitura de notas com IA', room: 'in', det: 'ia' },
  pedidos: { nome: 'Central de pedidos', room: 'in', det: 'auto' },
  app: { nome: 'Aplicativo da equipe', room: 'ext', det: 'app' },
  gestor: { nome: 'Painel do gestor', room: 'mgmt', det: 'app' },
  auto: { nome: 'Automações', room: 'ops', det: 'auto' },
  painel: { nome: 'Painel de indicadores', room: 'mgmt', det: 'painel' },
  fin: { nome: 'Financeiro com lembretes', room: 'fin', det: 'auto' },
  site: { nome: 'Site e WhatsApp', room: 'street', det: 'site' }
};
export const MOD_ORDER = ['base', 'ia', 'pedidos', 'auto', 'fin', 'painel', 'gestor', 'app', 'site'];

/* detalhes: o número aparece no círculo azul de cada módulo na planta */
export const DETALHES = [
  { k: 'ia', n: 1, nome: 'Leitura de notas com IA' },
  { k: 'auto', n: 2, nome: 'Automações' },
  { k: 'painel', n: 3, nome: 'Painel de indicadores' },
  { k: 'app', n: 4, nome: 'Aplicativo da equipe' },
  { k: 'site', n: 5, nome: 'Site e WhatsApp' }
];
export const DET_N = Object.fromEntries(DETALHES.map((d) => [d.k, d.n]));

/* exemplo que se desenha sozinho ao abrir a página (empresa fictícia) */
export const EXEMPLO = {
  texto: 'Tenho uma construtora com 12 pessoas. Tudo é controlado em planilha, as notas da obra são digitadas à mão e eu nunca sei o que está acontecendo em cada obra.',
  nome: 'Construtora Exemplo'
};

/* projetos reais: o que cada um tem em comum com a planta do visitante */
export const PROJ_TAGS = {
  'obra-em-dia': { ramos: ['obras'], mods: ['base', 'painel', 'ia'] },
  montacerto: { ramos: ['campo'], mods: ['app', 'gestor', 'base'] },
  'ultra-obra': { ramos: ['obras'], mods: ['ia', 'base'] },
  'via-opus': { ramos: ['obras'], mods: ['site'] },
  'caca-ruidos': { ramos: ['campo'], mods: ['site'] }
};
export const STAGE_STEPS = ['Planejamento', 'Desenvolvimento', 'Testes', 'Implantação', 'Em uso'];

/* ---------- detalhe 1: leitura de notas com IA (três documentos fictícios) ---------- */
export const AI_DOCS = [
  {
    kind: 'Nota fiscal de venda', num: 'Nº 000.481, série 1',
    emit: 'Elétrica Horizonte Materiais Ltda', addr: 'Rua das Indústrias, 120, Brasília, DF',
    date: '12/11/2026', dest: 'Sua Empresa Ltda',
    items: [['Cabo flexível 2,5 mm', '100 m', 389.0], ['Disjuntor 32 A', '6 un.', 171.6], ['Eletroduto corrugado', '50 m', 124.5], ['Quadro de distribuição', '1 un.', 599.8]],
    cat: 'Materiais elétricos', cats: ['Materiais elétricos', 'Materiais de construção', 'Ferramentas', 'Serviços'],
    centro: 'Obra Residencial Aurora', centros: ['Obra Residencial Aurora', 'Obra Comercial Ipê', 'Sede administrativa'],
    known: true
  },
  {
    kind: 'Cupom de combustível', num: 'Cupom 22.904, bomba 4',
    emit: 'Posto Rota Norte Ltda', addr: 'Rodovia DF 001, km 12, Brasília, DF',
    date: '11/11/2026', dest: 'Placa da frota: KTN 2B26',
    items: [['Diesel S10', '120 L', 718.8], ['Arla 32', '20 L', 79.0]],
    cat: 'Combustível', cats: ['Combustível', 'Manutenção de veículos', 'Pedágio', 'Serviços'],
    centro: 'Frota de entregas', centros: ['Frota de entregas', 'Equipe de campo', 'Sede administrativa'],
    known: true
  },
  {
    kind: 'Recibo de prestação de serviço', num: 'Recibo 0087',
    emit: 'Marcos Lima Serviços Hidráulicos', addr: 'Prestador autônomo, Taguatinga, DF',
    date: '10/11/2026', dest: 'Sua Empresa Ltda',
    items: [['Troca de registro geral', '1 serviço', 280.0], ['Reparo de vazamento', '1 serviço', 156.4]],
    cat: 'Manutenção predial', cats: ['Manutenção predial', 'Serviços', 'Materiais de construção', 'Limpeza'],
    centro: 'Sede administrativa', centros: ['Sede administrativa', 'Obra Residencial Aurora', 'Frota de entregas'],
    known: false
  }
];
export const AI_STEPS = [
  'Documento recebido pelo WhatsApp',
  'Tipo identificado e texto lido',
  'Campos extraídos',
  'Categoria e centro de custo definidos',
  'Lançamento preparado na planilha',
  'Pronto para a aprovação de uma pessoa'
];

/* ---------- detalhe 2: automações (quatro ramos, processo manual e fluxo automático) ---------- */
export const AUTO = [
  {
    ramo: 'Obras e construção',
    man: ['Mestre de obras fotografa a nota', 'Manda a foto no WhatsApp do escritório', 'Alguém digita os dados na planilha', 'Confere com o orçamento da obra', 'Avisa o engenheiro sobre gastos fora do previsto', 'Monta o relatório no fim do mês'],
    auto: [['Foto da nota chega pelo WhatsApp', 'WhatsApp'], ['Inteligência artificial lê fornecedor, itens e valor', 'IA'], ['Lançamento entra na planilha da obra', 'Planilha'], ['Gasto comparado com o orçamento', 'Sistema'], ['Engenheiro confere e aprova', 'Pessoa', 1], ['Relatório da obra sempre atualizado', 'Painel']]
  },
  {
    ramo: 'Serviços em campo',
    man: ['Cliente pede pelo telefone', 'Atendente anota no caderno', 'Gestor escolhe o técnico e liga para ele', 'Técnico avisa por mensagem quando termina', 'Alguém atualiza a planilha', 'Cliente liga para saber o status'],
    auto: [['Pedido entra pelo formulário ou WhatsApp', 'WhatsApp'], ['Ordem de serviço criada', 'Sistema'], ['Distribuída por região e agenda', 'Sistema'], ['Técnico recebe e atualiza no aplicativo', 'Aplicativo'], ['Gestor acompanha e decide exceções', 'Pessoa', 1], ['Cliente recebe aviso a cada etapa', 'Aviso']]
  },
  {
    ramo: 'Comércio e vendas',
    man: ['Pedido chega pelo WhatsApp', 'Vendedor confere o estoque na planilha', 'Anota o pedido em outro lugar', 'Avisa o estoque para separar', 'Responde o cliente quando lembra', 'Fecha o caixa somando à mão'],
    auto: [['Pedido chega pelo WhatsApp', 'WhatsApp'], ['Registrado com os dados do cliente', 'Sistema'], ['Estoque reservado na hora', 'Sistema'], ['Separação criada para a equipe', 'Tarefa'], ['Vendedor confirma condições especiais', 'Pessoa', 1], ['Vendas do dia no painel', 'Painel']]
  },
  {
    ramo: 'Escritório e financeiro',
    man: ['Boletos chegam por email', 'Alguém baixa e salva em pastas', 'Digita no controle de contas a pagar', 'Confere vencimentos toda manhã', 'Pede aprovação por mensagem', 'Atualiza a planilha depois de pagar'],
    auto: [['Boleto chega por email', 'Email'], ['Dados extraídos e conferidos', 'IA'], ['Conta a pagar lançada', 'Planilha'], ['Lembrete antes do vencimento', 'Aviso'], ['Responsável aprova o pagamento', 'Pessoa', 1], ['Fluxo de caixa atualizado', 'Painel']]
  }
];

/* ---------- detalhe 3: painel de indicadores (série fictícia) ---------- */
export const DASH = {
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  units: { all: 1, a: 0.58, b: 0.42 },
  cats: ['Produtos', 'Serviços', 'Contratos', 'Outros']
};

/* ---------- detalhe 4: aplicativo da equipe (tarefas fictícias por ramo) ---------- */
export const TEAM = {
  obras: { quem: 'Mestre de obras', lugar: 'Obra Residencial Aurora', tarefas: ['Conferir entrega de cimento', 'Registrar concretagem da laje', 'Enviar fotos do dia'] },
  comercio: { quem: 'Entregador', lugar: 'Rota Asa Norte', tarefas: ['Entregar pedido 2318', 'Entregar pedido 2321', 'Retirar uma devolução'] },
  campo: { quem: 'Técnico', lugar: 'Rota do dia', tarefas: ['OS 1042, instalação', 'OS 1043, manutenção preventiva', 'OS 1044, visita técnica'] },
  escritorio: { quem: 'Equipe externa', lugar: 'Agenda do dia', tarefas: ['Coletar documentos no cliente', 'Protocolar na prefeitura', 'Reunião com cliente novo'] },
  industria: { quem: 'Motorista', lugar: 'Expedição', tarefas: ['Carga 118 para Taguatinga', 'Carga 119 para o Gama', 'Coleta de matéria prima'] },
  outro: { quem: 'Equipe externa', lugar: 'Agenda do dia', tarefas: ['Visita ao cliente', 'Serviço agendado', 'Retorno de garantia'] }
};
export const TEAM_PEOPLE = ['Carlos', 'Ana', 'Rafael'];
