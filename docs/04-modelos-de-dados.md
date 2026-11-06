# 04 — Modelos de dados

O Dat-Movie tem **três tabelas de domínio** no Postgres, um modelo JavaScript
normalizado e alguns blobs de `localStorage`. A fonte da verdade do schema é
`supabase/migrations/`; este documento explica o desenho e as invariantes.

---

## Diagrama entidade-relacionamento

```text
auth.users (Supabase)
    │ 1
    │
    │ N
┌───▼──────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ items            │ 1      N │ item_lists       │ N      1 │ user_lists       │
│                  ├──────────┤                  ├──────────┤                  │
│ id (PK)          │          │ id (PK)          │          │ id (PK)          │
│ user_id (FK)     │          │ item_id (FK)     │          │ user_id (FK)     │
│ nome             │          │ list_id (FK)     │          │ nome             │
│ tipo             │          │ data_adicao      │          │ is_system        │
│ temporada        │          │ UNIQUE(item,list)│          │ ordem            │
│ episodio         │          └──────────────────┘          │ UNIQUE(user,nome)│
│ total_episodios  │                                        └──────────────────┘
│ season_episodes_map (JSONB)│
│ status / tier    │
│ imagem / tmdb_id │
│ ano              │
│ data_criacao     │
│ data_atualizacao │
└──────────────────┘
```

- Um usuário tem muitos itens.
- Um usuário tem muitas listas.
- Um item pode estar em muitas listas e uma lista pode ter muitos itens.
- A exclusão de usuário cascateia para itens e listas; a exclusão de item ou
  lista cascateia para as relações.

---

## `items`

Arquivo: `supabase/migrations/create_items_table.sql`.

| Coluna | Tipo | Default | Regras |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `user_id` | `UUID` | — | `NOT NULL`, FK `auth.users(id)` `ON DELETE CASCADE` |
| `nome` | `VARCHAR(255)` | — | `NOT NULL` |
| `tipo` | `VARCHAR(50)` | `'serie'` | `NULL` ou `anime` / `animacao` / `serie` |
| `temporada` | `INTEGER` | `1` | Temporada atual |
| `episodio` | `INTEGER` | `0` | Episódio dentro da temporada atual |
| `total_episodios` | `INTEGER` | `1` | Total da série **ou** da temporada, dependendo de quem gravou — ver invariantes |
| `season_episodes_map` | `JSONB` | `'{}'` | Mapa temporada → quantidade de episódios |
| `status` | `VARCHAR(50)` | `'assistindo'` | `assistindo`, `concluido`, `planejado`, `pausado` |
| `tier` | `VARCHAR(5)` | — | `S+`, `S`, `A`, `B`, `C`, `D` ou `NULL` |
| `imagem` | `TEXT` | — | URL do pôster/arte |
| `tmdb_id` | `INTEGER` | — | Âncora externa; sem FK (TMDb é externo) |
| `ano` | `INTEGER` | — | Ano de estreia |
| `data_criacao` | `TIMESTAMPTZ` | `timezone('utc', now())` | `NOT NULL`; pode ser enviada pelo cliente |
| `data_atualizacao` | `TIMESTAMPTZ` | `timezone('utc', now())` | `NOT NULL`; atualizada por trigger |

### Constraints e índices

- `items_tipo_check`: `tipo IS NULL OR tipo IN ('anime','animacao','serie')`.
  **Não reintroduza `NOT NULL`** — `trendingApi.getNewEpisodes` tolera `tipo`
  nulo de propósito.
- `idx_items_user_id`: acelera `WHERE user_id = ?`.
- `idx_items_user_data_criacao`: `(user_id, data_criacao DESC)`, a query principal
  do app.
- `idx_items_user_tmdb_unique`: índice **único parcial** em `(user_id, tmdb_id)`
  `WHERE tmdb_id IS NOT NULL`. Itens sem TMDb podem se repetir; o mesmo TMDb não.

### Trigger

`update_items_updated_at` dispara `BEFORE UPDATE` e grava
`NEW.data_atualizacao = timezone('utc', now())`. O cliente não precisa (e não
deve) enviar `data_atualizacao`.

### RLS

As migrations versionadas **não criam políticas para `items`**. As políticas de
`user_lists` e `item_lists` estão em `create_lists_tables.sql`, mas a de `items`
precisa existir no projeto hospedado. Antes de alterar o modelo, valide no painel:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename = 'items';
```

O comportamento esperado é que cada usuário só leia/escreva linhas com
`user_id = auth.uid()`. A ausência de RLS em `items` seria uma falha de segurança,
não uma decisão de produto.

---

## `user_lists`

Arquivo: `supabase/migrations/create_lists_tables.sql`.

| Coluna | Tipo | Default | Regras |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `user_id` | `UUID` | — | `NOT NULL`, FK `auth.users(id)` cascade |
| `nome` | `VARCHAR(100)` | — | `NOT NULL` |
| `is_system` | `BOOLEAN` | `false` | Listas de sistema não podem ser excluídas pela UI |
| `ordem` | `INTEGER` | `0` | Ordem de exibição na navbar |
| `data_criacao` | `TIMESTAMPTZ` | `now()` UTC | `NOT NULL` |

- `UNIQUE(user_id, nome)`: o mesmo usuário não tem duas listas com o mesmo nome.
- Índices: `idx_user_lists_user_id`, `idx_user_lists_ordem (user_id, ordem)`.
- RLS habilitada:
  - `SELECT`, `INSERT`, `UPDATE`: `auth.uid() = user_id`.
  - `DELETE`: `auth.uid() = user_id AND is_system = FALSE`.

### Listas de sistema conhecidas

- **“Próximos”** (`is_system = true`) — usada pela aba Próximos. A migração cria
  com `ordem = 99`.
- **“Lista de Desejos”** — nome legado aceito no código da navbar.
- A UI da página do título **esconde** “Próximos” e “Lista de Desejos” do seletor
  de listas, porque elas são derivadas do status, não coleções livres.

---

## `item_lists`

| Coluna | Tipo | Default | Regras |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `item_id` | `UUID` | — | `NOT NULL`, FK `items(id)` cascade |
| `list_id` | `UUID` | — | `NOT NULL`, FK `user_lists(id)` cascade |
| `data_adicao` | `TIMESTAMPTZ` | `now()` UTC | `NOT NULL` |

- `UNIQUE(item_id, list_id)`: um título nunca aparece duas vezes na mesma lista.
- Índices: `idx_item_lists_item_id`, `idx_item_lists_list_id`.
- RLS habilitada com política `FOR ALL`:
  ```sql
  EXISTS (
    SELECT 1 FROM user_lists
    WHERE user_lists.id = list_id
      AND user_lists.user_id = auth.uid()
  )
  ```
  A verificação é da **lista**, não do item. Isso é intencional: o dono da relação
  é o dono da lista. Se item e lista tivessem donos diferentes, a política ainda
  seguiria a lista.

---

## Modelo JavaScript do item

`fetchItemsFromSupabase` converte o retorno do Supabase para:

```js
{
  id: 'uuid',
  user_id: 'uuid',
  nome: 'Ruptura',
  tipo: 'serie',              // 'anime' | 'animacao' | 'serie' | null
  temporada: 2,
  episodio: 11,
  totalEpisodios: 19,         // pode estar errado; ver invariantes
  seasonEpisodesMap: { "1": 9, "2": 10 },
  status: 'assistindo',       // assistindo | concluido | planejado | pausado
  nota: null,                 // campo do modelo sem coluna no DDL versionado
  imagem: 'https://image.tmdb.org/...',
  dataCriacao: '2026-09-01T...',
  dataAtualizacao: '2026-09-02T...',
  tmdb_id: 95396,
  tier: 'S+',                 // S+ | S | A | B | C | D | null
  ano: 2022,
  lists: [
    { id: 'uuid', nome: 'Séries', is_system: false }
  ]
}
```

### Mapa de conversão

| Banco (snake_case) | JS (camelCase) |
|---|---|
| `total_episodios` | `totalEpisodios` |
| `season_episodes_map` | `seasonEpisodesMap` |
| `data_criacao` | `dataCriacao` |
| `data_atualizacao` | `dataAtualizacao` |
| `tmdb_id` | `tmdb_id` (mantido) |
| `user_id` | `user_id` (mantido) |
| `item_lists[].user_lists` | `lists[]` |

`lists` é montado como:

```js
item.item_lists?.map(il => il.user_lists).filter(Boolean) || []
```

### Campos só de UI

Alguns campos existem apenas em memória, nunca no banco:

- `_isPreview` — marca um item que veio da busca e ainda não foi salvo.
- `_parentCandidate` / `_parentResults` — sugestão de série principal quando o
  título é uma continuação.
- Campos derivados de TMDb (detalhes, temporadas, classificação) são resolvidos
  sob demanda e não são persistidos no item.

---

## Invariantes de negócio

### 1. `tmdb_id` é a identidade externa

- Dois itens do mesmo usuário não podem ter o mesmo `tmdb_id`.
- O cliente checa (`isDuplicateInCatalog`), mas a última defesa é o índice único.
- Itens sem `tmdb_id` usam fallback `nome + tipo + ano` no cliente.

### 2. `status = 'planejado'` é uma fila separada

`filterItems` aplica:

- na aba `planejado`: só `status === 'planejado'`;
- em qualquer outra aba: exclui `status === 'planejado'`.

A aba Próximos ignora filtro de tier e agrupamento por tier. A lista de sistema
“Próximos” é o espelho dessa fila, mas o status é a fonte da verdade.

### 3. `seasonEpisodesMap` manda no progresso

- Formato: `{ "<numero_da_temporada>": <quantidade_de_episodios> }`.
- A soma do mapa é o total da série inteira.
- `total_episodios` é **não confiável**: nasce com `DEFAULT 1`, o modal de adicionar
  grava o total da série, e a página do título já gravou o total da temporada.
- A migration `fix_total_episodios_from_season_map.sql` corrige dados antigos.
- A página do título corrige o total sozinha na próxima abertura, quando tem mapa.

### 4. `tier` vazio é `NULL`

O app normaliza `item.tier || null`. O banco rejeita string vazia. O filtro
“Sem tier” usa `!item.tier`.

### 5. `data_atualizacao` é do banco

O trigger sobrescreve qualquer valor enviado em `UPDATE`.

### 6. `lists` é derivado

Nunca envie `lists` para a tabela `items`. A relação vive em `item_lists` e é
atualizada por `addItemToList` / `removeItemFromList`.

---

## Modelo de autenticação

Não há tabela `profiles`. O usuário do Supabase Auth carrega:

```js
user.email
user.user_metadata.full_name
user.created_at
```

- Cadastro grava `full_name` em `user_metadata`.
- Edição de nome usa `supabase.auth.updateUser({ data: { full_name } })`.
- Iniciais são derivadas do nome/e-mail no cliente.

---

## Persistência local (localStorage)

| Chave | Conteúdo | Gravada por | Observações |
|---|---|---|---|
| `activeTab` | Aba atual (`home`, `all`, `planejado`, `pesquisa`, `list`) | `state.persistNavState` | Validada na leitura |
| `activeListId` | Id da lista aberta | `state.persistNavState` | Removida quando não há lista |
| `groupingActive` | `"true"` / `"false"` | `state` na leitura | **Bug:** o toggle grava `state.groupingActive` (chave divergente) |
| `showProgressBar` | `"true"` / `"false"` | `main.js` | Ausência = mostrar |
| `theme` | `system` / `dark` / `light` | `main.js` | Ausência = `system` |
| `datmovie_cache_v1` | `{ data: { [key]: { value, expiresAt } }, ts }` | `cache.js` | Restaurado se `ts` < 7 dias |
| `datmovie_affinity_memory_v1` | `{ seed, offset, shown: [] }` | `affinityMemory.js` | Máx. 400 ids |

### Cache

- TTL padrão: 1 h.
- Tamanho máximo: 200 entradas.
- Persistência com debounce de 250 ms.
- Restauração máxima de 7 dias.
- Invalidação por prefixo (`trending_` para tendências).
- `cacheClear()` remove o blob inteiro (usado no logout).

### Memória de afinidade

- `shown`: FIFO de ids já exibidos, teto 400.
- `seed`: avança a cada pintura.
- `offset`: avança a âncora de cada faixa.
- Sem `localStorage`, degrada para memória de módulo (não sobrevive ao F5).

---

## Migrações e scripts

| Arquivo | O que faz | Quando rodar |
|---|---|---|
| `create_items_table.sql` | Cria `items`, trigger e índices | Primeiro, do zero |
| `create_lists_tables.sql` | Cria listas, relações, CHECK de tipo e RLS | Depois de `items` |
| `add_index_items_user_id.sql` | Índice redundante de `user_id` | Idempotente; já coberto por `create_items_table` |
| `add_unique_index_items_user_tmdb.sql` | Índice único parcial | Depois do diagnóstico de duplicatas |
| `migrate_existing_data.sql` | Cria listas e relações a partir dos itens | Uma vez, após as tabelas |
| `fix_total_episodios_from_season_map.sql` | Corrige totais antigos | Quando houver dados legados |
| `scripts/migrate-data.js` | Mesma migração via service role, para todos os usuários | `npm run migrate` em ambiente administrativo |

### Regras de migração

- `scripts/migrate-data.js` exige `SUPABASE_URL` e
  `SUPABASE_SERVICE_ROLE_KEY`; nunca use a service role no frontend.
- Cria “Minha Lista”, “Próximos” (sistema) e listas por tipo (`Animes`,
  `Animações`, `Séries`).
- Todo item entra na lista do seu tipo, ou em “Minha Lista” se o tipo for
  desconhecido.
- Itens `planejado` também entram em “Próximos”.
- O script é idempotente via `ON CONFLICT DO NOTHING` / `upsert`.

---

## Lacunas e riscos do modelo atual

1. **RLS de `items` não versionada.** Validar no projeto hospedado antes de
   assumir que o isolamento por usuário está garantido pelo repositório.
2. **`nota` no modelo JS sem coluna no DDL.** O mapeamento lê `item.nota`, mas
   `create_items_table.sql` não a cria. Ou é resíduo de versão antiga, ou a coluna
   existe só no banco. Confirmar antes de portar o modelo.
3. **`total_episodios` com semântica ambígua.** A evolução deve escolher uma
   unidade só (série inteira) ou eliminar a coluna em favor do mapa.
4. **`tipo` legado.** O CHECK aceita três valores e `NULL`, mas a UI não expõe
   todos os caminhos. Definir se o app mantém “tipo” ou passa a usar
   gênero/formato.
5. **`is_system` sem catálogo formal.** “Próximos” e “Lista de Desejos” são
   identificadas por nome no código. O ideal é uma coluna `slug`/`kind`.
6. **`ordem` sem constraint de unicidade.** Duas listas podem ter a mesma ordem;
   o desempate é implícito.
7. **Índice duplicado.** `add_index_items_user_id.sql` repete o índice já criado
   em `create_items_table.sql`. Inofensivo, mas ruído.
8. **Sem auditoria/histórico.** Atualizações sobrescrevem o estado; não há
   histórico de progresso.
