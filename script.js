(function() {
  'use strict';

  // ========== CONFIG ==========
  const API_KEY = '3895403de8d6784feb4e94f4b8ad7d9f';
  const STORAGE_KEY = 'datmovie_items';
  const STORAGE_VERSION = '1.0';

  // ========== ESTADO ==========
  let items = [];
  let editingIndex = null;
  let viewMode = 'grid';
  let currentTab = 'anime';
  let cachedShowDetails = null;

  // ========== DOM REFS ==========
  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const tipo = $('tipo');
  const nome = $('nome');
  const temporada = $('temporada');
  const episodio = $('episodio');
  const statusSelect = $('status');
  const notaSelect = $('nota');
  const btnSubmit = $('btnSubmit');
  const btnCancel = $('btnCancel');
  const grid = $('grid');
  const suggestions = $('suggestions');
  const toast = $('toast');
  const searchInput = $('searchInput');
  const viewToggle = $('viewToggle');
  const openFormBtn = $('openFormBtn');
  const modalOverlay = $('modalOverlay');
  const modalClose = $('modalClose');
  const modalTitle = $('modalTitle');
  const themeToggle = $('themeToggle');
  const navItems = document.querySelectorAll('.nav-item');
  const previewImg = $('previewImg');
  const previewPlaceholder = $('previewPlaceholder');
  const episodioMaxHint = $('episodioMaxHint');
  const formLoading = $('formLoading');
  const filterStatus = $('filterStatus');
  const sortOrder = $('sortOrder');

  const totalCount = $('totalCount');
  const animeCount = $('animeCount');
  const animacaoCount = $('animacaoCount');
  const serieCount = $('serieCount');

  // ========== PERSISTÊNCIA ==========
  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          items = parsed.filter(item =>
            item &&
            typeof item === 'object' &&
            typeof item.nome === 'string' &&
            item.nome.trim() !== '' &&
            ['anime', 'animacao', 'serie'].includes(item.tipo) &&
            typeof item.temporada === 'number' && item.temporada >= 1 &&
            typeof item.episodio === 'number' && item.episodio >= 1 &&
            typeof item.totalEpisodios === 'number' && item.totalEpisodios >= 1
          );
          items.forEach(item => {
            if (!item.seasonEpisodesMap || typeof item.seasonEpisodesMap !== 'object') {
              item.seasonEpisodesMap = {};
            }
            // Garantir campos novos para itens antigos
            if (!item.status) item.status = 'assistindo';
            if (!item.dataCriacao) item.dataCriacao = new Date().toISOString();
            if (item.nota === undefined) item.nota = null;
          });
          return;
        }
      }
      items = [];
    } catch (e) {
      console.warn('Erro ao carregar dados:', e);
      items = [];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao salvar dados:', e);
      showToast('Erro ao salvar dados. Verifique o console.', 4000);
    }
  }

  // ========== TEMA ==========
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = themeToggle.querySelector('i');
    icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  // ========== TOAST ==========
  let toastTimer = null;

  function showToast(msg, duration = 2800) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ========== CÁLCULO DE PROGRESSO ==========
  function calcularProgresso(item) {
    let cumulativeCurrent = 0;
    let totalEp = item.totalEpisodios || 1;
    try {
      if (item.seasonEpisodesMap && typeof item.seasonEpisodesMap === 'object' && item.temporada) {
        const seasonsMap = item.seasonEpisodesMap;
        const currentSeason = String(item.temporada);
        let sumPrevious = 0;
        for (const [season, eps] of Object.entries(seasonsMap)) {
          if (Number(season) < Number(currentSeason) && typeof eps === 'number') {
            sumPrevious += eps;
          }
        }
        cumulativeCurrent = sumPrevious + (item.episodio || 1);
      } else {
        cumulativeCurrent = item.episodio || 1;
      }
    } catch (e) {
      cumulativeCurrent = item.episodio || 1;
    }
    if (cumulativeCurrent > totalEp) cumulativeCurrent = totalEp;
    return Math.min(100, Math.round((cumulativeCurrent / totalEp) * 100));
  }

  // ========== RENDER ==========
  function render() {
    const tab = currentTab;
    const search = searchInput.value.toLowerCase().trim();
    const statusFilter = filterStatus.value;
    const sortKey = sortOrder.value;

    let filtered = items.slice();

    // Filtro por tipo (aba)
    if (tab !== 'all') filtered = filtered.filter(item => item.tipo === tab);

    // Filtro por texto (busca)
    if (search) filtered = filtered.filter(item => item.nome.toLowerCase().includes(search));

    // Filtro por status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Ordenação
    const [field, direction] = sortKey.split('-');
    const isAsc = direction === 'asc';

    filtered.sort((a, b) => {
      let valA, valB;

      switch (field) {
        case 'nome':
          valA = a.nome.toLowerCase();
          valB = b.nome.toLowerCase();
          break;
        case 'progresso':
          valA = calcularProgresso(a);
          valB = calcularProgresso(b);
          break;
        case 'data':
          valA = new Date(a.dataCriacao || 0);
          valB = new Date(b.dataCriacao || 0);
          break;
        case 'nota':
          valA = a.nota || 0;
          valB = b.nota || 0;
          break;
        case 'temporada':
          valA = a.temporada || 0;
          valB = b.temporada || 0;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    // Atualiza estatísticas
    totalCount.textContent = items.length;
    animeCount.textContent = items.filter(i => i.tipo === 'anime').length;
    animacaoCount.textContent = items.filter(i => i.tipo === 'animacao').length;
    serieCount.textContent = items.filter(i => i.tipo === 'serie').length;

    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum título encontrado</p></div>`;
      grid.className = 'grid';
      return;
    }

    const isGrid = viewMode === 'grid';
    grid.className = `grid ${isGrid ? '' : 'list-mode'}`;

    const fragment = document.createDocumentFragment();

    filtered.forEach((item) => {
      const realIndex = items.indexOf(item);
      const progress = calcularProgresso(item);
      const icon = item.tipo === 'anime' ? 'fa-tv' : item.tipo === 'animacao' ? 'fa-paint-brush' : 'fa-video';
      const tipoLabel = item.tipo === 'anime' ? 'Anime' : item.tipo === 'animacao' ? 'Animação' : 'Série';
      const estrelas = item.nota ? '⭐'.repeat(item.nota) : '';

      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      card.innerHTML = `
        <div class="card-img">
          ${item.imagem ? `<img src="${item.imagem}" alt="${item.nome}" loading="lazy" />` : `<i class="fas ${icon}" style="font-size:1.8rem; opacity:0.3;"></i>`}
        </div>
        <div class="card-body">
          <span class="badge">${tipoLabel}</span>
          <h3 title="${item.nome}">${item.nome}</h3>
          ${estrelas ? `<span class="estrelas">${estrelas}</span>` : ''}
          <div class="info">
            <span>T${item.temporada} • Ep ${item.episodio}/${item.totalEpisodios}</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar" style="width:${progress}%;"></div>
          </div>
          <div class="card-actions">
            <button class="edit" data-index="${realIndex}" aria-label="Editar ${item.nome}"><i class="fas fa-pen"></i> Editar</button>
            <button class="delete" data-index="${realIndex}" aria-label="Remover ${item.nome}"><i class="fas fa-trash"></i> Remover</button>
          </div>
        </div>
      `;

      const editBtn = card.querySelector('.edit');
      const deleteBtn = card.querySelector('.delete');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startEdit(parseInt(editBtn.dataset.index));
      });
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(parseInt(deleteBtn.dataset.index));
      });

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  // ========== VALIDAÇÃO E EPISÓDIOS ==========
  function updateEpisodeMax(seasonNumber) {
    if (!cachedShowDetails) return;
    const season = cachedShowDetails.seasons.find(s => s.season_number === seasonNumber);
    const maxEp = season ? season.episode_count : 0;
    episodio.max = maxEp;
    episodioMaxHint.textContent = `Máximo: ${maxEp}`;
    if (parseInt(episodio.value) > maxEp) {
      episodio.value = maxEp;
    }
  }

  function populateSeasons(seasons) {
    temporada.innerHTML = '<option value="">Selecione</option>';
    seasons.forEach(s => {
      if (s.season_number === 0) return;
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.dataset.episodes = s.episode_count || 0;
      opt.textContent = `Temporada ${s.season_number} (${s.episode_count || 0} eps)`;
      temporada.appendChild(opt);
    });
    const firstSeason = seasons.find(s => s.season_number !== 0);
    if (firstSeason) {
      temporada.value = firstSeason.season_number;
      updateEpisodeMax(firstSeason.season_number);
    }
  }

  function clearPreview() {
    previewImg.style.display = 'none';
    previewImg.src = '';
    previewPlaceholder.style.display = 'block';
  }

  function setPreview(imagePath) {
    if (imagePath) {
      previewImg.src = `https://image.tmdb.org/t/p/w200${imagePath}`;
      previewImg.style.display = 'block';
      previewPlaceholder.style.display = 'none';
    } else {
      clearPreview();
    }
  }

  function setLoading(show) {
    formLoading.style.display = show ? 'flex' : 'none';
    btnSubmit.disabled = show;
    btnCancel.disabled = show;
  }

  // ========== CRUD ==========
  function addItem(e) {
    e.preventDefault();

    const nomeVal = nome.value.trim();
    const tempVal = parseInt(temporada.value);
    const epVal = parseInt(episodio.value);
    const statusVal = statusSelect.value;
    const notaVal = parseInt(notaSelect.value) || null;

    if (!nomeVal) { showToast('Digite o nome.'); return; }
    if (isNaN(tempVal) || tempVal < 1) { showToast('Selecione uma temporada válida.'); return; }
    if (isNaN(epVal) || epVal < 1) { showToast('Episódio atual ≥ 1.'); return; }

    const maxEp = parseInt(episodio.max) || 0;
    if (epVal > maxEp) {
      showToast(`O episódio não pode ser maior que ${maxEp} para esta temporada.`);
      return;
    }

    const tipoVal = tipo.value;

    let totalEp = 0;
    let seasonEpisodesMap = {};
    if (cachedShowDetails && cachedShowDetails.totalEpisodes > 0) {
      totalEp = cachedShowDetails.totalEpisodes;
      cachedShowDetails.seasons.forEach(s => {
        if (s.season_number !== 0) {
          seasonEpisodesMap[s.season_number] = s.episode_count || 0;
        }
      });
    } else {
      showToast('Buscando informações da série...', 2000);
      setLoading(true);
      fetchDetailsAndThen(nomeVal, () => {
        setLoading(false);
        addItem(e);
      });
      return;
    }

    if (totalEp === 0) {
      showToast('Não foi possível obter o total de episódios. Tente novamente.');
      return;
    }

    const duplicate = items.some((it, i) =>
      it.nome.toLowerCase() === nomeVal.toLowerCase() &&
      it.tipo === tipoVal &&
      i !== editingIndex
    );
    if (duplicate) { showToast('Este título já existe.'); return; }

    if (editingIndex !== null) {
      const oldName = items[editingIndex].nome;
      const nameChanged = (oldName !== nomeVal);

      items[editingIndex] = {
        ...items[editingIndex],
        nome: nomeVal,
        temporada: tempVal,
        episodio: epVal,
        totalEpisodios: totalEp,
        tipo: tipoVal,
        seasonEpisodesMap: seasonEpisodesMap,
        status: statusVal,
        nota: notaVal,
        dataCriacao: items[editingIndex].dataCriacao || new Date().toISOString()
      };

      if (nameChanged) {
        items[editingIndex].imagem = null;
        fetchImageAndDetails(nomeVal, editingIndex);
      }

      showToast('Item atualizado!');
      editingIndex = null;
      btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
      modalTitle.innerHTML = '<i class="fas fa-pen"></i> Adicionar título';
      btnCancel.style.display = 'inline-flex';
    } else {
      const newItem = {
        tipo: tipoVal,
        nome: nomeVal,
        temporada: tempVal,
        episodio: epVal,
        totalEpisodios: totalEp,
        seasonEpisodesMap: seasonEpisodesMap,
        status: statusVal,
        nota: notaVal,
        imagem: null,
        dataCriacao: new Date().toISOString()
      };
      items.push(newItem);
      fetchImageAndDetails(nomeVal, items.length - 1);
      showToast('Item adicionado!');
    }

    saveData();
    render();
    closeModal();
    form.reset();
    temporada.value = '';
    episodio.value = 1;
    episodio.max = 0;
    episodioMaxHint.textContent = 'Máximo: --';
    clearPreview();
    cachedShowDetails = null;
    suggestions.classList.remove('active');
    setLoading(false);
  }

  function fetchDetailsAndThen(nome, callback) {
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(nome)}`)
      .then(r => r.json())
      .then(data => {
        const result = data.results?.[0];
        if (result && result.media_type === 'tv') {
          return fetch(`https://api.themoviedb.org/3/tv/${result.id}?api_key=${API_KEY}`)
            .then(r => r.json())
            .then(tvData => {
              cachedShowDetails = {
                totalEpisodes: tvData.number_of_episodes || 0,
                seasons: tvData.seasons || []
              };
            });
        } else {
          cachedShowDetails = {
            totalEpisodes: 1,
            seasons: [{ season_number: 1, episode_count: 1 }]
          };
        }
      })
      .catch(() => {
        cachedShowDetails = {
          totalEpisodes: 1,
          seasons: [{ season_number: 1, episode_count: 1 }]
        };
      })
      .finally(() => {
        if (typeof callback === 'function') callback();
      });
  }

  function deleteItem(index) {
    if (!confirm('Remover este título?')) return;
    items.splice(index, 1);
    saveData();
    render();
    showToast('Item removido.');
  }

  function startEdit(index) {
    const item = items[index];
    editingIndex = index;
    tipo.value = item.tipo;
    nome.value = item.nome;
    statusSelect.value = item.status || 'assistindo';
    notaSelect.value = item.nota || '';

    setLoading(true);
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(item.nome)}`)
      .then(r => r.json())
      .then(data => {
        const result = data.results?.[0];
        if (result && result.media_type === 'tv') {
          return fetch(`https://api.themoviedb.org/3/tv/${result.id}?api_key=${API_KEY}`);
        } else {
          return Promise.resolve({ json: () => ({ seasons: [{ season_number: 1, episode_count: 1 }], number_of_episodes: 1 }) });
        }
      })
      .then(r => r.json())
      .then(details => {
        cachedShowDetails = {
          totalEpisodes: details.number_of_episodes || 1,
          seasons: details.seasons || [{ season_number: 1, episode_count: 1 }]
        };
        populateSeasons(cachedShowDetails.seasons);
        if (temporada.querySelector(`option[value="${item.temporada}"]`)) {
          temporada.value = item.temporada;
        } else {
          const first = cachedShowDetails.seasons.find(s => s.season_number !== 0);
          temporada.value = first ? first.season_number : 1;
        }
        updateEpisodeMax(parseInt(temporada.value));
        episodio.value = item.episodio;
        if (item.imagem) {
          setPreviewFromUrl(item.imagem);
        } else {
          clearPreview();
        }
        setLoading(false);
      })
      .catch(() => {
        showToast('Não foi possível buscar detalhes. Preencha manualmente.', 3000);
        setLoading(false);
        cachedShowDetails = {
          totalEpisodes: 1,
          seasons: [{ season_number: 1, episode_count: 1 }]
        };
        populateSeasons(cachedShowDetails.seasons);
        temporada.value = 1;
        updateEpisodeMax(1);
        episodio.value = item.episodio || 1;
      });

    btnSubmit.innerHTML = '<i class="fas fa-save"></i> Atualizar';
    modalTitle.innerHTML = '<i class="fas fa-pen"></i> Editar título';
    btnCancel.style.display = 'inline-flex';
    openModal();
  }

  function setPreviewFromUrl(url) {
    previewImg.src = url;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  }

  function cancelEdit() {
    editingIndex = null;
    btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar';
    modalTitle.innerHTML = '<i class="fas fa-pen"></i> Adicionar título';
    btnCancel.style.display = 'inline-flex';
    form.reset();
    temporada.value = '';
    episodio.value = 1;
    episodio.max = 0;
    episodioMaxHint.textContent = 'Máximo: --';
    clearPreview();
    cachedShowDetails = null;
    suggestions.classList.remove('active');
    closeModal();
    setLoading(false);
  }

  // ========== MODAL ==========
  function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => nome.focus(), 100);
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      cancelEdit();
      closeModal();
    }
  });

  // ========== API: IMAGEM E DETALHES ==========
  function fetchImageAndDetails(nome, index) {
    fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(nome)}`)
      .then(r => r.json())
      .then(data => {
        const result = data.results?.[0];
        if (!result) return;
        if (result.poster_path) {
          items[index].imagem = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
        }
        if (result.media_type === 'tv') {
          const tvId = result.id;
          return fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}`)
            .then(r => r.json())
            .then(tvData => {
              if (tvData.number_of_episodes) {
                items[index].totalEpisodios = tvData.number_of_episodes;
                const map = {};
                tvData.seasons.forEach(s => {
                  if (s.season_number !== 0) {
                    map[s.season_number] = s.episode_count || 0;
                  }
                });
                items[index].seasonEpisodesMap = map;
              }
            });
        } else {
          items[index].totalEpisodios = 1;
          items[index].seasonEpisodesMap = { 1: 1 };
        }
      })
      .catch(() => {})
      .finally(() => {
        saveData();
        render();
      });
  }

  // ========== SUGESTÕES ==========
  let suggestionTimeout = null;

  nome.addEventListener('input', () => {
    clearTimeout(suggestionTimeout);
    const q = nome.value.trim();
    if (q.length < 2) {
      suggestions.classList.remove('active');
      clearPreview();
      return;
    }
    suggestionTimeout = setTimeout(() => {
      fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => {
          suggestions.innerHTML = '';
          data.results?.forEach(res => {
            const name = res.name || res.title;
            if (!name) return;
            const div = document.createElement('div');
            div.textContent = name;
            div.dataset.id = res.id;
            div.dataset.mediaType = res.media_type;
            div.dataset.poster = res.poster_path || '';
            div.setAttribute('role', 'option');
            div.addEventListener('click', () => {
              nome.value = name;
              suggestions.classList.remove('active');

              if (div.dataset.mediaType === 'tv') {
                tipo.value = 'serie';
              } else if (div.dataset.mediaType === 'movie') {
                tipo.value = 'animacao';
              }

              if (div.dataset.poster) {
                setPreview(div.dataset.poster);
              } else {
                clearPreview();
              }

              setLoading(true);
              if (div.dataset.mediaType === 'tv') {
                const tvId = div.dataset.id;
                fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}`)
                  .then(r => r.json())
                  .then(details => {
                    cachedShowDetails = {
                      totalEpisodes: details.number_of_episodes || 0,
                      seasons: details.seasons || []
                    };
                    populateSeasons(cachedShowDetails.seasons);
                    if (temporada.value) {
                      updateEpisodeMax(parseInt(temporada.value));
                    }
                    showToast(`Total de episódios: ${cachedShowDetails.totalEpisodes}`, 2000);
                    setLoading(false);
                  })
                  .catch(() => {
                    showToast('Não foi possível buscar detalhes.', 2000);
                    setLoading(false);
                  });
              } else {
                cachedShowDetails = {
                  totalEpisodes: 1,
                  seasons: [{ season_number: 1, episode_count: 1 }]
                };
                populateSeasons(cachedShowDetails.seasons);
                updateEpisodeMax(1);
                showToast('Filme único (1 episódio)', 1500);
                setLoading(false);
              }
            });
            suggestions.appendChild(div);
          });
          suggestions.classList.add('active');
        })
        .catch(() => {});
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.form-group')) {
      suggestions.classList.remove('active');
    }
  });

  // ========== EVENTO: MUDANÇA DE TEMPORADA ==========
  temporada.addEventListener('change', () => {
    const val = parseInt(temporada.value);
    if (val && cachedShowDetails) {
      updateEpisodeMax(val);
      episodio.focus();
    } else {
      episodioMaxHint.textContent = 'Máximo: --';
    }
  });

  // ========== NAVEGAÇÃO ==========
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const tab = item.dataset.tab;
      if (tab) { currentTab = tab; render(); }
    });
  });

  // ========== TOOLBAR ==========
  viewToggle.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    viewToggle.innerHTML = viewMode === 'grid' ? '<i class="fas fa-th"></i>' : '<i class="fas fa-list"></i>';
    render();
  });

  openFormBtn.addEventListener('click', () => {
    if (editingIndex !== null) cancelEdit();
    clearPreview();
    cachedShowDetails = null;
    temporada.innerHTML = '<option value="">Selecione</option>';
    episodio.value = 1;
    episodio.max = 0;
    episodioMaxHint.textContent = 'Máximo: --';
    // Preencher status com valor padrão
    statusSelect.value = 'assistindo';
    notaSelect.value = '';
    openModal();
  });

  modalClose.addEventListener('click', () => {
    cancelEdit();
    closeModal();
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      cancelEdit();
      closeModal();
    }
  });

  searchInput.addEventListener('input', render);
  filterStatus.addEventListener('change', render);
  sortOrder.addEventListener('change', render);

  // ========== EXPORT / IMPORT ==========
  document.getElementById('exportBtn').addEventListener('click', () => {
    try {
      const data = JSON.stringify(items, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      a.download = `datmovie_backup_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Dados exportados!');
    } catch (e) {
      showToast('Erro ao exportar.', 3000);
      console.error(e);
    }
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data) && data.length > 0) {
            const valid = data.every(item =>
              item &&
              typeof item === 'object' &&
              typeof item.nome === 'string' &&
              item.nome.trim() !== '' &&
              ['anime', 'animacao', 'serie'].includes(item.tipo) &&
              typeof item.temporada === 'number' && item.temporada >= 1 &&
              typeof item.episodio === 'number' && item.episodio >= 1 &&
              typeof item.totalEpisodios === 'number' && item.totalEpisodios >= 1
            );
            if (valid) {
              if (items.length > 0 && !confirm('Isso substituirá todos os dados atuais. Continuar?')) return;
              items = data;
              items.forEach(item => {
                if (!item.seasonEpisodesMap || typeof item.seasonEpisodesMap !== 'object') {
                  item.seasonEpisodesMap = {};
                }
                if (!item.status) item.status = 'assistindo';
                if (!item.dataCriacao) item.dataCriacao = new Date().toISOString();
                if (item.nota === undefined) item.nota = null;
              });
              saveData();
              render();
              showToast('Dados importados com sucesso!');
            } else {
              showToast('Arquivo inválido: estrutura incorreta.');
            }
          } else {
            showToast('Arquivo vazio ou inválido.');
          }
        } catch (err) {
          showToast('Erro ao importar: arquivo corrompido.');
          console.error(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // ========== EVENTOS DO FORM ==========
  form.addEventListener('submit', addItem);
  btnCancel.addEventListener('click', cancelEdit);
  themeToggle.addEventListener('click', toggleTheme);

  // ========== INICIALIZAR ==========
  loadData();
  loadTheme();

  if (items.length === 0) {
    const exemplos = [
      { tipo: 'anime', nome: 'Naruto', temporada: 1, episodio: 20, totalEpisodios: 220, seasonEpisodesMap: {1: 220}, imagem: null, status: 'assistindo', nota: 4, dataCriacao: new Date().toISOString() },
      { tipo: 'serie', nome: 'Game of Thrones', temporada: 3, episodio: 5, totalEpisodios: 73, seasonEpisodesMap: {1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 7, 8: 6}, imagem: null, status: 'assistindo', nota: 5, dataCriacao: new Date().toISOString() },
      { tipo: 'animacao', nome: 'Toy Story', temporada: 1, episodio: 1, totalEpisodios: 1, seasonEpisodesMap: {1: 1}, imagem: null, status: 'concluido', nota: 3, dataCriacao: new Date().toISOString() }
    ];
    items = exemplos;
    saveData();
    exemplos.forEach((ex, i) => fetchImageAndDetails(ex.nome, i));
    setTimeout(render, 500);
  } else {
    render();
  }

})();