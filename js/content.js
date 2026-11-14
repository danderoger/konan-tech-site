/* Konan Tech v2: textos que mudam com frequência.
   Edite aqui sem medo: o resto do site lê estas listas.
   Regra do projeto: nada de hífens ou travessões nos textos visíveis, e nenhum número inventado. */

export const WA_NUMBER = '5561982270780';
export const WA_DEFAULT = 'Olá, vim pelo site da Konan Tech e quero falar com um especialista.';
export const waLink = (msg) => 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg || WA_DEFAULT);

/* Cenas da primeira tela: forma das partículas, legenda e duração em segundos */
export const HERO_SCENES = [
  { shape: 'logo', cap: 'Konan Tech', hold: 6.5 },
  { shape: 'network', cap: 'Conectando dados', hold: 6 },
  { shape: 'brain', cap: 'Aprendendo padrões', hold: 6 },
  { shape: 'streams', cap: 'Organizando informações', hold: 6 },
  { shape: 'dashboard', cap: 'Gerando indicadores', hold: 6 },
  { shape: 'city', cap: 'Construindo estruturas', hold: 6 }
];

/* Soluções: cada uma muda a forma das partículas e mostra uma demonstração */
export const SOLUTIONS = [
  {
    id: 'ia', shape: 'network', t: 'Inteligência artificial',
    d: 'Lê documentos, extrai dados de notas fiscais, classifica lançamentos e responde perguntas sobre as informações da empresa.',
    ben: 'Menos digitação manual e menos erro nos lançamentos.',
    tags: ['Leitura de documentos', 'Classificação automática', 'Assistentes inteligentes'],
    demo: { title: 'Nota fiscal recebida', kind: 'rows', rows: [['Fornecedor', 'Identificado'], ['Valor', 'R$ 1.284,90'], ['Categoria', 'Material elétrico'], ['Centro de custo', 'Obra 02']], end: 'Lançamento pronto para aprovação' }
  },
  {
    id: 'automacao', shape: 'streams', t: 'Automação de processos',
    d: 'Conecta as ferramentas que a empresa já usa e executa sozinha as tarefas repetidas: avisos, atualizações, relatórios e cobranças.',
    ben: 'A equipe para de copiar e colar e cuida do que importa.',
    tags: ['Integrações', 'Rotinas automáticas', 'Mensagens automáticas'],
    demo: { title: 'Nova ordem de serviço', kind: 'steps', rows: ['Ordem recebida pelo sistema', 'Responsável definido pela rota', 'Cliente avisado no WhatsApp', 'Planilha e painel atualizados'], end: 'Fluxo concluído sem ninguém digitar nada' }
  },
  {
    id: 'sistemas', shape: 'blocks', t: 'Sistemas personalizados',
    d: 'Plataformas web e aplicativos feitos sob medida para o jeito que a sua empresa trabalha, no escritório ou no campo.',
    ben: 'A operação inteira em um só lugar, no computador ou no celular.',
    tags: ['Gestão operacional', 'Controle financeiro', 'Aplicativos de campo'],
    demo: { title: 'Montando o sistema', kind: 'steps', rows: ['Cadastros de clientes e equipes', 'Ordens de serviço e agenda', 'Financeiro e centros de custo', 'Aplicativo para o campo'], end: 'Módulos escolhidos a partir do seu processo' }
  },
  {
    id: 'dashboards', shape: 'dashboard', t: 'Dashboards e gestão',
    d: 'Painéis de indicadores atualizados automaticamente a partir dos dados que a empresa já gera.',
    ben: 'Decisões tomadas com números, não com achismo.',
    tags: ['Indicadores', 'Relatórios', 'Acompanhamento em tempo real'],
    demo: { title: 'Painel da operação', kind: 'kpis', rows: [['Ordens concluídas', 94, '%'], ['Serviços hoje', 47, ''], ['Em rota agora', 6, '']], end: 'Atualizado automaticamente' }
  },
  {
    id: 'sites', shape: 'screens', t: 'Sites e experiências digitais',
    d: 'Sites institucionais e comerciais que apresentam a empresa com clareza e levam o visitante até a conversa.',
    ben: 'Mais credibilidade e mais pedidos de orçamento.',
    tags: ['Sites institucionais', 'Páginas comerciais', 'Identidade digital'],
    demo: { title: 'Publicando o site', kind: 'steps', rows: ['Pronto para celular, tablet e computador', 'Carregamento rápido', 'Contato pelo WhatsApp em um toque', 'Estrutura preparada para o Google'], end: 'Visitante entende e chama' }
  }
];

/* Perguntas frequentes */
export const FAQ = [
  ['Preciso saber exatamente o que quero antes de chamar?', 'Não. Basta contar como funciona hoje e o que incomoda. Transformar o problema em solução é o nosso trabalho.'],
  ['A Konan Tech atende empresas pequenas?', 'Sim. Atendemos principalmente pequenas e médias empresas, com soluções do tamanho da necessidade e sem funcionalidades que ninguém vai usar.'],
  ['Quanto custa um sistema personalizado?', 'Depende do escopo. Depois da conversa inicial você recebe uma proposta com valor e etapas definidos antes de qualquer desenvolvimento começar.'],
  ['Posso continuar usando minhas planilhas?', 'Pode. Vários dos nossos sistemas usam o Google Sheets como base, então a equipe continua vendo e conferindo os dados onde já está acostumada.'],
  ['Como a inteligência artificial entra nos projetos?', 'Quando faz sentido para a operação: leitura automática de notas fiscais, organização de documentos, resumos e assistentes que respondem dúvidas sobre os dados da empresa.'],
  ['O que acontece depois que o sistema fica pronto?', 'Oferecemos acompanhamento mensal com suporte, ajustes e melhorias contínuas. O sistema evolui junto com a empresa.'],
  ['Vocês atendem fora de Brasília?', 'Sim. O trabalho é feito online, com reuniões por vídeo, para empresas de todo o Brasil.']
];

/* Desafios do contato: texto do botão, frase da mensagem e o raciocínio mostrado no console */
export const CHALLENGES = [
  {
    label: 'Minha operação vive em planilhas',
    msg: 'minha operação vive em planilhas e eu quero organizar tudo em um sistema.',
    lines: ['Cenário: a operação depende de várias planilhas soltas.', 'Caminho provável: um sistema web com cadastros, controle e painel, a partir dos dados que você já tem.', 'As planilhas podem continuar como base enquanto a equipe se adapta.', 'Próximo passo: uma conversa para mapear o processo de hoje.']
  },
  {
    label: 'Perco tempo com tarefas repetidas',
    msg: 'minha equipe perde tempo com tarefas repetidas que poderiam ser automáticas.',
    lines: ['Cenário: tarefas manuais que se repetem todos os dias.', 'Caminho provável: automações que conectam as ferramentas que você já usa.', 'Exemplos: avisos no WhatsApp, planilhas que se atualizam sozinhas, relatórios prontos.', 'Próximo passo: listar as tarefas que mais tomam tempo da equipe.']
  },
  {
    label: 'Quero usar inteligência artificial',
    msg: 'quero entender como usar inteligência artificial na minha empresa.',
    lines: ['Cenário: interesse em aplicar inteligência artificial na rotina.', 'Onde costuma fazer sentido: leitura de documentos, organização de dados e assistentes internos.', 'A inteligência artificial entra onde gera resultado, não como enfeite.', 'Próximo passo: entender seus documentos e suas rotinas.']
  },
  {
    label: 'Preciso de um site que traga clientes',
    msg: 'preciso de um site profissional que traga novos clientes.',
    lines: ['Cenário: a presença digital não está trazendo clientes.', 'Caminho provável: um site rápido, claro e pensado para gerar contatos.', 'O conteúdo é escrito para o seu cliente entender e chamar.', 'Próximo passo: conversar sobre o seu público e os seus serviços.']
  },
  {
    label: 'Tenho outra ideia',
    msg: 'tenho uma ideia de solução e quero entender como tirar do papel.',
    lines: ['Cenário: uma ideia que precisa sair do papel.', 'Caminho provável: desenhar a primeira versão útil e testar cedo com quem vai usar.', 'Você acompanha cada etapa e decide junto.', 'Próximo passo: contar a ideia em poucas linhas.']
  }
];
