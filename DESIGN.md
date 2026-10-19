---
version: alpha
name: Dat-Movie — Mobile
colors:
  background: "#101112"
  backgroundLight: "#F4F1EA"
  surface: "#191A1C"
  surfaceRaised: "#222325"
  well: "#151618"
  text: "#F2EDE3"
  textSecondary: "#AEAFB2"
  textMuted: "#838589"
  outline: "#2A2C30"
  accent: "#E5D8BF"
  accentInk: "#101112"
  tierSplus: "#FFD700"
  tierS: "#34D399"
  tierA: "#3B82F6"
  tierB: "#F99E16"
typography:
  display:
    fontFamily: Sora
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: -0.02em
  title:
    fontFamily: Sora
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.08em
rounded:
  card: 10px
  poster: 6px
  control: 999px
  sheet: 20px
spacing:
  unit: 4px
  screenPadX: 18px
  section: 28px
  block: 14px
  item: 12px
components:
  tabBar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.textSecondary}"
    rounded: "0px"
    height: 62px
  primaryButton:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accentInk}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: 50px
  posterCard:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.text}"
    rounded: "{rounded.poster}"
  chip:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.textSecondary}"
    rounded: "{rounded.control}"
    height: 36px
  panel:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: 16px
---

## Overview

Prévia mobile do Dat-Movie — o mesmo catálogo de filmes e séries do app (tiers, progresso por episódio, listas, tema claro/escuro), reorganizado para uma tela de 390 × 844 px. A paleta vem de `style.css` (tema escuro como base, claro em `[data-theme="light"]`) e não muda na adaptação: a mudança está na composição, não na cor.

O que a prévia demonstra: barra de abas fixa no rodapé (Início · Catálogo · Buscar · Perfil), trilhos horizontais que mostram 2,5 cartões com `scroll-snap`, filtros em chips roláveis no lugar da barra de ferramentas do desktop, e a página do título aberta em tela cheia sobre o app.

## Colors

Fundo preto quente (#101112) com superfícies em dois degraus (#191A1C cartão, #222325 controle aninhado). O areia (#E5D8BF) é o único acento de marca e fica reservado à ação primária, ao item ativo da aba e ao progresso. As cores de tier são as do app e só aparecem dentro do chip S+/S/A/B — nunca como fundo de área grande. Bordas são desligadas por padrão; o contorno (#2A2C30) só existe onde dois blocos do mesmo tom se tocam (divisória da barra de abas, campo de busca).

No tema claro (creme #F4F1EA sobre branco) o areia não serve como texto nem como ícone. Por isso existe `--accent-ui`: igual ao areia no escuro, `#7A663B` no claro. Ele pinta aba ativa, coração de favorito, porcentagem, preenchimento da barra de progresso e o anel de foco do campo de busca; `--accent` continua pintando os botões preenchidos, com tinta calculada pela luminância do acento escolhido.

## Typography

Três papéis herdados do app: Sora para títulos e wordmark, Inter para corpo, rótulos e botões, IBM Plex Mono para dado técnico que precisa alinhar em coluna (ano, `11/19`, porcentagem, data). No mobile o corpo desce para 15px e o display para 26px; mono nunca fica abaixo de 11px. Metadados em mono usam caixa alta e `letter-spacing: 0.08em`.

## Layout

Uma coluna, respiro de 18px nas laterais. Seções separadas por 28px, título → trilho por 14px, cartões por 12px. Cartão de trilho com 132px de largura (2,5 visíveis em 390px). Alvos de toque com no mínimo 44px; a barra de abas tem 62px e reserva a área segura inferior. Nenhum conteúdo fica sob a barra: o fim de cada tela ganha padding equivalente.

## Shapes

Canto de cartão e painel em 10px, pôster em 6px, chips e botões em pílula. Nenhum bloco tem fio de 1px: a separação vem do tom do fundo. A prévia sobrepõe uma moldura de aparelho apenas na visualização desktop — dentro do aparelho não existe moldura.

## Components

- **Barra de abas**: fixa, fundo da superfície com desfoque, ícone + rótulo, item ativo em areia, `aria-current="page"`.
- **Cartão de trilho**: pôster com arte gerada, barra de progresso de 2px sob o pôster, título em duas linhas e linha mono com temporada/episódios. O glifo do pôster usa `42cqi` (container query), então a arte encolhe junto com o cartão de 104px do perfil e a miniatura de 42px da busca.
- **Chip de tier**: fundo na cor do tier com tinta escura correspondente, mono 10px, canto pílula. Aparece sobre o pôster no catálogo e no detalhe.
- **Chips de filtro**: pílulas roláveis, a ativa em areia com tinta escura; contagem no rótulo.
- **Página do título**: tela cheia sobre o app, topo com voltar + favoritar, arte desfocada ao fundo, bloco de progresso, ação primária "Marcar +1 episódio" (areia), sinopse, gêneros e temporadas.
- **Painel de números**: grade de três colunas em mono sobre `--bg-secondary`, usada na semana e no perfil.

## Do's and Don'ts

- Faça: manter o estado compartilhado — marcar episódio no detalhe atualiza trilho, catálogo, busca e painel de números.
- Faça: mostrar estados vazios reais (busca sem resultado com botão de limpar).
- Faça: tratar `App.jsx` como prévia visual. A adaptação responsiva do app de verdade continua em `style.css`; nada aqui é importado pela aplicação.
- Não faça: inventar nota, bilheteria, disponibilidade em streaming ou qualquer contagem que o app não calcula.
- Não use: imagem externa/hotlink. As artes dos pôsteres são geradas em CSS a partir de um tom por título.
- Não faça: reduzir alvo de toque abaixo de 44px para caber mais um cartão no trilho.
