# 03 — Estrutura de arquivos

## Árvore comentada

```text
dat-movie/
├── index.html                  # Shell da SPA: auth, navbar, home, grade, busca e modais
├── style.css                   # Design system e todas as regras de layout/tema
├── README.md                   # Visão geral, setup, deploy e estrutura
├── package.json                # Scripts e dependências
├── vite.config.js              # Configuração do Vite
├── vitest.config.js            # Configuração do Vitest
├── eslint.config.mjs           # ESLint flat config
│
├── src/
│   ├── main.js                 # Bootstrap e orquestração do app real
│   │
│   ├── lib/                    # Domínio + infraestrutura
│   │   ├── api.js              # callTMDB, detalhes, pôster por temporada, logos
│   │   ├── auth.js             # Sessão, login, cadastro, nome de exibição
│   │   ├── autoRotate.js       # Timer de rotação de imagens com pausa
│   │   ├── cache.js            # LRU com TTL + persistência em localStorage
│   │   ├── catalog.js          # Progresso, filtros, ordenação, dedupe, escape
│   │   ├── dates.js            # `parseLocalDate`: data ISO no fuso local
│   │   ├── discoverSearch.js   # Filtros avançados e busca discover/tv
│   │   ├── dom.js              # Mapa central de elementos do DOM
│   │   ├── fuzzySearch.js      # Normalização, distância de edição e score
│   │   ├── imageNavigation.js  # Navegação e curadoria de imagens
│   │   ├── lists.js            # CRUD de user_lists e item_lists
│   │   ├── logoPicker.js       # Escolha canônica de logo
│   │   ├── prng.js             # `seededRandom`: PRNG determinístico (mulberry32)
│   │   ├── recommendScoring.js # Score, mix 70/30 e sorteio ponderado
│   │   ├── seasonArt.js        # Regra de arte por temporada
│   │   ├── state.js            # Estado global e chaves de localStorage
│   │   ├── supabase.js         # Cliente Supabase (env VITE_*)
│   │   ├── titleFilters.js     # Filtros de qualidade de conteúdo
│   │   ├── titleRelations.js   # Títulos-base, continuações e ordenação
│   │   └── trendingApi.js      # Seções da home, cache, estatísticas, calendário
│   │
│   ├── components/             # UI reutilizável
│   │   ├── cards.js            # Anatomia única do card (markup + interação)
│   │   ├── confirmModal.js     # Confirmação assíncrona com foco preso
│   │   ├── episodesModal.js    # Lista/edição de episódios de uma temporada
│   │   ├── homePage.js         # Template e loaders de todas as seções da home
│   │   ├── searchPage.js       # Aba Pesquisar: busca, filtros, paginação
│   │   ├── titleInfoModal.js   # Ficha técnica do TMDb
│   │   └── uiHelpers.js        # Toast, lock de tela, foco, erros de campo
│   │
│   └── pages/
│       └── titlePage.js        # Página do título (HUD, steppers, listas, tier)
│
├── supabase/
│   ├── config.toml             # verify_jwt e entrypoints das funções
│   ├── migrations/             # DDL, índices, RLS e migrações de dados
│   └── functions/
│       ├── clever-endpoint/    # Proxy do TMDb com allow-list
│       ├── fanart-logo/        # Fallback de logo no Fanart.tv
│       └── _shared/            # auth.ts + allowedEndpoint.ts (compartilhados)
│
├── scripts/
│   └── migrate-data.js         # Migração administrativa para o sistema de listas
│
├── tests/                      # 29 suítes Vitest (unidade + contrato visual)
│
├── assets/                     # Marca: favicons, ícones, logotipos + guia
├── public/                     # Espelho servido pelo Vite (assets)
├── .github/workflows/ci.yml    # CI: lint, testes e build
├── dist/                       # Build de produção (gerado)
└── node_modules/               # Dependências (gerado)
```

> `dist/` e `node_modules/` não devem ser editados à mão.

---

## Responsabilidades por arquivo

### Shell

| Arquivo | Responsabilidade | Observações |
|---|---|---|
| `index.html` | Estrutura semântica, IDs, formulários e modais | Fonte dos seletores de `dom.js`; inclui Font Awesome e fontes |
| `style.css` | Tokens, temas, layout e componentes | Também é lido por testes de contrato visual |
| `vite.config.js` | Entrada e configuração do bundler | `index.html` é o entry HTML |
| `vitest.config.js` | Ambiente de teste | Testes rodam em Node, não em navegador |

### Orquestração

| Arquivo | Responsabilidade |
|---|---|
| `src/main.js` | Bootstrap; autenticação; CRUD Supabase; navbar e listas; filtros; render da grade; roteamento do título; eventos globais; composição dos modais |

`main.js` é o maior acoplador do projeto. Ele não é um “componente”: é a camada de
aplicação inteira em um arquivo.

### Domínio

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `catalog.js` | Progresso, filtros, ordenação, dedupe, escape HTML, datas, tiers | `fuzzySearch` |
| `fuzzySearch.js` | Normalização, distância de edição, score e queries alternativas | — |
| `titleFilters.js` | Bloqueios, idioma, alfabeto, data absurda, arte, título exibido | `dates` |
| `titleRelations.js` | Título-base, continuações, ordenação de resultados, pai | — |
| `recommendScoring.js` | Score bayesiano/popularidade/recência e mix de seleção | `titleFilters`, `dates`, `prng` |
| `discoverSearch.js` | Opções de filtro, `buildDiscoverParams`, `searchTitles` | `api`, `cache`, `trendingApi`, `titleFilters`, `fuzzySearch`, `titleRelations` |
| `seasonArt.js` | Decide e resolve arte por temporada | — |
| `logoPicker.js` | Escolhe logo canônico por idioma/país/votação | — |
| `imageNavigation.js` | Índice anterior/próximo, dedupe, idioma, largura | — |
| `autoRotate.js` | Timer com `shouldRun` e cleanup | — |
| `affinityMemory.js` | Memória persistente de ids exibidos, seed e offset | `localStorage` |
| `dates.js` | `parseLocalDate`: lê data ISO no fuso local, não em UTC | — |
| `prng.js` | `seededRandom`: PRNG determinístico (mulberry32) | — |

### Infraestrutura

| Módulo | Responsabilidade | Efeitos colaterais |
|---|---|---|
| `supabase.js` | Cria o client com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` | Loga erro se faltar env |
| `auth.js` | Sessão, usuário, login, cadastro, update de nome | Chama Supabase Auth |
| `lists.js` | CRUD de listas e relações | Chama Supabase |
| `api.js` | `callTMDB`, detalhes com cache/dedupe, pôster, logos | Chama Edge Functions e cache |
| `cache.js` | LRU com TTL, limite, persistência debounced | Escreve em `localStorage` |
| `trendingApi.js` | Consultas e regras das seções da home | Chama `api`, cache e domínio |
| `state.js` | Estado global e persistência de navegação | Lê/escreve `localStorage` |
| `dom.js` | Mapa de elementos | Lê o DOM no import |

### UI

| Arquivo | Responsabilidade |
|---|---|
| `cards.js` | `cardMarkup`, `createCardElement`, `attachCardInteraction`, `resolveCardPoster` |
| `homePage.js` | `renderHome` e loaders/renderizadores de cada seção |
| `searchPage.js` | `setupSearchPage` com `activate`/`deactivate` |
| `titlePage.js` | `setupTitlePage`, `showTitlePage`, `hideTitlePage` |
| `titleInfoModal.js` | Ficha técnica, classificação, bandeiras, status |
| `episodesModal.js` | Episódios da temporada e atualização de progresso |
| `confirmModal.js` | `showConfirm` com Promise e foco preso |
| `uiHelpers.js` | Toast, lock de scroll, trap de foco, erros de campo |

### Backend

| Caminho | Responsabilidade |
|---|---|
| `supabase/migrations/create_items_table.sql` | Tabela `items`, trigger e índices |
| `supabase/migrations/create_lists_tables.sql` | `user_lists`, `item_lists`, CHECK de tipo e RLS |
| `supabase/migrations/add_unique_index_items_user_tmdb.sql` | Índice único parcial por usuário + TMDb |
| `supabase/migrations/add_index_items_user_id.sql` | Índice redundante de `user_id` (idempotente) |
| `supabase/migrations/fix_total_episodios_from_season_map.sql` | Corrige totais antigos a partir do mapa |
| `supabase/migrations/migrate_existing_data.sql` | Migração SQL de itens para listas |
| `scripts/migrate-data.js` | Mesma migração via service role, para todos os usuários |
| `supabase/functions/clever-endpoint/index.ts` | Proxy TMDb com allow-list e usuário real |
| `supabase/functions/fanart-logo/index.ts` | Logo do Fanart com validação de `tmdbId` |
| `supabase/functions/_shared/auth.ts` | Leitura de claims e checagem de usuário |
| `supabase/functions/_shared/allowedEndpoint.ts` | Regex e limite de tamanho do endpoint |

---

## Onde mexer para cada tipo de mudança

| Quero… | Vá para |
|---|---|
| Mudar o cálculo de progresso | `src/lib/catalog.js` (`calcularProgresso`) + testes `catalog.test.js` |
| Adicionar um filtro ao catálogo | `src/lib/catalog.js` (`filterItems`) + `index.html` + `main.js` |
| Mudar a ordem/seções da home | `src/components/homePage.js` (`renderHomeBase`, `renderHome`) |
| Adicionar uma seção de API na home | `trendingApi.js` + `homePage.js` + teste próprio |
| Mudar a busca avançada | `src/lib/discoverSearch.js` + `src/components/searchPage.js` |
| Mudar o card | `src/components/cards.js` + bloco `CARD` em `style.css` + `cards.test.js` |
| Mudar tokens/tema | `style.css` (`:root`, `[data-theme]`) + `theme.test.js` |
| Mudar a página do título | `src/pages/titlePage.js` + `stepperTint.test.js` |
| Mudar listas | `src/lib/lists.js` + `src/main.js` (navbar) + SQL |
| Mudar schema/RLS | `supabase/migrations/` (nunca só no README) |
| Mudar o proxy TMDb | `supabase/functions/_shared/allowedEndpoint.ts` + `cleverEndpoint.test.js` |
| Mudar autenticação | `src/lib/auth.js` + `main.js` (form) + `functionAuth.test.js` |
| Mudar cache | `src/lib/cache.js` + `cache.test.js` + `freshRefresh.test.js` |

---

## Arquivos citados na documentação antiga que não existem

O `README.md` menciona uma estrutura de componentes ligeiramente diferente da
real. Estes nomes **não** existem como arquivos separados:

- `detailModal.js` — a ficha técnica vive em `titleInfoModal.js`.
- `stepper.js` — os steppers vivem em `pages/titlePage.js`.
- `addModal.js` — o fluxo de adicionar é composto em `main.js` + `titlePage.js` +
  `searchPage.js`.

Ao refatorar, trate `src/components/` e `src/pages/` como a estrutura real.
