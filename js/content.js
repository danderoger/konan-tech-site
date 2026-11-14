/* Konan Tech 2.0 (versão clara): textos e dados das demonstrações.
   Os textos fixos das seções ficam no index.html (para o Google ler).
   Tudo o que aparece nas demonstrações é fictício e está marcado assim na página. */

export const WA_NUMBER = '5561982270780';
export const WA_DEFAULT = 'Olá, vim pelo site da Konan Tech e quero falar com um especialista.';
export const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg || WA_DEFAULT)}`;
export const waContext = (frase) => `Olá, vim pelo site da Konan Tech: ${frase}`;

/* Abertura: cada etapa da linha do tempo muda a forma das partículas e o fim do título.
   d (opcional) ajusta a posição no computador: [deslocamento x, y, fator de escala] */
export const HERO_SCENES = [
  { shape: 'dust', word: 'dados organizados.', dur: 4.2 },
  { shape: 'network', word: 'conexões inteligentes.', dur: 4.6 },
  { shape: 'brain', word: 'decisões com IA.', dur: 4.8 },
  { shape: 'flow', word: 'fluxos automáticos.', dur: 4.6 },
  { shape: 'blocks', word: 'sistemas sob medida.', dur: 4.4 },
  { shape: 'screens', word: 'experiências digitais.', dur: 4.4 },
  { shape: 'logo', word: 'soluções inteligentes.', dur: 6.5, d: [-0.1, -0.8, 0.78] }
];

/* Automação: o que cada etapa faz na simulação (dados fictícios) */
export const FLOW_STEPS = [
  { label: 'Pedido do cliente', log: 'Pedido recebido pelo WhatsApp', prev: '<p class="pv-k">WhatsApp da empresa</p><p class="pv-b wa">Oi! Quero 3 cadeiras Lumi para entregar na sexta.</p>' },
  { label: 'Registra o pedido', log: 'Pedido 2318 registrado com os dados do cliente', prev: '<p class="pv-k">Planilha de pedidos</p><p class="pv-b">Pedido 2318, Marina S., 3 cadeiras Lumi, entrega sexta</p>' },
  { label: 'Atualiza o sistema', log: 'Estoque reservado e prazo calculado', prev: '<p class="pv-k">Sistema</p><p class="pv-b">Estoque: 12 para 9 unidades. Entrega confirmada para sexta.</p>' },
  { label: 'Avisa o responsável', log: 'Aviso enviado para a equipe de vendas', prev: '<p class="pv-k">Aviso para Ana, vendas</p><p class="pv-b">Novo pedido 2318 aguardando separação.</p>' },
  { label: 'Cria a tarefa', log: 'Tarefa de separação criada para hoje, 16h', prev: '<p class="pv-k">Tarefas da equipe</p><p class="pv-b">Separar pedido 2318. Responsável: Ana. Prazo: hoje, 16h.</p>' },
  { label: 'Atualiza o dashboard', log: 'Indicadores do dia atualizados', prev: '<p class="pv-k">Dashboard</p><p class="pv-b">Pedidos hoje: 19. Faturamento do dia atualizado.</p>' },
  { label: 'Prepara a resposta', log: 'Resposta pronta para o cliente', prev: '<p class="pv-k">Resposta preparada</p><p class="pv-b me">Olá, Marina! Seu pedido 2318 está confirmado para sexta. Qualquer dúvida, é só chamar.</p>' }
];

/* Dashboards: série fictícia de faturamento, com variação por unidade e período */
export const DASH = {
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  units: { all: 1, a: 0.58, b: 0.42 },
  cats: ['Produtos', 'Serviços', 'Contratos', 'Outros'],
  raw: [
    ['04/11', 'Unidade Norte', 'Pedido 2291', 'Produtos', '1.480,00', 'Pago'],
    ['04/11', 'Unidade Sul', 'Pedido 2292', 'Serviços', '920,00', 'Pendente'],
    ['05/11', 'Unidade Norte', 'Pedido 2293', 'Contratos', '3.200,00', 'Pago'],
    ['05/11', 'Unidade Norte', 'Pedido 2294', 'Produtos', '640,00', 'Pago'],
    ['06/11', 'Unidade Sul', 'Pedido 2295', 'Produtos', '1.120,00', 'Atrasado'],
    ['06/11', 'Unidade Sul', 'Pedido 2296', 'Outros', '310,00', 'Pago'],
    ['07/11', 'Unidade Norte', 'Pedido 2297', 'Serviços', '1.750,00', 'Pago'],
    ['07/11', 'Unidade Norte', 'Pedido 2297', 'Serviços', '1.750,00', 'Duplicado'],
    ['08/11', 'Unidade Sul', 'Pedido 2299', 'Contratos', '2.400,00', 'Pendente'],
    ['08/11', 'Unidade Norte', 'Pedido 2300', 'Produtos', '880,00', 'Pago'],
    ['09/11', 'Unidade Sul', 'Pedido 2301', 'Produtos', '1.360,00', 'Pago'],
    ['10/11', 'Unidade Norte', 'Pedido 2302', 'Outros', '450,00', 'Pago']
  ]
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
