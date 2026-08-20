/**
 * Funções puras de regras de negócio, cálculo de progresso,
 * ordenação, filtragem e sanitização para o catálogo Dat-Movie.
 */

export const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D'];

export const TIER_COLORS = {
  'S+': 'tier-Splus',
  'S': 'tier-S',
  'A': 'tier-A',
  'B': 'tier-B',
  'C': 'tier-C',
  'D': 'tier-D'
};

/**
 * Sanitiza valores para evitar injeções XSS no DOM.
 * @param {*} value - Valor a ser sanitizado.
 * @returns {string} String com caracteres especiais HTML escapados.
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Formata datas ISO (AAAA-MM-DD) para o formato brasileiro (DD/MM/AAAA).
 * @param {string} dateStr - String de data.
 * @returns {string} Data formatada ou string original caso inválida.
 */
export function formatDateBR(dateStr) {
  if (!dateStr || dateStr === 'Data desconhecida') return dateStr;
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Retorna a classe CSS correspondente a um determinado Tier.
 * @param {string|null} tier - Nome do tier (S+, S, A, B, C, D).
 * @returns {string} Nome da classe CSS ou string vazia.
 */
export function getTierClass(tier) {
  return TIER_COLORS[tier] || '';
}

/**
 * Calcula a porcentagem de progresso acumulado assistido de um título.
 * @param {Object} item - Objeto do item do catálogo.
 * @returns {number} Porcentagem calculada entre 0 e 100.
 */
export function calcularProgresso(item) {
  if (!item) return 0;
  let cumulativeCurrent = 0;
  const totalEp = Math.max(1, item.totalEpisodios || 1);

  try {
    if (item.seasonEpisodesMap && typeof item.seasonEpisodesMap === 'object' && item.temporada) {
      const seasonsMap = item.seasonEpisodesMap;
      const currentSeason = Number(item.temporada);
      let sumPrevious = 0;
      for (const [season, eps] of Object.entries(seasonsMap)) {
        if (Number(season) < currentSeason && typeof eps === 'number') {
          sumPrevious += eps;
        }
      }
      cumulativeCurrent = sumPrevious + Math.max(0, item.episodio || 0);
    } else {
      cumulativeCurrent = Math.max(0, item.episodio || 0);
    }
  } catch (e) {
    cumulativeCurrent = Math.max(1, item.episodio || 1);
  }

  if (cumulativeCurrent > totalEp) cumulativeCurrent = totalEp;
  return Math.min(100, Math.round((cumulativeCurrent / totalEp) * 100));
}

/**
 * Filtra a lista de itens com base na aba atual, termo de busca, status, tier e lista específica.
 * @param {Array} items - Lista completa de itens.
 * @param {Object} filters - Objeto com os critérios de filtro.
 * @returns {Array} Lista filtrada.
 */
export function filterItems(items, { currentTab = 'all', search = '', statusFilter = 'todos', tierFilter = 'todos', currentListId = null } = {}) {
  if (!Array.isArray(items)) return [];

  let baseItems = items.slice();

  // Filtro por lista específica (quando não é "Todos" ou "Desejos")
  if (currentListId && currentTab !== 'all' && currentTab !== 'planejado') {
    baseItems = baseItems.filter(item => 
      item.lists?.some(list => list.id === currentListId)
    );
  }

  // Filtro por aba
  if (currentTab === 'planejado') {
    baseItems = baseItems.filter(item => item.status === 'planejado');
  } else {
    baseItems = baseItems.filter(item => item.status !== 'planejado');
  }

  // Manter compatibilidade com filtro por tipo para abas antigas
  if (currentTab !== 'planejado' && currentTab !== 'all' && !currentListId) {
    baseItems = baseItems.filter(item => item.tipo === currentTab);
  }

  // Filtro por busca textual
  const query = search.toLowerCase().trim();
  if (query) {
    baseItems = baseItems.filter(item => item.nome && item.nome.toLowerCase().includes(query));
  }

  // Filtro por status
  if (statusFilter !== 'todos') {
    baseItems = baseItems.filter(item => item.status === statusFilter);
  }

  // Filtro por tier
  if (tierFilter !== 'todos') {
    if (tierFilter === 'null') {
      baseItems = baseItems.filter(item => !item.tier);
    } else {
      baseItems = baseItems.filter(item => item.tier === tierFilter);
    }
  }

  return baseItems;
}

/**
 * Ordena uma lista de itens de acordo com a chave especificada.
 * @param {Array} items - Lista de itens a serem ordenados.
 * @param {string} sortKey - Chave de ordenação (ex: 'nome-asc', 'progresso-desc', 'tier-asc').
 * @returns {Array} Nova lista ordenada.
 */
export function sortItems(items, sortKey = 'data-desc') {
  if (!Array.isArray(items)) return [];
  const list = items.slice();
  const [field, direction] = sortKey.split('-');
  const isAsc = direction === 'asc';

  return list.sort((a, b) => {
    let valA, valB;
    switch (field) {
      case 'nome':
        valA = (a.nome || '').toLowerCase();
        valB = (b.nome || '').toLowerCase();
        break;
      case 'progresso':
        valA = calcularProgresso(a);
        valB = calcularProgresso(b);
        break;
      case 'data':
        valA = new Date(a.dataCriacao || 0).getTime();
        valB = new Date(b.dataCriacao || 0).getTime();
        break;
      case 'tier': {
        const idxA = TIER_ORDER.indexOf(a.tier);
        const idxB = TIER_ORDER.indexOf(b.tier);
        valA = idxA === -1 ? (isAsc ? 999 : -1) : idxA;
        valB = idxB === -1 ? (isAsc ? 999 : -1) : idxB;
        break;
      }
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
}
