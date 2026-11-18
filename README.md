# Konan Tech: site institucional (versão 5.0, "Planta viva")

Site de uma página da Konan Tech, empresa brasileira de soluções digitais, desenvolvimento de sistemas, inteligência artificial, dashboards, sites e automação de processos.

Esta é a **versão 5.0**, na branch `v5` (local). A 3.0 continua na branch `v3`. A versão de produção (www.konantech.com.br) só muda com autorização do Dande.

## A ideia: a planta viva

O site deixa de mostrar o que a Konan sabe fazer e passa a fazer o que a Konan faz: entender a operação e desenhar a solução.

Logo na primeira tela, o visitante conta como a empresa funciona: falando (como um áudio de WhatsApp), escrevendo ou tocando em opções. Enquanto ele conta, a planta do sistema é desenhada na hora, no estilo de uma planta de arquitetura:

- cada área da empresa vira um cômodo, com paredes, portas e janelas;
- o que trava hoje ganha nuvem de revisão em vermelho, e cada nota leva o triângulo com o número da revisão em que foi marcada;
- a proposta entra em azul (módulos com hachura) e os dados correm pelos fluxos, passando pelas portas;
- o carimbo técnico registra empresa, ramo, equipe, atritos, proposta, data e revisão;
- se o visitante descreve a obra ("obra de 3 quartos, dois banheiros, sala, cozinha, 120 m²"), a casa é desenhada dentro do canteiro de obras, com um resumo embaixo do nome. Entendidos: quartos, suítes, banheiros, lavabo, sala, cozinha, garagem, varanda, área de serviço e metros quadrados. Embaixo da caixa de texto, a linha "Entendi: ..." mostra o que a planta aproveitou.

Com um toque, as paredes sobem em 3D (maquete de papel) e dá para girar arrastando. A planta vai embora com o visitante: resumo no WhatsApp, PDF em A4 com carimbo, ou link (`#planta=...`) para mostrar ao sócio.

Uma família de letras só (Archivo variável): expandida nos títulos, normal no texto, condensada na planta. Três tintas contam a história: grafite (o que existe), vermelho (o que trava) e azul (a proposta).

| Seção | O que acontece |
| --- | --- |
| Planta (topo) | Exemplo fictício que se desenha sozinho ao abrir. Voz, texto ou três perguntas (ramo, o que trava, equipe). A planta, o carimbo, o WhatsApp e o resto da página se ajustam na hora |
| Detalhes | Cada número azul da planta leva a um detalhe funcionando: leitura de notas com IA, automações, painel de indicadores, aplicativo da equipe com painel do gestor, site e WhatsApp. Os que estão na planta do visitante ganham a etiqueta "Na sua planta" |
| Projetos | Os cinco projetos reais como pranchas. Os mais parecidos com a planta do visitante sobem para o começo. Cada um abre em tela cheia. Link direto: `#projeto-obra-em-dia`, `#projeto-montacerto`, `#projeto-ultra-obra`, `#projeto-via-opus`, `#projeto-caca-ruidos` |
| Como trabalhamos | Quatro etapas numa linha de cota, depoimento do fundador e números |
| Dúvidas | Nove perguntas, incluindo privacidade da voz e "a planta é orçamento?" |
| Final | "Vamos tirar a sua planta do papel?": os traços da planta viram partículas, saem do papel e formam a logomarca |

## Como abrir

**Para ver no computador:** gere o arquivo único (abaixo) e dê duplo clique em `konan-tech-5.0.html`.

**Para desenvolver:** o site usa módulos JavaScript, então precisa de um servidor local. Na pasta do projeto:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Na Cloudflare Pages funciona sem configuração (sem comando de build, pasta raiz).

Endereços de teste: `#planta=obras.planilhas-documentos-equipe.1.Minha%20Empresa` abre uma planta pronta; `?tier=0`, `?tier=1` ou `?tier=2` forçam o nível das partículas do final.

## Arquivo único

```
npm install --no-save esbuild
ESBUILD_BIN=./node_modules/.bin/esbuild node scripts/build-offline.mjs konan-tech-5.0.html
```

Gera um arquivo só (scripts, estilos, fonte e imagens dentro dele) que abre com duplo clique, sem servidor e sem nenhuma requisição externa. Pelo arquivo, o botão "Copiar link" fica escondido (um link para um arquivo local não serve para ninguém).

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Todo o conteúdo fixo (para o Google ler), perguntas, detalhes, textos dos projetos |
| `css/main.css` | Todos os estilos, inclusive a planta, a maquete 3D e a impressão em PDF. Cores e medidas nas variáveis do `:root` |
| `js/content.js` | Ramos e cômodos, o que trava, módulos da proposta, exemplo, dados das demonstrações, WhatsApp |
| `js/plan.js` | Motor da planta: duas folhas (deitada no computador, em pé no celular), paredes, portas, janelas, nuvens, módulos, fluxos, carimbo e maquete 3D em CSS |
| `js/listen.js` | Conversa: reconhecimento de voz do navegador em português, leitura do texto (ramo, o que trava, tamanho da equipe, obra descrita) e destaques da legenda |
| `js/app.js` | Liga tudo: perguntas, exemplo, barra (3D, WhatsApp, PDF, link), detalhes, projetos, carregamento sob demanda |
| `js/perf.js`, `js/stage.js`, `js/shapes.js` | Partículas do final (Three.js), carregadas só quando o final se aproxima |
| `js/demos/` | `ai.js` (notas com IA), `auto.js` (automações), `dash.js` (painel), `team.js` (aplicativo da equipe), `boards.js` (projetos), `liftoff.js` (final) |
| `js/vendor/` | Three.js (só o necessário) e Lenis. Gerado por `scripts/build-vendor.sh` |
| `assets/konan-logo-dark.png` | Logomarca para fundo branco (cores da oficial ajustadas, desenho igual) |
| `assets/konan-logo.png` | Logomarca oficial, usada como molde das partículas |
| `assets/planta-exemplo.webp` | Planta de exemplo para quem abre sem JavaScript |
| `assets/projetos/` | Capturas reais do site da Via Opus |

## Onde mexer

- **Cômodos de cada ramo**: `RAMOS` em `js/content.js`.
- **O que trava, nota vermelha e módulos propostos**: `DORES` em `js/content.js`.
- **Nome dos módulos e qual detalhe cada um abre**: `MODULOS` e `DETALHES` em `js/content.js`.
- **Palavras que a conversa reconhece**: `RAMO_RX`, `DOR_RX`, `OBRA_RX` (cômodos da casa) e os números por extenso em `js/listen.js`. Limites e frases da obra: `obraClean` e `obraFrase` em `js/content.js`.
- **Casa da obra**: `planHouse` e `_house` em `js/plan.js`. Só aparece no ramo de obras, no espaço que sobra no canteiro (no celular, só quando não há nota nem módulo ocupando o canteiro; o resumo aparece sempre).
- **Geometria da planta**: `GEO` em `js/plan.js` (`land` é a folha deitada, `port` a folha em pé).
- **Textos das seções e dos projetos**: `index.html`. Estágio de um projeto: selo `.stg` e `data-step` (0 planejamento a 4 em uso).
- **WhatsApp**: `WA_NUMBER` em `js/content.js`. Cada botão pode ter `data-msg` com a frase do contexto; a barra e o final mandam o resumo da planta.

## Regras do projeto (valem para qualquer pessoa ou IA que editar)

1. Não redesenhar a logomarca. No fundo branco usar `konan-logo-dark.png`.
2. Não inventar clientes, depoimentos, números, funcionalidades ou resultados. Tudo o que é demonstração está marcado como fictício, simulação ou ilustração; o exemplo da planta tem o carimbo "Exemplo fictício".
3. Respeitar o estágio real de cada projeto: Obra em Dia (em implantação), MontaCerto (em operação diária), Ultra Obra (em testes), Via Opus e Caça Ruídos (entregues).
4. Nada de hífens ou travessões nos textos visíveis do site.
5. WhatsApp sempre fácil: topo, barra da planta, cada detalhe, projetos, final e botão flutuante.
6. Respeitar movimento reduzido e manter o site leve no celular.
7. Não publicar em produção sem autorização do Dande.

## Privacidade da voz

O botão Falar usa o reconhecimento de voz do próprio navegador (no Chrome, o áudio é processado pelo serviço do Google). A página só usa o texto para desenhar a planta, não guarda nada e não envia nada para a Konan Tech. A mensagem só chega se o visitante escolher enviar pelo WhatsApp. Navegadores sem reconhecimento de voz (Firefox, por exemplo) escondem o botão e oferecem Escrever.

## A confirmar antes de publicar

- Números do MontaCerto (mais de 200 atendimentos por dia, 30 montadores) e "5 projetos".
- "Base em Brasília, DF".
- Uso das capturas do site da Via Opus.
- Descrições e estágios de cada projeto (em especial o Obra em Dia).
- Endereço sem www (`konantech.com.br`), que ainda precisa de redirecionamento.

## Observações técnicas

- Sem WebGL no topo: a planta e a maquete 3D são SVG e CSS, leves até em celular simples. O Three.js só carrega perto do final.
- A quebra de linha dos textos da planta é medida com a fonte real, então os nomes cabem nos cômodos em qualquer tela. Nas salas de baixo, o nome termina antes da porta (nome comprido quebra em duas linhas no celular).
- Nomes e notas têm um contorno da cor do papel, como no desenho técnico: porta, fluxo ou grade que passe atrás some em volta das letras.
- `scripts/auditar-planta.cjs` desenha todas as combinações (6 ramos, 256 combinações de atritos, folha deitada e em pé: 3.072 plantas, mais 3 casas descritas no ramo de obras: 4.608 no total) e procura texto cruzado por porta, fluxo ou triângulo, texto em cima de módulo e texto saindo da sala. Na entrega: nenhum. Rode de novo sempre que mudar nomes de salas, notas ou a geometria:

```
npm install --no-save playwright && npx playwright install chromium
python3 -m http.server 8000   (em outro terminal)
node scripts/auditar-planta.cjs http://localhost:8000
```
- `_headers` libera o microfone só para a própria página (`microphone=(self)`). Com `microphone=()` o botão Falar não funciona.
- Com movimento reduzido: exemplo já desenhado (sem digitação), 3D sem animação, final direto na marca.
- Sem WebGL: o final mostra a folha e a marca aparece sem partículas.
- PDF: a impressão mostra só a folha da planta, deitada, em A4, com o nome da empresa no título do arquivo.
- Acessibilidade verificada com axe-core sem violações (computador, celular e visualizador de projeto); a planta é um grupo com título e descrição atualizados, e uma região viva anuncia o que foi marcado.
