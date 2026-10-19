---
schemaVersion: 1
scope: workspace
updatedAt: "2026-10-19T14:14:25.794Z"
workspaceName: "dat-movie"
---

# Project Memory

## Project Overview
- Workspace do Dat-Movie, um catálogo pessoal de filmes e séries.
- Objetivo atual: gerar e validar uma prévia mobile interativa do app, preservando a identidade visual original.
- A prévia é um artefato isolado e demonstrativo, não a implementação responsiva de produção.

## Current State
- `App.jsx` contém a prévia mobile em moldura de 390 × 844 px, com alternativa fluida.
- A prévia possui quatro destinos fixos: Início, Catálogo, Buscar e Perfil.
- Trilhos horizontais usam snap de aproximadamente 2,5 cartões; filtros são chips roláveis.
- O detalhe abre em tela cheia, com voltar, topo fixo e ação primária “Marcar +1 episódio”.
- Progresso e favoritos compartilham estado entre Início, Catálogo, Buscar e Perfil.
- Ajustes visíveis permitem modificar acento, densidade, modo moldura/fluido e exibição de notas.
- Dados, artes e sessão são fictícios; a prévia não chama Supabase nem TMDb.
- O alinhamento do cabeçalho, wordmark e anatomia dos cartões à identidade original ainda está em andamento e precisa de nova validação visual.

## Artifacts
- `App.jsx`: fonte ativa da prévia mobile interativa.
- `DESIGN.md`: fonte autoritativa do design system, com overview, cores, tipografia e layout.
- `index.html` e `style.css`: aplicação original, mantidos fora do escopo da prévia.
- `src/components/homePage.js` e `src/components/cards.js`: referências para header, marca e anatomia dos cartões do app real.
- `assets/logo/`: recursos de marca relevantes para recuperar o ícone e o wordmark originais.

## Design Direction
- Identidade monocromática quente, do preto às superfícies em camadas.
- Areia como único acento; cores de tier são a única exceção saturada.
- Tipografia preservada do projeto, com hierarquia editorial e números tabulares em fonte monoespaçada.
- A composição mobile deve parecer uma adaptação do Dat-Movie original, não uma nova identidade genérica.

## User Feedback
- O primeiro resultado mobile foi considerado ótimo em estrutura, mas distante da identidade original.
- O principal ajuste pedido é recuperar header, wordmark e anatomia dos cartões.
- O usuário pediu para manter e continuar o trabalho, além de visualizar a prévia.
- Interface, conversa e rótulos devem permanecer em português (pt-BR).

## Decisions
- Manter a prévia isolada em `App.jsx` nesta etapa.
- Não alterar `index.html`, `style.css` ou `src/` sem aprovação posterior.
- Manter moldura 390 × 844 px, opção fluida e barra inferior com quatro abas.
- Manter trilhos com snap, chips roláveis e estado compartilhado.
- A prévia deve ser apresentada como demonstração fiel, não como entrega responsiva final.

## Open Questions
- Se o detalhe em tela cheia substituirá `titleInfoModal` ou será um novo modo.
- Quando e como planejar breakpoints e tab bar no `style.css` real.
- Se a prévia será conectada a dados reais ou descartada após validação.
- Se o usuário considera a identidade readequada após os ajustes de marca.

## Next Steps
- Finalizar o alinhamento do header, wordmark, ícone e cartões com os arquivos originais.
- Renderizar e verificar a prévia completa em 390 × 844 px.
- Validar navegação, filtros, progresso, favoritos e alteração moldura/fluido.
- Apresentar o resultado ao usuário para aprovação.
- Só depois planejar a portabilidade responsiva para a aplicação real.

## Promotion Candidates For DESIGN.md
- Prévia mobile em moldura de 390 × 844 px com variante fluida.
- Barra inferior fixa com Início, Catálogo, Buscar e Perfil.
- Trilhos com snap de aproximadamente 2,5 cartões e filtros em chips roláveis.
- Detalhe em tela cheia com topo fixo e ação primária de progresso.
- Estado compartilhado entre destino e telas do preview.

## Recent History
- 2026-10-19: criada a primeira prévia mobile interativa com quatro abas, trilhos, filtros, detalhes e estado compartilhado.
- 2026-10-19: usuário elogiou a composição, mas apontou afastamento da identidade original.
- 2026-10-19: iniciada a recuperação da marca e da anatomia dos cartões a partir de `homePage.js`, `cards.js` e `assets/logo/`; validação final ainda pendente.