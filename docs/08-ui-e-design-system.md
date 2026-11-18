# 08 — UI e design system

Este documento descreve **como a interface é montada hoje**: o shell estático de
`index.html`, os tokens e temas de `style.css`, os componentes escritos à mão em
`src/components/` e `src/pages/`, e os contratos visuais que os testes seguram.

A UI não usa framework, roteador nem componentes declarativos. Ela é:

```text
index.html  →  estrutura fixa (regiões, modais, IDs)
style.css   →  design system (tokens, temas, layout, componentes)
src/*.js    →  markup dinâmico (template strings) + eventos + estado
```

Quem mexer na interface precisa decidir o que **preservar** (tokens, anatomia do
card, temas) e o que **substituir** com cuidado (shell estático, IDs globais,
`innerHTML`, navegação por `display: none`).

---

## 1. Camadas da interface

| Camada | Arquivo | Papel | Acoplamento |
|---|---|---|---|
| Shell | `index.html` | Regiões fixas, formulário de auth, navbar, toolbar, modais, toast | IDs globais |
| Design system | `style.css` | Tokens, temas, grid, card, navbar, modais, title page, layout | Classes e IDs |
| Componentes | `src/components/*.js` | Markup de card, home, busca, modais, helpers | `dom.js`, estado global |
| Página | `src/pages/titlePage.js` | Página do título, HUD, steppers, listas, tier | Muito estilo inline |
| Orquestração | `src/main.js` | Auth, perfil, abas, render, eventos, CRUD | Todos os anteriores |
| Referências | `src/lib/dom.js` | Mapa parcial de elementos | `getElementById` |

Não existe camada de componentes reutilizáveis no sentido de framework: o que é
reutilizado é o **markup** (`cardMarkup`) e as **classes CSS**. O resto é
orquestração direta de DOM.

---

## 2. Shell (`index.html`)

### 2.1 Ordem das regiões

| Ordem | Região | Elemento/ID | Visibilidade inicial |
|---|---|---|---|
| 1 | Login/cadastro | `#authContainer` | `display: none` até não haver sessão |
| 2 | Navbar fixa | `#topNavbar` | Sempre visível após login |
| 3 | Conteúdo | `main.main-content` | Sempre |
| 3.1 | Home | `#homeSection` | `display: none` fora da aba Home |
| 3.2 | Página do título | `#titlePage` | `display: none` até abrir um título |
| 3.3 | Cabeçalho do catálogo | `.main-header` | Visível em catálogo/listas |
| 3.4 | Filtros avançados | `#searchFiltersPanel` | `hidden` até abrir |
| 3.5 | Busca TMDb | `#searchView` | `display: none` fora da aba Pesquisar |
| 3.6 | Grade | `#gridSection` / `#grid` | Visível em catálogo/listas |
| 4 | Modais | `#detailListModal`, `#episodesModal`, `#titleInfoModal`, `#relinkModal`, `#confirmModal` | Fechados (`.modal-overlay` sem `.active`) |
| 5 | Toast | `#toast` | Fora da tela até `.show` |
| 6 | Script | `/src/main.js` | Módulo ES |

### 2.2 Decisões do shell que precisam sobreviver à refatoração

- **Script anti-flash de tema** no `<head>`: lê `localStorage.theme` e escreve
  `document.documentElement.dataset.theme` **antes** do CSS. Sem ele, o app abre
  escuro e “clareia” depois.
- **`color-scheme`** acompanha o tema para que scrollbar, `<select>` e controles
  nativos nasçam no tom certo.
- **Selects ocultos** (`#filterStatus`, `#filterTier`, `#filterYear`,
  `#filterAge`, `#sortOrder`) são a **fonte de verdade** dos filtros. O painel
  visual (`#filtersMenu`) apenas escreve neles. Isso permite trocar a UI de
  filtros sem mexer na lógica de `render()`.
- **`hidden` + `.hidden`**: o atributo `hidden` esconde, mas algumas regras
  declaram `display` e vencem o atributo; por isso existe `.hidden { display:
  none !important; }` e, em alguns casos, `style="display:none"` inline.
- **CSP** restringe origens: fontes do Google, Font Awesome no CDN, imagens de
  `image.tmdb.org`, `placehold.co`, `flagcdn.com`, `assets.fanart.tv` e conexões
  com `*.supabase.co` e `pt.wikipedia.org`. Qualquer nova origem (por exemplo,
  um CDN de imagens ou um serviço de analytics) exige atualizar a CSP.
- **Import map** resolve `@supabase/supabase-js` e `sortablejs` por CDN; o
  bundle não os empacota. Um refactor com bundler pode remover o import map.
- **Sem camada de instalação**: o app é desktop-only, então não tem
  `manifest.json`, ícone de app, meta tags de iOS nem service worker. Não é
  instalável e não funciona offline — isso é decisão, não pendência. A
  experiência mobile é outro projeto.

### 2.3 Mapa de IDs

Os IDs são o contrato entre HTML, `dom.js` e `main.js`. Ao migrar para
componentes, cada componente deve **possuir** seus elementos; os IDs podem
desaparecer, mas os testes que os leem precisam ser atualizados no mesmo commit.

#### Autenticação

| ID | Papel |
|---|---|
| `authContainer` | Overlay de login/cadastro |
| `authForm` | Formulário único, alterna entre os modos |
| `authTitle`, `authSubtitle` | Título e subtítulo do modo |
| `authName`, `authEmail`, `authPassword`, `authPasswordConfirm` | Campos |
| `authNameError`, `authEmailError`, `authPasswordError`, `authPasswordConfirmError` | Erros por campo (`role="alert"`) |
| `authRevealBtn` | Mostrar/ocultar senha (`aria-pressed`) |
| `authStrength` | Barra de força da senha (só cadastro) |
| `authSubmitBtn`, `authSwitchBtn`, `authSwitchText`, `authMessage` | Ação, troca de modo e mensagem (`aria-live`) |

#### Navbar e perfil

| ID | Papel |
|---|---|
| `topNavbar`, `navbarNav` | Barra e navegação populada por JS |
| `profileToggle`, `profileDropdown` | Abre/fecha o menu do perfil |
| `profileName`, `profileAvatar`, `profileHeadName`, `profileEmailFull` | Identidade no menu |
| `profileNameView`, `profileNameViewText`, `profileNameEdit` | Nome em modo leitura |
| `profileNameRow`, `profileNameInput`, `profileNameSave`, `profileNameCancel` | Nome em modo edição |
| `profileNameError`, `profileSince` | Erro e data de entrada |
| `showProgressBar` | Preferência de exibição da barra |
| `logoutBtn` | Sair |

#### Cabeçalho, filtros e busca

| ID | Papel |
|---|---|
| `headerListName`, `headerSubtitle` | Título e contagem da tela atual |
| `toolbarSearchLocal`, `searchInput` | Busca local no catálogo |
| `toolbarSearchTmdb`, `pesquisaInput` | Busca no TMDb |
| `filtersToggleBtn`, `filtersMenu`, `filtersCount` | Botão, painel e selo de filtros ativos |
| `filtersStatus`, `filtersTier`, `filtersYear`, `filtersAge`, `filtersList` | Seções do painel |
| `filtersListOptions`, `filtersClearBtn` | Coleções e limpeza |
| `sortToggleBtn`, `sortMenu` | Ordenação |
| `groupToggle` | Agrupar por tier |
| `advFiltersToggleBtn`, `advFiltersToolbarCount` | Filtros avançados da busca |
| `searchFiltersPanel`, `advFiltersPanel` | Painel expansível |
| `advGenres`, `advCountries` | Chips de gênero/país |
| `advCertification`, `advRuntime`, `advLanguage`, `advStatus`, `advType`, `advSort` | Selects avançados |
| `advYearFrom`, `advYearTo`, `advClear` | Ano e limpeza |
| `searchView`, `pesquisaSummary`, `pesquisaGrid`, `pesquisaEmpty`, `pesquisaLoading`, `pesquisaMore`, `pesquisaMoreBtn` | Resultado, estados e paginação |

#### Conteúdo e modais

| ID | Papel |
|---|---|
| `homeSection`, `titlePage`, `gridSection`, `grid` | Regiões de conteúdo |
| `detailListModal`, `detailListModalTitle`, `detailListModalClose`, `detailListCheckboxes` | Seleção de listas |
| `episodesModal`, `episodesTitle`, `episodesClose`, `episodesLoading`, `episodesContent` | Episódios |
| `titleInfoModal`, `titleInfoTitle`, `titleInfoClose`, `titleInfoLogoWrap`, `titleInfoLogoImg`, `titleInfoLoading`, `titleInfoContent` | Ficha do TMDb |
| `relinkModal`, `relinkTitle`, `relinkClose`, `relinkSearch`, `relinkLoading`, `relinkResults` | Corrigir vínculo |
| `confirmModal`, `confirmTitle`, `confirmClose`, `confirmMessage`, `confirmCancel`, `confirmOk` | Confirmação |
| `toast` | Aviso global (`role="alert"`, `aria-live="assertive"`) |

> `src/lib/dom.js` cobre apenas parte desses IDs. As seções “Modals”, “Lists”,
> “Add modal fields”, “Stepper extras” e “Toast & Form” estão vazias ou
> incompletas. O restante é buscado direto em `main.js`, `titlePage.js` e nos
> componentes. Não trate `dom.js` como inventário completo.

---

## 3. Tokens

Todos os valores de `:root` em `style.css`. O tema escuro é a base; o claro é
override em `[data-theme="light"]`.

### 3.1 Cor

| Papel | Token | Escuro | Claro |
|---|---|---|---|
| Fundo | `--bg-primary` | `#08080b` | `#F4F1EA` |
| Superfície | `--bg-surface` | `#0D0D10` | `#FFFFFF` |
| Elevado | `--bg-elevated` | `#121216` | `#FFFFFF` |
| Hover elevado | `--bg-elevated-hover` | `#18181D` | `#EFEBE1` |
| Poço | `--bg-secondary` / `--bg-well` | `#09090C` / `#0C0D0E` | `#ECE7DC` / `#E4DED1` |
| Hover | `--bg-hover` | `#141418` | `#E6E0D3` |
| Texto | `--text-primary` | `#F2EDE3` | `#1B1915` |
| Texto secundário | `--text-secondary` | `#AEAFB2` | `#55524A` |
| Texto muted | `--text-muted` | `#838589` | `#8A8478` |
| Acento | `--accent` | `#E5D8BF` | `#7A663B` |
| Tinta do acento | `--accent-ink` | `#08080b` | `#F4F1EA` |
| Contorno | `--border-outline` | `#16161A` | `#D4D0C8` |
| Perigo | `--danger` | `#ef4444` | `#ef4444` |
| Sucesso | `--success` | `#34d399` | `#34d399` |
| Aviso | `--warning` | `#fbbf24` | `#fbbf24` |

Regras de cor:

- **Bordas desligadas por padrão**: `--border` e `--border-strong` são
  `transparent`. A separação vem do tom; `--border-outline` só aparece onde dois
  blocos do mesmo tom se tocam.
- **Acento único**: areia no escuro, areia escurecida no claro. Não há segunda
  cor de marca. Cores de tier são a exceção saturada e só aparecem em selos,
  grupos e opções de tier — nunca como fundo de área grande.
- **Filete "nascer do sol"**: o único gradiente do sistema vive **apenas nos
  assets de marca** (icon, favicon, lockups) — linear horizontal monocromatica, areia `#F2E9D5` -> bronze `#6E5F3C`. Não há gradiente na interface: o item
  ativo do menu (`.nav-item.active::after`) e as tabs usam `--accent` sólido.
  O gradiente nunca aparece como fill, borda ou sombra.
- **Tiers**: `S+ #FFD700`, `S #34d399`, `A #3b82f6`, `B #f99e16`, `C hsl(17 92%
  50%)`, `D #ef4444`, cada um com tinta própria (`--tier-*-ink`) para contraste.
- **Sem halo**: o projeto rejeita `box-shadow` colorido/glow no acento. As
  sombras são pretas e discretas (`--shadow`, `--shadow-lg`). O teste
  `glow.test.js` protege isso.

### 3.2 Espaçamento e medidas

| Token | Valor | Uso |
|---|---|---|
| `--page-pad-x` | `32px` (16px ≤900, 12px ≤480) | Respiro lateral da página |
| `--page-pad-top` | `120px` (130px ≤700, 120px ≤480) | Folga sob a navbar fixa |
| `--page-pad-bottom` | `28px` (16px ≤900, 12px ≤480) | Fim da página |
| `--home-space-section` | `32px` (24px ≤768, 20px ≤480) | Entre seções da home |
| `--home-space-block` | `20px` | Título → trilho |
| `--home-space-item` | `12px` | Entre cards (trilhos e grade) |
| `--home-space-inner` | `12px` | Dentro do card |
| `--home-card-w` | `160px` | Largura padrão do card (trilhos e grade) |
| `--home-panel-pad` | `18px 20px` (14px ≤480) | Painéis da home |

A largura do card da home é **conhecida pelo JavaScript**: `getFullWidthCount` e
`getPickCount`, em `trendingApi.js`, repetem os mesmos degraus para calcular
“quantos cards cabem”. Mudar o token sem mudar o JS (ou vice-versa) quebra a
contagem e o teste `homeLayout.test.js`.

### 3.3 Raios, sombras e movimento

| Token | Valor |
|---|---|
| `--radius` | `10px` |
| `--radius-sm` | `6px` |
| `--radius-xs` | `6px` |
| `--radius-pill` | `999px` |
| `--shadow` | `0 4px 16px rgba(0,0,0,.4)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,.5)` |
| `--transition` | `0.2s ease` |
| `--transition-fast` | `0.3s cubic-bezier(.4,0,.2,1)` |
| `--transition-smooth` | `0.4s cubic-bezier(.4,0,.2,1)` |

O tema claro reduz as sombras (`.10` e `.14` de opacidade) para não pesar sobre
creme.

### 3.4 Alvos de clique e foco

| Token | Valor | Observação |
|---|---|---|
| `--touch-target` | `44px` | Mínimo acessível global |
| `--tap-btn` | `36px` | Botão de toolbar |
| `--tap-icon` | `28px` | Ícone compacto |
| `--focus-ring` | `0 0 0 2px var(--accent)` | Anel sem offset |

### 3.5 Z-index

| Camada | Valor |
|---|---|
| Conteúdo do title page | `20` |
| Navbar | `100` |
| Dropdowns da navbar | `110` |
| Modal | `200` |
| Login | `300` |
| Toast | `400` |
| Menu de filtros/ordenação | `1200` |

Exceção: `#detailListModal` é movido para o `<body>` e recebe
`style.zIndex = '300'` inline em `titlePage.js`, para ficar acima dos demais
modais — o mesmo nível do login, sem token compartilhado.

O menu de filtros usa `1200` para ficar acima de modais e da navbar. É um valor
fora da escala; um refactor deve substituir por uma escala nomeada
(`--z-navbar`, `--z-modal`, `--z-toast`).

---

## 4. Temas

### 4.1 Mecânica

1. O script inline do `<head>` resolve `system | dark | light` e escreve
   `data-theme` no `<html>`.
2. `:root` contém o tema escuro completo.
3. `[data-theme="light"]` sobrescreve **somente tokens**.
4. `main.js` (`applyTheme`) troca o atributo ao vivo, persiste em
   `localStorage.theme` e reflete o rádio do perfil.
5. Se a preferência é `system`, um `matchMedia('(prefers-color-scheme: light)')`
   mantém o app sincronizado com o SO enquanto a página está aberta.

Consequência importante: **quase nenhum componente tem regra `[data-theme]`
própria**. Quem consome `var(--...)` troca sozinho. As exceções são a marca e os
logos do TMDb.

### 4.2 Marca e logos

- `assets/logo/logotype-dark.svg` é areia e some no claro; no tema claro,
  `[data-theme="light"] .navbar-brand-logo { content: url(logotype-light.svg) }`
  troca a imagem renderizada. O mesmo vale para `stacked-light.svg` no login.
- Logos do TMDb chegam como PNG branco com transparência. No escuro, o branco
  aparece sozinho. No claro, recebem uma cadeia de `drop-shadow` cinza para
  ganhar contorno sem virar halo.

### 4.3 O que o teste de tema garante

`tests/theme.test.js` lê `style.css`, `index.html` e `main.js` e verifica, entre
outras coisas:

- o claro é override de token, não uma regra nova por componente;
- a escolha do usuário é lida/gravada com a chave certa;
- a marca e os logos não somem no claro;
- `color-scheme` acompanha o tema.

---

## 5. Tipografia

### 5.1 Três famílias, três papéis

| Papel | Família | Token | Onde |
|---|---|---|---|
| Corpo, botões, rótulos, episódios | **Inter** | `--font-body` | Interface geral |
| Títulos, cabeçalhos | **Sora** | `--font-display` | `h1–h6`, títulos de seção, nome do título, modal |
| Dado técnico | **IBM Plex Mono** | `--font-mono` | Ano, `T1 · 5/8`, porcentagem, data, contagem, código |

O contrato é rígido: **mono não é decoração**. Ele existe para alinhar números em
coluna e distinguir metadado de prosa. `typography.test.js` verifica:

- as famílias carregadas no `<link>` do Google Fonts;
- os pesos realmente usados na folha;
- que seletores de texto corrido não declaram mono;
- que o mono aparece no card apenas onde é dado técnico.

### 5.2 Escala

| Token | Valor | Uso |
|---|---|---|
| `--fs-display` | `clamp(1.6rem, 4vw, 2.2rem)` | Saudação da home |
| `--fs-title` | `1rem` | Título de seção |
| `--fs-body` | `0.85rem` | Texto corrido, estado vazio |
| `--fs-meta` | `0.72rem` | Secundário, progresso, episódio |
| `--fs-btn` | `0.8rem` | Rótulo de botão |
| `--fs-label` | `0.72rem` | Rótulo maiúsculo com tracking |
| `--fs-min` | `0.75rem` (12px) | Piso absoluto |
| `--fs-min-comfort` | `0.875rem` (14px) | Piso confortável |

A escala da home foi fechada para acabar com 12 tamanhos ad-hoc. Ainda assim, o
title page legado usa valores como `0.62rem` e `0.68rem` (≈10–11px) em
metadados. **Não replique esses valores** no novo design system: use os tokens e
o piso de 12px.

### 5.3 Regras de composição

- Títulos usam Sora; o corpo nunca usa Sora.
- Metadado em mono usa caixa alta e `letter-spacing` (ex.: `0.05em` em
  rótulos).
- Texto sobre foto é branco nos dois temas (`--text-on-photo`), porque o overlay
  do card é sempre um gradiente preto.
- Rampa de texto fraco tem cinco degraus nomeados (`--text-faintest` …
  `--text-strong`), com par no tema claro. Não invente `rgba(255,255,255,α)`.

---

## 6. Layout

### 6.1 Sem breakpoints

O app é **desktop**. A folha tem um único `@media`, para
`prefers-reduced-motion`; não há mais degraus por largura de janela nem por
orientação. A navbar fica em uma linha em qualquer largura e o conteúdo usa
`--page-pad-x` fixo.

### 6.2 Navbar e altura do conteúdo

A navbar tem uma altura medida: **64px**. `--page-pad-top` é 120px — a altura da
navbar mais 56px de folga, para o conteúdo não começar debaixo dela.

### 6.3 Grade

```css
.grid { gap: var(--home-space-item); }
.grid-cols-8,
.search-view .grid-cols-8 {
  grid-template-columns: repeat(auto-fill, minmax(var(--home-card-w), 1fr));
}
```

A classe se chama `grid-cols-8`, mas **não são 8 colunas fixas**: é auto-fill com
mínimo de 160px, a mesma largura do trilho da home. O nome é histórico.

### 6.4 Home

A home tem uma escala própria (`--home-*`) e uma primitiva de trilho
(`.home-h-scroll`) usada por Continuar, Calendário, esqueleto e todas as faixas.
O trilho tem `scroll-snap`, máscara de fade nas bordas e esconde a scrollbar. O
esqueleto de carregamento usa **a mesma primitiva**, para a troca por cards não
mudar a área rolável nem fazer a página “pular”.

---

## 7. Componentes

### 7.1 Navbar

- Fixa no topo, fundo `--bg-primary`, sombra discreta.
- Marca à esquerda (só o glifo; o nome não acompanha a marca), navegação ao centro (populada por
  `renderNavbar()`), ações à direita.
- Abas: Home, Catálogo, Próximos, Pesquisar e listas do usuário.
- Item ativo: fundo transparente + barra de 2px (cantos em pílula) na base (não é cápsula cheia).
- Perfil: botão com avatar/nome, dropdown com identidade, edição de nome,
  preferência de barra de progresso, tema e sair.

### 7.2 Toolbar e filtros

- Contador e subtítulo à esquerda; busca e filtros à direita.
- **Um botão de filtros** abre um painel com seis seções: Status, Tier, Época,
  Faixa etária, Coleção e “Limpar filtros”. Ordenar e visualizar ficam em
  cápsulas separadas — não são filtros.
- Opções são pílulas; a ativa é sólida (`--accent` + `--accent-ink`).
- O selo `#filtersCount` mostra quantos filtros estão ativos.
- Em Próximos e Pesquisar, Status/Tier são desligados com
  `.filters-section--off`.
- A busca avançada tem painel próprio (`#searchFiltersPanel`), com chips de
  gênero/país, selects e intervalo de ano.

### 7.3 Card

Anatomia única em `cardMarkup` (`src/components/cards.js`):

```html
<div class="card">
  <div class="card-img">
    <img src="..." alt="..." loading="lazy" />
    <div class="tier-stamp tier-S">S</div>   <!-- opcional -->
    <h3 class="card-title" title="...">Nome</h3>
  </div>
  <div class="card-body">
    <div class="progress-wrap">
      <div class="progress-track"><div class="progress-bar" style="width:42%"></div></div>
      <span class="progress-pct">42%</span>
    </div>
  </div>
</div>
```

Regras:

- Pôster 2/3; o título mora **dentro** da imagem, sobre um overlay escuro.
- O corpo é só a barra de progresso. Quando a preferência esconde a barra, o
  corpo inteiro some; conteúdo próprio (episódio do calendário, data de “Em
  Breve”) sobrevive.
- Sem hover, o título continua acessível pelo `title` do markup e pelo teclado.
  No desktop, o hover revela o nome e o clique abre o card; não há mais
  revelação em dois toques. Teclado (Enter/Espaço) abre direto.
- `.card--rail` muda **apenas a largura** para o trilho da home. Raio, borda,
  superfície, hover, tipografia e barra continuam os mesmos.
- O card do calendário e o card da Roleta são exceções declaradas: mostram dados
  que nenhum outro card tem, mas herdam os mesmos tokens.
- Placeholder de pôster ausente é um só (`fa-film`), sem estilo inline.

### 7.4 Grade e agrupamento

- Grade `auto-fill` com gap de 12px e mínimo de 160px.
- Cabeçalhos de grupo por tier ocupam a linha inteira, com borda esquerda na cor
  do tier e contagem em mono.
- `groupToggle` liga/desliga o agrupamento; a preferência deveria persistir em
  `localStorage.groupingActive`, mas grava na chave errada
  (`state.groupingActive`) — ver `10-divida-tecnica-e-refatoracao.md`.

### 7.5 Home

Seções (11, na ordem de `renderHomeBase`): saudação, Continuar Assistindo,
Roleta, Episódios da Semana, Descubra por afinidade, Em Breve, Abandonados,
Destaques do ano, Em Alta, Seus Favoritos e Explorar por gênero.

Padrões:

- Cabeçalho de seção único: título + botão de atualizar. O wrapper existe no
  HTML de todas as seções; `setupSectionRefresh` só preenche o botão.
- Trilho único (`home-h-scroll`) com snap e máscara.
- Painéis (Roleta, Afinidade, Ano) têm caixa preenchida e largura de leitura
  limitada; não são trilhos.
- Estado vazio é explícito e textual; não se esconde a seção sem explicação,
  exceto quando o contrato da seção manda esconder.

### 7.6 Busca

- `#searchView` tem grid próprio e resumo (`#pesquisaSummary`).
- Estados: vazio (“Digite pelo menos 2 caracteres”), carregando e “Carregar
  mais”.
- O painel avançado expande abaixo do header.

### 7.7 Modais

Estrutura comum:

```html
<div class="modal-overlay" id="...">
  <div class="modal ...">
    <div class="modal-header">...</div>
    <div class="modal-body">...</div>
    <div class="modal-footer">...</div>  <!-- opcional -->
  </div>
</div>
```

- Abre com `.active` no overlay; o modal sobe de `translateY(20px)` para `0`.
- Overlay `rgba(0,0,0,.7)`, `z-index: 200`, `overscroll-behavior: contain`.
- `confirmModal` prende o foco, restaura o foco anterior e fecha com Escape.
  `episodesModal` e `titleInfoModal` usam `trapFocus`, mas **não** têm Escape
  global; `titlePage` e `relink` têm tratamento próprio.
- Modais largos usam `width: min(1200px, 96%)`; o corpo rola, o header não.

### 7.8 Página do título

Blocos:

1. **HUD**: voltar, logo/nome, metadados, tier.
2. **Layout**: sidebar de ações + coluna principal.
3. **Principal**: pôster com steppers, sinopse, episódio unificado, temporadas,
   elenco, equipe, links.
4. **Episódio**: temporada e episódio lado a lado; sinopse abaixo.
5. **Tokens compartilhados** de ghost, texto fraco, perigo e steppers.

> Esta é a área com mais estilo inline (71 ocorrências de `style=` em
> `titlePage.js`). O CSS já tem classes para quase tudo; a dívida é migrar o
> markup para elas.

### 7.9 Autenticação

- Overlay de tela cheia com gradiente radial, `z-index: 300`.
- Caixa de 380px, logo empilhado, formulário único.
- Modo login/cadastro controlado por `data-auth-only="signup"` e `setAuthMode`.
- Força de senha em 4 níveis (25/50/75/100%, vermelho/amarelo/areia/verde).
- Erros por campo com `role="alert"`; mensagem geral com `aria-live="polite"`.
- Botão de revelar senha com `aria-pressed`.

### 7.10 Feedback

- `showToast(msg)` → `#toast` com `.show`, `role="alert"`, 2,8s.
- `showErrorToast(userMessage, error)` → toast + `console.error`.
- Estado vazio: `.empty-state` com ícone e texto muted.
- Carregamento: spinner Font Awesome + texto; esqueleto na home.
- Erros de formulário: `.field-error` + `.invalid` no input.

---

## 8. Acessibilidade

### 8.1 O que já existe

- `:focus-visible` com contorno de 2px no acento e offset de 2px em botões,
  inputs, selects, links e `[tabindex]`.
- Alvo global de 44×44 para botões, links com classe de botão, inputs e selects.
- `aria-label` em botões icônicos, `aria-expanded` em toggles, `aria-haspopup`
  em menus, `aria-current="page"` na aba ativa e `aria-pressed` em
  favoritos/revelar senha.
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` nos modais.
- `aria-live` em mensagens, subtítulo e toast.
- `prefers-reduced-motion: reduce` zera animações e transições.
- Contraste do acento no claro resolvido por token (`#7A663B`).

### 8.2 Lacunas conhecidas

- Foco preso só em alguns modais; Escape não é global.
- `aria-live="polite"` na `#titlePage` inteira pode anunciar demais.
- Não há “pular para o conteúdo” nem landmarks completos (`main` existe;
  `nav` existe; falta hierarquia de headings consistente em todas as telas).
- O menu de perfil usa `role="menu"`? Não — usa botões comuns; o padrão de menu
  ARIA não é completo.

---

## 9. Movimento

- `fadeSlideUp` nos cards (`0.4s ease`), com atraso zero.
- Modais sobem 20px e o overlay faz fade em 0.3s.
- Dropdowns e menus usam transições curtas de cor/fundo.
- Toast entra/sai por `translateY(80px)` + opacity.
- `prefers-reduced-motion` desliga tudo.
- Não há animação de página/rota: a troca de aba é `display: none` + `render()`.

Um refactor deve manter o movimento **funcional** (feedback de abertura, entrada
de card) e remover o que for decorativo sem propósito.

---

## 10. Contratos visuais

Os testes que leem `style.css`/`index.html`/fontes são a rede de segurança do
design system. Eles não olham pixels; olham **regras e estrutura**:

| Suíte | Contrato |
|---|---|
| `typography.test.js` | Famílias carregadas, pesos reais, mono reservado a dado técnico |
| `cards.test.js` | Anatomia única do card; nenhuma segunda implementação |
| `homeLayout.test.js` | Tokens da home, trilho único, JS e CSS com a mesma medida, sem estilo inline |
| `glow.test.js` | Nenhum halo no acento; sombras legítimas intactas |
| `progressBar.test.js` | Preferência de barra: alvo, persistência e menu |
| `theme.test.js` | Claro como override de token; marca/logos; escolha do usuário |
| `stepperTint.test.js` | Steppers: somar verde, subtrair vermelho |
| `searchPage.test.js` | Estrutura da busca avançada; decisão de não mostrar nota |
| `upcoming.test.js` | Posição, carregamento e corpo do card de “Em Breve” |

Ao refatorar, **não apague esses testes para “destravar” o build**. Reescreva-os
para o novo contrato (por exemplo, um teste de componente que verifica a mesma
regra) e registre a mudança no `09-testes.md`.

---

## 11. O que preservar na evolução

1. **Tokens e temas** — a identidade quente, o acento areia, o claro por
   override, `color-scheme`, anti-flash.
2. **Tipografia em três papéis** — Inter/Sora/IBM Plex Mono, com mono só para
   dado técnico.
3. **Anatomia do card** — pôster 2/3, título sobre a imagem, barra no corpo,
   variante só de largura.
4. **Trilho único da home** — snap, máscara, mesma primitiva no esqueleto.
5. **Barra de progresso como preferência** — esconde o corpo inteiro, não só a
   porcentagem.
6. **Estados explícitos** — vazio, carregando, erro, “carregar mais”.
7. **Acessibilidade de base** — foco visível, alvos de 44px, ARIA e reduced
   motion.
8. **Interação de desktop** — hover revela o nome, clique abre, teclado
   equivalente.

## 12. O que substituir

| Hoje | Problema | Direção |
|---|---|---|
| Shell estático + `display:none` | Abas não são rotas; sem deep link/voltar | Rotas reais (`/`, `/catalogo`, `/titulo/:id`, `/listas/:id`) |
| IDs globais + `dom.js` parcial | Acoplamento e `ReferenceError` históricos | Refs por componente / query local |
| `innerHTML` com template strings | XSS depende de escape manual; difícil testar | Componentes declarativos ou DOM seguro |
| Estilo inline no title page | Difícil de tematizar e de sobrescrever | Classes e tokens |
| Dropdowns de filtro | Estado e DOM espalhados | Um componente de filtros |
| CSS monolítico | Ordem e especificidade frágeis | Camadas: tokens, base, componentes, telas |
| Z-index solto (1200) | Colisões | Escala nomeada |
