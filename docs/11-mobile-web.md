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
- **Telas**: sistema próprio por seção
  (`<section class="screen" id="...">`), trocadas por `switchScreen(name)`.
  Não há router nem URL por tela; não há deep link.
- **Bottom sheets**: padrão do mobile — filtros, ordenação, listas, coleções,
  episódios e confirmação abrem como folha inferior com `.sheet-overlay`.
- **Back**: por gesto (swipe da borda no iOS). A tela de detalhe **não tem
  botão de voltar** por decisão de produto.

Telas declaradas em `mobile.html`:

| Tela | `id` | Papel |
|---|---|---|
| Home | `homeScreen` | Catálogo em destaque, calendário da semana, afinidade, sorteio |
| Catálogo | `catalogScreen` | Grade com filtros, agrupamento por tier e ordenação |
| Próximos | `proximosScreen` | Episódios da semana / Em Breve |
| Busca | `searchScreen` | Busca local + TMDb com filtros avançados |
| Listas | `listsScreen` | Listas do usuário, coleções |
| Detalhe | `titleScreen` | Ficha do título (ver seção 4) |
| Perfil | `profileScreen` | Nome, tema, barra de progresso, sair |

Nav inferior: Home, Catálogo, Próximos, Busca, Listas. O item ativo usa o
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
- O item ativo da nav usa `--accent` sólido (2px pill) — trava testada por
  `tests/glow.test.js`.
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

Histórico relevante:

- Detalhe redesenhado (pôster 124px, logo 46px, selos equalizados em 24px);
- Ano removido do detalhe (o selo foi ocupado pelo botão Detalhes — **o ano
  não aparece em lugar nenhum da ficha**, decisão em aberto desde então);
- Setas do backdrop reduzidas; seta de voltar removida (voltar = gesto);
- `Corrigir título` removido do mobile; CSS morto removido;
- Filete da logo monocromático (ver `assets/BRAND_GUIDELINES.md`).
