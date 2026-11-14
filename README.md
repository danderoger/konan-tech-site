# Konan Tech: site institucional (versão 3.0)

Site de uma página da Konan Tech, empresa brasileira de soluções digitais, desenvolvimento de sistemas, inteligência artificial, dashboards, sites e automação de processos.

Esta é a **versão 3.0**, na branch `v3`. A versão de produção (www.konantech.com.br) só muda com autorização do Dande.

## A ideia: a inteligência ganha forma

Uma única "matéria inteligente" atravessa a página: dezenas de milhares de partículas iluminadas como pérolas (luz, brilho e profundidade de campo) que assumem a forma de cada serviço. Os títulos fazem o mesmo: cada palavra nasce estreita e fina e se expande até o desenho final, usando os eixos de largura e peso da fonte Archivo. O fundo é gelo tecnológico com luz volumétrica sutil; o laboratório de IA e o final são cenas escuras.

| Capítulo | O que acontece |
| --- | --- |
| Abertura | Cinco cenas (dados soltos, rede neural 3D, circuito, interface, logomarca). Título fixo, serviços e botões na primeira tela. Pausar, escolher a cena e rever. Mouse: passar empurra, clicar e segurar atrai, soltar reorganiza |
| Soluções | Cinco frentes. Passar o mouse (ou rolar no celular) muda a forma das partículas para a do serviço |
| Projetos (3º capítulo) | Lista com prévia grande. Cada projeto abre em tela cheia com rolagem própria: problema, solução, funcionalidades, estágio e como pedir algo parecido. Link direto: `#projeto-obra-em-dia`, `#projeto-montacerto`, `#projeto-ultra-obra`, `#projeto-via-opus`, `#projeto-caca-ruidos` |
| Laboratório de IA (escuro) | Três documentos fictícios. Scanner, caixas de leitura, cada dado voa até o seu campo, campos editáveis e conferência por regras (mude o total e veja o alerta), envio para aprovação |
| Simulador de automação | Quatro ramos. As etapas manuais voam até o fluxo automático, um pedido percorre o fluxo e o registro mostra cada passo |
| Universo dos sistemas | Seção presa à rolagem: as peças soltas se juntam num painel que funciona (filtros, alertas, relatório) e as partículas cercam o painel |
| Antes e depois | A linha arrastável divide a página e as partículas ao mesmo tempo |
| Como trabalhamos | Quatro etapas, depoimento do fundador e números |
| Diagnóstico | Três perguntas montam a sugestão e a mensagem do WhatsApp |
| Final (escuro) | Os dados do site saem das interfaces, viram partículas, aceleram e formam a logomarca prata e azul; a animação desacelera e a mensagem aparece, com botões para rever e para conversar |

## Como abrir

**Para ver no computador:** gere o arquivo único (abaixo) e dê duplo clique em `konan-tech-3.0.html`.

**Para desenvolver:** o site usa módulos JavaScript, então precisa de um servidor local. Na pasta do projeto:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Na Cloudflare Pages funciona sem configuração (sem comando de build, pasta raiz).

Endereços de teste: `?tier=0`, `?tier=1` ou `?tier=2` forçam o nível do efeito 3D; `?hq` trava o nível completo; `?fast` acelera as transições em computadores lentos.

## Arquivo único

```
npm install --no-save esbuild
ESBUILD_BIN=./node_modules/.bin/esbuild node scripts/build-offline.mjs konan-tech-3.0.html
```

Gera um arquivo só (scripts, estilos, fonte e imagens dentro dele) que abre com duplo clique, sem servidor. O navegador bloqueia scripts do tipo module e a leitura da logo quando a página abre direto do arquivo; o arquivo único resolve as duas coisas.

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Todo o conteúdo fixo (para o Google ler), textos dos projetos e a ordem dos capítulos |
| `css/main.css` | Todos os estilos. Cores e medidas nas variáveis do `:root` |
| `js/content.js` | Dados das demonstrações: cenas da abertura, documentos do laboratório, ramos do simulador, série do painel, respostas do diagnóstico, WhatsApp |
| `js/app.js` | Capítulos, ambiente claro e escuro, abertura, interações com o mouse, carregamento sob demanda |
| `js/kinetic.js` | Títulos que ganham forma |
| `js/perf.js` | Escolhe o nível do efeito 3D conforme o aparelho |
| `js/stage.js` | Palco 3D: partículas iluminadas, profundidade de campo, morfose em curva, atração, rolagem, comparador |
| `js/shapes.js` | As formas das partículas (cada uma é uma função) |
| `js/demos/` | Uma experiência por arquivo: `cases.js`, `ai.js`, `auto.js`, `universe.js`, `compare.js`, `lab.js`, `finale.js` |
| `js/vendor/` | Three.js (só o necessário) e Lenis. Gerado por `scripts/build-vendor.sh` |
| `assets/konan-logo-dark.png` | Logomarca para fundo branco (cores da oficial ajustadas, desenho igual) |
| `assets/konan-logo.png` | Logomarca oficial: rodapé escuro, final sem 3D e molde das partículas |
| `assets/projetos/` | Capturas reais do site da Via Opus |
| `assets/hero-poster.webp` | Imagem de reserva para aparelhos sem WebGL e enquanto o 3D carrega |

## Onde mexer

- **Textos das seções e dos projetos**: `index.html` (cada projeto tem a maquete em `<template class="pj-vis">` e o texto em `.pj-more`).
- **Estágio de um projeto**: o selo `.stg` e `data-step` (0 planejamento, 1 desenvolvimento, 2 testes, 3 implantação, 4 em uso) no `<li class="pj">`.
- **WhatsApp**: `WA_NUMBER` em `js/content.js` e os links `wa.me` no `index.html`. Cada botão pode ter `data-msg` com a frase do contexto.
- **Cenas da abertura**: `HERO_SCENES` em `js/content.js`.
- **Forma, posição e opacidade das partículas em cada capítulo**: `CH` em `js/app.js` (`d` é computador, `m` é celular).
- **Quantidade de partículas por nível**: `TIERS` em `js/perf.js`.

## Regras do projeto (valem para qualquer pessoa ou IA que editar)

1. Não redesenhar a logomarca. No fundo branco usar `konan-logo-dark.png`; no escuro, a oficial.
2. Não inventar clientes, depoimentos, números, funcionalidades ou resultados. Tudo o que é demonstração está marcado como fictício, simulação ou ilustração.
3. Respeitar o estágio real de cada projeto: Obra em Dia (em implantação), MontaCerto (em operação diária), Ultra Obra (em testes), Via Opus e Caça Ruídos (entregues).
4. Nada de hífens ou travessões nos textos visíveis do site.
5. WhatsApp sempre fácil: topo, menu, abertura, cada demonstração, projetos, diagnóstico, final e botão flutuante.
6. Respeitar movimento reduzido e manter o site leve no celular.
7. Não publicar em produção sem autorização do Dande.

## A confirmar antes de publicar

- Números do MontaCerto (mais de 200 atendimentos por dia, 30 montadores) e "5 projetos".
- "Base em Brasília, DF".
- Uso das capturas do site da Via Opus e, se autorizado, link para o site publicado.
- Descrições e estágios de cada projeto (em especial o Obra em Dia).
- Endereço sem www (`konantech.com.br`), que ainda precisa de redirecionamento.

## Observações técnicas

- O conteúdo aparece primeiro; o 3D (Three.js) carrega no primeiro momento livre do navegador e cada demonstração carrega só quando a seção se aproxima.
- Nível do efeito: completo (42 mil partículas) em computadores, médio (20 mil) em celulares, leve (9 mil, sem profundidade de campo e sem desfoque de vidro) em aparelhos modestos ou sem aceleração de vídeo. Se ficar lento, o site reduz a resolução e depois a quantidade de partículas.
- As formas são preparadas nos momentos ociosos, para a troca de capítulo não travar. O 3D para quando a aba fica oculta e quando um projeto está aberto em tela cheia.
- No fundo claro os pontos são tinta (pérolas iluminadas); no escuro somam luz. No final, a soma de luz é reduzida quando a logo se forma, para ela ficar nítida.
- Com movimento reduzido: sem rolagem suave, abertura direto na logomarca, painel já montado, final direto na marca, títulos sem animação. Tudo continua funcionando pelos botões.
- Sem WebGL: imagem de reserva no topo, painel montado pela rolagem, logo oficial no final.
- Acessibilidade verificada com axe-core sem violações; navegação por teclado em todos os controles; janela de projeto com foco preso e Esc para fechar.
