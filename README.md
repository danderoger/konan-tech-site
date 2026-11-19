# Konan Tech 8.0

Site institucional da Konan Tech. Esta versão apresenta sistemas sob medida, automação e IA aplicada aos negócios e permite experimentar soluções e explorar cinco projetos existentes.

Branch de revisão: `redesign/konan-tech-8`. A versão parte da 7.0, revisão `a773512`. A 5.0 de `main` está no commit `3578e19`. O commit da revisão inclui o prefixo `[CF-Pages-Skip]` para impedir o deploy automático pelo Cloudflare Pages.

## Abrir a prévia

Na raiz do repositório, execute:

```sh
python3 -m http.server 8000
```

Abra <http://localhost:8000/>. A navegação, as demonstrações e o laboratório funcionam com os recursos incluídos no repositório. A voz usa o serviço do navegador, quando disponível, com autorização do visitante. O botão de PDF abre o diálogo de impressão do navegador, onde é possível escolher **Salvar como PDF**.

Links para testar:

| Endereço | O que abre |
| --- | --- |
| `/#detalhe-sistema` | Demonstração de um pedido compartilhado entre as áreas |
| `/#projeto-montacerto` | Case MontaCerto |
| `/#planta=comercio.planilhas.1.Loja%20Exemplo.x` | Mapa de uma operação comercial fictícia |
| `/#planta=obras.planilhas-documentos-equipe.1.Minha%20Empresa` | Link compatível com o formato da versão 5.0 |
| `/?tier=0#fim` | Final com o nível leve de partículas |

### Arquivo único

```sh
npm install --no-save esbuild
ESBUILD_BIN=./node_modules/.bin/esbuild node scripts/build-offline.mjs Konan-Tech-8.0.html
```

Abra o HTML gerado no navegador. O arquivo contém todos os recursos visuais. A opção de copiar um link de simulação depende de um endereço HTTP compartilhável e fica oculta no arquivo local.

## Estrutura

| Onde | Responsabilidade |
| --- | --- |
| `index.html`, `css/redesign.css` | Conteúdo institucional, identidade visual e layout responsivo |
| `js/assembly.js`, `js/assembly-scene.js`, `js/assembly-layout.js` | Montagem em WebGL e exploração da central com mouse, toque ou teclado |
| `js/app.js`, `js/solutions.js` | Navegação, cenários, demonstração de sistemas, estado do laboratório e fluxos por segmento |
| `js/plan.js`, `js/listen.js`, `js/content.js` | Planta viva, maquete CSS 3D, reconhecimento de texto e voz, regras locais e dados fictícios |
| `js/demos/`, `js/stage.js` | Demos, cases e formação da marca com Three.js |
| `css/main.css` | Estilos dos módulos originais, estados de acessibilidade e folha de impressão |

A direção visual **Sua operação, conectada** representa uma central com módulos de campo, financeiro e gestão. A cena começa com o modelo WebGL em montagem e termina com o mesmo modelo renderizado em Cycles. Depois, o visitante pode mover o mouse sobre a imagem ou girar a central no modo 3D. Em navegadores sem WebGL, o mesmo modelo é projetado por software no Canvas 2D. Em telas por toque, a montagem começa pelo controle para preservar a fluidez da navegação. O simulador de problemas pode levar a dificuldade selecionada diretamente ao laboratório. O portfólio abre com a captura do site Via Opus e reorganiza os projetos conforme o que o visitante informa.

O laboratório adapta a visualização ao ramo. Para construção, o ponto de partida é a planta. Nos demais ramos, o ponto de partida é um mapa com dados de entrada, atividades e acompanhamento. Os fluxos podem abrir uma maquete alternativa. A simulação usa regras locais para combinar o que o visitante informa com módulos de software. A demonstração de IA usa documentos fictícios. Um resumo só é compartilhado quando o visitante aciona o respectivo controle.

Eventos de interação ficam disponíveis no evento DOM `konan:interaction`. O payload contém a ação e uma categoria predefinida. As respostas do laboratório, nomes de empresas e transcrições não integram os eventos. A integração com um coletor de análise pode ser feita posteriormente.

## Renderização da central

O navegador e o Blender leem o mesmo arquivo `js/assembly-layout.js`. Para refazer o quadro de realismo, rode o Blender com o script incluído e exporte a saída em WebP para `assets/central.webp` e `assets/central-mobile.webp`.

```sh
blender -b -t 8 --factory-startup --python scripts/render-assembly.py -- /tmp/central.png 1320 960 160
```

O botão **Montagem** repete a sequência. **Realismo** exibe o quadro renderizado com paralaxe pelo mouse. **Girar em 3D** abre o modelo para mouse, toque ou teclado.

## Portfólio

| Projeto | Estágio registrado na versão 5.0 | Visual apresentado |
| --- | --- | --- |
| Obra em Dia | Em implantação | Interface ilustrativa |
| MontaCerto | Em operação diária | Interface ilustrativa |
| Ultra Obra | Em testes | Interface ilustrativa |
| Via Opus | Entregue | Capturas já presentes no repositório |
| Caça Ruídos | Entregue | Interface ilustrativa |

## Publicação após aprovação

1. Confirme a branch de produção no provedor, os estágios dos projetos e a autorização para manter as capturas da Via Opus.
2. Integre a branch revisada em `main` por um commit de merge novo, sem o prefixo que pula deploy, quando o domínio oficial estiver autorizado a receber a versão.
3. Em Cloudflare Pages, use a configuração estática existente: raiz do repositório e sem comando de build. Preserve o arquivo `_headers` para manter a política de microfone.
4. Verifique o domínio com e sem `www`, o redirecionamento canônico, a imagem Open Graph, os links compartilhados e o botão de contato após a publicação.
5. Para voltar à versão anterior, use o rollback do deploy no provedor ou reverta o commit de integração na branch de produção.
