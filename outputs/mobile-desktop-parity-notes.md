# Mobile -> Desktop parity (anotado)

1. **Barra de progresso no detalhe do título**
   - Mobile: `#titleProgressTrack/#titleProgressFill/#titleProgressPct` + `updateTitleProgressBar()` (`mobile.html`, `src/mobile.js:2026`).
   - Desktop: falta barra/% visual em `src/pages/titlePage.js`.
   - Ação: adicionar barra de progresso em tempo real no detalhe desktop, reutilizando `calcularProgresso`.

2. **Detalhes clicáveis para descoberta por metadados**
   - Mobile: gêneros, keywords, elenco, criação/direção, emissora, produtora e origem abrem resultados relacionados (`src/mobile.js:1632`, `2350`, `2422`).
   - Desktop: `titleInfoModal.js` mostra pills/cards estáticos (`129-133`, `300`, `377`, `388-422`).
   - Ação: tornar metadados navegáveis; no desktop, abrir busca/filtro correspondente.

3. **Palavras-chave TMDB no modal de detalhes**
   - Mobile: busca `keywords`, traduz via `keywordTranslations` e exibe chips clicáveis.
   - Desktop: `titleInfoModal.js:300` não pede `keywords` nem exibe seção.
   - Ação: incluir keywords traduzidas no bloco Detalhes.

4. **Steppers com pointer events**
   - Mobile: `pointerdown/up/cancel/leave` + guarda `holdActive/holdFired`.
   - Desktop: `src/pages/titlePage.js:550-575` usa mouse events.
   - Ação: migrar steppers do detalhe desktop para pointer events, mantendo hold-to-repeat.

## Aplicado (revisão implementada)

- **Nomenclatura desktop alinhada ao mobile:** nav Catálogo -> Coleção, Próximos -> Watchlist (src/main.js), labels/subtítulos correspondentes.
- **Glossário prático adotado:** Coleção = acervo principal; Watchlist = planejados; Listas = listas personalizadas do usuário. Ajustes: filtro Coleção -> Listas (index.html), subtitle Lista "..." (main.js), title page sidebar Coleções -> Listas (	itlePage.js), toasts mobile de coleção->lista (mobile.js).
- **Detalhe desktop:** barra de progresso + % em tempo real (src/pages/titlePage.js, calcularProgresso).
- **Steppers desktop:** pointer events + guarda hold para evitar passo duplo (src/pages/titlePage.js).
- **Modal de detalhes desktop:** keywords TMDB (content_ratings,keywords), tradução via 	ranslateKeyword, chips clicáveis de gênero/palavras-chave; clique fecha modal e abre pesquisa (	itleInfoModal.js, main.js, searchPage.js API search()).
- **Blur no detalhe desktop:** camada .tp-bg-blur com fallback de pôster, sync com backdrop, tema claro e reduced-motion (style.css, 	itlePage.js).

## Pendente / decisão maior

- Descoberta por metadados completa no desktop (pessoa/rede/produtora/origem como no mobile discoverScreen).
- Histórico de visualizações e personalização da Home no desktop.
- Unificar terminologia no DB/código legado onde "Próximos/Lista de Desejos" ainda são nomes de sistema.
- Padronizar skeletons em mais grids/listas desktop.
