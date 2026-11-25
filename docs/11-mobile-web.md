# 11 — Mobile web

Este documento cobre a **frente mobile** do Dat-Movie: o que ela é, como é
montada, onde fica cada coisa e o que ainda não tem cobertura. Antes deste
documento existir, o mobile não era citado em nenhum lugar da documentação.

---

## 1. O que é (e o que não é)

- **É** uma experiência mobile separada, standalone, otimizada para iPhone/Safari.
  O desktop (`index.html` + `src/main.js`) continua sendo o produto principal.
- **Não é** um PWA: sem service worker, sem manifest, sem prompt de
  instalação. A experiência é servida como site.
- **Não é** um app nativo. No iOS, o atalho da tela de início usa
  `apple-touch-icon.png` (180px) com `<link rel="apple-touch-icon">` em
  `mobile.html`; atalhos criados antes de a troca de ícone existir continuam
  com o ícone antigo até serem recriados.
- **Não duplica o servidor**: usa as mesmas credenciais Supabase
  (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, ver `.env` — nunca commitar),
  a mesma allow-list de endpoints da Edge Function `clever-endpoint`
  (`supabase/functions/_shared/allowedEndpoint.ts`) e os mesmos dados
  (`items`, `user_lists`, `item_lists`).

---

## 2. Como é montada

- **Entry**: `mobile.html` + `src/mobile.js` (~100 KB). O `vite.config.js`
  declara **duas entradas** no build (`index.html` e `mobile.html`), então
  `npm run build` gera as duas em `dist/`.
- **CSS**: vive em blocos `<style>` dentro de `mobile.html`. O mobile **não**
  importa `style.css`. Tokens são equivalentes aos do desktop
  (`--accent`, `--bg-*`, `--tier-*`, `--font-*`), mas são redefinidos no
  próprio arquivo — mudar cor num lugar não muda o outro.
- **JS**: `src/mobile.js` é um módulo único que expõe as funções para o
  `mobile.html` via `Object.assign(window, { ... })` (handlers `onclick` no
  markup). Não há bundler de componentes nem framework.
- **Sem barra superior** (removida em 18/11/2026): a marca e o botão de
  perfil que viviam no `.top-header` saíram de lá — o acesso ao perfil virou
  a última aba da nav, e a identidade fica no `#bootSplash`, na tela de
  login e numa pequena marca na linha do título de cada página
  (`.page-mark`, só nas telas que têm título).
- **Telas**: sistema próprio por seção
  (`<section class="screen" id="...">`), trocadas por `switchScreen(name)`.
  Não há router nem URL por tela; não há deep link.
- **Bottom sheets**: padrão do mobile — filtros, ordenação, listas, coleções,
  episódios, confirmação e **personalização da Home** abrem como folha
  inferior com `.sheet-overlay`.
- **Home personalizável**: a linha "Personalizar tela inicial" do Perfil abre
  `#homeLayoutSheet`, onde cada um dos 14 blocos da Home (Continuar
  Assistindo, Roleta, 4 rails de afinidade, Episódios da Semana, Descubra por
  afinidade, Em Breve, Abandonados, Destaques do ano, Em Alta, Favoritos,
  Explorar por gênero) tem um toggle de visibilidade e botões ▲/▼ de ordem.
  A saudação e "Voltar ao topo" são fixos. `applyHomeLayout()` roda no começo
  de `renderHome()`: reordena os blocos no DOM e marca os ocultos com
  `.hidden` (`display:none !important`, necessário porque os loaders escrevem
  `style.display=''` quando há dados). Loaders de blocos ocultos são
  ignorados, e ao reexibir um bloco o inline `display:none` é limpo.
  Preferência salva em `localStorage` na chave `homeLayout_<user.id>`
  (válida para aquele usuário naquele aparelho), com "Restaurar padrão"
  reaplicando a ordem do markup; ids desconhecidos no JSON salvo são
  descartados e blocos faltantes são acrescentados no fim.
- **Back**: por gesto (swipe da borda no iOS). A tela de detalhe **não tem
  botão de voltar** por decisão de produto.

Telas declaradas em `mobile.html`:

| Tela | `id` | Papel |
|---|---|---|
| Home | `homeScreen` | Catálogo em destaque, calendário da semana, afinidade, sorteio |
| Catálogo | `catalogScreen` | Grade com filtros, agrupamento por tier e ordenação |
| Próximos | `proximosScreen` | Episódios da semana / Em Breve |
| Busca | `searchScreen` | Busca local + TMDb com filtros avançados |
| Listas | `listsScreen` | Listas do usuário, coleções — **sem aba própria**: abre pela linha "Listas" do Perfil |
| Detalhe | `titleScreen` | Ficha do título (ver seção 4) |
| Perfil | `profileScreen` | Nome, tema, barra de progresso, personalização da tela inicial, sair |

Nav inferior: Home, Catálogo, Próximos, Pesquisar, Perfil. O item ativo usa o
acento sólido (ver `tests/glow.test.js`, que trava esse contrato).

---

## 3. Arquivos

| Arquivo | Papel |
|---|---|
| `mobile.html` | Markup + CSS da experiência mobile |
| `src/mobile.js` | Lógica: auth, CRUD, render, sheets, steppers, detalhe |
| `assets/icon/apple-touch-icon.*` e `public/assets/icon/apple-touch-icon.png` | Ícone iOS (gerado por `scripts/build-favicons.mjs`) |
| `scripts/build-favicons.mjs` | Regera favicons (16/32/48 + .ico) e apple-touch-icon a partir dos SVGs de `assets/` — roda com `npm run build:favicons` |

Espelho `public/assets/` ↔ `assets/`: tudo que o runtime precisa vai para os
dois lugares, senão o build de produção (e o `npm run dev`) mostram marcas
diferentes.

---

## 4. Tela de detalhe (`titleScreen`)

O ponto mais denso do mobile. Anatomia atual:

- Backdrop 16:9 com gradiente de legibilidade (`.title-backdrop::after`),
  sem botão de voltar.
- Pôster 124px sobrepondo o backdrop; bloco de info à direita com o logo do
  título (ou nome como fallback) e os selos.
- **Selos do cabeçalho** (mesma caixa: altura mínima 24px, gap 6px,
  `.title-badge-btn`): *Tier* — botão inteiro preenchido pela cor da tier
  (`.tier-*` no próprio botão, sem o quadradinho de 18px e sem fundo de
  superfície ao redor; sem tier, mostra "N/A" no estilo neutro) — e
  *Status* (ponto de 9px + rótulo: assistindo/concluído/planejado/pausado).
  O antigo selo *Detalhes* saiu daqui e virou botão com texto;
- **Steppers e sinopse** (`#progressSection`, sem rótulo visível): Temporada/
  Episódio, com `margin-top:12px` (as outras seções do detalhe usam 20px)
  para reduzir o espaço acima do bloco. Toque curto = 1 passo;
  **clique e segurar** = 1 passo aos 300ms e repetição a cada 100ms
  (`startHold`/`stopHold`). Os botões usam **pointer events**
  (`pointerdown/up/cancel/leave`) para funcionar no toque do iPhone — antes
  eram `mousedown/up/leave`, que não disparavam no iOS. `holdActive`/
  `holdFired` evitam o passo duplo no clique emitido ao soltar, e
  `touch-action:manipulation` + `user-select:none` evitam zoom/seleção
  nativa. Os limites vêm da TMDB (`seasonMax`, `epMaxByTemp`). A sinopse do
  episódio e a lista inline também ficam dentro deste único bloco: o antigo
  bloco "Episódio" (logo abaixo) foi fundido aqui; o rótulo "Progresso" foi
  removido e `#episodesToggle` foi para baixo da sinopse, logo acima da lista
  inline. Os quatro blocos — Temporada, Episódio, sinopse e progresso —
  ficam equidistantes: `--detail-gap:8px` vale para o `gap` dos steppers e
  para o `margin-top` da sinopse e da linha de progresso (o gap interno de
  cada caixa segue em 4px). Ao lado do botão, uma barra de progresso ocupa
  o resto da linha (`.progress-track` + `.progress-pct`) e acompanha os
  steppers em tempo real (`updateTitleProgressBar()`, que usa
  `calcularProgresso` com `curTemp`/`curEp`). Usa `.title-progress` (e não
  `.progress-wrap`) justamente para não herdar a regra que esconde a barra
  dos cards quando `showProgressBar` está desligado. A linha inteira é um
  bloco no padrão do detalhe — fundo `--bg-elevated`, `radius` de 10px e
  padding 8px/10px —, com o botão em `--bg-elevated-hover` e a trilha em
  `--bg-secondary`.
- **Botões de ação** (`.badge-action`: mono, `radius-sm`, `bg-surface`,
  `--text-secondary`), todos em linha (flex, `flex:1`):
  - logo **abaixo da sinopse do episódio**: `#moreInfoSection` com um único
    botão **"Mais informações"** (`.more-info-toggle`, Sora 0.72rem/500 em
    `--text-muted`, sem fundo nem caixa: ícone `fa-circle-info` discreto na
    mesma cor, texto e chevron, com uma linha divisória fina acima em
    `--border-outline`). Um toque expande/colapsa o acordeão
    `#moreInfoBody` (grid `0fr → 1fr` em 0.35s, que acompanha o conteúdo
    carregado depois) e atualiza `aria-expanded`. Dentro dele, dois blocos
    empilhados: **Detalhes** e **Listas** (agrupadas em "Do sistema" e "Minhas
    listas", com toggle próprio e contagem de selecionadas; não há botão —
    marcar/desmarcar salva sozinho após 500ms (`onListToggle()`), com toast
    discreto e proteção contra salvar no título errado; no preview o bloco
    fica desabilitado com uma dica). Cada bloco é carregado
    uma vez por título (`loadMoreInfoContent()`) e limpo ao trocar de título
    ou sair da tela (`resetMoreInfo()`). Os antigos modais/bottom sheet
    (`#titleInfoModal`, `#episodesModal`, `#listSheet`) foram removidos;
  - **Episódios** saiu do acordeão: `#episodesToggle` fica logo abaixo da
    sinopse (pílula discreta em `--bg-elevated`, com chevron que gira ao
    abrir), com a barra de progresso preenchendo a largura restante da linha;
    expande `#episodesInline` em seguida, com o acordeão de temporadas
    (`toggleSeason`). Carregamento próprio (`toggleEpisodesInline()`), uma
    vez por título;
  - **no fim da página**: `#actionsSection` com **Salvar · Remover** (um
    do lado do outro). Sem rótulo e sem caixa: só a **cor** e a **fonte**
    seguem o bloco dos steppers — `font-display` (Sora) 0.85rem/600,
    fundo `--bg-elevated` e texto `--text-primary` (`Remover` mantém
    `--danger`). No preview a aparência é a mesma, com Adicionar/Cancelar;
  - O antigo bloco "Listas" (`.twin-row`/`.twin-block`) foi eliminado;
- O modo **sorteio/preview** troca Salvar/Remover por Adicionar /
  Cancelar (usa os mesmos `.badge-action`) e mantém "Mais informações"
  disponível: Detalhes e Episódios funcionam pelo `tmdb_id`; em "Listas",
  ao concluir, `saveTitleLists()` avisa "Adicione o título antes de
  escolher listas";
- O insert do preview (`addRouletteTitle()`) grava **o que foi escolhido
  na tela** — `temporada`/`episodio` dos steppers (`curTemp`/`curEp`), `tier`
  (`currentTier`) e `status` (`currentStatus`). Antes eram constantes
  `1/0/'assistindo'/null`, então tier e progresso escolhidos eram perdidos.
- Ao **adicionar** um título (`addRouletteTitle()`), o app grava o aviso em
  `sessionStorage`, troca a URL pelo deep link `#/titulo/:id` e faz
  `location.reload()` — estado limpo para evitar erros. No boot, `initApp()`
  abre o detalhe pelo deep link e exibe o toast "Título adicionado ao
  catálogo!" (4s), lido do `sessionStorage` e removido em seguida.
- `Corrigir título` **não existe** no mobile hoje (o desktop mantém a feature).
  Se voltar a existir, seguir o padrão do desktop (`relinkTitle` no
  `titlePage.js`).
- Sinopse do episódio atual, depois a lista de episódios em acordeão.

**Bloco Detalhes** (dentro de `#moreInfoBody`, aberto por "Mais informações"): segue
a mesma gramática visual do restante do app — rótulos Sora 0.85rem/600 com
ícone em `--accent`, conteúdo em cartões `--bg-elevated` com `--radius` e
`padding:14px` (`.ti-card`). Cabeçalho só com texto: nome em Sora 1.2rem,
**nome original** (quando diferente) e linha de mono só com a estreia — sem
imagem nem vídeo; Sinopse, Sites (quatro tiles idênticos de 40px com as cores
das marcas: azul/globo, amarelo/IMDb, escuro/W e vermelho/YouTube; as marcas
transparentes ficam em `public/assets/icon/*-mark.svg`), Detalhes (grid
de células `--bg-surface` com rótulos uppercase e valores mono, incluindo
**Faixa etária** com selo BR e **Origem** com bandeiras), Elenco (carrossel
com `.ti-cast-photo`/`.ti-cast-role`) e **Equipe** (Criação, Direção,
Emissora e Produtora no mesmo trilho, separadores `.ti-team-sep`). O selo
etário usa as cores oficiais BR fixas nos dois temas; as bandeiras vêm de
`src/lib/flags.js` (mesmo helper do desktop, com fallback para emoji se
o SVG do flagcdn não carregar). Sem gradiente na UI. A chamada de detalhes usa
`append_to_response=content_ratings,keywords` (chave de cache própria).
As **Palavras-chave** do TMDb (vêm em inglês) são traduzidas para português
pelo dicionário local `src/lib/keywordTranslations.js` (o original fica no
tooltip; sem tradução, mantém o texto da API) e aparecem como chips clicáveis no
fim do grid de Detalhes.

Vários elementos do Detalhes são clicáveis e abrem a tela genérica
`#discoverScreen`, que chama `discover/tv` com o filtro correspondente e mostra
os títulos relacionados com os mesmos cards externos da busca (o botão "Voltar"
retorna à tela de origem):

- **Palavras-chave** → `with_keywords`;
- **Gêneros** → `with_genres` (Terror/id 27 usa a keyword `315058`, que é o
  fallback do proxy);
- **Elenco / Criação / Direção** → `person/{id}/tv_credits` (o `discover/tv`
  do TMDb **não** aceita `with_cast`/`with_crew` — esses filtros são só de
  `discover/movie`; parâmetros desconhecidos são ignorados e voltava a lista
  genérica). Endpoint liberado na allow-list do proxy — requer redeploy da
  Edge Function;
- **Emissoras** → `with_networks`; **Produtoras** → `with_companies`;
- **Origem** (bandeiras) → `with_origin_country`.

Os chips são montados por `discoverChip()` e os cards de elenco/equipe por
`discoverCard()` (sem id válido, caem para um `<div>` comum). A seleção usa
`with_type=2|4` (minissérie + ficção, fora talk/news/reality/vídeo), filtra
também os gêneros de ruído (Notícias/Reality/Talk) no cliente e ordena por
`vote_count.desc` — o TMDb não expõe views, então número de votos é o melhor
proxy de "mais vistos até os menos". Cada clique em "Carregar mais" traz 40
títulos: filmografias de pessoas são paginadas no cliente (40 por lote) e os
demais filtros juntam 2 páginas da API (o TMDb fixa 20 por página). O botão
aparece enquanto houver lotes. O link
"YouTube" em Sites continua abrindo a busca de trailer no YouTube.

Selos/tipografia: títulos em Sora (`--font-display`), dados técnicos em
IBM Plex Mono (`--font-mono`), corpo em Inter. O mobile respeita a mesma
regra de cor sólida do desktop.

---

## 5. Identidade visual no mobile

- O **único gradiente** do projeto segue existindo só como filete da logo
  (rampa monocromática gelo → ardósia, `#EAF4FA 0%` → `#D6E9F4 35%` →
  `#7C9BAF 70%` → `#35566B 100%` nos SVGs). **Não há gradiente na UI.**
- O item ativo da nav usa `--accent` sólido (2px pill, `.nav-tab.active::before`).
  **Nenhuma suíte trava esse contrato** — `tests/glow.test.js` lê só o
  `style.css` desktop; o mobile é verificado por revisão visual.
- Estados de status usam as mesmas cores semânticas do resto do app
  (`--success`, `--accent`, `--tier-a`, `--warning`).

---

## 6. Testes e verificação

- **Nenhum teste cobre o mobile** (`grep` por `mobile.html`/`src/mobile.js` em
  `tests/` retorna vazio). `glow.test.js` trava o acento sólido no desktop
  (`style.css`); o mobile é verificado por revisão visual no aparelho.
- Verificação mínima ao mexer no mobile: `npm run lint && npm run build`
  (o build compila `mobile.html`) e conferida no iPhone.
- O `index.html` desktop não muda quando o mobile muda — exceto assets de
  marca (ícone/favicon), que são compartilhados.

---

## 7. Dívida e decisões abertas

- `mobile.html` concentra markup + CSS (~80 KB) e `src/mobile.js` concentra
  toda a lógica (~100 KB) — mesmo padrão do `main.js` no desktop, com os
  mesmos problemas de evolução. Ver `10-divida-tecnica-e-refatoracao.md`.
- Não há deep link nem histórico real de navegação (`history.pushState` é
  usado só para a tela de título via hash `#/titulo/:id`).
- Docs 01–10 ainda descrevem um produto desktop (ver nota em `docs/README.md`);
  este documento é a única cobertura do mobile.
- Ícone novo ≠ ícone visto: vide seção 1 sobre o atalho do iOS.

Notas sobre a sheet "Filtros" do catálogo:

- Status, Lista e as seções **Tier**, **Época** e **Faixa etária** filtram de
  verdade. Tier usa `item.tier` (local, via `filterItems`);
  Época e Faixa etária resolvem ano e classificação pelos detalhes TMDB
  (`tv/{id}?append_to_response=content_ratings`) quando o item não tem a
  coluna `ano` — lote aquecido com concorrência 5, TTL de 30 dias no cache
  `tmdbfull_<id>` (o mesmo do desktop), filtro aplicado em memória após o
  aquecimento. Título sem `tmdb_id` aparece apenas em "Sem classificação" e
  fica fora de épocas fechadas.
- **Limpar filtros** restaura Status, Lista, Tier, Época e Faixa ao padrão
  (antes só limpava a lista e a aparência dos botões; o Status nunca era
  limpo, e os outros três não filtravam nada).
- Os botões aplicam o filtro na hora; o botão "Aplicar" apenas fecha a sheet.

Notas sobre o boot/login:

- O markup não traz mais a tela de login como visível por padrão: quem cobre
  o carregamento é o `#bootSplash`, que sai em `switchScreen()`.
- A sessão é lida do storage local (`getSession()`) e o usuário dela é
  reutilizado — sem chamada `/auth/v1/user` na largada. Sem sessão válida, cai
  no login. Erros inesperados no boot também caem no login em vez de travar
  no splash.

Histórico relevante:

- Fundo da tela de detalhe com blur mais forte (`.title-screen-blur`: 10px →
  26px, scale 1.12 → 1.32 para evitar bordas vazias);
- Botão Episódios saiu do topo e foi para baixo da sinopse, voltando à pílula
  simples (sem o efeito "ticket" experimentado antes), com barra de progresso
  dinâmica ocupando o espaço livre à direita;
- "Mais informações" perdeu o cartão de fundo: agora é ícone + texto menor
  (0.72rem) com um divisor fino acima (padrão de cabeçalho de seção), com
  chevron e acordeão inalterados;
- Detalhe: Progresso e Episódio passaram a ser um único bloco — steppers
  Temporada/Episódio, sinopse e lista inline juntos; o rótulo "Progresso" saiu
  e o botão "Episódios" foi para baixo da sinopse;
- Selo de tier no cabeçalho do detalhe: a cor da tier agora preenche o
  botão inteiro, sem o quadradinho interno nem a moldura de superfície;
- Modal Detalhes ganhou paridade parcial com o desktop: faixa etária
  (selo BR), origem (bandeiras), equipe (criação/direção/emissora/produtora)
  e nome original; helper de bandeiras extraído para `src/lib/flags.js`
  (reexportado pelo componente do desktop para os testes existentes);
- Modal Detalhes: removido o campo "Tipo" (Scripted etc.) da grade e da
  linha do hero, considerado inútil;
- Modal Detalhes padronizado: cartões elevados por seção, hero com
  backdrop, links em grid mono, células de dados e estilos de elenco
  (inclusive `.ti-cast-role`, que não existia);
- Detalhe: reduzido o espaço acima do bloco Progresso (`margin-top:12px`,
  contra 20px das demais seções);
- Preview de títulos pesquisados voltou a mostrar Detalhes/Listas/Episódios;
  ao tentar trocar listas antes de salvar, aparece aviso em vez de
  fechar a folha silenciosamente;
- Botões Salvar/Remover: sem rótulo "Ações" e sem caixa; apenas fonte
  (Sora 0.85rem/600) e cores (`bg-elevated`/`text-primary`, `--danger`
  em Remover) iguais às dos blocos Progresso/Episódio;
- Detalhe reestruturado: bloco "Listas" eliminado; "Detalhes" saiu dos
  selos do cabeçalho; Detalhes/Listas/Episódios agora formam uma linha
  abaixo da sinopse do episódio e Salvar/Remover ficam no fim da página;
- Corrigido o insert de novo título: tier, temporada/episódio e status
  escolhidos no preview passam a ser gravados no banco (antes o insert
  usava valores fixos e descartava a escolha do usuário);
- Adicionar título agora recarrega a página (via deep link + toast em
  `sessionStorage`) para garantir estado limpo; steppers Temporada/Episódio
  passaram a aceitar clique e segurar no toque (pointer events) com
  repetição e sem passo duplo ao soltar;
- Home configurável: a linha "Configurações" (que só dizia "Em breve") virou
  "Personalizar tela inicial", com folha de mostrar/ocultar + reordenar os
  14 blocos; persistência por usuário em `homeLayout_<user.id>`;
- Detalhe redesenhado (pôster 124px, logo 46px, selos equalizados em 24px);
- Continuar Assistindo ordena pelos **títulos editados mais recentemente**
  (`dataAtualizacao || dataCriacao` decrescente, paridade com o desktop) e o
  card passa a exibir o backdrop **desfocado** (`.continue-backdrop`, blur 6px +
  brightness) com o **logo centralizado** (`.cont-logo`); sem logo, o nome
  segue sobre a imagem com o gradiente padrão;
- Ano removido do detalhe (o selo foi ocupado pelo botão Detalhes — **o ano
  não aparece em lugar nenhum da ficha**, decisão em aberto desde então);
- Sheet "Filtros" do catálogo: Tier/Época/Faixa etária eram UI morta (só
  alternavam classe) e passaram a filtrar de verdade; `contentRating.js`
  concentra `pickContentRating` + `US_RATING_BR` (mobile e desktop
  compartilham; desktop importa pelo mesmo caminho);
- Boot: tela de login não é mais visível por padrão — `#bootSplash` cobre a
  verificação e a sessão local elimina a chamada `/auth/v1/user` na largada;
- Barra superior removida: o ícone saiu de vez de cima; o perfil virou aba
  da nav inferior (onde estava "Listas"); a tela de Listas passou a abrir
  pela linha "Listas" do Perfil (o botão provisório na tela de Catálogo foi
  removido no mesmo dia — "ele já existe no perfil"); o item ativo da nav
  fica em Catálogo enquanto se navega pela tela de Listas;
- Botões de Filtros/Ordenar/Agrupar (Catálogo, Próximos e Pesquisar)
  alinhados à direita da linha (`.filter-chips--right`);
- Home · Episódios da Semana: a faixa de data (`.cal-date`) passou
  para o **topo** do card; o mês aparece abreviado (JAN…DEZ) na mesma
  linha do dia, com `/NOV` em corpo menor (`.cal-dmonth`), e o dia da
  semana (`.cal-dday`) passou a ser escrito por extenso (Segunda…);
  A dica `#calendarHint` ("Próximos episódios" / "Episódios que saíram
  esta semana") foi removida por completo — markup e JS;
- Marca pequena na linha do título, no fim da linha (canto superior
  direito da linha): `.page-mark` (`icon-face.svg`, 22px) ao lado do
  `h2` com `justify-content:space-between` — título à esquerda, marca à
  direita. Presente **apenas nas telas que têm título** (Início,
  Catálogo, Próximos e Listas); Pesquisar e Perfil seguem sem título e
  sem marca; no tema claro usa `icon-face-light.svg` (`content: url(...)`
  no `<style>` final, mesmo padrão da logo do auth). Passou por
  tentativas anteriores de "ícone fixo no canto" (à esquerda, depois à
  direita, ancorado à borda da área do app) no mesmo dia — todas
  substituídas pela marca inline após correções do pedido original;
  Nasceu fixa à esquerda, foi movida para a direita no mesmo dia, por
  correção do pedido original.
- Setas do backdrop reduzidas; seta de voltar removida (voltar = gesto);
- `Corrigir título` removido do mobile; CSS morto removido;
- Filete da logo monocromático (ver `assets/BRAND_GUIDELINES.md`).
