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
  `.title-badge-btn`):
  - *Detalhes*: só o ícone `fa-circle-info` (1.1rem), abre o modal de
    informações do título — ocupa o slot onde era o ano;
  - *Tier*: selo de 18×18 com a letra;
  - *Status*: ponto de 9px + rótulo (assistindo/concluído/planejado/pausado).
- **Progresso**: steppers Temporada/Episódio.
- **Blocos Listas | Ações** (`.twin-row` → `.twin-block`): dois blocos lado a
  lado abaixo da sinopse, botões `.badge-action` (mono, `radius-sm`,
  `bg-surface`, `--text-secondary`). Listas: Selecionar listas, Episódios.
  Ações: Salvar, Remover.
- O modo **sorteio/preview** troca o bloco Ações pelos botões Adicionar /
  Cancelar (usa os mesmos `.badge-action`).
- `Corrigir título` **não existe** no mobile hoje (o desktop mantém a feature).
  Se voltar a existir, seguir o padrão do desktop (`relinkTitle` no
  `titlePage.js`).
- Sinopse do episódio atual, depois a lista de episódios em acordeão.

Selos/tipografia: títulos em Sora (`--font-display`), dados técnicos em
IBM Plex Mono (`--font-mono`), corpo em Inter. O mobile respeita a mesma
regra de cor sólida do desktop.

---

## 5. Identidade visual no mobile

- O **único gradiente** do projeto segue existindo só como filete da logo
  (rampa monocromática areia → bronze, `#F2E9D5 0%` → `#E5D8BF 35%` →
  `#A89467 70%` → `#6E5F3C 100%` nos SVGs). **Não há gradiente na UI.**
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
