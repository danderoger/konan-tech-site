# Konan Tech: site institucional (versão 2.0 clara)

Site de uma página da Konan Tech, empresa brasileira de soluções digitais, desenvolvimento de sistemas, inteligência artificial e automação de processos.

Esta é a **versão 2.0 clara**, em teste na branch `v2-claro`. A versão de produção (www.konantech.com.br) só muda com autorização do Dande.

## A ideia: inteligência em movimento

O site é claro (branco, névoa azul e azul elétrico) e um único mundo de partículas em 3D atravessa a página inteira. Ele muda de forma a cada capítulo e escurece nas duas seções noturnas (laboratório de IA e encerramento), onde os pontos passam a brilhar.

| Capítulo | O que acontece |
| --- | --- |
| Abertura | Linha do tempo clicável: dados soltos, conexões, inteligência, automação, sistema, experiência e a logomarca. O fim do título muda junto |
| Soluções | Cinco frentes, cada uma levando à sua demonstração |
| Inteligência artificial (escura) | Nota fiscal fictícia lida em seis etapas, com pausar, reiniciar e explorar etapa por etapa |
| Automação | O visitante liga e desliga etapas e simula um pedido percorrendo o fluxo |
| Sistemas | Notebook e celular em 3D com telas navegáveis e movimento de câmera |
| Dashboards | Tabela bruta vira indicadores, gráficos, alertas, projeção e relatório. Filtros recalculam tudo |
| Antes e depois | A linha arrastável divide a página e o mundo de partículas ao mesmo tempo: caos à esquerda, painel à direita |
| Projetos | Cartões com profundidade e apresentação completa de cada projeto (capturas reais da Via Opus) |
| Quem somos, processo, diagnóstico e dúvidas | Diagnóstico em três perguntas que monta a mensagem do WhatsApp |
| Encerramento (escuro) | A logomarca se forma em luz acima do convite final |

## Como abrir

Precisa de um servidor local, porque o site usa módulos JavaScript. Na pasta do projeto:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Na Cloudflare Pages funciona sem configuração (sem comando de build, pasta raiz). Endereços de teste: `?hq` trava a qualidade máxima e `?fast` acelera as transições em computadores lentos.

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Todo o conteúdo fixo (para o Google ler) e a ordem dos capítulos |
| `css/main.css` | Todos os estilos. Cores e medidas nas variáveis do `:root` |
| `js/content.js` | Dados das demonstrações: cenas da abertura, etapas da automação, números fictícios do dashboard, respostas do diagnóstico, WhatsApp |
| `js/app.js` | Comportamento da página: capítulos, ambiente claro e escuro, abertura, rolagem, revelações |
| `js/demos/` | Uma demonstração por arquivo: `ai.js`, `flow.js`, `devices.js`, `dash.js`, `compare.js`, `projects.js`, `lab.js` |
| `js/stage.js` | Palco 3D: partículas, morfose, ambiente claro e escuro, comparador que divide o mundo |
| `js/shapes.js` | As formas das partículas (cada uma é uma função) |
| `js/vendor/` | Three.js (só o necessário) e Lenis. Gerado por `scripts/build-vendor.sh` |
| `assets/konan-logo-dark.png` | Logomarca para fundo branco (cores da oficial ajustadas, desenho igual) |
| `assets/konan-logo.png` | Logomarca oficial: usada no rodapé escuro e como molde das partículas |
| `assets/projetos/` | Capturas reais do site da Via Opus |
| `assets/hero-poster.jpg` | Imagem de reserva para aparelhos sem WebGL |

## Onde mexer

- **Textos das seções e dos projetos**: `index.html`.
- **WhatsApp**: `WA_NUMBER` em `js/content.js` e os links `wa.me` no `index.html`. Cada botão pode ter `data-msg` com a frase do contexto.
- **Cenas da abertura e fim do título**: `HERO_SCENES` em `js/content.js`.
- **Forma, posição e opacidade das partículas em cada capítulo**: `CH` em `js/app.js` (`d` é computador, `m` é celular).
- **Cor de destaque**: `--ion` no `css/main.css` e `PAL.ion` em `js/shapes.js`.

## Regras do projeto (valem para qualquer pessoa ou IA que editar)

1. Não redesenhar a logomarca. No fundo branco usar `konan-logo-dark.png`; no escuro, a oficial.
2. Não inventar clientes, depoimentos, números, funcionalidades ou resultados. Tudo o que é demonstração está marcado como fictício ou ilustrativo.
3. Respeitar o estágio real de cada projeto: Obra em Dia (em implantação), MontaCerto (em operação diária), Ultra Obra (em testes), Via Opus e Caça Ruídos (entregues).
4. Nada de hífens ou travessões nos textos visíveis do site.
5. WhatsApp sempre fácil: topo, menu, cada demonstração, diagnóstico, encerramento e botão flutuante.
6. Respeitar movimento reduzido e manter o site leve no celular.
7. Não publicar em produção sem autorização do Dande.

## A confirmar antes de publicar

- Números do MontaCerto (mais de 200 atendimentos por dia, 30 montadores) e "5 projetos".
- "Base em Brasília, DF".
- Uso das capturas do site da Via Opus e, se autorizado, link para o site publicado.
- Descrições e estágios de cada projeto.
- Endereço sem www (`konantech.com.br`), que ainda precisa de redirecionamento.

## Observações técnicas

- O palco 3D carrega depois do conteúdo (o título aparece primeiro). Sem WebGL, o topo mostra a imagem de reserva e o comparador usa um fundo simples.
- No fundo claro os pontos são tinta (mistura normal); no escuro somam luz (mistura aditiva). A transição é contínua, controlada pela rolagem.
- Se o aparelho ficar lento, o site reduz a resolução e depois a quantidade de partículas.
- Com movimento reduzido: sem rolagem suave, sem animação automática da abertura e formas sem transição. As demonstrações continuam funcionando pelos botões.
- Acessibilidade verificada com axe-core sem violações; navegação por teclado em todos os controles.

## Arquivo único para abrir no computador

`scripts/build-offline.mjs` gera `konan-tech-2.0.html`, um arquivo só (scripts, estilos, fonte e imagens dentro dele) que abre com duplo clique, sem servidor. O navegador bloqueia scripts do tipo module e a leitura da logo quando a página abre direto do arquivo, por isso o site normal precisa de um servidor (ou de publicação).
