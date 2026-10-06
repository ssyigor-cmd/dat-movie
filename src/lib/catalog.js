/**
 * Funções puras de regras de negócio, cálculo de progresso,
 * ordenação, filtragem e sanitização para o catálogo Dat-Movie.
 */

import { matchScore } from './fuzzySearch.js';

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
 * Soma de um `seasonEpisodesMap`, ou seja, o total de episódios da série toda.
 *
 * Este total é o denominador confiável do progresso, e a coluna
 * `totalEpisodios` não é: o modal de adicionar grava `number_of_episodes` (a
 * série inteira), a página do título grava a contagem só da temporada atual, e
 * a coluna nasce com `DEFAULT 1` — que com qualquer episódio assistido já dá
 * 100%. Numerador e denominador precisam falar da mesma unidade, então o mapa,
 * que vem do TMDb temporada a temporada, manda sempre que existir.
 * @param {Object} mapa - Mapa temporada → contagem de episódios.
 * @returns {number} Total somado, ou 0 se o mapa não servir.
 */
export function totalDeEpisodiosDaSerie(mapa) {
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return 0;
  return Object.values(mapa).reduce((acc, eps) => acc + (Number(eps) || 0), 0);
}

/**
 * Calcula a porcentagem de progresso acumulado assistido de um título.
 *
 * Devolve 0 quando não há como saber o total de episódios do título — barra
 * vazia é "faltou dado", barra cheia seria uma mentira.
 * @param {Object} item - Objeto do item do catálogo.
 * @returns {number} Porcentagem calculada entre 0 e 100.
 */
export function calcularProgresso(item) {
  if (!item) return 0;
  const somaMapa = totalDeEpisodiosDaSerie(item.seasonEpisodesMap);
  const coluna = Number(item.totalEpisodios) || 0;
  const currentSeason = Number(item.temporada) || 0;

  let assistido = Math.max(0, Number(item.episodio) || 0);
  // Só soma temporadas anteriores quando há mapa: sem ele não existe como
  // saber quantos episódios as temporadas de trás tinham.
  if (somaMapa > 0 && currentSeason > 1) {
    let anteriores = 0;
    for (const [season, eps] of Object.entries(item.seasonEpisodesMap)) {
      if (Number(season) < currentSeason) anteriores += Number(eps) || 0;
    }
    assistido += anteriores;
  }

  // O mapa manda: ele vem do TMDb temporada a temporada. A coluna só entra
  // quando o mapa não existe, e nem assim quando ela for menor que o que já
  // foi assistido. Um total assim não é um total apertado, é lixo — a coluna
  // nasce com DEFAULT 1 e o bug antigo da página do título gravava só a
  // temporada atual — e dividir por ele marca como concluído um título que
  // está no começo. Sem total não há porcentagem honesta a mostrar.
  const totalEp = somaMapa > 0 ? somaMapa : coluna;
  if (totalEp <= 0) return 0;
  if (somaMapa <= 0 && assistido >= totalEp) return 0;

  const pct = Math.round((Math.min(assistido, totalEp) / totalEp) * 100);
  return Math.max(0, Math.min(100, pct));
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

  // Filtro por busca textual (tolerante a acento, ordem e erro de digitação)
  if (search) {
    baseItems = baseItems
      .map((item, i) => ({ item, i, score: matchScore(search, item.nome) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map(({ item }) => item);
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
 * Verifica se um candidato já existe no catálogo.
 * Fonte da verdade é tmdb_id. Fallback nome+tipo+ano só para itens sem tmdb_id.
 * @param {Object} candidate - { tmdb_id, nome, tipo, ano }
 * @param {Array} catalogItems - lista do usuário
 * @param {number|null} excludeIndex - índice a ignorar (edição)
 * @returns {boolean}
 */
export function isDuplicateInCatalog(candidate, catalogItems, excludeIndex = null) {
  if (!candidate || !Array.isArray(catalogItems) || catalogItems.length === 0) return false;
  const candId = candidate.tmdb_id;
  if (candId != null && candId !== '') {
    const cid = String(candId);
    return catalogItems.some((it, idx) => {
      if (excludeIndex !== null && idx === excludeIndex) return false;
      return it.tmdb_id != null && it.tmdb_id !== '' && String(it.tmdb_id) === cid;
    });
  }
  const candNome = (candidate.nome || '').trim().toLowerCase();
  const candTipo = candidate.tipo || '';
  const candAno = candidate.ano != null ? String(candidate.ano) : '';
  if (!candNome) return false;
  return catalogItems.some((it, idx) => {
    if (excludeIndex !== null && idx === excludeIndex) return false;
    if (it.tmdb_id != null && it.tmdb_id !== '') return false;
    const itNome = (it.nome || '').trim().toLowerCase();
    const itTipo = it.tipo || '';
    if (itNome !== candNome || itTipo !== candTipo) return false;
    const itAno = it.ano != null ? String(it.ano) : '';
    if (candAno && itAno) return candAno === itAno;
    return true;
  });
}

/**
 * Filtra resultados TMDb removendo os que já estão no catálogo (por tmdb_id).
 * Reutiliza a lógica de dedupe por tmdb_id.
 * @param {Array} tmdbResults - array com id
 * @param {Array} catalogItems
 * @returns {Array}
 */
export function filterNotInCatalog(tmdbResults, catalogItems) {
  if (!Array.isArray(tmdbResults)) return [];
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return tmdbResults.slice();
  const catalogIds = new Set(
    catalogItems
      .filter((i) => i.tmdb_id != null && i.tmdb_id !== '')
      .map((i) => String(i.tmdb_id))
  );
  return tmdbResults.filter((r) => !catalogIds.has(String(r.id)));
}

/**
 * Ordena uma lista de itens de acordo com a chave especificada.
 * @param {Array} items - Lista de itens a serem ordenados.
 * @param {string} sortKey - Chave de ordenação: `campo-direção`, com direção
 *   `asc` ou `desc` (ex: 'nome-asc', 'nome-desc', 'progresso-desc', 'ano-asc').
 *   Todo campo aceito nos dois sentidos.
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
      case 'ano': {
        // Mesma sentinela do tier: um título sem ano vira 0, que em ordem
        // ascendente subiria para o topo — "Ano (mais antigo)" abrindo com
        // tudo que não tem ano. O par de valores joga o ausente para o fim nas
        // duas direções, que é onde ele pertence.
        valA = a.ano ? a.ano : (isAsc ? Infinity : -1);
        valB = b.ano ? b.ano : (isAsc ? Infinity : -1);
        break;
      }
      default:
        valA = 0;
        valB = 0;
    }
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });
}
