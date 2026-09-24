/**
 * Estado global encapsulado - Fase 6
 * Centraliza variáveis antes espalhadas em main.js
 */

export const state = {
  items: [],
  editingIndex: null,
  currentTab: (() => {
    const v = localStorage.getItem('activeTab') || 'home';
    return ['home','all','planejado','pesquisa','list'].includes(v) ? v : 'home';
  })(),
  currentListId: localStorage.getItem('activeListId') || null,
  currentUser: null,
  userLists: [],
  listsSortable: null,
  cachedShowDetails: null,
  selectedTmdbId: null,
  selectedMediaType: null,
  selectedPosterPath: null,
  selectedAno: null,
  selectedName: '',
  existingItemForSearch: null,
  gridDensity: parseInt(localStorage.getItem('gridDensity')) || 8,
  groupingActive: localStorage.getItem('groupingActive') === 'true' || false,
  addSeasonLimits: {},
  addEpisodeInfoRequestId: 0,
};

export function persistNavState() {
  try {
    localStorage.setItem('activeTab', state.currentTab);
    if (state.currentListId) localStorage.setItem('activeListId', state.currentListId);
    else localStorage.removeItem('activeListId');
  } catch (_) {}
}

export function setActiveTab(tab, listId = null) {
  state.currentTab = tab;
  state.currentListId = listId;
  persistNavState();
}

export function getState() { return state; }
