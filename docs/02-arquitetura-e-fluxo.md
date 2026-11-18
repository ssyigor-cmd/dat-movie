# 02 — Arquitetura e fluxo de dados

## Stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Build/dev server | Vite 8 (`vite.config.js`) | Bundling, HMR, `import.meta.env` |
| Linguagem | JavaScript ES Modules | Sem TypeScript, sem framework de UI |
| UI | HTML estático + DOM API | `index.html`, `style.css`, módulos de componente |
| Autenticação/DB | Supabase (`@supabase/supabase-js`) | Auth e Postgres com RLS |
| APIs externas | Edge Functions Deno | Proxy para TMDb e Fanart.tv |
| Animação | Anime.js | Transições e microinterações |
| Drag & drop | SortableJS | Reordenação de listas na navbar |
| Mobile web | HTML estático + DOM API | mobile.html + src/mobile.js; CSS próprio, sem style.css - ver 11-mobile-web.md |
| Testes | Vitest 4 | Unidade + contratos visuais |
| Lint | ESLint 9 | `src`, `tests`, `scripts` |
| Runtime de tooling | Node >= 22 | Scripts de build, teste e migração |

O app **não usa React, Vue, Svelte ou roteador**. A única dependência de UI com
estado é o próprio DOM.

---

## Camadas

```text
┌─────────────────────────────────────────────────────────────┐
│ Shell                                                       │
│ index.html (regiões, modais, formulários) + style.css       │
└──────────────────────────────┬──────────────────────────────┘
                               │ IDs e classes
┌──────────────────────────────▼──────────────────────────────┐
│ Orquestração                                                │
│ src/main.js: bootstrap, auth, CRUD, navegação, filtros,     │
│ render da grade, eventos globais, modais                    │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────┐  ┌────────────▼──────────────┐
│ Páginas / componentes        │  │ Estado global             │
│ homePage, searchPage,        │  │ src/lib/state.js          │
│ titlePage, cards, modais     │  │ (objeto mutável + LS)     │
└───────────────┬──────────────┘  └────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────────────────────▼──────────────┐
│ Domínio (funções puras, testáveis)                          │
│ catalog, fuzzySearch, titleFilters, titleRelations,         │
│ recommendScoring, discoverSearch, seasonArt, logoPicker,    │
│ imageNavigation, autoRotate, affinityMemory                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Infraestrutura                                              │
│ api.js, auth.js, lists.js, cache.js, supabase.js,           │
│ trendingApi.js                                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JWT
┌──────────────────────────────▼──────────────────────────────┐
│ Backend                                                     │
│ Supabase Auth + Postgres (RLS) + Edge Functions             │
│ clever-endpoint → TMDb · fanart-logo → Fanart.tv            │
└─────────────────────────────────────────────────────────────┘
```

### Regra de dependência

- `src/lib/` **não importa** `src/components/`, `src/pages/` nem `src/main.js`.
- Componentes e páginas podem importar `src/lib/`.
- `main.js` é o único que conhece todos os módulos e liga callbacks entre eles.
- `dom.js` é a única central de referências de elementos; ainda assim, `main.js`
  usa `document.getElementById` como fallback.
- `supabase.js` é o único ponto que lê as variáveis `VITE_SUPABASE_*`.

---

## Sequência de inicialização

O boot é top-down, sem `DOMContentLoaded` explícito: o script é um módulo
carregado no fim do `body` e executa depois do HTML.

1. `index.html` carrega `/src/main.js` como módulo.
2. `main.js` importa Supabase, módulos de domínio, componentes e páginas.
3. `setupConfirmModal()` prepara o modal de confirmação.
4. `setupSearchPage({ onOpenTitle })` prepara a aba Pesquisar **antes** do
   `checkSession`, para que `render()` já possa usar `searchPageApi`.
5. `setAuthMode('login')` monta o formulário no modo login.
6. `checkSession()`:
   - lê a sessão (`getCurrentSession`);
   - se existir, esconde a tela de auth, carrega o usuário, renderiza o menu de
     perfil, garante a aba inicial e chama `loadItems()`;
   - se não existir, mostra a tela de auth.
7. `loadItems()` busca itens + listas no Supabase, grava em `state.items`, chama
   `loadUserLists()`, `render()` e, se a URL tiver `#/titulo/:id`, abre a página
   do título.
8. `loadUserLists()` busca `user_lists` e renderiza a navbar.
10. `render()` decide qual tela mostrar conforme `state.currentTab`.

> **Não há `onAuthStateChange`.** O ciclo de sessão é dirigido por
> `checkSession()` após login, cadastro e logout. Uma expiração de token em
> segundo plano não redesenha a UI sozinha.

---

## Fluxo de leitura do catálogo

```text
Supabase (items + item_lists + user_lists)
        │  select com join aninhado, ORDER BY data_criacao DESC
        ▼
fetchItemsFromSupabase()
        │  snake_case → camelCase
        ▼
state.items  ──►  render()  ──►  cards / home / filtros
```

O `select` é:

```js
.from('items')
.select(`
  *,
  item_lists (
    list_id,
    user_lists ( id, nome, is_system )
  )
`)
.eq('user_id', user.id)
.order('data_criacao', { ascending: false })
```

O mapeamento para o modelo JS está em [04 — Modelos de dados](04-modelos-de-dados.md).

---

## Fluxo de escrita

Toda escrita passa por `main.js` e volta para o Supabase; não há update otimista
sistemático.

```text
Interação (card, página do título, modal, navbar)
        │ callbacks
        ▼
addItemToSupabase / updateItemInSupabase / deleteItemFromSupabase
        │
        ▼
Supabase (items)  ──►  retorno normalizado  ──►  state.items
        │
        ▼
loadItems() ou atualização local + render()
```

### Adicionar

- `addItemToSupabase` monta o registro snake_case, insere e normaliza o retorno.
- `23505` (unique violation) vira erro amigável “Este título já existe no seu
  catálogo.”.
- A página do título, ao criar um preview, também cria as relações em
  `item_lists` e atualiza `state.items`.

### Atualizar

- `updateItemInSupabase` só envia chaves presentes em `updates`.
- `totalEpisodios` → `total_episodios`; `seasonEpisodesMap` →
  `season_episodes_map`; `dataCriacao` → `data_criacao`.
- O trigger `update_items_updated_at` atualiza `data_atualizacao` no banco.

### Excluir

- `deleteItemFromSupabase` remove o item; `item_lists` cai por `ON DELETE CASCADE`.
- A UI pede confirmação via `confirmModal`.

### Listas

- `lists.js` encapsula CRUD de `user_lists` e `item_lists`.
- `addItemToList` trata `23505` como “já existe” e devolve `null`.
- `deleteList` remove relações antes da lista e recusa `is_system`.
- `updateListsOrder` dispara updates em paralelo e reporta falhas parciais.

---

## Fluxo de busca e descoberta

### Busca local (catálogo)

```text
input#searchInput (debounce 200 ms)
        ▼
render() → filterItems(state.items, { search, ... })
        ▼
fuzzySearch.matchScore / sortByRelevance
```

### Busca TMDb (aba Pesquisar)

```text
input#pesquisaInput
        ▼
searchPage (debounce próprio)
        ▼
searchTitles({ query, filters, page })
        ├── sem filtros avançados → search/tv
        └── com filtros          → discover/tv
        ▼
callTMDB → supabase.functions.invoke('clever-endpoint')
        ▼
normalizeTrendingItem + dedupe + filtros de qualidade
        ▼
cards de resultado → abrir página do título (preview ou item existente)
```

### Filtros avançados

- `emptySearchFilters()` define o estado inicial.
- `hasActiveFilters()` decide entre `search/tv` e `discover/tv`.
- `buildDiscoverParams()` traduz o estado da UI para query params do TMDb.
- Texto e filtros são aplicados juntos: o texto vira filtro local sobre a página.

---

## Fluxo da home

```text
render() com currentTab === 'home'
        ▼
renderHome(container, { user, items, callbacks })
        ├── renderHomeBase (template + saudação)
        ├── renderHomeContinue (síncrono, estado.items)
        ├── renderHomeFavorites (síncrono)
        ├── loadAndRenderCalendar (TMDb)
        ├── setupRoulette (TMDb)
        ├── loadAndRenderAbandoned (síncrono)
        ├── setupAffinityDiscovery (TMDb)
        ├── loadAndRenderUpcoming (TMDb)
        ├── setupYearPicker + loadAndRenderByYear (TMDb)
        ├── loadAndRenderTrending (TMDb)
        ├── loadAndRenderAffinityRails (TMDb)
        └── loadAndRenderCategories (TMDb)
```

As seções assíncronas são disparadas em paralelo e preenchem seu próprio
container. O botão de atualizar de cada seção chama o loader com `{ fresh: true }`,
que ignora a leitura do cache e regrava a resposta.

O detalhamento das regras de cada seção está em
[05 — Lógica de negócio](05-logica-de-negocio.md#11-home-regras-por-seção).

---

## Fluxo da página do título

```text
Clique em card / resultado de busca
        ▼
history.pushState({ titleId }, '', '#/titulo/<id>')
        ▼
showTitlePage(item, #titlePage)
        ├── esconde home/grid/search/main-header
        ├── renderiza HUD, backdrop, logo, steppers, listas, tier
        ├── busca detalhes/temporadas no TMDb
        └── liga eventos de salvar/remover/adicionar
```

- `setupTitlePage(callbacks)` recebe as operações de CRUD e de listas.
- A página mantém estado local (`curTemp`, `curEp`, `newStatus`, `newTier`) e só
  persiste ao salvar.
- `onBack` limpa o hash, esconde a página e chama `render()`.
- `popstate` reabre a página se o hash voltar a `#/titulo/:id`.
- Existe também o hash de preview `#/titulo/preview-<tmdbId>`; ele não é
  resolvido pelo `popstate` porque o item ainda não está em `state.items`.

---

## Estados de UI

O app usa três padrões recorrentes:

| Estado | Representação |
|---|---|
| Carregando | `form-loading` com spinner; esqueleto de cards na home |
| Vazio | `.empty-state` com ícone e mensagem |
| Erro | `showErrorToast` / `showToast`; mensagens de auth em `#authMessage` |

Não há boundary global de erro: cada loader trata o próprio `catch` e mantém a
seção vazia ou com mensagem.

---

## Decisões arquiteturais e trade-offs

| Decisão | Motivo | Consequência |
|---|---|---|
| Sem framework | Simplicidade e bundle pequeno; o app nasceu como página única | Estado e render manuais; `main.js` cresce |
| HTML estático | Componentes previsíveis e acessíveis no HTML | Muitos IDs e acoplamento com `dom.js` |
| Funções puras em `src/lib/` | Testabilidade sem DOM | Alguns módulos misturam domínio e infra (ex.: `trendingApi` chama API) |
| Estado global mutável | Simples para um único usuário | Difícil rastrear quem alterou; sem reatividade |
| Supabase como backend | Auth + RLS + Postgres sem servidor próprio | Regras críticas dependem de políticas SQL |
| Edge Functions como proxy | Esconde chaves e limita endpoints | Latência extra e allow-list precisa acompanhar o produto |
| Cache em memória + LS | Reduz chamadas caras ao TMDb | Invalidação manual por prefixo; dados podem ficar até 1 h |
| Hash routing mínimo | Abrir título compartilhável sem roteador | Só a página do título tem rota; abas não são deep-linkable |

---

## Onde a evolução vai tocar

1. **Shell e layout:** `index.html` + `style.css`, com componentes declarativos.
2. **Orquestração:** `main.js` → camada de aplicação/estado, com casos de uso
   separados de DOM.
3. **Páginas:** `homePage.js` e `titlePage.js` → componentes com props/eventos
   explícitos, sem estilo inline.
4. **Infra:** `api.js`, `lists.js`, `auth.js` → contratos tipados e tratamento de
   erro uniforme.
5. **Domínio:** `src/lib/` → preservar e, se possível, portar quase sem mudanças.

O inventário de dívidas está em
[10 — Dívida técnica](10-divida-tecnica-e-refatoracao.md).
