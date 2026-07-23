![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

````markdown
# Dat-Movie

Catálogo pessoal de animes, animações e séries – com filtros, ordenação, temas claro/escuro e busca automática de informações via API TMDb.

## Como usar

1. Clone o repositório ou baixe os arquivos:
   git clone https://github.com/seu-usuario/dat-movie.git
   cd dat-movie

2. Abra o projeto com um servidor local (recomendado para funcionamento da API):
   npx live-server
   ou simplesmente abra o arquivo index.html no navegador.

## Funcionalidades

- Adicionar animes, animações e séries com nome, temporada, episódio atual, status e nota (1–5)
- Busca automática de pôster, total de episódios e temporadas via API TMDb
- Filtros por status (Assistindo, Concluído, Planejado, Pausado)
- Ordenação por nome, progresso, data de adição, nota e temporada
- Visualização em grade ou lista
- Temas claro e escuro
- Barra de progresso com cálculo acumulado (temporadas anteriores + atual)
- Pré-visualização do pôster ao selecionar um título
- Exportar e importar dados (backup em JSON)
- Persistência local com localStorage
- Design moderno com paleta Red-Purple e efeito glassmorphism

## Arquivos principais

- index.html : Estrutura da página e formulário
- style.css : Estilos, temas, responsividade e animações
- script.js : Toda a lógica, API, filtros, ordenação, persistência e acessibilidade

## Deploy

Para gerar uma versão estática (pode ser hospedada no GitHub Pages, Netlify, Vercel, etc.), basta enviar a pasta com os três arquivos para o serviço de sua preferência.

## Licença

MIT