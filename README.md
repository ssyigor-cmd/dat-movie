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

**Dat-Movie** é um catálogo pessoal de mídia desenvolvido como uma Single Page Application (SPA). A aplicação oferece listas personalizáveis com drag-and-drop, gerenciamento de episódios com destaque do episódio atual, filtragem por Tiers de qualidade e status, além de sincronização em tempo real via Supabase. Integra-se com a API do TMDb para busca de títulos, metadados ricos e imagens de backdrop/poster.

---

## 🚀 Funcionalidades Principais

- **Autenticação Segura:** Login, cadastro e gerenciamento de sessões com Supabase Auth.
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
  - Font Awesome para biblioteca de ícones.
- **Backend & Cloud (BaaS):**
  - [Supabase](https://supabase.com/) como banco de dados (PostgreSQL), autenticação e segurança de acesso.
  - Supabase Edge Functions (Deno) para consumo seguro de APIs externas.
- **APIs Externas:**
  - [TMDb (The Movie Database)](https://www.themoviedb.org/) para busca, metadados, posters e backdrops.
- **Testes Unitários:**
  - [Vitest](https://vitest.dev/) para execução rápida de testes das regras de negócio e utilitários.

---

## 📋 Pré-requisitos

Para rodar a aplicação localmente, certifique-se de possuir:
- **Node.js** (versão 18 ou superior)
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
   npm test
   ```

6. **Build de Produção:**
   ```bash
   npm run build
   ```

---

## 🗄️ Configuração do Supabase

### 1. Banco de Dados (Tabelas)

Abra o **SQL Editor** no painel do seu projeto Supabase e execute as instruções abaixo para criar todas as tabelas necessárias:

```sql
-- Tabela principal de itens do catálogo
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'serie',
    temporada INTEGER DEFAULT 1,
    episodio INTEGER DEFAULT 0,
    total_episodios INTEGER DEFAULT 1,
    season_episodes_map JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'assistindo' CHECK (status IN ('assistindo', 'concluido', 'planejado', 'pausado')),
    tier VARCHAR(5) CHECK (tier IN ('S+', 'S', 'A', 'B', 'C', 'D')),
    imagem TEXT,
    tmdb_id INTEGER,
    ano INTEGER,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de listas do usuário
CREATE TABLE user_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    ordem INTEGER DEFAULT 0,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, nome)
);

-- Tabela de relacionamento N:N entre itens e listas
CREATE TABLE item_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
    data_adicao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(item_id, list_id)
);

-- Trigger para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Políticas RLS (Row Level Security)

Execute as seguintes instruções para aplicar as políticas de proteção aos dados:

```sql
-- Políticas para items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir que usuários visualizem seus próprios itens"
    ON items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários criem seus próprios itens"
    ON items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários atualizem seus próprios itens"
    ON items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários excluam seus próprios itens"
    ON items FOR DELETE USING (auth.uid() = user_id);

-- Políticas para user_lists
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir que usuários vejam suas próprias listas"
    ON user_lists FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários criem suas próprias listas"
    ON user_lists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários atualizem suas próprias listas"
    ON user_lists FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários excluam suas próprias listas"
    ON user_lists FOR DELETE USING (auth.uid() = user_id);

-- Políticas para item_lists (acesso indireto via item ou lista do usuário)
ALTER TABLE item_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso aos relacionamentos dos próprios itens"
    ON item_lists FOR SELECT USING (
        EXISTS (SELECT 1 FROM items WHERE items.id = item_lists.item_id AND items.user_id = auth.uid())
    );

CREATE POLICY "Permitir criar relacionamentos para próprios itens"
    ON item_lists FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM items WHERE items.id = item_lists.item_id AND items.user_id = auth.uid())
    );

CREATE POLICY "Permitir excluir relacionamentos dos próprios itens"
    ON item_lists FOR DELETE USING (
        EXISTS (SELECT 1 FROM items WHERE items.id = item_lists.item_id AND items.user_id = auth.uid())
    );
```

### 3. Migrando dados existentes

Se você já possui dados na tabela `items` e quer adicionar o sistema de listas, execute a migração:

```bash
npm run migrate
```

Ou execute manualmente o script SQL em `supabase/migrations/migrate_existing_data.sql`.

### 4. Edge Functions do Supabase

As Edge Functions são responsáveis por intermediar as consultas às APIs externas de forma segura:

```bash
# Entrar no seu projeto
supabase login
supabase link --project-ref seu-project-ref

# Deploy das funções
supabase functions deploy clever-endpoint

# Configurar chaves de API (se necessário)
supabase secrets set TMDB_API_KEY=sua-chave-tmdb
```

---

## 📂 Estrutura de Diretórios

```text
├── assets/                  # Identidade de marca, imagens e logotipos
├── src/
│   ├── components/          # Componentes de UI
│   │   ├── cards.js         # Criação de cards e bento "Continuando"
│   │   ├── detailModal.js   # Modal de detalhes com backdrop, logo e sinopse
│   │   ├── episodesModal.js # Modal de episódios com acordeão e destaque atual
│   │   └── uiHelpers.js     # Toasts, travas de foco, validação e Canvas Orb
│   ├── lib/                 # Lógica de negócio e utilitários
│   │   ├── api.js           # Chamadas TMDB, cache de logos e fetch de imagens
│   │   ├── auth.js          # Fluxos de login, cadastro e sign-out
│   │   ├── catalog.js       # Cálculos, filtros, ordenação e escape HTML
│   │   ├── imageNavigation.js # Filtros e ordenação de imagens do TMDb
│   │   ├── lists.js         # CRUD de listas e relacionamento item-lista
│   │   ├── stepper.js       # Controle de botões stepper (clique simples e hold)
│   │   └── supabase.js      # Inicialização do Supabase Client
│   └── main.js              # Ponto de entrada (bootstrap e eventos globais)
├── supabase/
│   └── migrations/          # Scripts SQL de criação de tabelas e migração
├── tests/                   # Testes unitários (Vitest)
│   ├── catalog.test.js
│   └── imageNavigation.test.js
├── index.html               # Arquivo HTML base da SPA
├── package.json             # Dependências e scripts
├── style.css                # Folha de estilos unificada (Liquid Glass Design)
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
