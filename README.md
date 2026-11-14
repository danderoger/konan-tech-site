# Konan Tech: site institucional

Site de uma página da Konan Tech, empresa brasileira de soluções digitais, desenvolvimento de sistemas e automação de processos.
A primeira tela tem milhares de partículas que formam a logomarca oficial e se transformam em rede neural, cérebro digital, fluxos de dados, painéis de indicadores e uma cidade de estruturas, em ciclo contínuo.

Versão atual: **primeira versão para avaliação**. Nada foi publicado em produção.

## Como abrir

Não precisa instalar nada. Abra o arquivo `index.html` no navegador.
Para testar como num servidor, rode `python3 -m http.server 8000` na pasta e abra `http://localhost:8000`.

HTML, CSS e JavaScript puros, sem bibliotecas. As fontes (Geist, Geist Mono e Unbounded) vêm do Google Fonts.

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Todo o conteúdo e a ordem das seções |
| `css/styles.css` | Todos os estilos. As cores ficam nas variáveis do `:root`, no começo do arquivo |
| `js/main.js` | Menu, perguntas frequentes, simulações, comparador antes e depois, partículas WebGL |
| `js/logo-points.js` | Pontos da logomarca usados pelas partículas. Gerado a partir da logo, não editar à mão |
| `assets/konan-logo.png` | Logomarca oficial com fundo transparente |
| `assets/favicon.png`, `assets/og-image.png` | Ícone da aba e imagem de compartilhamento |
| `docs/briefing-konan-tech.md` | Briefing original do projeto, com a direção criativa |

Seções da página, na ordem: topo, frase de visão, sobre, soluções, antes e depois, projetos, como trabalhamos, perguntas frequentes e contato.

## Onde mexer para os ajustes mais comuns

- **Textos das seções**: `index.html`.
- **Soluções (5 itens com simulação), perguntas frequentes e desafios do contato**: listas `SOL`, `FAQ` e `CH` no começo de `js/main.js`.
- **Cor de destaque**: constante `ACCENT` no começo de `js/main.js` e variável `--ac` no `:root` do CSS. As partículas seguem a cor automaticamente.
- **WhatsApp**: número `5561982270780` no começo de `js/main.js` (`WA_BASE`) e nos links do `index.html`.
- **Cenas das partículas do topo**: função `heroDef` em `js/main.js` define a ordem e a duração. Cada forma é montada em `buildScene`.
- **Projetos**: seção `#projetos` do `index.html`. Cada projeto é um bloco `article class="pj"`.

## Regras do projeto (valem para qualquer pessoa ou IA que editar)

1. **Não redesenhar nem descaracterizar a logomarca.** Ela é prata metálica com detalhes em azul tecnológico, sobre fundo preto. Usar sempre `assets/konan-logo.png`.
2. **Não inventar clientes, depoimentos, números, funcionalidades ou resultados.** Todo número e todo estágio de projeto precisa ser real.
3. **Respeitar o estágio real de cada projeto**: Obra em Dia (em implantação), MontaCerto (em operação diária), Ultra Obra (em testes), Via Opus e Caça Ruídos (entregues). Não chamar tudo de "case de sucesso".
4. **Nada de hífens ou travessões nos textos visíveis do site.** Reescrever a frase.
5. **Manter o acesso ao WhatsApp sempre fácil**: botão no topo, na seção de contato e o botão flutuante.
6. **Respeitar movimento reduzido** (`prefers-reduced-motion`) e manter o site leve no celular: o número de partículas já cai em telas pequenas.
7. **Não publicar em produção sem autorização do Dande.**

## O que ainda precisa ser confirmado ou trocado

- **Telas reais dos projetos.** Hoje os notebooks e celulares da seção de projetos são ilustrações, marcadas como "Tela ilustrativa". Trocar por capturas reais do Obra em Dia, MontaCerto e Ultra Obra.
- **Números da seção Sobre**: mais de 200 atendimentos por dia e 30 montadores vêm do MontaCerto. O número 5 projetos é a contagem da lista. Confirmar os três.
- **Localização no rodapé**: está "Base em Brasília, DF". Confirmar.
- **Depoimento do fundador**: texto de apresentação em nome de Dande Roger. Revisar o texto.
- **Perguntas frequentes**: as respostas sobre prazo, valor e atendimento são genéricas. Ajustar ao que a Konan Tech pratica.
- **Domínio e publicação**: definir endereço e hospedagem. Quando houver domínio, trocar `og:image` por endereço completo e adicionar `canonical`.
- **Páginas de privacidade e termos**: ainda não existem.

## Observações técnicas

- Partículas em WebGL puro, com plano B em canvas 2D quando o aparelho não tem WebGL. Na primeira tela são cerca de 5 mil pontos no computador e 2,4 mil no celular. A animação pausa quando sai da tela.
- Com movimento reduzido ativado no aparelho, a primeira tela mostra a logo parada.
- O arquivo `js/main.js` foi testado com um navegador simulado (cliques, menu, perguntas, comparador, desafios), mas o desenho das partículas em WebGL ainda precisa ser conferido em navegadores e celulares reais.
