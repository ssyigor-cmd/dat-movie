/**
 * Estado global encapsulado - Fase 6
 * Centraliza variáveis antes espalhadas em main.js
 */

export const STORAGE_KEYS = {
  ACTIVE_TAB: 'activeTab',
  ACTIVE_LIST_ID: 'activeListId',
  GRID_DENSITY: 'gridDensity',
  GROUPING_ACTIVE: 'groupingActive',
  SHOW_PROGRESS_BAR: 'showProgressBar',
  THEME: 'theme'
};

export const state = {
  items: [],
  currentTab: (() => {
    const v = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'home';
    return ['home','all','planejado','pesquisa','list'].includes(v) ? v : 'home';
  })(),
  currentListId: localStorage.getItem(STORAGE_KEYS.ACTIVE_LIST_ID) || null,
  currentUser: null,
  userLists: [],
  listsSortable: null,
  gridDensity: parseInt(localStorage.getItem(STORAGE_KEYS.GRID_DENSITY)) || 8,
  groupingActive: (localStorage.getItem(STORAGE_KEYS.GROUPING_ACTIVE)) === 'true',
  // Padrão é *mostrar*. Quem nunca escolheu nada não deve ver a tela mudar ao
  // atualizar o app; a ausência da chave conta como "não escolheu".
  showProgressBar: localStorage.getItem(STORAGE_KEYS.SHOW_PROGRESS_BAR) !== 'false',
  // 'system' | 'dark' | 'light'. A ausência da chave conta como 'system':
  // quem nunca escolheu segue o sistema operacional, e não é punido por isso.
  theme: ['system', 'dark', 'light'].includes(localStorage.getItem(STORAGE_KEYS.THEME))
    ? localStorage.getItem(STORAGE_KEYS.THEME)
    : 'system',
};

export function persistNavState() {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, state.currentTab);
    if (state.currentListId) localStorage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, state.currentListId);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_LIST_ID);
  } catch {}
}

export function setActiveTab(tab, listId = null) {
  state.currentTab = tab;
  state.currentListId = listId;
  persistNavState();
}

