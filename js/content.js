/* Konan Tech 3.0: textos e dados das demonstrações.
   Os textos fixos das seções ficam no index.html (para o Google ler).
   Tudo o que aparece nas demonstrações é fictício e está identificado assim na página. */

export const WA_NUMBER = '5561982270780';
export const WA_DEFAULT = 'Olá, vim pelo site da Konan Tech e quero conversar sobre uma solução para a minha empresa.';
export const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg || WA_DEFAULT)}`;
export const waContext = (frase) => `Olá, vim pelo site da Konan Tech: ${frase}`;

/* Abertura: cinco cenas. A última forma a marca e fica.
   dur = segundos até a próxima cena; k = ajuste de escala; dy = ajuste vertical (no computador). */
export const HERO_SCENES = [
  { shape: 'dust', cap: 'Pedidos, notas, planilhas e mensagens espalhados.', dur: 3.4, k: 0.82 },
  { shape: 'neural', cap: 'A informação começa a se conectar.', dur: 3.8, k: 1.22 },
  { shape: 'circuit', cap: 'Fluxos e processos que correm sozinhos.', dur: 3.6, k: 0.76, dy: 0.3 },
  { shape: 'iface', cap: 'Painéis e indicadores para decidir.', dur: 3.6, k: 0.72, dy: 0.25 },
  { shape: 'logo', cap: 'Tudo isso ganha forma.', dur: 0 }
];

/* Projetos: forma das partículas quando cada projeto está em destaque */
export const STAGE_STEPS = ['Planejamento', 'Desenvolvimento', 'Testes', 'Implantação', 'Em uso'];

/* Laboratório de IA: três documentos fictícios */
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

/* Simulador de automação: quatro ramos, cada um com o processo manual e o fluxo automático */
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

/* Universo dos sistemas: série fictícia de faturamento */
export const DASH = {
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  units: { all: 1, a: 0.58, b: 0.42 },
  cats: ['Produtos', 'Serviços', 'Contratos', 'Outros']
};

/* Diagnóstico: o que mostramos para cada resposta */
export const LAB = {
  dores: [
    {
      frase: 'tudo vive em planilhas',
      blocos: [['Hoje', 'Planilhas soltas e controles paralelos'], ['Base única', 'Cadastros e controles em um sistema web, aproveitando os dados que você já tem'], ['Painel', 'Indicadores atualizados sem montar relatório à mão']],
      passo: 'Começaríamos mapeando as planilhas de hoje e quem usa cada uma.'
    },
    {
      frase: 'a equipe perde tempo com tarefas repetidas',
      blocos: [['Gatilho', 'Um pedido, um formulário ou uma mensagem chega'], ['Automação', 'Registros, avisos e tarefas acontecem sozinhos'], ['Resultado', 'A equipe só confere e decide']],
      passo: 'Começaríamos listando as tarefas que mais tomam tempo da equipe.'
    },
    {
      frase: 'digitamos notas e documentos à mão',
      blocos: [['Entrada', 'Foto, PDF ou XML enviados pelo WhatsApp ou email'], ['Inteligência artificial', 'Leitura dos campos com conferência por regras'], ['Planilha ou sistema', 'Lançamento pronto para aprovação']],
      passo: 'Começaríamos com uma amostra dos seus documentos para testar a leitura.'
    },
    {
      frase: 'não sei o que a equipe em campo está fazendo',
      blocos: [['Aplicativo', 'A equipe atualiza cada ordem pelo celular, até sem internet'], ['Painel do gestor', 'Status, rota e atrasos em tempo real'], ['Avisos', 'O cliente e o gestor são avisados sem ligação']],
      passo: 'Começaríamos acompanhando um dia da operação para desenhar o aplicativo.'
    },
    {
      frase: 'não tenho indicadores confiáveis',
      blocos: [['Dados', 'Junção das fontes que já existem, sem duplicidade'], ['Dashboard', 'Indicadores, comparativos e alertas em um só lugar'], ['Rotina', 'Relatório pronto para a reunião da semana']],
      passo: 'Começaríamos definindo os cinco números que mais importam para você.'
    },
    {
      frase: 'preciso de um site que traga clientes',
      blocos: [['Conteúdo', 'Texto escrito para o seu cliente entender o que você faz'], ['Site', 'Rápido, claro e completo no celular'], ['Contato', 'WhatsApp a um toque de qualquer página']],
      passo: 'Começaríamos conversando sobre o seu público e os seus serviços.'
    }
  ],
  areas: ['obras e construção', 'serviços em campo', 'comércio e vendas', 'administrativo e financeiro', 'outra área'],
  times: ['até 5 pessoas', '6 a 20 pessoas', '21 a 50 pessoas', 'mais de 50 pessoas']
};
