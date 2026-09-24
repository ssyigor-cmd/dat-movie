# Barra Inferior - Modelo Ideal

Registrado em 2026-09-24 como modelo ideal solicitado.

## Configuração

- Distribuição: 10% status / 10% temporada / 10% episódio / 55% meta / 15% ações
  - `style.css:809` `.epp-combined 75%` com `epp-season 13.33%` (10% total), `epp-episode 13.33%` (10%), `epp-episode-meta 73.34%` (55%)
  - `style.css:1235` `.epp-status 10%`
  - `style.css:926` `.epp-actions 15%`
- Espaçamento: `gap: 10px` status/ações, `gap: 8px` controles temporada/episódio, modal `gap: 6px` compacto
- Números: `2.8rem 900` em `style.css:533` modal e `989/1046/1104/1142` geral
- Altura: `poster-steppers-row` `flex:0 0 auto` `max-height:28vh` com `margin-top:auto` na base do modal `grid-template-rows:auto 1fr auto`
- Selo tier: marcador `22x28px` catálogo e `18x24px` home, sem exibição na Home

## Referência

Commit: `691cc3c` - feat(ui): numeros 2.8rem
Tag sugerida: `barra-ideal-v1`
