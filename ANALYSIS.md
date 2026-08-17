# Relatório de Análise Técnica - Projeto Dat-Movie

Este relatório apresenta uma análise aprofundada, estruturada e construtiva da arquitetura, do código-fonte, da experiência do usuário (UI/UX), da acessibilidade, da segurança e da integração com APIs externas no projeto **Dat-Movie**.

---

## 1. Resumo Executivo

O **Dat-Movie** é um catálogo pessoal de animes, animações e séries desenvolvido como uma Single Page Application (SPA) baseada em Vite, JavaScript baunilha (Vanilla JS, utilizando ES Modules) e Supabase (Banco de Dados PostgreSQL, Autenticação, Row Level Security e Edge Functions). A aplicação consome dados das APIs externas TMDb (The Movie Database) e Fanart.tv para enriquecer as informações visuais (pôsteres, anos de lançamento, sinopses e logotipos oficiais).

**Pontos Fortes:**
- **Design Visual Moderno:** O uso de variáveis customizadas e o efeito *Liquid Glass* (glassmorphism) criam um design elegante e fluido.
- **Abordagem Modular:** O código está separado em arquivos de lógica pura (`src/lib/`) e arquivos de interface/modais (`src/components/`).
- **Navegabilidade:** O modal de episódios com efeito sanfona (acordeão) e os botões *stepper* com detecção de tempo de clique (hold timers) fornecem uma experiência de controle muito boa para o usuário.
- **Preocupação com Testes:** O projeto utiliza o Vitest e já conta com 29 testes de unidade focados em regras de negócio críticas (filtragem, ordenação, processamento de imagens).

**Oportunidades Críticas de Melhoria:**
- **Acoplamento no Orquestrador (`main.js`):** O arquivo de entrada da aplicação ainda concentra muitas responsabilidades de controle e manipulação do DOM.
- **Código Duplicado:** Funções cruciais de filtragem e ordenação testadas no módulo `catalog.js` foram reescritas inline no `main.js`.
- **Bugs de UI e Integração:** Erros na concatenação de URLs de imagem causam quebras na renderização de pré-visualizações, e o suporte parcial a filmes quebra a integração com o TMDb em certas consultas.
- **Inconsistências Responsivas:** Redundâncias no CSS para telas pequenas (mobile) causam sobreposições de layout desnecessárias.

---

## 2. Análise de Código e Regras de Negócio

### a) Legibilidade, Manutenibilidade e Organização
- **Nomes de variáveis e funções:** O padrão de nomenclatura é consistente, alternando entre inglês para variáveis técnicas/APIs (ex: `tmdb_id`, `seasonEpisodesMap`) e português para funções de negócio (ex: `calcularProgresso`, `filtrarItens`).
- **Funções muito longas:** A função `addItem` em `main.js` acumula 130 linhas de código. Ela lida ao mesmo tempo com: validação de formulário, exibição de erros, requisições externas para o TMDB, deduplicação de catálogos e chamadas ao Supabase. Recomenda-se quebrá-la em funções menores.
- **Código Duplicado:** As funções utilitárias `filterItems` e `sortItems` estão definidas e testadas no arquivo `src/lib/catalog.js`, mas o `main.js` re-implementa essa lógica manualmente no momento de atualizar a tela (linhas 380-422). As funções importadas tornam-se "código morto" (*dead code*).

### b) Tratamento de Erros e Resiliência
- O tratamento de erros de rede e Supabase é feito de forma adequada nas funções CRUD através de blocos `try/catch`.
- **Controle assíncrono (Race Conditions):** Na seleção de sugestões de autocompletar, a chamada assíncrona para obter imagens de alta qualidade (`fetchHighQualityImage()`) concorre com o encerramento do clique. Se uma busca demorar muito e o usuário selecionar rapidamente outro título, o retorno assíncrono atrasado pode sobrescrever o título ativo.

---

## 3. Análise Visual, Responsividade e UX/UI

### a) Inconsistências de Responsividade (CSS e Layout)
Ao analisar o arquivo `style.css` na seção `@media (max-width: 480px)` (mobile extremo), identificamos duas redefinições em conflito que quebram o design mobile:

1. **Duplicação da Grade de Continuação (`.continue-grid`):**
   - Na linha 1707, o número de colunas é definido como 1: `grid-template-columns: 1fr;`.
   - Na linha 1731 (dentro da mesma media query), é redefinido para 2 colunas: `grid-template-columns: repeat(2, 1fr);`.
   - A segunda regra prevalece, exibindo os cards horizontais do bento em 2 colunas em telas estreitas, achatando os pôsteres e textos de progresso a tamanhos ilegíveis.

2. **Corte e Espaçamento da Grade Principal (`.grid-cols-*`):**
   - Na linha 1703, as grades de 6 a 14 colunas são simplificadas para 2 colunas: `grid-template-columns: repeat(2, 1fr);`.
   - Na linha 1735, a regra é redefinida para 3 colunas: `grid-template-columns: repeat(3, 1fr);`.
   - Em smartphones pequenos, 3 colunas de cards são excessivas e apertam as informações textuais do catálogo.

### b) Acessibilidade (a11y)
- **Modais e Foco:** O uso de `trapFocus` e `releaseFocusTrap` nos modais principais funciona muito bem para usuários de teclado.
- **Falta de ARIA nos Dropdowns de Tiers:** Os seletores de Tier nos cabeçalhos dos modais de adição e detalhe comportam-se como menus pop-up, mas os elementos não possuem atributos ARIA cruciais (como `aria-expanded="false"`, `aria-haspopup="listbox"`, `role="listbox"` e `role="option"`).

### c) Inconsistência de Tema Declarada
- O arquivo `README.md` anterior citava suporte a "Temas claro/escuro". Porém, o código de estilos (`style.css`) possui apenas variáveis para o tema escuro monocromático (baseado em `#0A0A0A`). Não há funcionalidade de troca de tema ou folha de estilos correspondente para o tema claro.

---

## 4. Análise de Arquitetura e Estrutura

- **Dependências Externas:** A utilização de bibliotecas via CDN (`anime.js` e Font Awesome) acelera o carregamento inicial, mas aumenta a dependência de conexões externas livres de bloqueio (ex: firewalls corporativos). Recomenda-se empacotar localmente essas bibliotecas via npm para produção.
- **Gerenciamento de Estado Implícito:** O estado global da aplicação (`items`, `editingIndex`, `currentTab`, `cachedShowDetails`, etc.) fica solto no escopo do arquivo principal `main.js`. Isso dificulta a testabilidade e o isolamento dos componentes visuais.
- **Configuração do Vite:** O projeto não conta com um arquivo `vite.config.js` explícito. Embora o Vite funcione de forma automática com suas configurações padrão para projetos simples, a falta de configurações de build de produção (ex: otimização de chunks, minificação avançada, resolução de caminhos absolutos) limita a escalabilidade da aplicação.

---

## 5. Integração com Supabase e APIs externas

### a) Integração Supabase
- **Row Level Security (RLS):** As consultas utilizam corretamente filtros baseados no usuário logado (`supabase.auth.getUser()`). No entanto, a segurança real deve ser validada no painel administrativo do Supabase (garantindo que a tabela `items` possua a RLS ativada e que as permissões restrinjam o acesso ao proprietário via `auth.uid() = user_id`).

### b) Integração TMDB e Fallbacks
- **Edge Functions:** A aplicação utiliza duas Edge Functions remotas (`clever-endpoint` e `fanart-logo`).
- **Problema de Consulta de Mídia (Tipo Filme):**
  Ao selecionar um título que a API do TMDB retorna como `media_type: 'movie'` (filme), a aplicação armazena seu ID. Ao abrir o modal de detalhes ou de episódios para esse item, o sistema assume que se trata de uma série de TV e chama:
  ```javascript
  const seriesDetails = await callTMDB(`tv/${tmdbId}`, {}, 'pt-BR');
  ```
  Isso gera um erro de requisição (HTTP 404) no console do desenvolvedor, pois o ID pertence a um filme e não a uma série na API do TMDB. A tela exibe "Erro ao carregar sinopse" para o usuário.

---

## 6. Riscos de Segurança e Boas Práticas

- **Políticas de CSP (Content Security Policy):**
  O cabeçalho CSP presente na tag `<meta>` do `index.html` permite a execução de scripts e estilos inline (`'unsafe-inline'`). Esse parâmetro reduz a eficácia do CSP contra ataques do tipo Cross-Site Scripting (XSS). Embora útil no ambiente de desenvolvimento do Vite (que injeta estilos dinamicamente), no ambiente de produção ele deve ser revisado, removendo a regra de injeção inline e substituindo por técnicas baseadas em hashes (`sha256`) ou `nonces`.
- **Sanitização contra XSS:**
  A aplicação utiliza uma função de escape robusta (`escapeHTML` em `catalog.js`) ao renderizar informações nos cards e nos modais. No entanto, é crucial assegurar que dados recebidos por inputs do usuário e exibidos sem escape na tela (caso haja) sejam sanitizados.

---

## 7. Catálogo de Bugs e Comportamentos Inesperados

Aqui estão detalhados os bugs encontrados, suas localizações exatas no código e como solucioná-los:

### Bug 1: URL de Pré-visualização de Imagem corrompida (broken image)
- **Local:** [`src/components/suggestions.js`](file:///c:/Projetos/dat-movie/src/components/suggestions.js#L95)
- **Descrição:** A linha 95 executa `onSetPreview(posterUrl)`, onde `posterUrl` já é uma URL absoluta montada na linha 61 (`https://image.tmdb.org/t/p/w92/path.jpg`). Contudo, em `main.js`, a função callback `onSetPreview` está implementada assim:
  ```javascript
  onSetPreview: (poster) => {
    previewImg.src = `https://image.tmdb.org/t/p/original${poster}`;
  }
  ```
  Isso faz com que o endereço resultante da imagem de preview seja inválido:
  `https://image.tmdb.org/t/p/originalhttps://image.tmdb.org/t/p/w92/path.jpg`
- **Impacto:** O pôster de pré-visualização fica quebrado e com ícone de erro no modal de adição até que a imagem de alta resolução (que usa o caminho relativo) termine de carregar.
- **Correção:** Alterar o parâmetro enviado na linha 95 em `suggestions.js` para passar apenas o caminho relativo `poster` (ex: `onSetPreview(poster)`).

---

### Bug 2: Chamada 404 do TMDb para Filmes
- **Local:** [`src/components/detailModal.js`](file:///c:/Projetos/dat-movie/src/components/detailModal.js#L94) e [`src/components/episodesModal.js`](file:///c:/Projetos/dat-movie/src/components/episodesModal.js#L76)
- **Descrição:** Quando o usuário adiciona um filme (vindo de sugestões de autocompletar cujo `media_type` é `'movie'`), a aplicação falha ao tentar buscar informações extras no modal de detalhes ou de episódios, pois a requisição é direcionada para a rota `/tv/` ao invés de `/movie/`.
- **Impacto:** O modal de episódios falha com erro visual na tela, e o modal de detalhes não exibe a sinopse original e o logotipo do título.
- **Correção:** Garantir que o `mediaType` correto seja salvo junto ao item (ou inferido dinamicamente) e passado para a função `callTMDB`. Roteie a consulta do TMDb de acordo com esse tipo.

---

### Bug 3: Código morto e re-implementação inline
- **Local:** [`src/main.js`](file:///c:/Projetos/dat-movie/src/main.js#L380-L422)
- **Descrição:** Os métodos utilitários `filterItems` e `sortItems` desenvolvidos para organizar o catálogo em `src/lib/catalog.js` não são executados em lugar nenhum de `main.js`. Em contrapartida, toda a lógica de filtragem e ordenação foi reescrita diretamente no corpo da função `render()`.
- **Impacto:** Menor reusabilidade, aumento desnecessário no tamanho do arquivo `main.js` (aumentando a complexidade ciclomática do arquivo) e redundância de testes (os testes unitários cobrem funções que não rodam em produção).
- **Correção:** Substituir a filtragem e ordenação inline pela chamada às funções importadas:
  ```javascript
  const filtered = sortItems(filterItems(items, { currentTab, search, statusFilter, tierFilter }), sortKey);
  ```

---

### Bug 4: Layout redundante e quebras visuais em resoluções mobile (CSS)
- **Local:** [`style.css`](file:///c:/Projetos/dat-movie/style.css#L1703)
- **Descrição:** Conflito de redefinições dentro da mesma media query `@media (max-width: 480px)`.
  - `.continue-grid` ganha 2 colunas após ter sido definido com 1 coluna.
  - `.grid-cols-*` ganha 3 colunas após ter sido definido com 2 colunas.
- **Impacto:** O catálogo e o bento ficam esmagados em smartphones de tela fina, forçando textos longos a quebrarem linhas de forma estranha e reduzindo drasticamente a qualidade visual da página.
- **Correção:** Organizar a folha de estilos removendo as declarações duplicadas e redundantes de forma que o mobile possua apenas 1 coluna para `.continue-grid` e 2 colunas para o grid do catálogo.

---

## 8. Plano de Ação Recomendado

### Fase 1: Correção de Bugs Críticos (Imediato)
1. **Corrigir preview em `suggestions.js`:** Passar o caminho relativo para o callback de pré-visualização.
2. **Sanear media queries redundantes no `style.css`:** Ajustar o grid mobile para 2 colunas e o bento para 1 coluna.
3. **Consertar a chamada de filmes no TMDb:** Roteamento condicional de endpoints dependendo do tipo do título consultado.

### Fase 2: Refatoração e Manutenibilidade
1. **Adotar Funções de Catálogo do `catalog.js`:** Substituir as linhas de código duplicadas em `main.js` pelas funções utilitárias importadas e testadas.
2. **Limpar Importações Mortas:** Limpar os imports não utilizados em `main.js` (`clearHold`, `updateEpisodeLimit`).
3. **Estruturar Vite Config:** Criar um arquivo `vite.config.js` para otimizar os caminhos absolutos, minificação de build e inclusão de plugins caso o projeto cresça.

### Fase 3: Acessibilidade e UX
1. **Melhorar ARIA nos Modais:** Adicionar atributos ARIA para descrever o estado dos dropdowns de Tiers (`aria-expanded`, `aria-haspopup`).
2. **Atualizar a documentação do README.md:** Corrigir as inconsistências (como a menção ao tema claro/escuro inexistente) e documentar de forma clara o banco de dados.
