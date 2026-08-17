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

**Dat-Movie** é um catálogo pessoal de animes, animações e séries desenvolvido como uma Single Page Application (SPA). A aplicação oferece gerenciamento de episódios, controle de temporadas, filtragem avançada por Tiers de qualidade e status, além de sincronização em tempo real e na nuvem utilizando o Supabase. Integra-se também com as APIs do TMDb e Fanart.tv para trazer metadados ricos de forma automática.

---

## 🚀 Funcionalidades Principais

- **Autenticação Segura:** Login, cadastro e gerenciamento de sessões com Supabase Auth.
- **Autocompletar Inteligente:** Busca dinâmica de títulos conectada ao TMDb que traz o nome correto, ano e pôster oficial de forma assíncrona.
- **Tier List Integrada:** Classifique seus títulos favoritos usando tiers visuais que vão de **S+** a **D**.
- **Grade Dinâmica Ajustável:** Controle de densidade da grade de exibição (entre 6 e 14 colunas) e agrupamento visual instantâneo baseado em Tiers.
- **Painel "Continuando":** Uma seção Bento Box que destaca os 3 últimos títulos que você está assistindo no momento.
- **Modal de Detalhes Completo:** Sinopses, logotipos transparentes (via Fanart.tv/TMDb fallback), links oficiais para IMDb/Wikipedia e progresso acumulado calculado automaticamente.
- **Visualizador de Episódios:** Lista cronológica e interativa dos episódios de cada temporada organizados de forma colapsável (acordeão).
- **Steppers Avançados:** Botões de incremento e decremento rápidos para temporada/episódio com detecção de tempo de clique (*hold timers*).
- **Segurança contra XSS:** Sanitização nativa na renderização para evitar injeções maliciosas.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - HTML5 & CSS3 (Design responsivo, variáveis customizadas, layout grid flexível e efeito *Liquid Glass*).
  - JavaScript moderno (Vanilla JS com ES Modules e importação de mapas).
  - [Vite](https://vite.dev/) como empacotador de assets e servidor de desenvolvimento leve.
  - [anime.js](https://animejs.com/) para animações e transições fluidas de elementos de UI.
  - Font Awesome para biblioteca de ícones.
- **Backend & Cloud (BaaS):**
  - [Supabase](https://supabase.com/) como gerenciador de banco de dados (PostgreSQL), autenticação e segurança de acesso.
  - Supabase Edge Functions executando Deno para consumo seguro de APIs de terceiros.
- **APIs Externas:**
  - [TMDb (The Movie Database)](https://www.themoviedb.org/) para informações de mídia.
  - [Fanart.tv](https://fanart.tv/) para obtenção de logotipos transparentes de alta qualidade.
- **Testes Unitários:**
  - [Vitest](https://vitest.dev/) para execução rápida de testes das regras de negócio e utilitários.

---

## 📋 Pré-requisitos

Para rodar a aplicação localmente, certifique-se de possuir:
- **Node.js** (versão 18 ou superior)
- Gerenciador de pacotes **npm**
- Uma conta ativa na plataforma **Supabase** (para hospedagem das tabelas e chaves de acesso)
- Uma chave de API (API Key) do **TMDb** e **Fanart.tv** para as buscas automáticas

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

5. **Executar Testes de Unidade:**
   ```bash
   npm run test
   ```

---

## 🗄️ Configuração do Supabase

### 1. Banco de Dados (Tabelas)
Abra o **SQL Editor** no painel do seu projeto Supabase e execute a instrução abaixo para criar a tabela de dados principal:

```sql
-- Criar a tabela de itens do catálogo
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('anime', 'animacao', 'serie')),
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
```

### 2. Políticas RLS (Row Level Security)
Execute as seguintes instruções para aplicar as políticas de proteção aos dados, garantindo que cada usuário só acesse suas próprias informações:

```sql
-- Ativar a política de Row Level Security na tabela
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir que usuários visualizem seus próprios itens"
    ON items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários criem seus próprios itens"
    ON items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários atualizem seus próprios itens"
    ON items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir que usuários excluam seus próprios itens"
    ON items FOR DELETE
    USING (auth.uid() = user_id);
```

### 3. Edge Functions do Supabase
As Edge Functions são responsáveis por intermediar as consultas às APIs externas de forma segura. O projeto conta com a Edge Function `fanart-logo` para obter logos limpos.

Para publicar localmente a Edge Function do projeto no Supabase, certifique-se de configurar a CLI do Supabase e rodar:
```bash
# Entrar no seu projeto
supabase login
supabase link --project-ref seu-project-ref

# Deploy da função
supabase functions deploy fanart-logo

# Setar a API Key do Fanart no Supabase
supabase secrets set FANART_API_KEY=sua-chave-api-fanart
```

*Nota: Garanta que a função remota `clever-endpoint` também esteja configurada e ativa no Supabase do seu projeto de acordo com a API do TMDb.*

---

## 📂 Estrutura de Diretórios

A estrutura interna da aplicação está estruturada de maneira limpa para facilitar o desacoplamento e a manutenibilidade:

```text
├── .vscode/                 # Configurações locais do VS Code
├── assets/                  # Identidade de marca, imagens e logotipos
├── src/
│   ├── components/          # Componentes reutilizáveis e helpers de UI
│   │   ├── cards.js         # Criação física de cards e bento de continuar
│   │   ├── detailModal.js   # Modal com detalhes, notas e links do título
│   │   ├── episodesModal.js # Modal com listagem de episódios por temporada
│   │   ├── suggestions.js   # Controle da lista suspensa de autocompletar
│   │   └── uiHelpers.js     # Toasts, travas de foco, validação e Canvas Orb
│   ├── lib/                 # Lógica de negócio e APIs isoladas de UI
│   │   ├── api.js           # Funções de chamada do TMDB, Fanart e Cache
│   │   ├── auth.js          # Fluxos de login, cadastro e sign-out
│   │   ├── catalog.js       # Regras de cálculo, filtros, ordenação e escape
│   │   ├── imageNavigation.js # Filtros e ordenações de fotos do TMDb
│   │   ├── stepper.js       # Controle de botões stepper (single & hold click)
│   │   └── supabase.js      # Inicialização do Supabase Client
│   └── main.js              # Ponto de entrada (Bootstrapping e eventos)
├── tests/                   # Testes unitários rodados via Vitest
│   ├── catalog.test.js
│   └── imageNavigation.test.js
├── index.html               # Arquivo HTML base da SPA
├── package.json             # Dependências de desenvolvimento e scripts
├── style.css                # Folha de estilos unificada (Liquid Glass Design)
└── README.md                # Documentação técnica principal
```

---

## 🌐 Deploy

Você pode hospedar a aplicação facilmente em plataformas como **Vercel**, **Netlify** ou **Cloudflare Pages**. 

Ao configurar o projeto na plataforma escolhida:
1. Defina o comando de build como: `npm run build` (caso configure scripts de build no Vite).
2. Defina o diretório de saída como: `dist`.
3. Adicione as variáveis de ambiente necessárias nas configurações do painel do serviço de hospedagem:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 📄 Licença

Este projeto está licenciado sob os termos da licença **MIT**. Veja o arquivo da licença para mais detalhes.

---

## 🤝 Contribuições

Contribuições são sempre bem-vindas! Se você encontrar um bug ou tiver ideias de melhoria para o design visual ou desempenho:
1. Abra uma *Issue* detalhando o problema ou sugestão.
2. Crie um *Fork* do projeto, desenvolva suas correções e envie um *Pull Request*.
