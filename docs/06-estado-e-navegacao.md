# 06 — Estado e navegação

## Estado global

`src/lib/state.js` exporta um objeto mutável único:

```js
export const state = {
  items: [],              // catálogo normalizado
  currentTab: 'home',     // home | all | planejado | pesquisa | list
  currentListId: null,    // id da lista aberta
  currentUser: null,      // usuário do Supabase Auth
  userLists: [],          // user_lists do usuário
  listsSortable: null,    // instância do SortableJS
  groupingActive: false,  // agrupar grade por tier
  showProgressBar: true,  // preferência de UI
  theme: 'system'         // system | dark | light
};
```

### Leitura inicial

| Campo | Origem | Fallback |
|---|---|---|
| `currentTab` | `localStorage.activeTab` | `home`; valor inválido → `home` |
| `currentListId` | `localStorage.activeListId` | `null` |
| `groupingActive` | `localStorage.groupingActive === 'true'` | `false` |
| `showProgressBar` | `localStorage.showProgressBar !== 'false'` | `true` |
| `theme` | `localStorage.theme` válido | `system` |

### Escrita

- `persistNavState()` grava `activeTab` e `activeListId`.
- Preferências (`showProgressBar`, `theme`) são gravadas em `main.js`, não em
  `state.js`.
- `groupingActive` é gravado no toggle, mas com a chave errada
  (`state.groupingActive`) — ver dívida técnica.

### O que **não** fica no estado global

- Filtros de status/tier/ano/idade/busca: vivem no valor dos `<select>`/`<input>`
  do DOM e são lidos a cada `render()`.
- Ordenação: vive em `#sortOrder`.
- Estado da página do título: closure local em `titlePage.js`
  (`curTemp`, `curEp`, `newStatus`, `newTier`).
- Estado da busca avançada: closure de `searchPage.js`.
- Cache e memória de afinidade: módulos próprios.

---

## Abas

| Aba (`currentTab`) | Tela | Conteúdo | Observações |
|---|---|---|---|
| `home` | `#homeSection` | Seções da home | Header principal escondido |
| `all` | `#gridSection` | Catálogo completo (exceto planejados) | Título “Catálogo” |
| `planejado` | `#gridSection` | Só `status === 'planejado'` | Título “Próximos”; sem tier/agrupamento |
| `pesquisa` | `#searchView` | Busca TMDb + filtros avançados | Header “Pesquisar” |
| `list` | `#gridSection` | Itens da lista `currentListId` | Título = nome da lista |

### Regras de navegação

- `setActiveTab(tab, listId)` em `main.js`:
  1. fecha a página do título, se aberta (e limpa o hash);
  2. fecha o modal de detalhes e o de correção;
  3. atualiza `state.currentTab` / `currentListId`;
  4. persiste;
  5. atualiza a navbar;
  6. chama `render()`.
- Clicar em uma lista define `currentTab = 'list'` e `currentListId`.
- A aba Próximos é uma **aba**, não uma lista: `currentListId = null`.
- A lista de sistema “Próximos” existe no banco, mas a navegação usa o status.

### Matriz de visibilidade no `render()`

| Elemento | home | all/list | planejado | pesquisa |
|---|---|---|---|---|
| `#homeSection` | visível | oculto | oculto | oculto |
| `#gridSection` | oculto | visível | visível | oculto |
| `#searchView` | oculto | oculto | oculto | visível |
| `.main-header` | oculto | visível | visível | visível |
| busca local | oculta | visível | visível | oculta |
| busca TMDb | oculta | oculta | oculta | visível |
| filtros de status/tier | ocultos | visíveis | ocultos | ocultos |
| filtros de busca | ocultos | ocultos | ocultos | visíveis |
| agrupamento | oculto | visível | oculto | oculto |

---

## Roteamento

Não há roteador. A navegação principal é estado em memória + persistência.

### Rota do título

- Abrir: `history.pushState({ titleId }, '', '#/titulo/<id>')`.
- Fechar: `history.pushState(null, '', location.pathname + location.search)`.
- `popstate`: se o hash for `#/titulo/:id`, procura o item em `state.items` e
  reabre; senão esconde a página e chama `render()`.
- Abertura direta: `loadItems()` verifica o hash depois de carregar o catálogo;
  há também um `setTimeout(500)` no fim do módulo para o caso de o catálogo ainda
  não estar pronto.

### Limitações

- Abas não são deep-linkable: só o título tem URL.
- `#/titulo/preview-<tmdbId>` é usado para preview de busca, mas o `popstate` não
  resolve esse id (não está em `state.items`).
- Voltar/avançar do navegador só restaura a página do título; não restaura abas,
  filtros ou scroll.

### Preview

Quando o usuário abre um resultado da busca que ainda não está no catálogo:

1. `openTitlePageForSearch` cria um item em memória com `_isPreview = true`.
2. O hash vira `#/titulo/preview-<tmdbId>`.
3. A página mostra o botão “Adicionar” em vez de “Salvar”.
4. Ao adicionar, o item real é criado e a página recarrega no modo catálogo.

---

## Eventos e fluxo de render

### Render da grade

`render()` é a função central. Ela:

1. ajusta a visibilidade de toolbars/headers;
2. decide a tela pela aba;
3. lê filtros do DOM;
4. filtra e ordena;
5. enriquece ano/idade quando necessário (assíncrono);
6. monta os cards em `DocumentFragment`;
7. aplica agrupamento por tier quando ativo;
8. atualiza labels e contadores.

### Proteção contra render obsoleto

- `renderSeq` é incrementado a cada render que faz enriquecimento assíncrono.
- Se um render mais novo começou, o antigo aborta antes de pintar.

### Debounce da busca local

- `input#searchInput` → `setTimeout(render, 200)`.

### Eventos globais

| Evento | Efeito |
|---|---|
| `popstate` | Abre/fecha página do título |
| clique fora | Fecha dropdowns (perfil, listas, filtros) |
| `Escape` | Fecha dropdown/modal; prioridade para edição de nome |
| `change` nos filtros | `render()` |
| `change` no tema | Aplica e persiste |
| `change` na barra de progresso | Alterna classe no `<body>` |

---

## Navbar e listas

### Estrutura

- Navbar fixa no topo (`#topNavbar`).
- Itens: Início, Catálogo, Próximos, Pesquisar, listas do usuário, botão de
  criar lista, perfil.
- Listas são arrastáveis (SortableJS) e a ordem é persistida.

### Criação/renomeação

- Criar: `promptCreateList()` → `createList` → recarrega listas → renderiza.
- Renomear: edição inline → `renameList`.
- Excluir: confirmação → `deleteList`.
- Listas de sistema não têm ação de excluir.

### Estado ativo

`updateActiveNav` marca `.active` quando:

- `data-tab === currentTab` e não há lista; ou
- `data-list-id === currentListId`.

O botão de listas fica ativo quando `currentTab === 'list'` e há lista.

---

## Modais

| Modal | Aberto por | Fecha por | Foco |
|---|---|---|---|
| `#confirmModal` | `showConfirm` | OK/Cancelar/X/Escape/backdrop | Trap + retorno ao elemento anterior |
| `#episodesModal` | Página do título | X/Escape/backdrop | Trap |
| `#titleInfoModal` | Página do título | X/Escape/backdrop | Trap |
| `#relinkModal` | Página do título | X/Escape/backdrop | — |
| `#detailListModal` | Página do título | X/backdrop | — |

### Contrato de confirmação

`showConfirm(message, title)` devolve uma `Promise<boolean>`:

- resolve `true` no OK;
- resolve `false` em qualquer cancelamento;
- sem modal no DOM, cai para `window.confirm`.

### Lock de tela

`lockScreen()` adiciona `modal-open` e `overflow: hidden` em `body`/`html`.
`unlockScreen()` só restaura se não houver nenhum `.modal-overlay.active`.

---

## Tema

### Três estados

- `system`: segue `prefers-color-scheme`.
- `dark`: força escuro.
- `light`: força claro.

### Aplicação

- `resolveTheme()` decide o valor efetivo.
- `document.documentElement.dataset.theme` recebe `dark` ou `light`.
- O CSS usa `[data-theme="light"]` para sobrescrever tokens.
- O favicon troca entre `favicon-32-dark.svg` e `favicon-32-light.svg`.
- Um script no `<head>` pinta o tema antes do CSS para evitar flash.

### Persistência

- `localStorage.theme`.
- Falha de escrita não quebra a sessão; vale só até recarregar.

---

## Sessão

### Login

1. `handleLogin` valida campos.
2. `loginWithPassword`.
3. `checkSession()` recarrega usuário, itens e listas.

### Cadastro

1. `validateSignup` valida nome, e-mail, senha e confirmação.
2. `signUpWithPassword` grava `full_name`.
3. `checkSession()`.
4. Se o Supabase exigir confirmação de e-mail, a sessão pode vir nula.

### Logout

1. `supabase.auth.signOut()`.
2. `cacheClear()`.
3. `setAuthMode('login')`.
4. `checkSession()`.

### Recuperação de senha

Não implementada no app real.

### Expiração

Não há listener de `onAuthStateChange`; uma sessão expirada só é percebida na
próxima operação que falhar.

---

## Preferências de UI

| Preferência | Chave | Padrão | Efeito |
|---|---|---|---|
| Barra de progresso | `showProgressBar` | mostrar | Classe `is-progress-bar-hidden` no `<body>` |
| Tema | `theme` | `system` | `data-theme` no `<html>` |
| Agrupamento por tier | `groupingActive` | desligado | Agrupa a grade; **bug de chave** |
| Aba ativa | `activeTab` | `home` | Restaura navegação |
| Lista ativa | `activeListId` | — | Restaura lista |

---

## Concorrência e cancelamento

| Mecanismo | Onde | Para quê |
|---|---|---|
| `renderSeq` | `main.js` | Descartar render antigo após enriquecimento assíncrono |
| `tvDetailsInflight` | `api.js` | Deduplicar chamadas simultâneas do mesmo `tv/{id}` |
| Fila com concorrência 4 | `api.js` | Limitar detalhes simultâneos |
| Concorrência 5 | `trendingApi.getNewEpisodes` | Limitar detalhes no calendário |
| `AbortController` | — | **Não usado**; requisições não são canceladas |
| Debounce | busca local, busca TMDb, cache | Reduzir trabalho |

---

## Armadilhas conhecidas

1. **Chave de agrupamento divergente.** O toggle grava `state.groupingActive` em
   vez de `groupingActive`; a preferência não sobrevive ao refresh.
2. **Filtros no DOM.** Como não estão no estado, qualquer refatoração de
   componente precisa extrair esses valores de forma explícita.
3. **`popstate` com catálogo vazio.** Se o usuário voltar para um título antes de
   `loadItems()` terminar, a página não abre.
4. **Preview no histórico.** `#/titulo/preview-<id>` não é resolvido no
   `popstate`.
5. **Scroll não é restaurado.** Trocar de aba e voltar recomeça do topo.
6. **Foco em modais.** `trapFocus` usa `offsetParent !== null`; elementos com
   `position: fixed` podem ter `offsetParent` nulo e ficar fora do trap.
