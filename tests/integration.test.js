import { describe, it, expect, vi, beforeEach } from 'vitest';
// Allow-list real da Edge Function, não uma cópia local.
import { isAllowedEndpoint } from '../supabase/functions/_shared/allowedEndpoint.ts';

const store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal('localStorage', localStorageMock);

// Os testes deste arquivo validam o CONTRATO DO MÓDULO REAL (src/lib/state.js).
// A versão anterior mantinha uma cópia local de STORAGE_KEYS — incluindo a
// chave `gridDensity`, que nunca existiu no app — e testava só essa cópia.
// Aqui o estado real é reimportado a cada teste, com localStorage semeado.
async function loadStateModule(seed = {}) {
  localStorageMock.clear();
  Object.assign(store, seed);
  vi.resetModules();
  return import('../src/lib/state.js');
}

describe('state.js - contratos e integração', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('STORAGE_KEYS (módulo real)', () => {
    it('define as chaves usadas pelo app', async () => {
      const { STORAGE_KEYS } = await loadStateModule();
      expect(STORAGE_KEYS.ACTIVE_TAB).toBe('activeTab');
      expect(STORAGE_KEYS.ACTIVE_LIST_ID).toBe('activeListId');
      expect(STORAGE_KEYS.GROUPING_ACTIVE).toBe('groupingActive');
      expect(STORAGE_KEYS.SHOW_PROGRESS_BAR).toBe('showProgressBar');
      expect(STORAGE_KEYS.THEME).toBe('theme');
    });

    it('não carrega a chave fantasma gridDensity', async () => {
      const { STORAGE_KEYS } = await loadStateModule();
      expect('GRID_DENSITY' in STORAGE_KEYS).toBe(false);
    });
  });

  describe('persistNavState (módulo real)', () => {
    it('grava activeTab e activeListId', async () => {
      const { state, persistNavState } = await loadStateModule();
      state.currentTab = 'pesquisa';
      state.currentListId = 'list-1';
      persistNavState();
      expect(localStorageMock.getItem('activeTab')).toBe('pesquisa');
      expect(localStorageMock.getItem('activeListId')).toBe('list-1');
    });

    it('remove activeListId quando null', async () => {
      const { state, persistNavState } = await loadStateModule();
      state.currentTab = 'all';
      state.currentListId = null;
      persistNavState();
      expect(localStorageMock.getItem('activeTab')).toBe('all');
      expect(localStorageMock.getItem('activeListId')).toBeNull();
    });
  });

  describe('estado inicial - leitura de localStorage (módulo real)', () => {
    it('lê activeTab semeado e mantém o que foi persistido', async () => {
      const { state, persistNavState } = await loadStateModule({ activeTab: 'pesquisa' });
      expect(state.currentTab).toBe('pesquisa');
      state.currentTab = 'all';
      state.currentListId = 'list-2';
      persistNavState();
      // Reimporta SEM limpar o store: deve ler o que persistNavState gravou.
      vi.resetModules();
      const fresh = await import('../src/lib/state.js');
      expect(fresh.state.currentTab).toBe('all');
      expect(fresh.state.currentListId).toBe('list-2');
    });

    it('activeTab inválido cai em home', async () => {
      const { state } = await loadStateModule({ activeTab: 'xpto' });
      expect(state.currentTab).toBe('home');
    });

    it('groupingActive só é verdadeiro com a string "true"', async () => {
      expect((await loadStateModule()).state.groupingActive).toBe(false);
      expect((await loadStateModule({ groupingActive: 'true' })).state.groupingActive).toBe(true);
      expect((await loadStateModule({ groupingActive: '1' })).state.groupingActive).toBe(false);
    });

    it('showProgressBar: ausência de escolha conta como mostrar', async () => {
      expect((await loadStateModule()).state.showProgressBar).toBe(true);
      expect((await loadStateModule({ showProgressBar: 'false' })).state.showProgressBar).toBe(false);
      expect((await loadStateModule({ showProgressBar: 'true' })).state.showProgressBar).toBe(true);
    });

    it('theme: sistema é o padrão; valores desconhecidos voltam a ele', async () => {
      expect((await loadStateModule()).state.theme).toBe('system');
      expect((await loadStateModule({ theme: 'dark' })).state.theme).toBe('dark');
      expect((await loadStateModule({ theme: 'claro' })).state.theme).toBe('system');
    });
  });
});

describe('clever-endpoint contrato de entrada', () => {
  it('o body da chamada ao clever-endpoint contém endpoint e params', () => {
    const body = { endpoint: 'search/tv', params: { query: 'teste', language: 'pt-BR' } };
    expect(body).toHaveProperty('endpoint');
    expect(body).toHaveProperty('params');
    expect(body.params.language).toBe('pt-BR');
  });

  it('apenas endpoints TMDb permitidos passam na validação', () => {
    const permitidos = ['search/tv', 'search/multi', 'tv/12345', 'trending/tv/day', 'discover/tv', 'tv/12345/season/1', 'genre/tv/list'];
    permitidos.forEach(ep => {
      expect(isAllowedEndpoint(ep)).toBe(true);
    });
  });

  it('endpoints arbitrários são rejeitados', () => {
    const rejeitados = ['user/1', 'admin/delete', 'movie/123', '', 'https://evil.com', 'search/movie'];
    rejeitados.forEach(ep => {
      expect(isAllowedEndpoint(ep)).toBe(false);
    });
  });
});
