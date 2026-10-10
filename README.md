<p align="center">
  <img src="assets/logo/stacked-dark.svg" alt="Dat-Movie Logo" width="180" />
</p>

<h1 align="center">🎬 Dat-Movie</h1>

<p align="center">
  <a href="#-funcionalidades-principais">Funcionalidades</a> •
  <a href="#-tecnologias-utilizadas">Tecnologias</a> •
  <a href="#-pré-requisitos">Pré-requisitos</a> •
  <a href="#-instalação-e-execução-local">Instalação</a> •
  <a href="#-configuração-do-supabase">Supabase</a> •
  <a href="#-estrutura-de-diretórios">Estrutura</a> •
  <a href="#-deploy">Deploy</a> •
  <a href="#-licença">Licença</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5 Badge" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3 Badge" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript Badge" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite Badge" />
  <img src="https://img.shields.io/badge/Supabase-3FC08D?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase Badge" />
  <img src="https://img.shields.io/badge/Vitest-3E8E41?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest Badge" />
</p>

**Dat-Movie** é um catálogo pessoal de mídia desenvolvido como uma Single Page Application (SPA). A aplicação oferece listas personalizáveis com drag-and-drop, gerenciamento de episódios com destaque do episódio atual, filtragem por Tiers de qualidade e status, além de persistência por usuário no Supabase. Integra-se com a API do TMDb para busca de títulos, metadados ricos e imagens de backdrop/poster.

---

## 🚀 Funcionalidades Principais

> **Nota sobre sincronização:** o catálogo é persistido por usuário no Supabase, mas
> **não há sincronização em tempo real**. As alterações são gravadas imediatamente e
> só voltam a aparecer em outros dispositivos quando a página é recarregada. Não existe
> canal realtime (`supabase.channel` / `postgres_changes`) no código.

- **Autenticação Segura:** Login, cadastro e gerenciamento de sessões com Supabase Auth.
- **Nome de Exibição Travado por Padrão:** O menu do perfil mostra o nome como texto, e a edição só abre quando você pede (botão Alterar). Sair do menu com alteração não salva pede confirmação em vez de descartar em silêncio.
- **Preferência de Exibição:** No mesmo menu, um checkbox mostra ou esconde a barra de progresso dos títulos, no Catálogo e na Home. A escolha é guardada no navegador e vale para os cards já na tela, sem recarregar.
- **Pesquisa TMDB:** Busca integrada ao TMDb que traz backdrop, sinopse, logo, título original e dados completos de temporadas/episódios.
- **Listas Personalizáveis:** Crie, renomeie, reordene (drag-and-drop) e exclua listas. Um título pode pertencer a múltiplas listas, mas nunca é duplicado na mesma lista.
- **Detecção de Título Existente:** Ao pesquisar um título que já existe no catálogo, o modal pré-marca as listas que ele já pertence e adiciona apenas às novas listas ao salvar.
- **Tier List Integrada:** Classifique seus títulos favoritos usando tiers visuais que vão de **S+** a **D**.
- **Grade Dinâmica Ajustável:** Controle de densidade da grade de exibição e agrupamento visual instantâneo baseado em Tiers.
- **Painel "Continuando":** Seção que destaca os últimos títulos que você está assistindo no momento.
- **Modal de Detalhes em Streaming:** Layout com imagem de backdrop, logo transparente, sinopse com blur, links oficiais para YouTube/Wikipedia/IMDb, steppers de progresso e botões de status.
- **Modal de Adição Reestruturado:** Backdrop 16:9, logo, título original, sinopse, seleção de listas e status — tudo em um layout unificado com o modal de detalhes.
- **Visualizador de Episódios:** Lista cronológica organizada em acordeão com destaque visual automático do episódio atual, auto-expansão da temporada e scroll suave.
- **Steppers Avançados:** Botões de incremento e decremento rápidos para temporada/episódio com detecção de tempo de clique (*hold timers*). Status "Concluído" auto-preenche temporada/episódio máximos.
- **Densidade do Grid:** Controle de colunas da grade entre 6 e 14 opções.
- **Segurança contra XSS:** Sanitização nativa na renderização para evitar injeções maliciosas.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - HTML5 & CSS3 (Design responsivo, variáveis customizadas, layout grid flexível e efeito *Liquid Glass*).
  - JavaScript moderno (Vanilla JS com ES Modules).
  - [Vite](https://vite.dev/) como empacotador de assets e servidor de desenvolvimento.
  - [anime.js](https://animejs.com/) para animações e transições fluidas de UI.
  - [Sortable.js](https://sortablejs.github.io/Sortable/) para drag-and-drop de listas na sidebar.
  - **Inter** (corpo, botões, episódios) + **Sora** (títulos e destaques) + **IBM Plex Mono** (dados técnicos e códigos) via Google Fonts. Ver `assets/BRAND_GUIDELINES.md`.
  - Font Awesome 6.5.0 para biblioteca de ícones.
- **Backend & Cloud (BaaS):**
  - [Supabase](https://supabase.com/) como banco de dados (PostgreSQL), autenticação e segurança de acesso.
  - Supabase Edge Functions (Deno) para consumo seguro de APIs externas.
- **APIs Externas:**
  - [TMDb (The Movie Database)](https://www.themoviedb.org/) para busca, metadados, posters e backdrops.
- **Testes Unitários:**
  - [Vitest](https://vitest.dev/) para execução rápida de testes das regras de negócio e utilitários.
  - Além das regras de negócio, alguns testes seguram **contratos visuais** que
    apodrecem em silêncio: a tipografia (famílias e pesos reais, e o mono
    reservado a dado técnico), o uso do mono no card, a anatomia do card, a
    home, a ausência de halo na cor de destaque e o alvo da preferência de
    barra de progresso. Regressão nesses contratos aparece só como "a fonte
    mudou" ou "o botão não funciona", muito depois do commit que a trouxe.

---

## 📋 Pré-requisitos

Para rodar a aplicação localmente, certifique-se de possuir:
- **Node.js 22 ou superior** — `@supabase/supabase-js` v2.111 depende de `WebSocket` global no `createClient`, que não existe no Node 20. Abaixo de 22 a suíte de testes morre já no import. Declarado em `engines` no `package.json`.
- Gerenciador de pacotes **npm**
- Uma conta ativa na plataforma **Supabase** (para hospedagem das tabelas e chaves de acesso)

---

## ⚙️ Instalação e Execução Local

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/ssyigor-cmd/dat-movie.git
   cd dat-movie
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto e configure as chaves do Supabase:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
   ```

4. **Iniciar o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a URL gerada (geralmente `http://localhost:5173`) no seu navegador.

5. **Executar Testes:**
   ```bash
   npm test          # suíte completa (Vitest)
   npm run lint      # ESLint em src, tests e scripts
   npm run check     # lint + testes + build, na ordem
   ```

6. **Build de Produção:**
   ```bash
   npm run build
   ```

> **Testes de contrato visual rodam sem navegador.** Eles leem `style.css`,
> `index.html` e os fontes e checam a regra, não o pixel. É de propósito: a
> tipografia, o halo e a anatomia do card já voltaram mais de uma vez sem
> ninguém perceber, porque a quebra só aparece olhando a tela.

---

## 🗄️ Configuração do Supabase

### 1. Banco de Dados (Tabelas e políticas RLS)

**O schema vive em `supabase/migrations/`, não neste arquivo.** Aqui fica só o
resumo: copiar SQL do README já gerou divergência entre o que o doc mandava criar
e o que realmente estava no banco.

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `create_items_table.sql` | Tabela `items`, trigger de `data_atualizacao`, índices |
| 2 | `create_lists_tables.sql` | Tabelas `user_lists`/`item_lists`, CHECK de `tipo`, políticas RLS |
| 3 | `add_index_items_user_id.sql` | Índice em `items(user_id)` |
| 4 | `add_unique_index_items_user_tmdb.sql` | Barra títulos duplicados do mesmo TMDb (⚠️ tem passo de diagnóstico) |

Do zero, rode na ordem da tabela no SQL Editor do painel (ou via CLI, seção 4).

Resumo do modelo:

- **`items`** — o catálogo. `tier` ∈ {S+, S, A, B, C, D}; `status` ∈ {assistindo, concluido, planejado, pausado}. `tmdb_id` é a âncora com o TMDb.
- **`user_lists`** — listas do usuário. `is_system` marca as que a UI não pode apagar.
- **`item_lists`** — junção N:N com `UNIQUE(item_id, list_id)`: um título nunca aparece duas vezes na mesma lista.

> **Dois detalhes que já causaram bug** — confira ao revisar:
>
> 1. `items.tipo` **aceita `NULL`**: o CHECK é `tipo IS NULL OR tipo IN (...)`. `trendingApi.getNewEpisodes` depende disso de propósito — um CHECK `NOT NULL` rejeitaria itens legítimos no insert.
> 2. A RLS de `item_lists` verifica a **lista** (`user_lists.user_id`), não o item. A versão anterior deste README usava `items.user_id` e dava resultado diferente quando item e lista tinham donos diferentes.

### 2. Impedir títulos duplicados (dedup no banco)

O `isDuplicateInCatalog` roda **só no cliente**, então não cobre dois
dispositivos inserindo o mesmo `tmdb_id` ao mesmo tempo. Antes de criar o índice
único, confira se já existem duplicatas:

```sql
SELECT user_id, tmdb_id, COUNT(*) AS ocorrencias, array_agg(nome ORDER BY data_criacao) AS titulos
FROM items WHERE tmdb_id IS NOT NULL
GROUP BY user_id, tmdb_id HAVING COUNT(*) > 1 ORDER BY ocorrencias DESC;
```

Se a consulta voltar vazia, aplique
`supabase/migrations/add_unique_index_items_user_tmdb.sql`. Se voltar linhas,
decida o que fazer com cada duplicata **antes** — o `CREATE UNIQUE INDEX` falha e
a migration aborta, de propósito, para não apagar dado do usuário em silêncio.

### 3. Migrando dados existentes

Se você já possui dados na tabela `items` e quer adicionar o sistema de listas, execute a migração:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key \
npm run migrate
```

`SUPABASE_SERVICE_ROLE_KEY` é uma credencial administrativa: use-a somente no terminal/CI seguro e nunca a coloque em `.env` com prefixo `VITE_` ou no frontend.

Ou execute manualmente o script SQL em `supabase/migrations/migrate_existing_data.sql`.

### 4. Edge Functions do Supabase

As Edge Functions são responsáveis por intermediar as consultas às APIs externas de forma segura:

```bash
# Entrar no seu projeto
supabase login
supabase link --project-ref seu-project-ref

# Deploy das funções
supabase functions deploy clever-endpoint
supabase functions deploy fanart-logo

# Configurar chaves de API
supabase secrets set TMDB_API_KEY=sua-chave-tmdb
supabase secrets set FANART_API_KEY=sua-chave-fanart
```

Ambas as funções exigem sessão JWT (`verify_jwt = true` em `supabase/config.toml`):

| Função | `verify_jwt` | Papel |
|---|---|---|
| `clever-endpoint` | `true` | Proxy do TMDb. Aceita **somente** os endpoints de TV usados pelo app, via allow-list. |
| `fanart-logo` | `true` | Fallback de logo. Valida `tmdbId` como inteiro positivo antes de montar a URL. |

> **Não reabra `fanart-logo` com `verify_jwt = false`.** Isso a transforma em um proxy
> público e ilimitado para uma API de terceiro com cota — qualquer pessoa na internet
> conseguiria gastar a sua cota chamando a função.

A allow-list de endpoints do TMDb vive em `supabase/functions/_shared/allowedEndpoint.ts`
e é importada **tanto pela Edge Function quanto pelos testes** (`tests/cleverEndpoint.test.js`).
Editar a regex altera o proxy e a suíte juntos: uma regressão na barreira de segurança
quebra o build em vez de passar em silêncio. Não copie o padrão para dentro de um `.test.js`.

---

## 📂 Estrutura de Diretórios

```text
├── assets/                  # Identidade de marca, imagens e logotipos
│   └── BRAND_GUIDELINES.md  # Tokens de cor e tipografia (fonte da verdade)
├── src/
│   ├── components/          # Componentes de UI
│   │   ├── cards.js         # Anatomia do card, em um único lugar
│   │   ├── confirmModal.js  # Confirmação assíncrona com trava de foco
│   │   ├── detailModal.js   # Modal de detalhes com backdrop, logo e sinopse
│   │   ├── episodesModal.js # Modal de episódios com acordeão e destaque atual
│   │   ├── homePage.js      # Home: continuando, roulette, calendário, afinidade
│   │   ├── titleInfoModal.js# Ficha expandida do TMDb
│   │   └── uiHelpers.js     # Toasts, validação de campo e helpers
│   ├── lib/                 # Lógica de negócio e utilitários
│   │   ├── api.js           # Chamadas TMDB, cache de logos e fetch de imagens
│   │   ├── auth.js          # Fluxos de login, cadastro, sign-out e nome
│   │   ├── cache.js         # Cache em localStorage com TTL
│   │   ├── catalog.js       # Cálculos, filtros, ordenação e escape HTML
│   │   ├── dom.js           # Registro central de referências do DOM
│   │   ├── imageNavigation.js # Filtros e ordenação de imagens do TMDb
│   │   ├── lists.js         # CRUD de listas e relacionamento item-lista
│   │   ├── logoPicker.js    # Escolha de logo por catálogo
│   │   ├── seasonArt.js     # Arte por temporada
│   │   ├── state.js         # Estado global e chaves de preferências
│   │   ├── stepper.js       # Botões stepper (clique simples e hold)
│   │   ├── supabase.js      # Inicialização do Supabase Client
│   │   ├── titleFilters.js  # Filtros e ordenação de títulos
│   │   ├── trendingApi.js   # Trending, sugestões e estatísticas do catálogo
│   │   └── ...              # autoRotate, fuzzySearch, recommendScoring, titleRelations
│   ├── pages/
│   │   └── titlePage.js     # Página do título (ficha, episódios, backdrop)
│   └── main.js              # Bootstrap, eventos globais e fluxo do perfil
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   └── migrations/          # Schema do banco — fonte da verdade do DDL e das RLS
│       ├── create_items_table.sql
│       ├── create_lists_tables.sql
│       ├── add_index_items_user_id.sql
│       ├── add_unique_index_items_user_tmdb.sql
│       └── migrate_existing_data.sql
├── tests/                   # Testes unitários e de contrato (Vitest)
│   ├── catalog.test.js      # Regras de negócio do catálogo
│   ├── cards.test.js        # Anatomia do card em um único lugar
│   ├── typography.test.js   # Famílias, pesos reais e reserva do mono
│   ├── glow.test.js         # Nenhum halo; anel de foco e sombra intactos
│   ├── progressBar.test.js  # Alvo e persistência da preferência de exibição
│   └── ...                  # 22 suítes no total
├── index.html               # Arquivo HTML base da SPA
├── package.json             # Dependências e scripts
├── style.css                # Folha de estilos unificada
└── README.md                # Este arquivo
```

---

## 🌐 Deploy

A aplicação pode ser hospedada em plataformas como **Vercel**, **Netlify** ou **Cloudflare Pages**.

Ao configurar o projeto na plataforma escolhida:
1. Comando de build: `npm run build`
2. Diretório de saída: `dist`
3. Variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 📄 Licença

Este projeto está licenciado sob os termos da licença **MIT**. Veja o arquivo da licença para mais detalhes.

---

## 🤝 Contribuições

Contribuições são sempre bem-vindas! Se você encontrar um bug ou tiver ideias de melhoria:
1. Abra uma *Issue* detalhando o problema ou sugestão.
2. Crie um *Fork* do projeto, desenvolva suas correções e envie um *Pull Request*.
