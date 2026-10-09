import { describe, it, expect, vi } from 'vitest';
import { isWithin7DaysWindow, getFavorites, getCatalogStats, rankRecommendationBases, rotateList, shuffleList, pickVariety, clearTrendingCache } from '../src/lib/trendingApi.js';
import { cacheSet, cacheGet, cacheClear } from '../src/lib/cache.js';

describe('clearTrendingCache', () => {
  it('remove apenas as chaves trending_ e preserva logos e detalhes', () => {
    cacheClear();
    cacheSet('trending_search/tv|{}|pt-BR', { results: [] });
    cacheSet('trending_discover/tv|{"page":1}|pt-BR', { results: [] });
    cacheSet('tvcache_123', { id: 123, name: 'Detalhe' });
    cacheSet('logoV2_123_tv', 'https://exemplo/logo.png');

    clearTrendingCache();

    expect(cacheGet('trending_search/tv|{}|pt-BR')).toBeUndefined();
    expect(cacheGet('trending_discover/tv|{"page":1}|pt-BR')).toBeUndefined();
    // Estes dois são caros de refazer e não têm relação com tendências.
    expect(cacheGet('tvcache_123')).toEqual({ id: 123, name: 'Detalhe' });
    expect(cacheGet('logoV2_123_tv')).toBe('https://exemplo/logo.png');

    cacheClear();
  });

  it('não estoura quando não há entradas de tendência', () => {
    cacheClear();
    cacheSet('tvcache_999', { id: 999 });
    expect(() => clearTrendingCache()).not.toThrow();
    expect(cacheGet('tvcache_999')).toEqual({ id: 999 });
    cacheClear();
  });
});

describe('isWithin7DaysWindow', () => {
  const now = new Date('2026-09-24T10:00:00');
  it('detecta passado dentro de 7 dias', () => {
    expect(isWithin7DaysWindow('2026-09-20', 7, now)).toBe(true);
    expect(isWithin7DaysWindow('2026-09-18', 7, now)).toBe(true);
  });
  it('detecta passado fora de 7 dias', () => {
    expect(isWithin7DaysWindow('2026-09-10', 7, now)).toBe(false);
  });
  it('detecta futuro dentro de 7 dias (next_episode)', () => {
    expect(isWithin7DaysWindow('2026-09-27', 7, now)).toBe(true);
    expect(isWithin7DaysWindow('2026-10-01', 7, now)).toBe(true);
  });
  it('futuro além de 7 dias não é novidade', () => {
    expect(isWithin7DaysWindow('2026-10-10', 7, now)).toBe(false);
  });
  it('fuso do usuário: meio-dia evita erro de dia', () => {
    // 2026-09-17 12:00 vs now 2026-09-24 12:00 = exatamente 7 dias
    expect(isWithin7DaysWindow('2026-09-17', 7, now)).toBe(true);
    expect(isWithin7DaysWindow('2026-09-16', 7, now)).toBe(false);
  });
});

describe('getFavorites ordenação', () => {
  it('S+ antes de S e por dataAtualizacao desc', () => {
    const items = [
      { tier: 'S', nome: 'B', dataAtualizacao: '2026-09-20T00:00:00Z' },
      { tier: 'S+', nome: 'A', dataAtualizacao: '2026-09-10T00:00:00Z' },
      { tier: 'S', nome: 'C', dataAtualizacao: '2026-09-25T00:00:00Z' },
      { tier: 'S+', nome: 'D', dataAtualizacao: '2026-09-25T00:00:00Z' },
      { tier: 'A', nome: 'E' }
    ];
    const res = getFavorites(items, 10);
    expect(res.map(r => r.nome)).toEqual(['D', 'A', 'C', 'B']);
  });
});

describe('getCatalogStats único passe', () => {
  it('calcula todas as métricas em único passe e totalEpisodiosAssistidos', () => {
    const items = [
      { status: 'assistindo', episodio: 5 },
      { status: 'concluido', episodio: 12 },
      { status: 'planejado', episodio: 0 },
      { status: 'assistindo', episodio: 3 },
      { status: 'pausado', episodio: 8 }
    ];
    const s = getCatalogStats(items);
    expect(s.total).toBe(5);
    expect(s.assistindo).toBe(2);
    expect(s.concluidos).toBe(1);
    expect(s.planejados).toBe(1);
    expect(s.totalEpisodiosAssistidos).toBe(28);
    expect(s.horasAssistidas).toBe(11);
    expect(s.taxaConclusao).toBe(20);
    expect(typeof s.progressoMedio).toBe('number');
  });
  it('retorna zeros para lista vazia', () => {
    expect(getCatalogStats([])).toEqual({ total: 0, assistindo: 0, concluidos: 0, planejados: 0, totalEpisodiosAssistidos: 0, horasAssistidas: 0, progressoMedio: 0, taxaConclusao: 0 });
  });
});

describe('rankRecommendationBases', () => {
  it('ordena por progresso + tier + recência, sem repetir', () => {
    // A fórmula soma as três notas, então o progresso pode virar por cima do
    // tier: A assistiu 3 de 12 (25%) e ainda é tier A, o que vale mais que os
    // 4% de C (tier S+) e de B (tier S). O tier desempata C à frente de B,
    // porque as duas têm o mesmo progresso e a mesma recência.
    const items = [
      { nome: 'A', status: 'assistindo', tmdb_id: 1, tier: 'A', episodio: 3, seasonEpisodesMap: { 1: 12 } },
      { nome: 'B', status: 'assistindo', tmdb_id: 2, tier: 'S', episodio: 1, seasonEpisodesMap: { 1: 24 } },
      { nome: 'C', status: 'assistindo', tmdb_id: 3, tier: 'S+', episodio: 1, seasonEpisodesMap: { 1: 24 } }
    ];
    expect(rankRecommendationBases(items).map(r => r.nome)).toEqual(['A', 'C', 'B']);
  });

  it('sem assistindo, usa tiers S+/S e depois o resto', () => {
    const items = [
      { nome: 'X', status: 'planejado', tmdb_id: 10, tier: 'C' },
      { nome: 'Y', status: 'planejado', tmdb_id: 11, tier: 'S' },
      { nome: 'Z', status: 'planejado', tier: 'A' }
    ];
    expect(rankRecommendationBases(items).map(r => r.nome)).toEqual(['Y', 'X']);
  });

  it('quem está assistindo ancora primeiro, e o resto do catálogo vem atrás', () => {
    // Era o outro defeito da lista: só os `assistindo` eram candidatos, então
    // quem tinha um título em andamento girava sempre nas mesmas duas ou três
    // âncoras. O resto entra atrás, ordenado pelo mesmo score.
    const items = [
      { nome: 'Planejado', status: 'planejado', tmdb_id: 3, tier: 'C' },
      { nome: 'Assistindo', status: 'assistindo', tmdb_id: 1, tier: 'A' },
      { nome: 'Concluído', status: 'concluido', tmdb_id: 2, tier: 'S+' },
      { nome: 'Sem id', status: 'planejado', tier: 'S' }
    ];
    expect(rankRecommendationBases(items).map(r => r.nome)).toEqual(['Assistindo', 'Concluído', 'Planejado']);
  });

  it('recência desempata dois itens de mesmo tier e progresso', () => {
    const agora = new Date();
    const velho = new Date(agora.getTime() - 40 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      { nome: 'Velho', status: 'planejado', tmdb_id: 1, tier: 'A', dataAtualizacao: velho },
      { nome: 'Novo', status: 'planejado', tmdb_id: 2, tier: 'A', dataAtualizacao: agora.toISOString() }
    ];
    expect(rankRecommendationBases(items).map(r => r.nome)).toEqual(['Novo', 'Velho']);
  });

  it('ignora titulos sem tmdb_id e entradas invalidas', () => {
    expect(rankRecommendationBases([{ nome: 'Sem id', status: 'assistindo', tier: 'S+' }])).toEqual([]);
    expect(rankRecommendationBases([])).toEqual([]);
    expect(rankRecommendationBases(null)).toEqual([]);
  });
});

describe('rotateList', () => {
  const list = [1, 2, 3, 4, 5];

  it('devolve a lista intacta com offset 0', () => {
    expect(rotateList(list)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rotaciona agrupando o restante no fim', () => {
    expect(rotateList(list, 2)).toEqual([3, 4, 5, 1, 2]);
    expect(rotateList(list, 4)).toEqual([5, 1, 2, 3, 4]);
  });

  it('aceita offset negativo e maior que a lista', () => {
    expect(rotateList(list, -1)).toEqual([5, 1, 2, 3, 4]);
    expect(rotateList(list, 7)).toEqual([3, 4, 5, 1, 2]);
  });

  it('limita a quantidade retornada', () => {
    expect(rotateList(list, 3, 2)).toEqual([4, 5]);
    expect(rotateList(list, 0, 99)).toEqual([1, 2, 3, 4, 5]);
    expect(rotateList(list, 0, 0)).toEqual([]);
  });

  it('não altera a lista original e trata entradas invalidas', () => {
    const original = [...list];
    rotateList(list, 2, 2);
    expect(list).toEqual(original);
    expect(rotateList([])).toEqual([]);
    expect(rotateList(null)).toEqual([]);
  });
});

describe('shuffleList', () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

  it('é determinística para a mesma semente', () => {
    expect(shuffleList(pool, 7)).toEqual(shuffleList(pool, 7));
  });

  it('gera ordens diferentes para sementes diferentes', () => {
    const a = shuffleList(pool, 1).map(t => t.id).join(',');
    const b = shuffleList(pool, 2).map(t => t.id).join(',');
    const c = shuffleList(pool, 3).map(t => t.id).join(',');
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('mantém todos os itens uma única vez e não muta a origem', () => {
    const original = [...pool];
    const out = shuffleList(pool, 42);
    expect(out).toHaveLength(pool.length);
    expect(new Set(out.map(t => t.id)).size).toBe(pool.length);
    expect(pool).toEqual(original);
  });

  it('trata entradas invalidas', () => {
    expect(shuffleList([], 1)).toEqual([]);
    expect(shuffleList(null, 1)).toEqual([]);
  });
});

describe('pickVariety', () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));

  it('prioriza itens ainda não exibidos', () => {
    const seen = new Set(['1', '2', '3', '4']);
    const out = pickVariety(pool, seen, 3, 1);
    expect(out).toHaveLength(3);
    out.forEach(t => expect(seen.has(String(t.id))).toBe(true));
    expect(out.every(t => Number(t.id) > 4)).toBe(true);
  });

  it('não repete enquanto houver material novo', () => {
    const seen = new Set();
    const first = pickVariety(pool, seen, 4, 1).map(t => t.id);
    const second = pickVariety(pool, seen, 4, 2).map(t => t.id);
    expect(new Set([...first, ...second]).size).toBe(8);
  });

  it('limpa os vistos quando o pool se esgera e ainda preenche a quantidade', () => {
    const seen = new Set(pool.map(t => String(t.id)));
    const out = pickVariety(pool, seen, 4, 5);
    expect(out).toHaveLength(4);
    expect(seen.size).toBeLessThanOrEqual(4);
  });

  it('preenche com itens já vistos quando o pool é menor que o pedido', () => {
    const small = [{ id: 1 }, { id: 2 }];
    const seen = new Set();
    expect(pickVariety(small, seen, 5, 1)).toHaveLength(2);
  });

  it('acepta contagem zero, pool vazio e Set ausente', () => {
    expect(pickVariety(pool, new Set(), 0, 1)).toEqual([]);
    expect(pickVariety([], new Set(), 3, 1)).toEqual([]);
    expect(pickVariety(null, new Set(), 3, 1)).toEqual([]);
    expect(pickVariety(pool, null, 2, 1)).toHaveLength(2);
  });
});

describe('getTitlesByGenre - fallback de genero sem dados', () => {
  const tv = (id, name) => ({ id, name, poster_path: '/p.jpg', first_air_date: '2024-01-01', overview: 'ok' });
  const page = results => ({ results, total_pages: 1, page: 1, total_results: results.length });

  async function withMock(callTMDB, fn) {
    vi.resetModules();
    vi.doMock('../src/lib/api.js', () => ({ callTMDB }));
    const mod = await import('../src/lib/trendingApi.js');
    try { return await fn(mod); } finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
  }

  it('refaz a busca so por keyword quando with_genres volta vazio (Terror/27)', async () => {
    const calls = [];
    const result = await withMock(async (endpoint, params) => {
      calls.push({ endpoint, params });
      if (params.with_genres) return page([]);
      return page([tv(1, 'A'), tv(2, 'B')]);
    }, mod => mod.getTitlesByGenre(27, [], 20));

    expect(result.map(t => t.title ?? t.name)).toEqual(['A', 'B']);
    expect(calls[0].params).toMatchObject({ with_genres: '27' });

    const fallback = calls.find(c => c.params.with_keywords);
    expect(fallback).toBeTruthy();
    // Regressao: mandar o genero invalido junto com a keyword envenena a query
    // e o endpoint volta a devolver 0.
    expect(fallback.params.with_genres).toBeUndefined();
    expect(fallback.params.with_keywords).toBe('315058');
  });

  it('nao dispara fallback quando o genero ja devolve itens', async () => {
    const calls = [];
    const result = await withMock(async (endpoint, params) => {
      calls.push(params);
      return page([tv(9, 'Only')]);
    }, mod => mod.getTitlesByGenre(10759, [], 20));

    expect(result).toHaveLength(1);
    expect(calls.some(c => c.with_keywords)).toBe(false);
  });

  it('nao tenta fallback em genero sem palavra-chave mapeada', async () => {
    const calls = [];
    await withMock(async (endpoint, params) => {
      calls.push(params);
      return page([]);
    }, mod => mod.getTitlesByGenre(10765, [], 20));

    expect(calls.every(c => c.with_keywords === undefined)).toBe(true);
  });
});
describe('composeCategoryList', () => {
  it('mantem as 6 categorias fixas mesmo com generos do usuario', async () => {
    const mod = await import('../src/lib/trendingApi.js');
    const user = [
      { id: 10759, name: 'Acao', icon: 'fa-bolt' },
      { id: 16, name: 'Animacao', icon: 'fa-palette' },
      { id: 18, name: 'Drama', icon: 'fa-theater-masks' },
      { id: 10765, name: 'FicSci', icon: 'fa-rocket' }
    ];
    const list = mod.composeCategoryList(user);
    const ids = list.map(c => c.id);
    // Terror(27) e Comedia(35) era o que sumia: os generos do usuario substituíam
    // as fixas e a funcao devolvia no maximo 4.
    for (const fixo of mod.CATEGORIES.map(c => c.id)) {
      expect(ids).toContain(fixo);
    }
    expect(list).toHaveLength(6);
  });

  it('soma generos do usuario que nao estao entre as 6, com teto', async () => {
    const mod = await import('../src/lib/trendingApi.js');
    const extras = [
      { id: 9648, name: 'Misterio', icon: 'fa-search' },
      { id: 80, name: 'Crime', icon: 'fa-user-secret' },
      { id: 99, name: 'Documentario', icon: 'fa-film' },
      { id: 10768, name: 'Guerra', icon: 'fa-fighter-jet' }
    ];
    const list = mod.composeCategoryList(extras);
    const ids = list.map(c => c.id);
    expect(ids).toContain(9648);
    expect(ids).toContain(80);
    // Teto de 2 extras: cada categoria roda ate 15 paginas de busca.
    expect(list).toHaveLength(6 + mod.EXTRA_GENRE_LIMIT);
    expect(ids).not.toContain(99);
    expect(ids).not.toContain(10768);
  });

  it('nao duplica as fixas e tolera entrada invalida', async () => {
    const mod = await import('../src/lib/trendingApi.js');
    expect(mod.composeCategoryList(null)).toHaveLength(6);
    expect(mod.composeCategoryList(undefined)).toHaveLength(6);
    expect(mod.composeCategoryList([null, { id: 27 }])).toHaveLength(6);
    const comRepetido = mod.composeCategoryList([{ id: 27 }, { id: 27 }, { id: 9648 }]);
    expect(comRepetido.filter(c => c.id === 27)).toHaveLength(1);
  });
});

describe('getCalendarWeek', () => {
  const details = (last, next) => ({ genres: [], last_episode_to_air: last, next_episode_to_air: next });
  const ep = (n, d) => ({ season_number: 1, episode_number: n, air_date: d, name: `E${n}`, still_path: '/s.jpg' });
  const hoje = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const daqui = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d); };
  const atras = n => { const d = new Date(hoje); d.setDate(d.getDate() - n); return iso(d); };
  const assistindo = [{ tmdb_id: 1, status: 'assistindo', tipo: 'serie', nome: 'A' }];

  it('usa o que vem quando ha episodio agendado', async () => {
    const week = await (async () => {
      const withMock = async (fn) => {
        vi.resetModules();
        vi.doMock('../src/lib/api.js', () => ({ callTMDB: async () => details(ep(1, atras(2)), ep(2, daqui(3))) }));
        const m = await import('../src/lib/trendingApi.js');
        try { return await fn(m); } finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
      };
      return withMock(m => m.getCalendarWeek(assistindo));
    })();
    expect(week).toHaveLength(1);
    expect(week[0][2]).toBe(true);
    expect(week[0][0]).toBe(daqui(3));
  });

  it('cai para os episodios recentes em vez de esconder a secao', async () => {
    vi.resetModules();
    // So existe last_episode_to_air no passado: e o caso comum de serie com dia
    // fixo, e era exatamente o que o filtro de futuro descartava.
    vi.doMock('../src/lib/api.js', () => ({ callTMDB: async () => details(ep(1, atras(1)), null) }));
    const mod = await import('../src/lib/trendingApi.js');
    let week;
    try { week = await mod.getCalendarWeek(assistindo); }
    finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
    expect(week).toHaveLength(1);
    expect(week[0][2]).toBe(false);
    expect(week[0][0]).toBe(atras(1));
  });

  it('continua vazio quando nao ha titulo assistindo', async () => {
    vi.resetModules();
    vi.doMock('../src/lib/api.js', () => ({ callTMDB: async () => { throw new Error('nao deve chamar'); } }));
    const mod = await import('../src/lib/trendingApi.js');
    let week;
    try { week = await mod.getCalendarWeek([{ tmdb_id: 1, status: 'planejado', tipo: 'serie' }]); }
    finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
    expect(week).toEqual([]);
  });
});

describe('getTitlesByYear', () => {
  // withMock precisa ser local: as outras cópias do helper são escopadas
  // dentro dos respectivos describe e não vazam para cá.
  async function withMock(callTMDB, fn) {
    vi.resetModules();
    vi.doMock('../src/lib/api.js', () => ({ callTMDB }));
    const mod = await import('../src/lib/trendingApi.js');
    try { return await fn(mod); } finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); }
  }

  it('rejeita ano fora de 4 dígitos antes de chamar a API', async () => {
    await withMock(() => { throw new Error('nao deveria chamar'); }, async (mod) => {
      await expect(mod.getTitlesByYear('20a2', [], 5)).rejects.toThrow('Ano inválido');
      await expect(mod.getTitlesByYear('', [], 5)).rejects.toThrow('Ano inválido');
      await expect(mod.getTitlesByYear(null, [], 5)).rejects.toThrow('Ano inválido');
    });
  });

  it('manda o ano para o discover/tv e ordena por popularidade', async () => {
    let capturado = null;
    const fake = async (endpoint, params) => {
      if (endpoint === 'discover/tv') { capturado = params; return { results: [] }; }
      return { results: [] };
    };
    await withMock(fake, async (mod) => { await mod.getTitlesByYear('2020', [], 5); });
    expect(capturado).toBeTruthy();
    expect(capturado.first_air_date_year).toBe('2020');
    expect(capturado.sort_by).toBe('popularity.desc');
  });

  it('normaliza os itens como os demais carrosséis', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'discover/tv') {
        return { results: [
          { id: 1, name: 'Título Um', first_air_date: '2020-03-10', poster_path: '/a.jpg', vote_average: 8 },
          { id: 2, name: 'Título Dois', first_air_date: '2020-09-01', poster_path: '/b.jpg', vote_average: 7 },
        ] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, (mod) => mod.getTitlesByYear('2020', [], 5));
    expect(out.length).toBe(2);
    expect(out[0].title).toBe('Título Um');
    expect(out[0].mediaType).toBe('tv');
    expect(out[0].posterUrl).toContain('/a.jpg');
  });

  it('não repete título que já está no catálogo', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'discover/tv') {
        return { results: [
          { id: 100, name: 'Já Tenho', poster_path: '/a.jpg' },
          { id: 200, name: 'Novinho', poster_path: '/b.jpg' },
        ] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, (mod) => mod.getTitlesByYear('2020', [{ tmdb_id: 100 }], 5));
    expect(out.map(t => t.title)).toEqual(['Novinho']);
  });

  it('respeita o limite pedido', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'discover/tv') {
        return { results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: 'T' + i, poster_path: '/p.jpg' })) };
      }
      return { results: [] };
    };
    const out = await withMock(fake, (mod) => mod.getTitlesByYear('2020', [], 3));
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
