// Obtém referências aos elementos da lista de animes e séries, sugestões e inputs
const animesLista = document.getElementById("animesLista");
const seriesLista = document.getElementById("seriesLista");

const titulosAdicionados = []; // Array para rastrear títulos adicionados
const API_KEY = "3895403de8d6784feb4e94f4b8ad7d9f"; // Chave da API TMDb
const nomeInput = document.getElementById("nome"); // Campo de entrada para o nome
const suggestionsDiv = document.getElementById("suggestions"); // Div para exibir sugestões

// Evento de input para o campo de nome
nomeInput.addEventListener("input", (event) => {
  const query = event.target.value;

  // Verifica se a consulta tem pelo menos 2 caracteres
  if (query.length >= 2) {
    // Faz uma requisição à API TMDb para buscar sugestões
    fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${query}`
    )
      .then((response) => response.json())
      .then((data) => {
        const results = data.results;
        suggestionsDiv.innerHTML = "";

        // Cria e adiciona sugestões na div de sugestões
        results.forEach((result) => {
          const name = result.name || result.title;
          const suggestionItem = document.createElement("div");
          suggestionItem.textContent = name;

          suggestionItem.addEventListener("click", () => {
            nomeInput.value = name;
            suggestionsDiv.innerHTML = "";
          });

          suggestionsDiv.appendChild(suggestionItem);
        });
      })
      .catch((error) => console.error("Erro ao buscar sugestões:", error));
  } else {
    suggestionsDiv.innerHTML = "";
  }
});

// Função para ordenar itens na tabela
function ordenarItens(lista) {
  return Array.from(lista.children).sort((a, b) =>
    a.children[1].textContent.localeCompare(b.children[1].textContent)
  );
}

// Função para atualizar a tabela após adicionar ou remover itens
function atualizarTabela(lista) {
  const sortedItems = ordenarItens(lista);
  while (lista.firstChild) {
    lista.removeChild(lista.firstChild);
  }
  sortedItems.forEach((item) => lista.appendChild(item));
}

// Função para adicionar um novo item
function adicionar() {
  // Obtém os valores dos inputs
  const tipo = document.getElementById("tipo").value;
  const nome = document.getElementById("nome").value;
  const temporada = document.getElementById("temporada").value;
  const episodio = document.getElementById("episodio").value;

  // Verifica se todos os campos estão preenchidos
  if (!nome || !temporada || !episodio) {
    alert("Preencha todos os campos antes de adicionar.");
    return;
  }

  // Determina a lista a ser atualizada com base no tipo
  const itemsLista = tipo === "anime" ? animesLista : seriesLista;

  // Verifica se o título já foi adicionado
  if (titulosAdicionados.includes(nome)) {
    alert("Esse título já foi adicionado anteriormente.");
    return;
  }

  // Verifica se o título já existe na lista
  for (let i = 0; i < itemsLista.children.length; i++) {
    const existingNome =
      itemsLista.children[i].querySelector("td:nth-child(2)").textContent;
    if (nome === existingNome) {
      alert("Esse título já existe na lista.");
      return;
    }
  }

  // Cria uma nova linha na tabela com os valores dos inputs
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td class="${tipo}">${tipo === "anime" ? "Anime" : "Série"}</td>
    <td>${nome}</td>
    <td>${temporada}</td>
    <td>${episodio}</td>
    <td class="imagem-cell"></td>
    <td>
      <button onclick="editar(this)">Editar</button>
      <button onclick="remover(this)">Remover</button>
    </td>
  `;

  // Busca informações da API TMDb para adicionar imagem à célula de imagem
  const imageCell = newRow.querySelector(".imagem-cell");
  const imageElement = document.createElement("img");
  fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${nome}`
  )
    .then((response) => response.json())
    .then((data) => {
      const results = data.results;

      if (results.length > 0 && results[0].poster_path) {
        const image = results[0].poster_path;
        const imageUrl = `https://image.tmdb.org/t/p/w200${image}`;
        imageElement.src = imageUrl;
        imageElement.alt = "Imagem";
        imageCell.appendChild(imageElement);
      }
    })
    .catch((error) =>
      console.error("Erro ao buscar informações da API TMDb:", error)
    );

  // Adiciona a nova linha à lista e atualiza a tabela
  itemsLista.appendChild(newRow);
  titulosAdicionados.push(nome);
  atualizarTabela(itemsLista);
}

// Função para editar um item
function editar(button) {
  const row = button.parentNode.parentNode;
  const cells = row.getElementsByTagName("td");
  const tipo = cells[0].textContent.toLowerCase();
  const nome = cells[1].textContent;
  const temporada = cells[2].textContent;
  const episodio = cells[3].textContent;

  // Remove o título da lista de títulos adicionados
  const indexTitulo = titulosAdicionados.indexOf(nome);
  if (indexTitulo !== -1) {
    titulosAdicionados.splice(indexTitulo, 1);
  }

  // Remove a linha da tabela e atualiza a lista
  row.remove();
  atualizarTabela(tipo === "anime" ? animesLista : seriesLista);
}

// Função para remover um item
function remover(button) {
  const row = button.closest("tr");
  const tipo = row.querySelector("td:first-child").textContent.toLowerCase();
  const nome = row.querySelector("td:nth-child(2)").textContent;

  // Remove o título da lista de títulos adicionados
  if (tipo === "série") {
    const index = titulosAdicionados.indexOf(nome);
    if (index !== -1) {
      titulosAdicionados.splice(index, 1);
    }
  }

  // Remove a linha da tabela e atualiza a lista
  row.remove();
  atualizarTabela(tipo === "anime" ? animesLista : seriesLista);
}