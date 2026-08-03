![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

# 🎬 Dat-Movie

Catálogo pessoal de animes, animações e séries – com autenticação, busca estilo IMDb, tier system e persistência na nuvem com Supabase.

---

## Funcionalidades

- Autenticação (login/cadastro) com Supabase
- Busca de títulos com sugestões (pôster, ano, tipo)
- Tiers de qualidade (S+ a D) com selo visual nos cards
- Modal de detalhes com sinopse, imagem, steppers (clicar e segurar) e edição de temporada/episódio
- Filtros por status, tier, ordenação e agrupamento
- Seção "Continuando" com os títulos em andamento
- Temas claro/escuro
- Barra de progresso acumulado
- Animações com anime.js

---

## Tecnologias

- HTML, CSS (variáveis, grid, glassmorphism), JavaScript (ES modules)
- Vite (build)
- Supabase (PostgreSQL + Auth + RLS)
- TMDb (via Edge Function)
- anime.js, Font Awesome, Google Fonts

---

## Como rodar

```bash
git clone https://github.com/ssyigor-cmd/dat-movie.git
cd dat-movie
npm install
```


Crie um arquivo .env:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```
Inicie o servidor:

```bash
npm run dev
```

Licença
MIT
