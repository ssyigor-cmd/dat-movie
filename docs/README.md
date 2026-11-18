# Documentação do Dat-Movie

Esta pasta reúne a documentação funcional e técnica do **Dat-Movie** no estado atual
do código. Ela existe para registrar as regras de negócio, os modelos de dados e as
decisões já tomadas, para que a evolução do app não perca esse contexto.

> **Estado do documento:** levantamento feito em **30/10/2026**, a partir do código
> em `src/`, `supabase/`, `index.html`, `style.css` e `tests/`; o documento 11
> (mobile) foi acrescentado em **18/11/2026**. Quando código e documentação
> divergirem, o código é a fonte da verdade — e esta pasta deve ser corrigida
> junto com a mudança.

---

## Como ler

| Documento | Responde a pergunta |
|---|---|
| [01 — Visão geral](01-visao-geral.md) | O que é o produto, para quem, quais problemas resolve e qual o glossário? |
| [02 — Arquitetura e fluxo](02-arquitetura-e-fluxo.md) | Como o app é montado, como os dados entram e saem, e quais são as camadas? |
| [03 — Estrutura de arquivos](03-estrutura-de-arquivos.md) | O que cada pasta e arquivo faz, e onde mexer para cada tipo de mudança? |
| [04 — Modelos de dados](04-modelos-de-dados.md) | Quais tabelas, colunas, constraints, RLS e modelos JavaScript existem? |
| [05 — Lógica de negócio](05-logica-de-negocio.md) | Como funcionam progresso, filtros, listas, dedupe, busca, recomendações, cache e arte? |
| [06 — Estado e navegação](06-estado-e-navegacao.md) | O que fica no estado global, o que persiste, como as abas e rotas funcionam? |
| [07 — Integrações e API](07-integracoes-e-api.md) | Como o app fala com Supabase, TMDb e Fanart, e quais são as barreiras de segurança? |
| [08 — UI e design system](08-ui-e-design-system.md) | Como o DOM, os tokens, os temas, os componentes e o layout são organizados? |
| [09 — Testes](09-testes.md) | Quais garantias a suíte oferece e o que ela não cobre? |
| [10 — Dívida técnica](10-divida-tecnica-e-refatoracao.md) | O que atrapalha a evolução do app? |
| [11 — Mobile web](11-mobile-web.md) | A frente mobile: como é montada, anatomia da tela de detalhe, identidade compartilhada e dívida própria? |

`outputs/` guarda arquivos de exploração (notas de análise, estudos de
iconeografia) que não são documentação — são insumo de design e ficam aqui
para não poluir a raiz do repositório.

Leitura sugerida:

1. **Produto e regras:** 01 → 05.
2. **Dados e integrações:** 04 → 07.
3. **Interface e garantias:** 08 → 09.
4. **Mobile (se for mexer no `mobile.html`):** 11.
5. **Dívida e próximos passos:** 10.

---

## Convenções

- **Idioma:** português do Brasil, o mesmo do produto e das mensagens de UI.
- **App:** SPA desktop em JavaScript puro + Vite, entry em `src/main.js`, montada por `index.html`. Existe também a frente mobile (entry `src/mobile.js`, montada por `mobile.html`), documentada em [11 — Mobile web](11-mobile-web.md). O desktop é o que usa Supabase e TMDb.
- **Termos de código:** nomes de funções, tabelas e chaves são mantidos como estão
  no código, inclusive quando misturam português e inglês.
- **“Fonte da verdade”:** o schema do banco vive em `supabase/migrations/`; as
  regras de segurança das funções em `supabase/functions/_shared/`; os contratos
  visuais em `tests/`.

---

## Regras de manutenção

Ao alterar o produto, atualize o documento correspondente no mesmo commit:

| Mudou | Atualize |
|---|---|
| Tabela, coluna, constraint, índice ou política RLS | `04-modelos-de-dados.md` |
| Cálculo, filtro, ordenação, recomendação ou cache | `05-logica-de-negocio.md` |
| Aba, rota, chave de `localStorage` ou estado global | `06-estado-e-navegacao.md` |
| Endpoint, Edge Function, variável de ambiente ou segurança | `07-integracoes-e-api.md` |
| Token, componente, layout ou tema | `08-ui-e-design-system.md` |
| Suíte de teste ou contrato visual | `09-testes.md` |
| Decisão estrutural ou dívida resolvida | `10-divida-tecnica-e-refatoracao.md` |
| Tela, fluxo ou arquitetura do mobile | `11-mobile-web.md` |

Não copie SQL de schema para os documentos narrativos: aponte para o arquivo em
`supabase/migrations/`. O README do projeto já registra que copiar SQL para prosa
causou divergência entre documentação e banco.
