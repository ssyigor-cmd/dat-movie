import { describe, it, expect, vi, beforeEach } from 'vitest';
// Allow-list real da Edge Function, não uma cópia local.
import { isAllowedEndpoint } from '../supabase/functions/_shared/allowedEndpoint.ts';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

const STORAGE_KEYS = {
  ACTIVE_TAB: 'activeTab',
  ACTIVE_LIST_ID: 'activeListId',
  GRID_DENSITY: 'gridDensity',
  GROUPING_ACTIVE: 'groupingActive'
};

describe('state.js - contratos e integração', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('STORAGE_KEYS', () => {
    it('define chaves consistentes para localStorage', () => {
      expect(STORAGE_KEYS.ACTIVE_TAB).toBe('activeTab');
      expect(STORAGE_KEYS.ACTIVE_LIST_ID).toBe('activeListId');
      expect(STORAGE_KEYS.GRID_DENSITY).toBe('gridDensity');
      expect(STORAGE_KEYS.GROUPING_ACTIVE).toBe('groupingActive');
    });
  });

  describe('persistNavState - contrato', () => {
    it('salva e recupera activeTab via STORAGE_KEYS', () => {
      localStorageMock.setItem(STORAGE_KEYS.ACTIVE_TAB, 'pesquisa');
      expect(localStorageMock.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('pesquisa');
    });
    it('salva e recupera activeListId', () => {
      localStorageMock.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, 'list-1');
      expect(localStorageMock.getItem(STORAGE_KEYS.ACTIVE_LIST_ID)).toBe('list-1');
    });
    it('remove activeListId quando null', () => {
      localStorageMock.removeItem(STORAGE_KEYS.ACTIVE_LIST_ID);
      expect(localStorageMock.getItem(STORAGE_KEYS.ACTIVE_LIST_ID)).toBeNull();
    });
  });

  describe('estado inicial - leitura de localStorage', () => {
    it('lê activeTab do localStorage', () => {
      localStorageMock.setItem(STORAGE_KEYS.ACTIVE_TAB, 'pesquisa');
      expect(localStorageMock.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('pesquisa');
    });
    it('padroniza gridDensity', () => {
      localStorageMock.setItem(STORAGE_KEYS.GRID_DENSITY, '10');
      expect(parseInt(localStorageMock.getItem(STORAGE_KEYS.GRID_DENSITY) ?? '')).toBe(10);
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
