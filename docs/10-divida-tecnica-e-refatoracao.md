# 10 — Dívida técnica

Este documento registra o que existe hoje, o que atrapalha a evolução e uma ordem
possível de ataque. Ele não é uma ordem de execução nem uma proposta de reescrita:
é uma base para decidir escopo e priorizar.

---

## 1. Por que evoluir

O Dat-Movie é uma SPA desktop: navbar fixa no topo, toolbar horizontal, modais
grandes e uma página de título em duas colunas. O funcionamento está de pé, mas a
estrutura cobra um preço em três frentes:

1. **Navegação não é navegação.** Abas são `state.currentTab` + `display: none`;
   não há URL por tela, voltar do navegador não funciona e não existe deep link
   para lista, filtro ou título.
2. **A UI é difícil de evoluir.** `main.js` concentra auth, perfil, abas, render,
   CRUD e eventos; `titlePage.js` tem muitos estilos inline; `style.css` tem
   3571 linhas e regras duplicadas.
3. **O estado é implícito.** Parte vive em `state.js`, parte no DOM (selects,
   inputs), parte em closures de componentes, parte em `localStorage`. Cada tela
   lê de um lugar diferente.

---

## 2. Baseline mensurável

### 2.1 Tamanho

| Arquivo | Linhas | Observação |
|---|---:|---|
| `style.css` | 3752 | Design system + todas as telas |
| `src/main.js` | 2217 | Bootstrap, auth, perfil, abas, render, CRUD |
| `src/components/homePage.js` | 1414 | Template e loaders de 11 seções |
| `src/lib/trendingApi.js` | 897 | Rede, cache, score, calendário, estatísticas |
| `src/pages/titlePage.js` | 833 | Página do título |
| `src/components/titleInfoModal.js` | 519 | Ficha do TMDb |
| `src/lib/discoverSearch.js` | 486 | Busca avançada |
| `src/components/searchPage.js` | 444 | UI da busca |
| `src/lib/recommendScoring.js` | 426 | Score e mix |
| **Total `src/**/*.js`** | **~10.046** | 30 módulos |

### 2.2 Acoplamentos e sintomas

| Métrica | Valor |
|---|---|
| Estilos inline em `src/` | 96 (71 em `titlePage.js`, 21 em `homePage.js`, 4 em `cards.js`, `episodesModal.js` e `main.js`) |
| `innerHTML` em `src/` | 95 |
| IDs no shell | 117 (todos únicos) |
| Chaves em `dom.js` | 51 (sem seções vazias) |
| Suítes de teste | 29 |
| Casos de teste | 526 |
| Falhas atuais | 3 (2 arquivos) |
| Service worker | N/A (sem camada PWA) |
| `onAuthStateChange` | Ausente |
| Realtime Supabase | Ausente |
| Cobertura configurada | Ausente |

### 2.3 Drift de documentação e schema

- `integration.test.js` cita `gridDensity`, chave que **não existe** em
  `state.js`.
- `items.nota` é lido pelo modelo JS, mas não existe no DDL versionado.
- A RLS de `items` não está versionada nas migrations; só a de
  `user_lists`/`item_lists` está.
- `homePage.js` tem 18 caracteres `U+FFFD` em comentários (linhas ~1108–1125),
  resquício de encoding.

---

## 3. Inventário de dívida

Prioridade: **P0** bloqueia uma mudança estrutural ou é risco de segurança/dados;
**P1** atrapalha a evolução e a experiência; **P2** higiene.

| ID | Área | Evidência | Impacto | Prioridade |
|---|---|---|---|---|
| D01 | Navegação | `setActiveTab` + `display:none`; sem router; sem URL por aba/lista/título | Sem deep link, voltar quebrado, estado impossível de restaurar | P0 |
| D02 | `main.js` | ~2000 linhas; auth, perfil, navbar, abas, render, CRUD, modais, relink | Toda mudança mexe no arquivo mais arriscado | P0 |
| D03 | Estado | `state.js` + DOM + closures + `localStorage` | Comportamento depende da ordem de render; difícil testar | P0 |
| D04 | Schema | RLS de `items` não versionada; `nota` ausente no DDL | Risco de segurança e de perda de dado | P0 |
| D05 | Testes | 6 falhas; contratos de texto frágeis | Baseline vermelho; mudança sem rede confiável | P0 |
| D06 | CSS | 3571 linhas; `.filter-menu` duplicado; title page no fim | Especificidade e ordem frágeis; difícil evoluir | P1 |
| D07 | Title page | 789 linhas; 71 `style=`; muitos `!important` | Não tematiza nem testa; difícil compor | P1 |
| D08 | DOM | IDs globais; `dom.js` incompleto; `filterMenuOptions` capturado uma vez | `ReferenceError` históricos; NodeList obsoleta | P1 |
| D09 | Render | 95 `innerHTML`; escape manual | XSS depende de disciplina; difícil compor | P1 |
| D10 | Auth | Sem `onAuthStateChange`; sessão só no boot/refresh | Token expirado ou logout em outra aba não refletem | P1 |
| D11 | Rede | Sem `AbortController`, timeout ou retry; só detalhes de TV têm fila de concorrência | Requisições órfãs, tela presa, cota desperdiçada | P1 |
| D12 | Acessibilidade | Escape não global; foco preso parcial; sem skip link | Barreiras para teclado/leitor de tela | P1 |
| D13 | Cache | Cache global, não por usuário; preferências também globais | Dados de uma conta podem aparecer para outra no mesmo navegador | P2 |
| D15 | Duplicação | `#searchFiltersPanel` e `#advFiltersPanel` são dois wrappers para o mesmo painel | Dois caminhos para a mesma função | P2 |
| D16 | Observabilidade | Sem error boundary, métricas ou log estruturado | Falha em produção vira relato vago | P2 |
| D17 | Encoding | 18 `U+FFFD` em `homePage.js` | Comentários ilegíveis; risco de copiar texto quebrado | P2 |
| D19 | Realtime | Nenhum canal `postgres_changes` | Mudança em outro dispositivo só aparece no refresh | P2 |

> **D14 e D18 saíram do inventário.** D14: a camada PWA/instalação foi
> removida (o app é desktop-only e não é instalável). D18: o README deixou de
> citar `detailModal.js`, `stepper.js` e a contagem errada de suítes. Não são
> dívidas pendentes, são decisões e correções já aplicadas.

### 3.1 Dívidas que **não** são prioridade

- **Não** trocar a paleta, a tipografia ou a anatomia do card: isso é identidade,
  não dívida.
- **Não** adicionar realtime no primeiro corte: o produto declara que não há
  sincronização em tempo real; isso é decisão, não bug.
- **Não** reescrever as Edge Functions sem necessidade: elas são pequenas,
  testadas e resolvem o problema de cota/segredo.
- **Não** reintroduzir suporte mobile nem a camada de instalação (manifest de
  PWA, ícone de app, meta tags de iOS) no app atual: ele é desktop e roda no
  navegador. Uma experiência web/mobile separada é outro produto.

---

## 4. Ordem sugerida de ataque

A ordem abaixo ataca primeiro o que dá segurança para o resto. Cada etapa pode
parar sem deixar o app pior.

### 4.1 Baseline e decisões

- Resolver as falhas de teste (código ou expectativa) e registrar a decisão.
- Rodar `npm run lint`, `npm test` e `npm run build` verdes.
- Verificar a RLS de `items` no projeto hospedado e versionar a policy.
- Decidir `items.nota`: criar coluna + migration ou remover do modelo JS.
- Registrar as decisões estruturais em ADRs.

Critério de saída: suíte verde, schema conferido, decisões escritas.

### 4.2 Domínio puro

- Separar as funções puras de `src/lib/` de qualquer acesso a DOM, Supabase ou
  `window`.
- Definir as formas de `Item`, `UserList`, `ItemList`, `TMDbTitle`,
  `SearchFilters`, `Progress`, `Tier` e `Status`.
- Portar os testes de domínio sem alterar comportamento.

Critério de saída: domínio testável sem DOM; nenhuma fórmula mudou.

### 4.3 Dados e sessão

- Uma porta de entrada para Supabase, com erros mapeados.
- Repositórios por agregado: catálogo, listas e relações.
- `getSession` + `onAuthStateChange` para reagir a expiração/logout.
- Timeout, `AbortController` e retry com backoff nas leituras idempotentes.
- Cache separado por usuário.

Critério de saída: a UI lista/cria/edita/exclui sem conhecer Supabase; nenhuma
chamada TMDb fora do gateway.

### 4.4 Design system

- Dividir `style.css` em tokens, temas, base e componentes.
- Preservar os nomes de token (`--bg-*`, `--text-*`, `--accent`, `--tier-*`,
  `--home-*`).
- Extrair os componentes que já existem na prática: Card, Rail, Modal, Tabs,
  Stepper, EmptyState, Skeleton, Toast.

Critério de saída: telas novas montam com os componentes; tema claro/escuro
funciona sem regra por componente; alvos ≥44px.

### 4.5 Rotas e shell

- Rotas reais para home, catálogo, próximos, pesquisa, listas, título, perfil e
  login.
- Guard de auth e restauração de scroll/foco ao trocar de rota.
- Deep link para título/lista; voltar do navegador funciona.
- Filtros relevantes na query string.

Critério de saída: recarregar em `/titulo/123` abre o título; voltar retorna à
tela anterior.

### 4.6 Telas

- Auth, Catálogo, Título, Home, Busca, Perfil e Listas, nessa ordem de risco.
- Estados de loading, vazio e erro em cada tela.
- Acessibilidade e testes de fluxo.

Critério de saída: todos os fluxos do `01-visao-geral.md` funcionam; nenhuma
regra de negócio duplicada na UI.

### 4.7 Endurecimento

- E2E dos fluxos críticos.
- Auditoria de acessibilidade.
- Orçamento de performance e monitoramento de erro.
- Remoção de código morto e atualização da documentação.

---

## 5. Critérios de aceite

### 5.1 Paridade funcional

- [ ] Login, cadastro, logout e sessão expirada.
- [ ] Catálogo com busca local, filtros combinados, ordenação e agrupamento.
- [ ] Página do título com progresso, steppers, status, tier, listas e episódios.
- [ ] Adicionar título pela busca do TMDb, com dedupe e seleção de listas.
- [ ] Home com todas as seções e botão de atualizar.
- [ ] Listas: criar, renomear, reordenar, excluir e associar títulos.
- [ ] Perfil: nome, tema, barra de progresso.
- [ ] Corrigir vínculo de título.
- [ ] Estados vazios, carregando e erro em todas as telas.

### 5.2 Dados

- [ ] Nenhuma duplicata `(user_id, tmdb_id)`.
- [ ] RLS de `items`, `user_lists` e `item_lists` verificada e versionada.
- [ ] `tipo NULL` preservado.
- [ ] `nota` decidida (coluna ou remoção).
- [ ] Migração de dados ensaiada e reversível.
- [ ] Nenhum dado de um usuário visível para outro no mesmo navegador.

### 5.3 Desktop

- [ ] Navbar superior e toolbar utilizáveis em ≥1280px.
- [ ] Modais mantêm largura de leitura e não viram folhas gigantes.
- [ ] Grade e trilhos mantêm a medida única do card.
- [ ] Tema claro/escuro e `prefers-reduced-motion`.

### 5.4 Qualidade

- [ ] `npm run lint` sem erro.
- [ ] Testes de domínio verdes.
- [ ] Testes de componente para Card, Rail, Tabs, Modal e Stepper.
- [ ] E2E dos fluxos críticos.
- [ ] Sem `console.error` em fluxo normal.
- [ ] Documentação atualizada no mesmo commit.

### 5.5 Performance

- [ ] LCP < 2,5s em 4G simulado na home.
- [ ] JS inicial dentro do orçamento acordado (ex.: < 200KB gzip).
- [ ] Imagens com tamanho correto e lazy fora da primeira dobra.
- [ ] Nenhuma requisição TMDb duplicada em voo.

---

## 6. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| RLS de `items` divergente ou ausente | Média | Alto | Auditar o projeto hospedado antes de qualquer migração; versionar a policy |
| Perda/duplicação de dados na migração | Média | Alto | Ensaio em cópia; script idempotente; backup; rollback |
| Suíte vermelha esconde regressão | Alta | Alto | Baseline verde antes de mudanças estruturais |
| Escopo virar redesign | Alta | Médio | Congelar tokens e anatomia; revisão visual separada |
| CSS quebra ao dividir | Média | Médio | Preservar tokens e ordem; contratos visuais; revisão por tela |
| Cota/allow-list do TMDb | Média | Médio | Gateway único, cache, retry com limite, monitorar 429 |
| Sessão expirada sem aviso | Média | Médio | `onAuthStateChange` + guard + mensagem |
| Drag-and-drop de listas | Média | Baixo | Biblioteca testada; fallback por botões |
| `totalEpisodios` não confiável | Alta | Médio | Manter prioridade do `seasonEpisodesMap`; não “corrigir” com total bruto |
| Mudança grande de uma vez | Média | Alto | Entregar por camada/tela, com o app funcionando entre etapas |

---

## 7. Decisões que precisam de ADR

1. **Roteador** — adotar um ou manter o hash atual expandido.
2. **Estado de servidor** — cache próprio vs biblioteca de query.
3. **Estratégia de CSS** — manter tokens em CSS puro ou adotar CSS Modules.
4. **Cache** — LRU atual vs persistência por usuário.
5. **`items.tipo`** — manter `NULL` ou tornar obrigatório com valor
   “desconhecido”.
6. **`items.nota`** — criar coluna ou remover do modelo.
7. **Realtime** — fora do v1 ou entra.
8. **Estratégia de entrada** — rota a rota vs tela a tela.

---

## 8. O que não fazer

- **Não começar pelo CSS.** Sem domínio e rotas definidos, o design system vira
  retrabalho.
- **Não apagar testes de contrato para “destravar”.** Migre-os.
- **Não mudar a identidade visual** (paleta, fontes, card) no mesmo esforço da
  mudança estrutural.
- **Não introduzir realtime ou offline** antes da paridade funcional.
- **Não migrar dados** antes de conferir a RLS e o índice único.
- **Não manter dois roteadores** (hash antigo + router novo) por tempo
  indefinido.
