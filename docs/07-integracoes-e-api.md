# 07 — Integrações e API

O app fala com três serviços:

1. **Supabase Auth** — sessão do usuário.
2. **Supabase Postgres/PostgREST** — catálogo e listas.
3. **Edge Functions** — único caminho para TMDb e Fanart.tv.

Nenhuma chave de API externa vai ao navegador.

---

## Variáveis de ambiente

### Frontend (Vite)

| Variável | Onde é lida | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Chave pública (anon) |

O arquivo `.env` não é versionado. Sem as duas variáveis, o client é criado com
`undefined` e o app loga erro no console.

### Edge Functions (secrets do Supabase)

| Secret | Função | Uso |
|---|---|---|
| `TMDB_API_KEY` | `clever-endpoint` | Autenticar chamadas ao TMDb |
| `FANART_API_KEY` | `fanart-logo` | Autenticar chamadas ao Fanart.tv |

Configuração:

```bash
supabase secrets set TMDB_API_KEY=...
supabase secrets set FANART_API_KEY=...
```

### Script administrativo

| Variável | Uso |
|---|---|
| `SUPABASE_URL` ou `VITE_SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Migração de dados |

A service role **nunca** pode ir para o frontend nem para variáveis `VITE_*`.

---

## Supabase Auth

`src/lib/auth.js`:

| Função | Chamada | Retorno |
|---|---|---|
| `getCurrentSession` | `supabase.auth.getSession()` | Sessão ou `null` |
| `getCurrentUser` | `supabase.auth.getUser()` | Usuário ou `null` |
| `loginWithPassword` | `signInWithPassword` | `{ user, session }` |
| `signUpWithPassword` | `signUp` com `options.data.full_name` | `{ user, session }` |
| `updateDisplayName` | `updateUser({ data: { full_name } })` | Usuário atualizado |

- Não há tabela `profiles`.
- Não há recuperação de senha no app.
- O logout é chamado direto em `main.js` (`supabase.auth.signOut`).
- O cliente Supabase injeta o JWT da sessão nas chamadas a `functions.invoke`, o
  que satisfaz o `verify_jwt` das Edge Functions.

---

## Supabase Postgres (PostgREST)

### Leitura do catálogo

```js
supabase
  .from('items')
  .select(`
    *,
    item_lists (
      list_id,
      user_lists ( id, nome, is_system )
    )
  `)
  .eq('user_id', user.id)
  .order('data_criacao', { ascending: false })
```

### Escrita

| Operação | Tabela | Observação |
|---|---|---|
| Inserir item | `items` | `23505` vira erro amigável |
| Atualizar item | `items` | Só chaves presentes |
| Excluir item | `items` | Cascata em `item_lists` |
| Listar listas | `user_lists` | `ORDER BY ordem` |
| Criar/renomear/excluir lista | `user_lists` | Exclusão bloqueada para `is_system` |
| Adicionar/remover relação | `item_lists` | `23505` = já existe |

### RLS

- `user_lists` e `item_lists` têm políticas versionadas.
- `items` **não tem política versionada**; validar no projeto hospedado (ver
  [04](04-modelos-de-dados.md#rls)).

---

## Edge Functions

### `clever-endpoint`

Proxy do TMDb.

**Contrato**

```http
POST /functions/v1/clever-endpoint
Authorization: Bearer <jwt-do-usuário>
Content-Type: application/json

{
  "endpoint": "search/tv",
  "params": { "query": "ruptura", "language": "pt-BR" }
}
```

**Resposta de sucesso:** payload JSON do TMDb, status 200.

**Regras**

1. `OPTIONS` responde CORS.
2. Só `POST`; outros métodos → 405.
3. Exige usuário real (`role === 'authenticated'` e `sub` string não vazia).
4. `TMDB_API_KEY` precisa existir; senão 500.
5. `endpoint` precisa passar na allow-list e ter ≤ 120 caracteres.
6. `params` precisa ser objeto; arrays viram string separada por vírgula.
7. `api_key`, `undefined`, `null` e `''` são ignorados.
8. Erro do TMDb devolve o status original e `{ error, details }`.
9. Erro interno devolve 500 com a mensagem.

**Allow-list** (`supabase/functions/_shared/allowedEndpoint.ts`):

```regex
^(?:search\/(?:tv|multi)|discover\/tv|trending\/tv\/(?:day|week)|genre\/tv\/list|tv\/\d+(?:\/(?:images|aggregate_credits|recommendations|similar|season\/\d+))?)$
```

Endpoints permitidos, na prática:

| Endpoint | Usado por |
|---|---|
| `search/tv` | Busca, correção de vínculo, episódios, afinidade |
| `search/multi` | Permitido, sem uso atual |
| `discover/tv` | Home, busca avançada, roleta |
| `trending/tv/day` / `week` | Em Alta, roleta |
| `genre/tv/list` | Filtros de gênero |
| `tv/{id}` | Detalhes, temporadas, gêneros, calendário |
| `tv/{id}/images` | Logos e imagens |
| `tv/{id}/aggregate_credits` | Ficha técnica |
| `tv/{id}/recommendations` | Afinidade |
| `tv/{id}/similar` | Afinidade (fallback) |
| `tv/{id}/season/{n}` | Episódios |

**CORS:** `Access-Control-Allow-Origin: *`, headers `authorization`,
`x-client-info`, `Content-Type`, `apikey`; métodos `POST, OPTIONS`.

---

### `fanart-logo`

Fallback de logo transparente.

**Contrato**

```http
POST /functions/v1/fanart-logo
Authorization: Bearer <jwt-do-usuário>
Content-Type: application/json

{ "tmdbId": 95396, "mediaType": "tv" }
```

**Resposta:** `{ "logoUrl": "https://..." }` ou `{ "logoUrl": null }`.

**Regras**

1. `OPTIONS` responde CORS.
2. Só `POST`.
3. Exige usuário real.
4. `tmdbId` é normalizado para inteiro positivo; qualquer outra coisa → 400.
   A validação existe porque o id é interpolado na URL e poderia vazar a chave
   para outro caminho.
5. `FANART_API_KEY` ausente → 500.
6. `mediaType === 'movie'` usa `/movies`; qualquer outro usa `/tv`.
7. Falha do Fanart (não-2xx) → 200 com `logoUrl: null` (degradação suave).
8. Prefere `clearlogo[0]`, depois `hdtvlogo[0]`.

---

### `verify_jwt`

`supabase/config.toml`:

```toml
[functions.fanart-logo]
verify_jwt = true

[functions.clever-endpoint]
verify_jwt = true
```

**Por que não basta:** a `anon key` também é um JWT válido e é pública (vai no
bundle). `verify_jwt` barra token inválido/ausente, mas aceita a anon key. Por
isso as funções também checam `role === 'authenticated'` + `sub`.

### `_shared/auth.ts`

- `readClaims(req)`: lê `Authorization: Bearer <jwt>`, exige 3 segmentos e
  decodifica o payload em base64url. **Não revalida assinatura** — o gateway já
  validou.
- `isAuthenticatedUser(claims)`: aceita só `role === 'authenticated'` com `sub`
  string não vazia. Rejeita `anon`, `service_role`, `sub` vazio ou não-string.
- `unauthorizedResponse(cors)`: 401 JSON com CORS.

### `_shared/allowedEndpoint.ts`

- `MAX_ENDPOINT_LENGTH = 120`.
- `isAllowedEndpoint` exige string, tamanho e regex.
- É importado pela função **e** pelos testes (`cleverEndpoint.test.js`,
  `integration.test.js`), para a barreira não divergir da suíte.

---

## TMDb

### Base

`https://api.themoviedb.org/3` — chamada apenas pela Edge Function.

### Imagens

`https://image.tmdb.org/t/p/<size><file_path>`

Tamanhos usados:

| Tamanho | Uso |
|---|---|
| `w92` | Miniatura no dropdown de afinidade |
| `w342` | Pôster de card da home |
| `w500` | Pôster de catálogo, logo, arte de temporada |

### Idioma

- Padrão do app: `pt-BR`.
- Logos usam `include_image_language=pt-BR,en-US,null` e fallback
  `pt,en,null`.
- Imagens de temporada usam `null` (sem idioma).

### Normalização

`normalizeTrendingItem(raw)`:

```js
{
  id: raw.id,
  title: raw.name || raw.title || 'Sem título',
  mediaType: 'tv',
  posterUrl: raw.poster_path ? `https://image.tmdb.org/t/p/w342${raw.poster_path}` : '',
  posterPath: raw.poster_path || null,
  voteAverage: raw.vote_average || 0,
  overview: raw.overview || '',
  date: raw.first_air_date || raw.release_date || '',
  raw
}
```

`voteAverage` é carregado para o score interno, mas **não é exibido** na busca.

### Limites

- O TMDb devolve 20 itens por página e limita `page * 20` a 500.
- O app usa no máximo 15 páginas por coleta (`MAX_PAGES`), ou seja, 300 itens.
- A busca avançada carrega 2 páginas por vez (40 itens).

---

## Fanart.tv

- Base: `https://webservice.fanart.tv/v3`.
- Usado apenas como fallback de logo.
- A chave fica no secret `FANART_API_KEY`.
- A função tenta `clearlogo` e depois `hdtvlogo`.
- Falha não quebra a UI.

---

## Cache e resiliência

| Camada | O que faz |
|---|---|
| `cache.js` | LRU em memória + `localStorage`, TTL 1 h, máx. 200 |
| `cachedCallTMDB` | Cache por endpoint + params + idioma |
| `fetchTvDetailsCached` | Dedupe de chamadas simultâneas + fila de 4 |
| `collectFiltered` | Pagina até `needed`, para na página sem novidade |
| `fresh` | Ignora leitura e regrava resposta |
| `Promise.allSettled` | Tolerância a falhas parciais em listas/afinidade |
| `try/catch` por seção | Home não cai inteira |

### O que não existe

- Retry com backoff.
- Circuit breaker.
- Cancelamento de requisição (`AbortController`).
- Rate limiting próprio.
- Telemetria/monitoramento.

---

## Segurança

### Modelo

```text
Navegador
  ├── anon key (pública) → Supabase Auth/Postgres com RLS
  └── JWT do usuário    → Edge Functions (verify_jwt + role/sub)
                              └── secrets (TMDB/Fanart) nunca saem do servidor
```

### Garantias

1. Chaves externas só em secrets.
2. Endpoint do TMDb limitado por allow-list.
3. `tmdbId` do Fanart validado como inteiro positivo.
4. `service_role` só no script administrativo.
5. RLS isola listas por usuário.
6. A anon key sozinha **não** passa nas funções.

### Riscos a revisar

1. **RLS de `items` não versionada.**
2. **CORS `*`**: aceitável para API pública com JWT, mas revisar se o produto
   ganhar domínio fixo.
3. **Sem rate limit por usuário**: um usuário autenticado pode consumir cota.
4. **`readClaims` não valida assinatura**: correto sob `verify_jwt = true`, mas
   não reutilizar o módulo fora desse contexto.
5. **`fetchLogoFromTMDB` com `movie/{id}/images`**: endpoint fora da allow-list.
6. **Logs**: erros vão ao console do navegador; não há correlação/ID de request.

---

## Como testar as integrações localmente

1. Configure `.env` com URL e anon key.
2. Faça login no app.
3. Suba as funções:
   ```bash
   supabase functions serve clever-endpoint --env-file ./supabase/.env.local
   supabase functions serve fanart-logo --env-file ./supabase/.env.local
   ```
4. Para testes automatizados, as suítes não chamam rede: elas importam
   `_shared/auth.ts` e `_shared/allowedEndpoint.ts` diretamente e usam mocks de
   `fetch`/Supabase quando necessário.

---

## Checklist de evolução

- [ ] Manter as duas funções como único caminho externo.
- [ ] Manter a allow-list compartilhada com os testes.
- [ ] Trocar `functions.invoke` por um cliente de API tipado, mas preservar o
      contrato `{ endpoint, params }`.
- [ ] Centralizar tratamento de erro/401 e renovação de sessão.
- [ ] Adicionar retry/backoff apenas para leituras idempotentes.
- [ ] Versionar a RLS de `items`.
- [ ] Remover o caminho `movie/{id}/images` ou incluí-lo na allow-list.
- [ ] Definir rate limit/telemetria antes de abrir para mais usuários.
