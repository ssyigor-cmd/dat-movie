# 09 — Testes

A suíte é o principal registro executável das decisões do projeto. Ela mistura
**testes de domínio** (funções puras) com **contratos de texto** que leem
`style.css`, `index.html` e os fontes para impedir regressões visuais silenciosas.

> **Estado em 06/11/2026:** `npm test` executa **29 arquivos** e **527 casos**.
> Resultado: **29 arquivos passam, 0 falham**; `npm run lint` também está limpo.
> As decisões que levaram a isso estão na seção 7.

---

## 1. Stack e filosofia

| Item | Valor |
|---|---|
| Runner | Vitest 4 (`node node_modules/vitest/vitest.mjs run`) |
| Ambiente | Node (sem `jsdom`, sem navegador) |
| Rede | Nenhum teste chama Supabase ou TMDb de verdade |
| Banco | Nenhum teste toca Postgres |
| Config | `vitest.config.js` injeta `VITE_SUPABASE_URL`/`ANON_KEY` dummy |
| Node mínimo | 22 (`@supabase/supabase-js` usa `WebSocket` global no import) |

O `vitest.config.js` existe por um motivo específico: `src/lib/api.js` importa
`supabase.js`, que chama `createClient` no topo do módulo. Sem as variáveis
dummy, a suíte inteira dependeria de um `.env` local e quebraria em CI.

### Dois tipos de teste

1. **Comportamento** — importa o módulo e chama a função. Ex.: `calcularProgresso`,
   `matchScore`, `pickWithMix`, `isAllowedEndpoint`.
2. **Contrato de texto** — lê arquivos com `readFileSync` e verifica presença,
   ausência, ordem ou forma de uma regra/markup. Ex.: tipografia, anatomia do
   card, tokens da home, posição de “Em Breve”.

O segundo tipo é deliberado: “a fonte mudou” ou “o botão não funciona” só
aparecem olhando a tela, muitas vezes semanas depois do commit. O teste de
contrato falha no CI no mesmo commit.

---

## 2. Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Roda a suíte uma vez |
| `npm run lint` | ESLint em `src`, `tests` e `scripts` |
| `npm run check` | `lint` → `test` → `build` |
| `npm run build` | Build de produção (Vite) |
| `npm run migrate` | Migração administrativa de dados (não é teste) |

O CI (`.github/workflows/ci.yml`) roda em Node 22, com `npm ci`, lint, testes e
build. O lint é obrigatório porque `no-undef` já pegou 32 `ReferenceError` que
nem teste nem build detectavam.

---

## 3. Inventário das 29 suítes

Contagem de `it(` por arquivo; “tipo” indica o foco principal.

| # | Arquivo | Casos | Tipo | O que prende |
|---|---|---:|---|---|
| 1 | `affinityMemory.test.js` | 8 | Comportamento | Memória de quais títulos a afinidade já mostrou; seed/offset; reset |
| 2 | `affinityRails.test.js` | 17 | Comportamento | Trilhos de afinidade: quantidade, base, cache, repetição |
| 3 | `autoRotate.test.js` | 7 | Comportamento | Timer de rotação de imagens, pausa, cancelamento |
| 4 | `cache.test.js` | 9 | Comportamento | LRU + TTL + `localStorage`, prefixos, limite de 200 |
| 5 | `cards.test.js` | 8 | Contrato | Anatomia única do card; uma só implementação de markup |
| 6 | `catalog.test.js` | 40 | Comportamento | `escapeHTML`, filtros, ordenação, progresso, datas, tier |
| 7 | `cleverEndpoint.test.js` | 20 | Segurança | Allow-list do proxy TMDb, tamanho, método, path |
| 8 | `dedupe.test.js` | 12 | Comportamento | `isDuplicateInCatalog`, `filterNotInCatalog`, `String(undefined)` |
| 9 | `discoverSearch.test.js` | 37 | Comportamento | Filtros avançados, parâmetros do discover, dedupe, ordenação, busca |
| 10 | `freshRefresh.test.js` | 10 | Comportamento + contrato | Flag `fresh`, cache, fiação dos botões de atualizar |
| 11 | `functionAuth.test.js` | 14 | Segurança | Claims JWT, usuário autenticado, resposta 401 |
| 12 | `fuzzySearch.test.js` | 34 | Comportamento | Normalização, distância de edição, score, ordenação, fallback |
| 13 | `glow.test.js` | 5 | Contrato | Nenhum halo no acento; sombras legítimas intactas |
| 14 | `homeLayout.test.js` | 29 | Contrato | Tokens da home, trilho único, medida JS/CSS, sem estilo inline |
| 15 | `imageNavigation.test.js` | 15 | Comportamento | `nextImage`, `prevImage`, dedupe, idioma, largura |
| 16 | `integration.test.js` | 9 | Contrato/integração | Chaves de storage e contrato de entrada do proxy |
| 17 | `logoPicker.test.js` | 13 | Comportamento | Escolha canônica de logo por idioma/qualidade |
| 18 | `progressBar.test.js` | 9 | Contrato | Preferência da barra: markup, persistência, menu |
| 19 | `recommendScoring.test.js` | 51 | Comportamento | Bayes, popularidade, recência, sinais, mix 70/30, filtros |
| 20 | `searchPage.test.js` | 9 | Contrato | IDs da busca avançada, fiação, decisão “sem nota” |
| 21 | `seasonArt.test.js` | 22 | Comportamento | Temporada rastreada, pôster por temporada, fallback |
| 22 | `stepperTint.test.js` | 3 | Contrato | Stepper soma verde, subtrai vermelho |
| 23 | `theme.test.js` | 14 | Contrato | Claro por token, escolha do usuário, marca/logos |
| 24 | `titleFilters.test.js` | 31 | Comportamento | Título não latino, data futura absurda, arte, idioma, bloqueios |
| 25 | `titleInfoModal.test.js` | 22 | Comportamento | Bandeiras, idioma, classificação etária, status |
| 26 | `titleRelations.test.js` | 19 | Comportamento | Título-base, continuação, tag, ordenação, pai |
| 27 | `trending.test.js` | 43 | Comportamento | Cache, janela de 7 dias, favoritos, estatísticas, rotação, calendário |
| 28 | `typography.test.js` | 7 | Contrato | Famílias, pesos reais, reserva do mono |
| 29 | `upcoming.test.js` | 9 | Contrato | Posição, carregamento, TMDb e corpo do card de “Em Breve” |

**Total:** 527 casos.

### 3.1 O que cada bloco cobre, em resumo

- **Catálogo e progresso** (`catalog`, `dedupe`): a regra mais sensível do
  produto. `calcularProgresso` tem vários cenários (mapa de temporadas, total
  não confiável, episódio acima do total, filme). Filtros combinam texto, tier,
  status, década, idade e coleção. Ordenação cobre nome, data, tier, progresso e
  ano.
- **Busca** (`fuzzySearch`, `discoverSearch`, `searchPage`): normalização sem
  acento, tolerância a erro, score, fallback de consultas, parâmetros do
  `discover/tv`, dedupe por id, ordenação e estados da UI.
- **Recomendação** (`recommendScoring`, `trending`, `affinity*`): score
  bayesiano, log de popularidade, recência, sinais do usuário, mix 70/30,
  sorteio ponderado, rotação, embaralhamento e trilhos de afinidade.
- **TMDb e arte** (`imageNavigation`, `logoPicker`, `seasonArt`, `titleFilters`,
  `titleRelations`, `titleInfoModal`): curadoria de imagens, escolha de logo,
  pôster por temporada, filtros de qualidade, relações de continuação e ficha
  técnica.
- **Infra** (`cache`, `autoRotate`, `freshRefresh`): TTL, LRU, persistência,
  restauração, invalidação por prefixo e o ciclo do botão “Atualizar”.
- **Segurança** (`cleverEndpoint`, `functionAuth`, `integration`): allow-list,
  tamanho máximo de endpoint, claims e resposta 401.

---

## 4. Como os contratos de texto funcionam

Padrões repetidos:

```js
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'style.css'), 'utf8');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
```

- **Comentários são removidos** antes de procurar regras
  (`replace(/\/\*[\s\S]*?\*\//g, ' ')`), porque a folha explica decisões
  citando tokens que não são mais declarações.
- **Regras CSS são parseadas** com `matchAll(/([^{}]+)\{([^{}]*)\}/g)`, e os
  seletores são separados por vírgula. Isso evita o falso positivo de olhar só a
  última linha de um bloco com 27 seletores.
- **Fontes são varridas** (`walk`) para pegar todo `.js`/`.html` em `src`, não
  três arquivos escolhidos a dedo.
- **Ordem no template** é verificada com `indexOf` (ex.: “Em Breve” depois da
  afinidade).
- **Ausência** é tão importante quanto presença: `not.toContain('vote_average')`,
  `not.toContain('if (busy) return')`, `not.toContain('callTMDB(...)'`.

### Vantagens

- Roda em milissegundos, sem navegador.
- Pega regressão de decisão (token, família, ordem, fiação) no commit.
- Obriga a documentar o “porquê” no próprio teste.

### Limitações

- Não prova que a tela funciona; prova que o texto tem a forma esperada.
- Quebra com refactor legítimo (renomear classe, mudar ordem, trocar
  `innerHTML` por componente).
- Pode passar com código morto que ainda contenha a string.
- Pode falhar por detalhe de formatação (linha, CRLF, espaço).

---

## 5. Segurança coberta

### 5.1 `cleverEndpoint.test.js`

Importa a **allow-list real** de `supabase/functions/_shared/allowedEndpoint.ts`
— não uma cópia. Verifica endpoints permitidos (TV), rejeição de filmes, path
travessia, query string, tamanho máximo de 120 caracteres e método.

### 5.2 `functionAuth.test.js`

Importa `_shared/auth.ts` e cobre:

- leitura de claims do JWT;
- `isAuthenticatedUser` exige `role === 'authenticated'` **e** `sub`;
- resposta 401 padronizada.

### 5.3 `integration.test.js`

Verifica as chaves de `localStorage` e o contrato de entrada do proxy. **Atenção:**
o bloco chamado “state.js — contratos e integração” **não importa**
`src/lib/state.js`; ele redefine `STORAGE_KEYS` localmente e testa o próprio
mock. É um teste tautológico, não uma garantia sobre o módulo real.

---

## 6. Cobertura real e lacunas

### 6.1 O que **não** é testado

| Área | Lacuna |
|---|---|
| Renderização | Nenhum teste monta DOM, clica, digita ou verifica foco |
| Navegação | Abas, hash, voltar do título, deep link e restauração de estado |
| Auth | Login, cadastro, erros, sessão expirada, `onAuthStateChange` |
| Supabase | CRUD, RLS, migrations, índices, concorrência |
| `main.js` | Só contratos de texto pontuais; nenhuma execução |
| `titlePage.js` | Nenhum teste direto da página mais complexa |
| `homePage.js` | Contratos de posição/fiação; nenhum comportamento de clique |
| Modais | Abertura, foco preso, Escape, restauração de foco |
| Acessibilidade | Nenhum axe/automação; só contratos de CSS |
| Layout | Nenhum viewport real; medidas e tokens só por leitura de texto |
| Visual | Nenhum screenshot/regressão visual |
| Performance | Nenhum orçamento de bundle, LCP ou memória |
| Banco | Nenhum teste de migration ou de política RLS |
| Erros de rede | Timeout, retry, abort, rate limit |

### 6.2 Cobertura por módulo (qualitativa)

| Módulo | Cobertura |
|---|---|
| `catalog.js` | Alta |
| `recommendScoring.js` | Alta |
| `discoverSearch.js` | Alta |
| `fuzzySearch.js` | Alta |
| `trendingApi.js` | Alta, porém dependente de mocks e contratos de texto |
| `cache.js` | Alta |
| `titleFilters.js` | Alta |
| `titleRelations.js` | Alta |
| `seasonArt.js` / `logoPicker.js` / `imageNavigation.js` | Alta |
| `api.js` | Indireta (mockada); sem teste de contrato HTTP real |
| `auth.js` | Nenhuma |
| `lists.js` | Nenhuma |
| `state.js` | Nenhuma (o teste homônimo não o importa) |
| `dom.js` | Nenhuma |
| `main.js` | Baixa |
| `titlePage.js` | Nenhuma |
| `homePage.js` | Baixa/média (contratos) |
| `cards.js` | Média (markup) |
| `searchPage.js` | Baixa (fiação) |

### 6.3 Ausência de cobertura configurada

Não há `coverage` no `vitest.config.js` nem script `test:coverage`. Se quiser
medir, adicione `@vitest/coverage-v8` e um limite mínimo — mas não use a
porcentagem como substituto dos contratos de decisão.

---

## 7. Estado: suíte verde (06/11/2026)

`npm test` fecha com **29 suítes, 527 casos e 0 falhas**; `npm run lint` também
está limpo. O que era vermelho e como cada caso foi decidido:

| Suíte | Caso | Resolução |
|---|---|---|
| `catalog.test.js` | "limita o resultado a 100% no máximo" | Expectativa desatualizada. O caso usava item **sem mapa**, que é exatamente o caminho do guard "total não confiável". Passou a exercitar o teto com mapa (15 contra 10 no mapa → 100), e o guard ganhou caso próprio (`→ 0`), conforme `05-logica-de-negocio.md` |
| `catalog.test.js` | "ignora total por temporada que não fecha com o que foi assistido" | Contradizia o caso vizinho "não acumula temporadas anteriores sem seasonEpisodesMap", que fixa 3/40 → 8. Alinhada a 2/9 → 22 e renomeada para dizer o que mede |
| `freshRefresh.test.js` | "getTitlesByYear não recebe fresh: fica com o cache de 1h" | Falso negativo de CRLF: o assert procurava `poolSizeFor(lim)\n` e o checkout no Windows tem `\r\n`. A leitura do fonte agora normaliza o EOL |

> `trending.test.js` ("cai para os episódios recentes…") já estava resolvido
> antes deste levantamento.

### O que ficou aprendido

- Teste de contrato que lê o fonte **não pode depender do EOL** do checkout: o
  mesmo arquivo é CRLF no Windows e LF no CI, e o teste passa de um lado só.
- Quando a expectativa contradiz um caso vizinho do mesmo bloco, o errado
  costuma ser a expectativa — não o código que implementa a regra documentada.
- O que continua frágil é o **tipo** de contrato, não o baseline: prender
  refactor a regex do fonte quebra teste sem mudar comportamento. Ver
  `10-divida-tecnica-e-refatoracao.md` (D05).

---

## 8. Regras para mudanças

1. **Não apague teste para deixar o CI verde.** Se o contrato mudou, reescreva o
   teste para o novo contrato e explique no commit.
2. **Separe domínio de apresentação.** Funções puras devem continuar testáveis
   sem DOM; componentes devem ser testáveis com Testing Library/jsdom.
3. **Migre contratos de texto para contratos de componente** quando possível:
   em vez de procurar `class="card-title"` no fonte, renderize o card e verifique
   o papel/nome acessível.
4. **Mantenha os testes de segurança** (`cleverEndpoint`, `functionAuth`)
   importando os arquivos reais das Edge Functions.
5. **Adicione testes que faltam** na ordem de risco: auth/sessão, CRUD/RLS,
   navegação, modais/foco, título, home.
6. **Não copie a allow-list** para o teste; importe de `_shared/`.
7. **Rode `npm run check`** antes de considerar a fase concluída.

---

## 9. Pirâmide sugerida

```text
        E2E (poucos, críticos)
        ├─ login → catálogo → título → marcar episódio → recarregar
        ├─ busca → adicionar → lista
        └─ tema claro/escuro e navegação por teclado
      Integração (médio)
        ├─ repositórios Supabase contra banco local/CI
        ├─ Edge Functions com JWT real
        └─ rotas + guards de sessão
    Componentes (médio)
        ├─ Card, Rail, Modal, Stepper, EmptyState
        └─ acessibilidade (foco, ARIA, teclado)
  Unitário (muitos)
        ├─ progresso, filtros, dedupe, score, cache, datas
        └─ parsing/normalização
```

### Critérios de aceite de teste

- [ ] `npm test` verde no baseline antes da primeira mudança estrutural.
- [ ] Nenhuma regra de negócio sem teste unitário.
- [ ] Todo fluxo crítico com pelo menos um teste de integração ou E2E.
- [ ] Contratos visuais migrados ou substituídos conscientemente.
- [ ] Testes de segurança das funções continuam importando o código real.
- [ ] CI roda lint + testes + build em Node 22.
- [ ] Cobertura medida, mas não usada como única meta.
