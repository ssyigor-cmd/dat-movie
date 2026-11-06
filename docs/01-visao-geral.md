# 01 — Visão geral

## O que é o Dat-Movie

O Dat-Movie é um **catálogo pessoal de séries de TV** (com espaço para animes e
animações) que combina três coisas que normalmente vivem em apps separados:

1. **Acompanhamento de progresso** — em que temporada e episódio o usuário parou.
2. **Curadoria pessoal** — status, nota de tier e listas customizáveis.
3. **Descoberta** — busca no TMDb, filtros avançados e recomendações na home.

O produto é uma SPA (single-page application) em JavaScript puro, com backend
Supabase (Auth + Postgres) e APIs externas acessadas exclusivamente por Edge
Functions. Não há framework de UI: o HTML é estático em `index.html` e o DOM é
manipulado por módulos em `src/`.

> **Escopo real hoje:** o proxy do TMDb aceita apenas endpoints de **TV**. Filmes
> não fazem parte do catálogo nem da allow-list de API.

---

## Problema e proposta

Quem assiste a várias séries ao mesmo tempo perde o fio da meada: qual episódio
era o próximo, o que foi abandonado, o que está na fila, o que merece prioridade.
Planilhas e apps genéricos não têm a combinação de **progresso por temporada**,
**ranking pessoal** e **listas livres**.

O Dat-Movie resolve isso com:

- um item de catálogo que guarda temporada, episódio e o mapa de episódios por
  temporada (a base do progresso confiável);
- um **tier** pessoal (S+ a D) para priorizar o que assistir;
- **listas many-to-many** para organizar o acervo sem duplicar títulos;
- uma home que transforma o próprio catálogo em recomendação (afinidade,
  gêneros, ano, abandonados, favoritos, episódios da semana).

---

## Público e casos de uso

| Persona | Necessidade | Como o app atende |
|---|---|---|
| Maratonista | Saber o próximo episódio | Página do título com steppers de temporada/episódio e barra de progresso |
| Curador | Organizar o que vale a pena | Tier S+ a D, listas customizáveis, filtros por status/tier/década/idade |
| Explorador | Descobrir sem sair do app | Aba Pesquisar com TMDb, filtros avançados e busca tolerante a erro |
| Usuário recorrente | Retomar de onde parou | Home com “Continuar Assistindo”, “Abandonados”, “Episódios da Semana” |

### Jornada principal

1. O usuário entra ou cria conta (e-mail + senha).
2. O catálogo é carregado do Supabase com as listas de cada item.
3. Na home, vê o que está assistindo, o que abandonou e sugestões.
4. Abre um título, ajusta temporada/episódio/status/tier e salva.
5. Adiciona títulos novos pela busca do TMDb, pela home ou pela página do título.
6. Organiza tudo em listas e filtra o catálogo.

---

## Funcionalidades

### Conta e sessão

- Cadastro com e-mail, senha e nome de exibição.
- Login, logout e restauração de sessão.
- Nome de exibição editável no menu de perfil; iniciais geradas a partir dele.
- Não existe tabela `profiles`: o nome vive em `user_metadata.full_name`.

### Catálogo

- Criar, ler, atualizar e excluir itens.
- Campos principais: nome, tipo, temporada, episódio, total de episódios, mapa de
  episódios por temporada, status, tier, imagem, `tmdb_id`, ano.
- Status: `assistindo`, `concluido`, `planejado`, `pausado`.
- Tier: `S+`, `S`, `A`, `B`, `C`, `D` ou nulo.
- Busca local tolerante a erros de digitação e acentuação.
- Filtros por status, tier, década e faixa etária; ordenação por data, nome,
  progresso, etc.
- Agrupamento visual por tier.
- Preferência para mostrar ou esconder a barra de progresso.

### Listas

- Listas customizáveis por usuário, com ordem arrastável.
- Relação N:N entre itens e listas (`item_lists`).
- Listas de sistema (`is_system = true`), como “Próximos”, que não podem ser
  excluídas pela UI.
- Um título nunca aparece duas vezes na mesma lista (`UNIQUE(item_id, list_id)`).
- Um título pode estar em várias listas ao mesmo tempo.

### Home

Seções, na ordem em que são renderizadas:

1. Saudação.
2. Continuar Assistindo.
3. Roleta (“Não sabe o que assistir?”).
4. Episódios da Semana.
5. Descubra por afinidade (busca de âncora + faixas “se você gostou de X”).
6. Em Breve (próximos lançamentos).
7. Abandonados.
8. Destaques do ano (ano configurável).
9. Em Alta.
10. Seus Favoritos.
11. Explorar por gênero (categorias + gêneros do usuário).

Cada seção tem estados de carregamento, vazio e erro, e as seções de API têm botão
de atualizar que ignora o cache (`fresh`).

### Busca e descoberta

- Aba **Pesquisar** com busca por nome no TMDb (`search/tv`).
- Quando há filtro avançado ativo, a busca troca para `discover/tv`, que aceita
  gênero, país de origem, classificação, duração, idioma, status, tipo, ano e
  ordenação.
- O texto digitado vira filtro local sobre a página carregada, sem descartar os
  filtros.
- Paginação de 40 itens por página, com botão “carregar mais”.
- Deduplicação por id e exclusão de títulos que já estão no catálogo.
- Ordenação deliberadamente **sem nota**: o produto não expõe `vote_average`.

### Página do título

- Backdrop com rotação automática de imagens.
- Logo localizado (TMDb, com fallback Fanart).
- Steppers de temporada e episódio, com limites calculados pelo TMDb.
- Status, tier, listas e progresso.
- Ações de salvar, remover e adicionar.
- Correção de vínculo com o TMDb (“Corrigir título”).
- Modais de episódios e de ficha técnica.

### Aparência

- Tema escuro (padrão), claro e “seguir o sistema”.
- Tokens de cor, tipografia, espaçamento, raio e alvo de clique em `style.css`.
- Layout desktop com navbar fixa e conteúdo em largura fluida.

---

## O que o produto não é (hoje)

- **Não é um app de filmes.** O catálogo real é de TV.
- **Não é uma rede social.** Não há perfis públicos, comentários ou notas
  públicas.
- **Não é um tracker automático.** O progresso é manual; a API serve para
  descobrir e enriquecer metadados.
- **Não é offline-first.** O cache melhora repetição de leitura, mas o app
  depende de rede para autenticar e carregar o catálogo.
- **Não tem backend próprio.** Supabase é o backend; as Edge Functions são o
  único caminho para APIs externas.

---

## Princípios de produto já incorporados ao código

Estes princípios aparecem em comentários, testes e decisões de implementação e
devem ser preservados em qualquer mudança:

1. **Progresso honesto.** Sem total confiável, a barra fica vazia em vez de
   mentir 100%. O mapa de episódios por temporada manda sobre a coluna
   `total_episodios`.
2. **Sem duplicata.** O mesmo `tmdb_id` não pode entrar duas vezes no catálogo do
   mesmo usuário; o banco tem índice único parcial como última defesa.
3. **Curadoria, não aleatoriedade pura.** As recomendações ancoram no topo de
   popularidade e reservam uma cota menor para exploração.
4. **Sem nota pública.** A descoberta não mostra `vote_average`; a nota é pessoal
   (tier).
5. **Título legível.** A home filtra produções bloqueadas, idiomas fora do eixo
   en/ja/ko, datas absurdas, cards sem arte e títulos predominantemente não
   latinos.
6. **Segurança no servidor.** A chave do TMDb e a do Fanart nunca vão ao
   navegador; a allow-list e a checagem de usuário real vivem nas Edge Functions.

---

## Glossário

| Termo | Significado |
|---|---|
| **Item / título** | Registro do catálogo do usuário. No banco é uma linha de `items`; no JS é o objeto camelCase descrito em `04`. |
| **Tier** | Ranking pessoal de prioridade/qualidade: S+, S, A, B, C, D ou nulo. |
| **Status** | Estado de acompanhamento: assistindo, concluído, planejado ou pausado. |
| **Temporada / episódio** | Posição atual do usuário. `episodio` é o episódio dentro da temporada atual. |
| **`seasonEpisodesMap`** | Objeto `{ "1": 10, "2": 8 }` com a contagem de episódios de cada temporada, vindo do TMDb. É o denominador confiável do progresso. |
| **Lista** | Coleção nomeada do usuário (`user_lists`). Pode ser de sistema ou customizada. |
| **Relação** | Vínculo item ↔ lista (`item_lists`). |
| **Faixa / rail** | Trilho horizontal de cards na home. |
| **Afinidade** | Recomendação baseada em um título âncora do catálogo (“se você gostou de X…”). |
| **Fresh** | Modo de leitura que ignora o cache e vai à rede, usado pelo botão de atualizar. |
| **Preview** | Estado de um título vindo da busca antes de ser adicionado ao catálogo. |
| **Edge Function** | Função Deno no Supabase que faz proxy seguro para TMDb/Fanart. |

---

## Estado atual

O app funciona, tem suíte de testes e regras de negócio bem isoladas em `src/lib/`.
O que pesa na evolução é a **camada de apresentação**: `main.js` concentra
bootstrap, autenticação, CRUD, navegação, filtros, render e eventos; a página do
título tem muito estilo inline; e o HTML é um único arquivo com todos os modais.

Os pontos de atenção e as dívidas conhecidas estão em
[10 — Dívida técnica](10-divida-tecnica-e-refatoracao.md).
