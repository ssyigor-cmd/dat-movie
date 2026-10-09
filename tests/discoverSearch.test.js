import { describe, it, expect, vi } from 'vitest';
import {
  buildDiscoverParams,
  hasActiveFilters,
  emptySearchFilters,
  filterResultsByQuery,
  filterExcludedCountries,
  dedupeById,
  SEARCH_PAGE_SIZE,
  SEARCH_SORT_OPTIONS,
  AGE_RATING_COUNTRY
} from '../src/lib/discoverSearch.js';

describe('emptySearchFilters', () => {
  it('nasce sem nenhum recorte aplicado', () => {
    const f = emptySearchFilters();
    expect(f.genres).toEqual([]);
    expect(f.excludeGenres).toEqual([]);
    expect(f.countries).toEqual([]);
    expect(f.excludeCountries).toEqual([]);
    expect(f.certification).toBe('');
    expect(f.yearFrom).toBe('');
    expect(f.sort).toBe('');
  });
});

describe('hasActiveFilters', () => {
  it('filtro vazio não dispara o discover', () => {
    expect(hasActiveFilters(emptySearchFilters())).toBe(false);
  });

  it('mudar só a ordenação não conta como filtro', () => {
    expect(hasActiveFilters({ ...emptySearchFilters(), sort: 'name.asc' })).toBe(false);
  });

  it('cada recorte liga o discover', () => {
    expect(hasActiveFilters({ ...emptySearchFilters(), genres: [18] })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), excludeGenres: [80] })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), countries: ['BR'] })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), excludeCountries: ['US'] })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), certification: 'TV-14' })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), runtime: 'short' })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), yearFrom: '2010' })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), yearTo: '2020' })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), language: 'ja' })).toBe(true);
    // '0' é uma situação válida (Em exibição); não pode ser confundido com vazio.
    expect(hasActiveFilters({ ...emptySearchFilters(), status: '0' })).toBe(true);
    expect(hasActiveFilters({ ...emptySearchFilters(), type: '2' })).toBe(true);
  });
});

describe('buildDiscoverParams', () => {
  it('sem filtros só define a ordenação', () => {
    expect(buildDiscoverParams(emptySearchFilters())).toEqual({ sort_by: 'popularity.desc' });
  });

  it('gêneros são E (vírgula) e países são OU (pipe)', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), genres: [80, 16], countries: ['US', 'GB'] });
    expect(p.with_genres).toBe('80,16');
    expect(p.with_origin_country).toBe('US|GB');
  });

  it('gêneros negados viram without_genres (OU)', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), excludeGenres: [80, 16] });
    expect(p.without_genres).toBe('80|16');
  });

  it('país negado não vira parâmetro (o TMDB não tem without_origin_country)', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), countries: ['BR'], excludeCountries: ['US'] });
    expect(p.with_origin_country).toBe('BR');
    expect(p.without_origin_country).toBeUndefined();
  });

  it('classificação de idade fixa o país em US', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), certification: 'TV-14' });
    expect(p.certification).toBe('TV-14');
    expect(p.certification_country).toBe(AGE_RATING_COUNTRY);
  });

  it('duração de episódio vira with_runtime.gte/lte', () => {
    expect(buildDiscoverParams({ ...emptySearchFilters(), runtime: 'short' })).toMatchObject({ 'with_runtime.lte': 30 });
    expect(buildDiscoverParams({ ...emptySearchFilters(), runtime: 'short' })['with_runtime.gte']).toBeUndefined();
    expect(buildDiscoverParams({ ...emptySearchFilters(), runtime: 'standard' })).toMatchObject({ 'with_runtime.gte': 30, 'with_runtime.lte': 60 });
    expect(buildDiscoverParams({ ...emptySearchFilters(), runtime: 'long' })).toMatchObject({ 'with_runtime.gte': 60 });
    expect(buildDiscoverParams({ ...emptySearchFilters(), runtime: 'long' })['with_runtime.lte']).toBeUndefined();
  });

  it('ano exato usa first_air_date_year, faixa usa .gte/.lte', () => {
    expect(buildDiscoverParams({ ...emptySearchFilters(), yearFrom: '2020', yearTo: '2020' })).toMatchObject({ first_air_date_year: '2020' });
    const faixa = buildDiscoverParams({ ...emptySearchFilters(), yearFrom: '2010', yearTo: '2020' });
    expect(faixa['first_air_date.gte']).toBe('2010-01-01');
    expect(faixa['first_air_date.lte']).toBe('2020-12-31');
    expect(faixa.first_air_date_year).toBeUndefined();
    const soFrom = buildDiscoverParams({ ...emptySearchFilters(), yearFrom: '2010' });
    expect(soFrom['first_air_date.gte']).toBe('2010-01-01');
    expect(soFrom['first_air_date.lte']).toBeUndefined();
  });

  it('ignora ano que não tem 4 dígitos', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), yearFrom: '20a0', yearTo: '202' });
    expect(p.first_air_date_year).toBeUndefined();
    expect(p['first_air_date.gte']).toBeUndefined();
    expect(p['first_air_date.lte']).toBeUndefined();
  });

  it('status, formato e idioma entram como string', () => {
    const p = buildDiscoverParams({ ...emptySearchFilters(), status: '0', type: '2', language: 'ja' });
    expect(p.with_status).toBe('0');
    expect(p.with_type).toBe('2');
    expect(p.with_original_language).toBe('ja');
  });

  it('nunca emite parâmetro de nota', () => {
    const filtros = {
      ...emptySearchFilters(),
      genres: [18],
      countries: ['US'],
      certification: 'TV-MA',
      runtime: 'short',
      yearFrom: '2000',
      yearTo: '2024',
      status: '3',
      type: '4',
      language: 'en',
      sort: 'first_air_date.desc'
    };
    const chaves = Object.keys(buildDiscoverParams(filtros));
    expect(chaves.some((k) => /vote_/i.test(k))).toBe(false);
  });

  it('ordenação inválida (ou neutra) cai para popularidade', () => {
    expect(buildDiscoverParams({ ...emptySearchFilters(), sort: 'vote_average.desc' }).sort_by).toBe('popularity.desc');
    expect(buildDiscoverParams({ ...emptySearchFilters(), sort: '' }).sort_by).toBe('popularity.desc');
    expect(buildDiscoverParams({ ...emptySearchFilters(), sort: 'name.asc' }).sort_by).toBe('name.asc');
    expect(buildDiscoverParams({ ...emptySearchFilters(), sort: 'name.desc' }).sort_by).toBe('name.desc');
    expect(buildDiscoverParams({ ...emptySearchFilters(), sort: 'popularity.asc' }).sort_by).toBe('popularity.asc');
  });
});

describe('SEARCH_PAGE_SIZE e dedupeById', () => {
  it('cada carregamento traz 40 itens (duas páginas do TMDB)', () => {
    expect(SEARCH_PAGE_SIZE).toBe(40);
  });

  it('remove repetidos por id preservando a ordem', () => {
    const out = dedupeById([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 1, name: 'A de novo' },
      { id: 3, name: 'C' },
      { id: 2, name: 'B de novo' }
    ]);
    expect(out.map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe('SEARCH_SORT_OPTIONS', () => {
  it('oferece as duas direções de popularidade e de nome', () => {
    const valores = SEARCH_SORT_OPTIONS.map((o) => o.value);
    expect(valores).toContain('popularity.desc');
    expect(valores).toContain('popularity.asc');
    expect(valores).toContain('name.asc');
    expect(valores).toContain('name.desc');
  });

  it('nenhuma opção ordena por nota', () => {
    expect(SEARCH_SORT_OPTIONS.some((o) => /vote_/.test(o.value))).toBe(false);
  });
});

describe('filterExcludedCountries', () => {
  const lista = [
    { id: 1, name: 'BR Show', origin_country: ['BR'] },
    { id: 2, name: 'US Show', origin_country: ['US'] },
    { id: 3, name: 'Coprodução', origin_country: ['US', 'GB'] },
    { id: 4, name: 'Sem origem', origin_country: [] }
  ];

  it('remove títulos do país negado, inclusive coproduções', () => {
    const out = filterExcludedCountries(lista, ['US']);
    expect(out.map((i) => i.id)).toEqual([1, 4]);
  });

  it('sem país negado devolve tudo', () => {
    expect(filterExcludedCountries(lista, [])).toHaveLength(4);
  });
});

describe('filterResultsByQuery', () => {
  const resultados = [
    { id: 1, name: 'Dragon Ball' },
    { id: 2, name: 'Outra Coisa' },
    { id: 3, name: 'Dragoon' }
  ];

  it('mantém só o que casa com o texto, com o melhor primeiro', () => {
    const out = filterResultsByQuery(resultados, 'dragon ball');
    expect(out[0].name).toBe('Dragon Ball');
    expect(out.some((r) => r.name === 'Outra Coisa')).toBe(false);
  });

  it('texto curto demais não filtra nada fora', () => {
    expect(filterResultsByQuery(resultados, 'd')).toHaveLength(3);
  });

  it('tolerância a digitação acha o título certo', () => {
    const out = filterResultsByQuery(resultados, 'dargon ball');
    expect(out[0].name).toBe('Dragon Ball');
  });
});

// Bate na API de verdade? Não: o `callTMDB` é substituído por um fake.
async function withMock(callTMDB, fn) {
  vi.resetModules();
  vi.doMock('../src/lib/api.js', () => ({ callTMDB }));
  const mod = await import('../src/lib/discoverSearch.js');
  try { return await fn(mod); } finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
}

describe('searchTitles', () => {
  it('sem texto e sem filtro fica ocioso e não chama a API', async () => {
    await withMock(() => { throw new Error('não deveria chamar'); }, async (mod) => {
      const out = await mod.searchTitles({ query: '', filters: mod.emptySearchFilters() });
      expect(out.mode).toBe('idle');
      expect(out.items).toEqual([]);
    });
  });

  it('sem filtro e com texto usa search/tv', async () => {
    let endpoint = null;
    let firstParams = null;
    const fake = async (ep, p) => {
      endpoint = ep;
      if (!firstParams) firstParams = p;
      return { page: p.page, total_pages: 3, total_results: 42, results: [{ id: 1, name: 'Dragon Ball', poster_path: '/a.jpg' }] };
    };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: 'dragon', filters: mod.emptySearchFilters(), page: 1 }));
    expect(endpoint).toBe('search/tv');
    expect(firstParams.query).toBe('dragon');
    expect(firstParams.page).toBe(1);
    expect(out.mode).toBe('search');
    expect(out.items[0].title).toBe('Dragon Ball');
    expect(out.totalResults).toBe(42);
  });

  it('com filtro ativo usa discover/tv e junta duas páginas do TMDB', async () => {
    const pages = [];
    let endpoint = null;
    let firstParams = null;
    const fake = async (ep, p) => {
      endpoint = ep;
      pages.push(p.page);
      if (!firstParams) firstParams = p;
      return { page: p.page, total_pages: 5, total_results: 100, results: [] };
    };
    const filters = { ...emptyFilters(), genres: [18, 35], countries: ['BR'], runtime: 'short' };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: '', filters, page: 2 }));
    expect(endpoint).toBe('discover/tv');
    expect(pages.sort((a, b) => a - b)).toEqual([3, 4]);
    expect(firstParams.with_genres).toBe('18,35');
    expect(firstParams.with_origin_country).toBe('BR');
    expect(firstParams['with_runtime.lte']).toBe(30);
    expect(Object.keys(firstParams).some((k) => /vote_/i.test(k))).toBe(false);
    expect(out.mode).toBe('discover');
    expect(out.totalPages).toBe(3); // ceil(5 / 2)
  });

  it('junta as duas páginas e remove títulos repetidos entre elas', async () => {
    const fake = async (ep, p) => {
      if (p.page === 1) {
        return { page: 1, total_pages: 4, total_results: 80, results: [
          { id: 1, name: 'A', poster_path: '/a.jpg' },
          { id: 2, name: 'B', poster_path: '/b.jpg' }
        ] };
      }
      return { page: 2, total_pages: 4, total_results: 80, results: [
        { id: 2, name: 'B', poster_path: '/b.jpg' },
        { id: 3, name: 'C', poster_path: '/c.jpg' }
      ] };
    };
    const filters = { ...emptyFilters(), genres: [18] };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: '', filters, page: 1 }));
    expect(out.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(out.totalPages).toBe(2); // ceil(4 / 2)
  });

  it('no discover remove localmente os títulos do país negado', async () => {
    const fake = async (ep, p) => ({
      page: p.page, total_pages: 1, total_results: 2, results: [
        { id: 1, name: 'US Show', origin_country: ['US'], poster_path: '/a.jpg' },
        { id: 2, name: 'BR Show', origin_country: ['BR'], poster_path: '/b.jpg' }
      ]
    });
    const filters = { ...emptyFilters(), excludeCountries: ['US'] };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: '', filters, page: 1 }));
    expect(out.mode).toBe('discover');
    expect(out.items.map((i) => i.id)).toEqual([2]);
  });

  it('sem texto e sem filtro, mas com ordenação escolhida, lista o catálogo', async () => {
    let endpoint = null;
    let params = null;
    const fake = async (ep, p) => {
      endpoint = ep; params = p;
      return { page: p.page, total_pages: 2, total_results: 20, results: [{ id: 1, name: 'A', poster_path: '/a.jpg' }] };
    };
    const filters = { ...emptyFilters(), sort: 'name.asc' };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: '', filters, page: 1 }));
    expect(endpoint).toBe('discover/tv');
    expect(params.sort_by).toBe('name.asc');
    expect(out.mode).toBe('discover');
  });

  it('com texto digitado, a ordenação é ignorada e vale a relevância', async () => {
    let endpoint = null;
    const fake = async (ep) => { endpoint = ep; return { results: [] }; };
    const filters = { ...emptyFilters(), sort: 'name.desc' };
    await withMock(fake, (mod) => mod.searchTitles({ query: 'dragon', filters, page: 1 }));
    expect(endpoint).toBe('search/tv');
  });

  it('no modo discover o texto vira filtro local', async () => {
    const fake = async () => ({
      page: 1, total_pages: 1, total_results: 2,
      results: [
        { id: 1, name: 'Dragon Ball', poster_path: '/a.jpg' },
        { id: 2, name: 'Novela Qualquer', poster_path: '/b.jpg' }
      ]
    });
    const filters = { ...emptyFilters(), genres: [16] };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: 'dragon', filters, page: 1 }));
    expect(out.mode).toBe('discover');
    expect(out.items.map((i) => i.title)).toEqual(['Dragon Ball']);
  });

  it('remove produções bloqueadas (YouTube/vlog)', async () => {
    const fake = async () => ({
      page: 1, total_pages: 1, total_results: 2,
      results: [
        { id: 1, name: 'Full Movie Completo', poster_path: '/a.jpg' },
        { id: 2, name: 'Série de Verdade', poster_path: '/b.jpg' }
      ]
    });
    const filters = { ...emptyFilters(), genres: [18] };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: '', filters, page: 1 }));
    expect(out.items.map((i) => i.title)).toEqual(['Série de Verdade']);
  });

  it('tenta grafias alternativas quando a busca volta vazia', async () => {
    const chamadas = [];
    const fake = async (ep, p) => {
      chamadas.push(p.query);
      // A grafia com acento não acha nada; a normalizada (fallback) acha.
      if (p.query === 'dragão ball') return { results: [] };
      return { results: [{ id: 1, name: 'Dragon Ball', poster_path: '/a.jpg' }] };
    };
    const out = await withMock(fake, (mod) => mod.searchTitles({ query: 'dragão ball', filters: mod.emptySearchFilters(), page: 1 }));
    expect(chamadas.length).toBeGreaterThan(1);
    expect(out.items[0].title).toBe('Dragon Ball');
  });

  it('propaga erro da API para a tela tratar', async () => {
    const fake = async () => { throw new Error('sem rede'); };
    await withMock(fake, async (mod) => {
      await expect(mod.searchTitles({ query: 'dragon', filters: mod.emptySearchFilters(), page: 1 })).rejects.toThrow('sem rede');
    });
  });
});

/** Filtros com a mesma forma de `emptySearchFilters`, sem importar o módulo mockado. */
function emptyFilters() {
  return {
    genres: [], excludeGenres: [], certification: '', runtime: '', yearFrom: '', yearTo: '',
    countries: [], excludeCountries: [], status: '', type: '', language: '', sort: ''
  };
}
