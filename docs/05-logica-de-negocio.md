# 05 — Lógica de negócio

Este documento descreve as regras que não são óbvias só pela leitura da UI. Quase
todas vivem em `src/lib/` e são cobertas por testes; a camada de apresentação
apenas as orquestra.

Índice:

1. [Progresso](#1-progresso)
2. [Status e tier](#2-status-e-tier)
3. [Filtros e ordenação do catálogo](#3-filtros-e-ordenação-do-catálogo)
4. [Deduplicação](#4-deduplicação)
5. [Listas](#5-listas)
6. [Busca local tolerante a erro](#6-busca-local-tolerante-a-erro)
7. [Busca e descoberta no TMDb](#7-busca-e-descoberta-no-tmdb)
8. [Relações entre títulos](#8-relações-entre-títulos)
9. [Filtros de qualidade de conteúdo](#9-filtros-de-qualidade-de-conteúdo)
10. [Recomendações e score](#10-recomendações-e-score)
11. [Home: regras por seção](#11-home-regras-por-seção)
12. [Arte por temporada e logos](#12-arte-por-temporada-e-logos)
13. [Cache e atualização](#13-cache-e-atualização)
14. [Imagens e rotação automática](#14-imagens-e-rotação-automática)
15. [Casos de borda e decisões](#15-casos-de-borda-e-decisões)

---

## 1. Progresso

### Função

`calcularProgresso(item)` em `src/lib/catalog.js`.

### Fórmula

```text
assistido = episodio
se existe mapa e temporada > 1:
    assistido += soma dos episódios das temporadas anteriores

total = soma do seasonEpisodesMap, se > 0
        senão totalEpisodios

se total <= 0: 0
se não há mapa e assistido >= total: 0   // total não confiável
pct = round(min(assistido, total) / total * 100)
```

### Por que o mapa manda

`total_episodios` nasceu com `DEFAULT 1` e já foi gravado com duas semânticas
diferentes:

- o modal de adicionar grava `number_of_episodes` (série inteira);
- a página do título já gravou `maxEpByTemp[temporada]` (só a temporada atual).

O numerador sempre somou temporadas anteriores. Dividir por um total de temporada
estourava e travava a barra em 100%. O mapa, vindo do TMDb temporada a temporada,
é a única fonte que fala a mesma unidade do numerador.

### Regras derivadas

- Sem mapa e sem total confiável, a barra fica **vazia** em vez de cheia.
- `episodio` é sempre o episódio dentro da temporada atual; a soma das anteriores
  é reconstruída pelo mapa.
- `totalDeEpisodiosDaSerie(mapa)` ignora valores não numéricos e arrays.
- A migration `fix_total_episodios_from_season_map.sql` alinha a coluna ao mapa
  nos dados antigos.

### Exemplo

```js
item = { temporada: 2, episodio: 3, seasonEpisodesMap: { 1: 10, 2: 8 }, totalEpisodios: 8 }
// assistido = 3 + 10 = 13
// total = 18
// pct = round(13/18*100) = 72
```

---

## 2. Status e tier

### Status

| Status | Significado | Efeito na UI |
|---|---|---|
| `assistindo` | Em andamento | Aparece em Continuar Assistindo, calendário e afinidade |
| `concluido` | Terminado | Não usa arte por temporada |
| `planejado` | Fila de espera | Só aparece na aba Próximos; entra na lista de sistema “Próximos” |
| `pausado` | Abandonado temporariamente | Aparece em Abandonados |

Não há máquina de estados: qualquer status pode ir para qualquer outro. A UI
oferece os quatro botões na página do título.

> `getCatalogStats` (`trendingApi.js`) calcula totais, horas e taxa de conclusão,
> mas **não é chamado por nenhuma tela** hoje. Não presuma que existe um painel de
> estatísticas no app real.

### Tier

- Ordem: `S+ > S > A > B > C > D > sem tier`.
- `S+` e `S` são “favoritos” na home.
- Tier influencia a escolha de âncoras de afinidade (bônus).
- Tier é pessoal; não vem do TMDb.

---

## 3. Filtros e ordenação do catálogo

### `filterItems(items, filtros)`

Ordem de aplicação:

1. **Lista específica** (`currentListId`), exceto nas abas `all` e `planejado`.
2. **Aba**:
   - `planejado`: só `status === 'planejado'`;
   - qualquer outra: exclui `status === 'planejado'`.
3. **Tipo legado**: se a aba não é `planejado`/`all` e não há lista, filtra
   `item.tipo === currentTab`. As abas atuais não usam isso, mas a compatibilidade
   existe.
4. **Busca textual** com `matchScore`; resultados ordenados por score.
5. **Status** exato (ignorado quando `todos`).
6. **Tier** exato; `null` significa “sem tier”.
7. **Década** via `yearResolver` (padrão: `item.ano`).

> O filtro de década é aplicado **duas vezes** no app: primeiro de forma síncrona
> com `yearFilter: 'todos'`, depois em `main.js` com o ano enriquecido do TMDb.
> Isso permite filtrar item antigo sem coluna `ano`.

### `decadeOf(ano)`

- `>= 2020` → `2020`
- `>= 2010` → `2010`
- `>= 2000` → `2000`
- `>= 1990` → `1990`
- `>= 1980` → `1980`
- resto → `antes`
- sem ano válido → `todos`

### `sortItems(items, sortKey)`

Formato: `campo-direção` (`asc`/`desc`).

| Campo | Critério | Ausência |
|---|---|---|
| `nome` | Alfabético | String vazia |
| `progresso` | `calcularProgresso` | 0 |
| `data` | `dataCriacao` | 0 |
| `tier` | Ordem S+…D | Vai para o fim nos dois sentidos |
| `temporada` | Número | 0 |
| `ano` | Número | Vai para o fim nos dois sentidos |
| padrão | 0 | — |

### Filtros de idade e ano (fora de `catalog.js`)

- **Idade**: `warmDetailsBatch` busca detalhes de todos os itens com `tmdb_id`,
  extrai `content_ratings` e aplica `ageCodeOf`. `ageMatch` compara o código
  (`sem` = sem classificação).
- **Ano**: usa `item.ano` ou `yearFromDetails(det)` (primeira data de exibição).
- Há um `renderSeq` que invalida renders antigos quando o usuário muda filtro no
  meio do enriquecimento.

---

## 4. Deduplicação

### No cliente

`isDuplicateInCatalog(candidate, catalogItems, excludeIndex)`:

1. Se o candidato tem `tmdb_id`, compara **somente** `tmdb_id` (string).
2. Se não tem, compara `nome` normalizado + `tipo` + `ano`.
3. `excludeIndex` permite editar o próprio item sem se auto-bloquear.

`filterNotInCatalog(tmdbResults, catalogItems)` remove resultados do TMDb cujo
`id` já existe como `tmdb_id` no catálogo. Itens sem `tmdb_id` não entram no
conjunto.

### No banco

`idx_items_user_tmdb_unique` em `(user_id, tmdb_id) WHERE tmdb_id IS NOT NULL`.

- Dois dispositivos podem passar pelo check do cliente ao mesmo tempo; o índice
  é a última defesa.
- `23505` é traduzido para “Este título já existe no seu catálogo.”.

### Em listas

`UNIQUE(item_id, list_id)` em `item_lists`. `addItemToList` trata `23505` como
sucesso silencioso (já estava na lista).

---

## 5. Listas

### Modelo

- `user_lists`: nome, `is_system`, `ordem`.
- `item_lists`: relação N:N.
- A ordem é arrastável na navbar via SortableJS; `updateListsOrder` dispara um
  update por lista em paralelo e falha se algum falhar.

### Regras

- Listas de sistema não podem ser excluídas (`deleteList` recusa e a RLS também).
- “Próximos” e “Lista de Desejos” são identificadas por **nome** no código e
  escondidas do seletor de listas da página do título.
- Ao salvar a página do título, o diff entre checkboxes marcados e `item.lists`
  gera `addItemToList` / `removeItemFromList`.
- Falhas parciais são toleradas: `Promise.allSettled` mantém o que funcionou.
- A lista “Próximos” é alimentada pelo status `planejado`, não por uma regra
  separada de associação.

### Criação

- `createList` calcula `ordem = max(ordem) + 1`.
- Nome duplicado no mesmo usuário viola `UNIQUE(user_id, nome)`.

---

## 6. Busca local tolerante a erro

`src/lib/fuzzySearch.js`.

### Normalização

`normalizeForSearch`:

- decompõe acentos (`NFD`) e remove diacríticos;
- minúsculas;
- troca pontuação por espaço;
- colapsa espaços.

### Camadas de `matchScore`

| Condição | Score |
|---|---|
| Texto normalizado igual à consulta | 100 |
| Texto contém a consulta | 92 |
| Texto sem espaços contém a consulta sem espaços | 88 |
| Todos os termos da consulta aparecem, em qualquer ordem | 95 |
| Média de similaridade por termo ≥ 60% | até 92 (média × 0,92) |
| Caso contrário | 0 |

### Distância de edição

- Damerau-Levenshtein (variante OSA), com transposição de letras vizinhas.
- Limite por tamanho do termo:
  - ≤ 3 letras: 0 edições;
  - 4–6: 1 edição;
  - ≥ 7: 2 edições.
- A diferença de tamanho entre termo e palavra também é limitada, para “on” não
  casar com “once”.

### Ordenação

- `sortByRelevance(query, items, getName)` ordena por score e mantém a ordem
  original em empate.
- `buildFallbackQueries(query)` gera grafias alternativas (sem stopwords, etc.)
  para a busca no TMDb quando a primeira tentativa volta vazia.

### Stopwords

`the, o, a, os, as, de, da, do, e` são ignoradas na geração de alternativas.

---

## 7. Busca e descoberta no TMDb

`src/lib/discoverSearch.js` + `src/components/searchPage.js`.

### Modos de `searchTitles`

| Condição | Modo | Endpoint |
|---|---|---|
| Há filtro ativo | `discover` | `discover/tv` |
| Sem filtro, texto ≥ 2 | `search` | `search/tv` |
| Sem filtro, sem texto, com ordenação | `discover` (browse) | `discover/tv` |
| Sem nada | `idle` | nenhum |

### Paginação

- Cada carregamento junta **2 páginas do TMDb** = 40 itens
  (`SEARCH_PAGE_SIZE`).
- A `page` de entrada/saída é lógica (blocos de 40).
- `dedupeById` remove repetidos entre páginas.
- `totalPages` é calculado a partir do maior `total_pages` do TMDb.

### Filtros → query

`buildDiscoverParams`:

| UI | Parâmetro | Regra |
|---|---|---|
| Gêneros | `with_genres` | Vários ids com `,` (E lógico) |
| Gêneros negados | `without_genres` | Vários ids com `\|` (OU) |
| Países | `with_origin_country` | Vários com `\|` (OU) |
| Classificação | `certification` + `certification_country` | `BR:18` separa país; senão US |
| Duração | `with_runtime.gte` / `.lte` | Presets curto/padrão/longo |
| Ano exato | `first_air_date_year` | `from === to` |
| Faixa de ano | `first_air_date.gte` / `.lte` | `AAAA-01-01` / `AAAA-12-31` |
| Status | `with_status` | 0–5 |
| Tipo | `with_type` | 0–6 |
| Idioma | `with_original_language` | ISO 639-1 |
| Ordenação | `sort_by` | Lista sem nota; padrão `popularity.desc` |

### Regras importantes

- **Sem nota.** Nenhum parâmetro `vote_average`/`vote_count` é emitido.
- **Negação de país é local.** O TMDb não tem `without_origin_country`;
  `filterExcludedCountries` remove no lote carregado.
- **Texto + filtros juntos.** No modo discover, o texto vira
  `filterResultsByQuery` (local), sem descartar os filtros.
- **Fallback de grafia.** Só na primeira página e só no modo search.
- **Gênero Terror.** `genre/tv/list` não inclui 27; `getTitlesByGenre` usa a
  keyword `315058` como fallback, substituindo `with_genres`.
- **Bloqueios.** `removeBlocked` remove produções proibidas dos resultados.

### Opções de UI

- Gêneros: lista do TMDb com fallback local (`TV_GENRES_FALLBACK`).
- Países: lista curada (`COUNTRY_OPTIONS`).
- Classificação: `AGE_RATING_OPTIONS` (US, com `BR:18` experimental).
- Duração: `EPISODE_RUNTIME_OPTIONS`.
- Ordenação: `SEARCH_SORT_OPTIONS` (sem nota).
- Status, tipo e idioma: listas fixas.

---

## 8. Relações entre títulos

`src/lib/titleRelations.js`.

- `normalizeTitleName`: sem acento, minúsculo, só letras/números.
- `getBaseTitle`: parte antes dos dois-pontos (`"Bleach: ..."` → `"Bleach"`).
- `isContinuationTitle`: contém `:`.
- `getContinuationTag`: `temporada`, `parte` ou `continuação`.
- `sortSearchResults`: nome exato primeiro, depois popularidade.
- `findParentCandidate`: para um título de continuação, procura:
  1. resultado com nome exatamente igual à base, mais antigo primeiro;
  2. resultado cujo nome é prefixo do título escolhido, mais antigo primeiro.

Uso: evitar vincular o item ao id do arco/continuação em vez da série principal.
A página do título mostra um aviso com a sugestão e permite abrir o pai.

---

## 9. Filtros de qualidade de conteúdo

`src/lib/titleFilters.js`.

### Proibições duras (nunca relaxadas)

| Filtro | Regra |
|---|---|
| Produção bloqueada | `isBlockedProduction`: ids de YouTube/vlog + padrões de título/sinopse |
| Idioma | `isAllowedLanguage`: apenas `en`, `ja`, `ko`; campo ausente passa (falha aberta) |

### Defeitos visíveis (relaxáveis)

Aplicados por `pickWithMix` somente quando não há material limpo suficiente:

| Filtro | Regra |
|---|---|
| Alfabeto | `isStrictlyNonLatinTitle`: rejeita título predominantemente não latino |
| Data | `isAbsurdFutureDate`: mais de 365 dias no futuro |
| Arte | `hasArtwork`: precisa de pôster ou backdrop |

### Detalhes

- Título com maioria de letras não latinas é rejeitado; “Shogun”, “Round 6” e
  “Naruto” passam.
- Datas até 365 dias no futuro são aceitas (anúncios legíveis).
- `hasArtwork` aceita formato normalizado (`posterUrl`, `posterPath`) e cru
  (`poster_path`, `backdrop_path`, `profile_path`, `still_path`).
- `displayTitle` prioriza `title`, `name`, `raw.name`, `raw.title`,
  `raw.original_name`.

---

## 10. Recomendações e score

`src/lib/recommendScoring.js`.

### Score de um título

```text
score = 0.45 * popularidade_normalizada
      + 0.30 * qualidade_bayesiana
      + 0.25 * recência
```

- **Popularidade**: `log10(1 + popularity)`, normalizada min-max **dentro do pool**.
- **Qualidade**: rating bayesiano:
  ```text
  (votos / (votos + 250)) * nota + (250 / (votos + 250)) * 6.5
  ```
  dividido por 10.
- **Recência**: decaimento exponencial com meia-vida de 6 anos; sem data = 0.5;
  data absurda no futuro = 0.

### Seleção (`pickWithMix`)

1. Calcula score de todo o pool.
2. Separa em `clean` e `defective` (defeitos visíveis).
3. Divide o ranking:
   - **âncora**: top 50% do pool;
   - **exploração**: o restante.
4. Cotas: **70% âncora / 30% exploração** (`MIX`).
   - Com `wanted >= 4`, a âncora fica entre 2 e `wanted - 1`.
5. Sorteio ponderado dentro de cada região, com temperatura:
   - âncora: `0.2` (concentrada no topo);
   - exploração: `1.1` (espalhada).
6. Itens já exibidos têm peso `0.05` (`SEEN_PENALTY`).
7. Se a exploração esgotar, completa com o que sobrou da âncora, sem repetir.
8. Só usa itens com defeito se ainda faltar vaga.
9. Reordena o resultado final pela posição no ranking de score.

### Sorteio ponderado

- PRNG determinístico `mulberry32` (mesma seed = mesma seleção).
- Esquema de Efraimidis-Spirakis: `chave = random^(1/peso)`, maiores vencem.
- `excludeSeen` é rígido; sem ele, o item visto entra com peso reduzido.

### Afinidade

- `rankRecommendationBases` ordena o catálogo como âncora:
  ```text
  score = progresso + bônus de tier + recência
  bônus: S+ 20, S 12, A 5
  recência: max(0, 10 - semanas desde dataAtualizacao/dataCriacao)
  ```
  `assistindo` primeiro, depois o resto.
- `getAffinityRail`:
  - pool = `recommendations` + `similar` (deduplicados);
  - fator de pool 5× a largura;
  - até 12 buscas de âncora;
  - exclui títulos já vistos e bases já usadas;
  - base sem pool é descartada.
- `getAffinityRails`: até 4 faixas, cada uma com âncora distinta.
- `getAffinityRecommendations` (busca manual de até 4 títulos):
  ```text
  score = frequência * 15 + gêneros_em_comum * 8 + popularidade/100 + nota
  ```
  Exclui os títulos escolhidos e os que já estão no catálogo.

### Memória de variedade

`affinityMemory`:
- `shown` (FIFO, máx. 400) evita repetir entre recarregamentos;
- `seed` e `offset` avançam a cada pintura;
- sem `localStorage`, a memória não sobrevive ao F5.

---

## 11. Home: regras por seção

Ordem visual (template de `renderHomeBase`; a chamada dos loaders em
`renderHome` segue uma sequência própria, mas preenche esses mesmos blocos):

| # | Seção | Fonte | Regra |
|---|---|---|---|
| 1 | Saudação | `state.currentUser` | `buildGreeting` por horário |
| 2 | Continuar Assistindo | catálogo | `status === 'assistindo'`, com progresso |
| 3 | Roleta | TMDb | 30% trending; senão `discover/tv` aleatório com `vote_count >= 30` |
| 4 | Episódios da Semana | TMDb | `getCalendarWeek` |
| 5 | Descubra por afinidade | TMDb | busca de até 4 âncoras + faixas |
| 6 | Em Breve | TMDb | `discover/tv` com `first_air_date.gte` hoje |
| 7 | Abandonados | catálogo | `status === 'pausado'`, mais antigos primeiro |
| 8 | Destaques do ano | TMDb | `discover/tv` com `first_air_date_year` |
| 9 | Em Alta | TMDb | `trending/tv/day` ou `week` |
| 10 | Seus Favoritos | catálogo | tier `S+` ou `S` |
| 11 | Explorar por gênero | TMDb | 14 categorias fixas + até 2 gêneros do usuário |

### Regras transversais

- **Largura**: `getFullWidthCount()` define quantos cards pedir:
  - ≤ 1440 px: 18
  - > 1440 px: 20
- **Pool**: as buscas pedem `lim * 15` itens (até 15 páginas de 20) para sobrar
  material após os filtros e para o botão de atualizar variar.
- **Dedupe**: toda seção remove o que já está no catálogo (`tmdb_id`).
- **Fresh**: o botão de atualizar passa `{ fresh: true }`, ignora a leitura do
  cache e regrava a resposta.
- **Skeleton**: cada seção nasce com esqueleto e é substituída quando carrega.
- **Falha**: erro mantém a seção vazia/escondida; não derruba a home.
- **Categorias**: as 14 fixas sempre existem; gêneros do usuário **somam** até 2,
  nunca substituem.
- **Gêneros do usuário**: calculados a partir dos 20 primeiros `assistindo` com
  `tmdb_id`, contando gêneros dos detalhes.
- **Terror**: fallback por keyword `315058`.

### `getNewEpisodes`

- Só itens `assistindo` com `tipo` `serie`, `anime`, `animacao` ou nulo.
- Busca detalhes de cada título (concorrência 5).
- Considera `last_episode_to_air` **e** `next_episode_to_air`.
- Janela de ±7 dias no fuso local (meio-dia como âncora).
- Ordena por data decrescente.

### `getCalendarWeek`

- Usa até 20 episódios de `getNewEpisodes`.
- Se houver episódios futuros, mostra só futuros em ordem crescente.
- Senão, mostra os recentes em ordem decrescente.
- Agrupa por data; no máximo 7 datas.

### `getFavorites`

- Tier `S+` ou `S`.
- Ordena por tier e depois por atualização mais recente.

### `getAbandoned`

- `status === 'pausado'`.
- Ordena pela atualização mais antiga.

### `getCatalogStats`

```text
total, assistindo, concluidos, planejados
totalEpisodiosAssistidos = soma de episodio (não acumula temporadas)
horasAssistidas = round(totalEpisodiosAssistidos * 24 / 60)   // 24 min/ep
progressoMedio = média de calcularProgresso
taxaConclusao = concluidos / total
```

> A estimativa de horas assume 24 minutos por episódio. É uma heurística, não um
> dado do TMDb.

---

## 12. Arte por temporada e logos

### Arte por temporada

`src/lib/seasonArt.js`.

Problema: o TMDb rebranda a arte principal de séries longas para o arco mais
recente (ex.: Bleach). O app acompanha por temporada, então deve mostrar a arte da
temporada acompanhada.

Regra `shouldUseSeasonArt(item, numberOfSeasons)`:

- item precisa ter `tmdb_id`;
- item **não** pode estar `concluido`;
- a série precisa ter mais de 1 temporada;
- `temporada` precisa ser um número ≥ 1.

`resolveSeasonPosterUrl`:

1. pôster da temporada em `details.seasons`;
2. fallback no pôster da série;
3. `null` se não houver.

`seasonPosterUrlFromSeason` monta a URL a partir do payload de
`tv/{id}/season/{n}`.

### Logos

`src/lib/logoPicker.js`.

Preferência:

1. `pt` + `BR`
2. `en` + `US`
3. `pt` + qualquer país
4. `en` + qualquer país
5. sem idioma

Dentro de cada grupo, vence:

1. maior `vote_average`;
2. maior `vote_count`;
3. maior `width`.

`api.pickTitleLogo`:

- Para TV: tenta logo localizado no TMDb e Fanart em paralelo; se houver TMDb,
  usa; senão Fanart.
- Para outros tipos: vai direto ao Fanart.
- `fetchTitleLogo` ainda tem um fallback final para `tv/{id}/images` (ou
  `movie/{id}/images`).

> **Atenção:** o fallback `fetchLogoFromTMDB` usa `movie/{id}/images` para
> `mediaType === 'movie'`, endpoint que **não está na allow-list** do
> `clever-endpoint`. Para TV, `tv/{id}/images` está permitido. Como o produto real
> é TV, o caminho de filme é código morto/arriscado.

### Imagens do modal

`imageNavigation.processImages`:

1. filtra `posters` e `backdrops` por idioma (`null`, `en`, `pt`);
2. combina;
3. deduplica por `file_path`;
4. ordena por `width` decrescente.

`nextImage`/`prevImage` fazem wrap-around circular.

---

## 13. Cache e atualização

`src/lib/cache.js`.

### LRU

- TTL padrão: 1 h.
- Máximo: 200 entradas.
- `get` remove expirados e reinsere para marcar como recente.
- `set` remove o mais antigo quando cheio.
- `deleteByPrefix` invalida um grupo.

### Persistência

- Chave: `datmovie_cache_v1`.
- Formato: `{ data: { [key]: { value, expiresAt } }, ts }`.
- Escrita com debounce de 250 ms.
- Restauração apenas se `ts` tiver menos de 7 dias.
- Cada entrada ainda respeita seu próprio `expiresAt`.
- `clear()` cancela escrita agendada e remove o blob.

### Chaves conhecidas

| Prefixo/chave | Origem | Conteúdo |
|---|---|---|
| `trending_...` | `trendingApi` | Respostas do TMDb das seções |
| `tvcache_<id>` | `api.fetchTvDetailsCached` | Detalhes de série |
| `logoV2_<id>_<type>` | `api` | Logo escolhido |
| `logoLoc_<id>_<size>` | `api` | Logo localizado |
| `search_tv_genres_pt` | `discoverSearch` | Gêneros de TV |

### `fresh`

- `cachedCallTMDB(..., { fresh: true })` pula a leitura e regrava a resposta.
- Usado pelos botões de atualizar da home.
- `fetchTvDetailsCached` não aceita `fresh`; quem precisa de detalhes frescos usa
  `cachedCallTMDB` diretamente.

### Invalidação

- `clearTrendingCache()` remove só `trending_`.
- `cacheClear()` remove tudo (logout).

---

## 14. Imagens e rotação automática

`src/lib/autoRotate.js`.

- Um único `setInterval`, reiniciável.
- `shouldRun()` permite pausar (aba em segundo plano).
- `restart()` zera a contagem para quem navegou manualmente ter o intervalo
  inteiro.
- `start()` é idempotente: nunca deixa dois timers vivos.

Uso: backdrop da página do título. A rotação é interrompida ao sair da página.

---

## 15. Casos de borda e decisões

| Caso | Comportamento | Onde |
|---|---|---|
| Item sem `tmdb_id` | Não aparece em recomendações/afinidade; dedupe por nome+tipo+ano | `catalog`, `trendingApi` |
| `tipo` nulo | Aceito no banco e em `getNewEpisodes` | SQL + `trendingApi` |
| `totalEpisodios` menor que o assistido | Progresso 0 se não há mapa | `calcularProgresso` |
| Temporada 0 ou inválida | Não usa arte por temporada | `seasonArt` |
| Data de estreia em 2040 | Rejeitada nos carrosséis | `titleFilters` |
| Título só em japonês/chinês | Rejeitado se não latino predominar | `titleFilters` |
| Sem pôster/backdrop | Card só entra se faltar material limpo | `recommendScoring` |
| Idioma original ausente | Passa (falha aberta) | `titleFilters` |
| Gênero Terror | `discover` vazio → keyword 315058 | `trendingApi` |
| `recommendations` sem página 2 | `collectFiltered` para na primeira página sem novidade | `trendingApi` |
| Duas abas inserem o mesmo TMDb | Índice único devolve 23505 | SQL + `main.js` |
| Lista de sistema | Não pode ser excluída | `lists.js` + RLS |
| `localStorage` indisponível | Cache e afinidade degradam para memória | `cache`, `affinityMemory` |
| `localStorage` corrompido | Blob é ignorado; começa do zero | `cache`, `affinityMemory` |
| Falha do Fanart | Retorna `logoUrl: null`, sem quebrar a tela | `fanart-logo` |
| Falha do TMDb | Seção fica vazia; erro vai ao console/toast | loaders da home |
| Requisição antiga termina depois | `renderSeq` descarta render obsoleto | `main.js` |
| Hash de preview `#/titulo/preview-<id>` | Não é resolvido pelo `popstate` | `main.js` |
| Toggle de agrupamento | Grava chave errada (`state.groupingActive`) | `main.js` (bug) |

---

## Regras que qualquer mudança deve preservar como contrato

1. `calcularProgresso` e a prioridade do mapa.
2. A proibição de duplicata por `tmdb_id`.
3. A separação `planejado` × resto.
4. O mix 70/30 com âncora no topo e temperatura assimétrica.
5. As proibições duras de conteúdo (produção e idioma) versus defeitos
   relaxáveis.
6. O contrato de `searchTitles` (modos, página lógica de 40, dedupe, sem nota).
7. A allow-list de endpoints e a exigência de usuário real.
8. O cache com TTL e o modo `fresh`.
9. A arte por temporada apenas para séries multi-temporada não concluídas.
10. A preferência de logo pt-BR e a ordenação por votação.
