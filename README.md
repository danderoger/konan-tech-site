# Konan Tech: site institucional (versão 2.0)

Site de uma página da Konan Tech, empresa brasileira de soluções digitais, desenvolvimento de sistemas, inteligência artificial e automação de processos.

Versão atual: **2.0, em fase de testes**. A versão de produção (www.konantech.com.br) só muda com autorização do Dande.

## A ideia da versão 2.0

Um único mundo de partículas em 3D fica atrás da página inteira e muda de forma a cada capítulo, contando a história junto com o texto:

| Capítulo | O que as partículas formam |
| --- | --- |
| Início | Ciclo: logomarca, rede neural, cérebro digital, fluxos de dados, painel de indicadores, cidade digital |
| Visão | Campo de estrelas, calmo para a leitura |
| Quem somos | Globo com órbitas, com os números do MontaCerto em volta |
| Soluções | Uma forma por solução: rede neural (IA), fluxos (automação), módulos (sistemas), painel 3D (dashboards), telas (sites) |
| Transformação | A rolagem controla a passagem do caos (papéis e planilhas soltas) para um painel organizado |
| Projetos | Piso de dados ondulando sob a galeria horizontal |
| Processo | Hélice dupla girando |
| Contato | Portal em espiral atrás do console |
| Rodapé | A logomarca se forma de novo |

Outros elementos: abertura com contador, título que muda de largura ao aparecer, rolagem suave, seções que ficam paradas enquanto o conteúdo muda, galeria horizontal de projetos, console que monta a mensagem do WhatsApp, cursor próprio, botões magnéticos, trilho de capítulos e brilho (bloom) nas partículas.

## Como abrir

Precisa de um servidor local, porque o site usa módulos JavaScript. Na pasta do projeto:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Na Cloudflare Pages o site funciona sem nenhuma configuração (sem comando de build, pasta raiz).

Endereços de teste úteis: `?hq` trava a qualidade máxima e `?fast` acelera as transições em computadores muito lentos.

## Estrutura

| Arquivo | O que tem |
| --- | --- |
| `index.html` | Todo o conteúdo e a ordem dos capítulos |
| `css/main.css` | Todos os estilos. Cores e medidas nas variáveis do `:root`, no começo |
| `js/content.js` | **Textos que mudam com frequência**: cenas da primeira tela, demonstrações das soluções, perguntas frequentes, desafios do contato, número do WhatsApp |
| `js/app.js` | Comportamento da página: abertura, rolagem, capítulos, soluções, contato, cursor |
| `js/stage.js` | Palco 3D: partículas, brilho, morfose entre formas, interação com mouse e toque |
| `js/shapes.js` | As formas das partículas (cada uma é uma função) |
| `js/vendor/` | Bibliotecas: Three.js (só o necessário), GSAP com ScrollTrigger e Lenis. Gerado por `scripts/build-vendor.sh` |
| `assets/konan-logo.png` | Logomarca oficial. As partículas da primeira tela são amostradas dela |
| `assets/fonts/` | Fonte Archivo variável, hospedada no próprio site (licença OFL) |
| `assets/hero-poster.jpg` | Imagem de reserva para aparelhos sem WebGL |
| `_headers` | Regras de cache e segurança da Cloudflare Pages |
| `docs/briefing-konan-tech.md` | Briefing original do projeto |

## Onde mexer para os ajustes mais comuns

- **Textos das seções**: `index.html`.
- **Soluções, demonstrações, perguntas e desafios do contato**: `js/content.js`. As soluções aparecem também no `index.html` (para o Google ler); se mudar uma, mude nos dois.
- **WhatsApp**: `WA_NUMBER` em `js/content.js` e os links `wa.me` no `index.html`.
- **Cor de destaque**: `--ion` no `:root` do `css/main.css` e `PAL.ion` em `js/shapes.js`.
- **Ordem e duração das cenas da primeira tela**: `HERO_SCENES` em `js/content.js`.
- **Posição das partículas em cada capítulo**: `LAYOUT` em `js/app.js` (`d` é computador, `m` é celular).
- **Forma de cada capítulo**: `SHAPE_OF` em `js/app.js`.
- **Quantidade de partículas**: função `initStage` em `js/app.js` (34 mil no computador, 14 mil no celular).

## Regras do projeto (valem para qualquer pessoa ou IA que editar)

1. **Não redesenhar nem descaracterizar a logomarca.** Prata metálica com detalhes em azul, sobre fundo preto. Usar sempre `assets/konan-logo.png`.
2. **Não inventar clientes, depoimentos, números, funcionalidades ou resultados.** Telas e valores das demonstrações são marcados como ilustrativos.
3. **Respeitar o estágio real de cada projeto**: Obra em Dia (em implantação), MontaCerto (em operação diária), Ultra Obra (em testes), Via Opus e Caça Ruídos (entregues).
4. **Nada de hífens ou travessões nos textos visíveis do site.** Reescrever a frase.
5. **WhatsApp sempre fácil**: botão no topo, no menu, no contato e o botão flutuante.
6. **Respeitar movimento reduzido** e manter o site leve no celular. A qualidade das partículas cai sozinha em aparelhos lentos.
7. **Não publicar em produção sem autorização do Dande.**

## O que ainda precisa ser confirmado ou trocado

- **Números da seção Quem somos**: mais de 200 atendimentos por dia, 30 montadores e 5 projetos. Confirmar os três.
- **Localização no rodapé**: "Base em Brasília, DF". Confirmar.
- **Telas reais dos projetos**: as telas da galeria são ilustrações marcadas como tal. Trocar por capturas reais quando houver.
- **Depoimento do fundador e respostas das perguntas frequentes**: revisar.
- **Endereço sem www** (`konantech.com.br`): ainda não abre o site. Precisa de redirecionamento.
- **Páginas de privacidade e termos**: ainda não existem.

## Observações técnicas

- Partículas em WebGL com Three.js, morfose feita na placa de vídeo, brilho com UnrealBloomPass.
- Se o aparelho ficar lento, o site reduz a resolução, depois desliga o brilho, depois diminui as partículas.
- Com movimento reduzido ativado no aparelho, não há abertura, rolagem suave nem animações; as formas mudam sem transição.
- Sem WebGL, o topo mostra `assets/hero-poster.jpg` e o resto do site funciona normalmente.
- Para atualizar as bibliotecas: `sh scripts/build-vendor.sh` (precisa de Node.js).
