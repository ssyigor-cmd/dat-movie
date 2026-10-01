/**
 * As faixas "Se você gostou de X vai gostar disso".
 *
 * A seção nasceu de uma faixa única e virou quatro, uma por título âncora do
 * catálogo. O que estes testes seguram é a parte que quebra em silêncio: duas
 * faixas com a mesma âncora, ou duas faixas mostrando os mesmos pôsteres,
 * parecem uma seção só repetida — e é exatamente o defeito que a troca de
 * "Títulos para você" por estas faixas deveria resolver, não recriar.
 */
import { describe, it, expect, vi } from 'vitest';
import { cacheClear } from '../src/lib/cache.js';

const MOD = '../src/lib/trendingApi.js';

/** Recarrega o módulo com o `callTMDB` trocado. */
async function withMock(callTMDB, fn) {
  vi.resetModules();
  cacheClear();
  vi.doMock('../src/lib/api.js', () => ({ callTMDB }));
  try {
    const mod = await import(MOD);
    return await fn(mod);
  } finally {
    vi.doUnmock('../src/lib/api.js');
    vi.resetModules();
    cacheClear();
  }
}

/** Item do catálogo. `tmdb_id` é o que a faixa usa de âncora. */
function item(over = {}) {
  return {
    id: over.id || 1,
    nome: 'Título',
    tmdb_id: 100,
    status: 'assistindo',
    tier: 'S',
    dataAtualizacao: new Date().toISOString(),
    ...over
  };
}

/** Título cru do TMDb, como `recommendations` devolve. */
function raw(over = {}) {
  return {
    id: 900,
    name: 'Candidato',
    poster_path: '/p.jpg',
    first_air_date: '2019-01-01',
    original_language: 'en',
    overview: '',
    vote_average: 8,
    popularity: 10,
    ...over
  };
}

/**
 * Base que responde com o mesmo conjunto para todas as âncoras.
 * É o pior caso: sem o filtro entre faixas, as quatro viram cópias.
 */
function todasIguais() {
  return async () => ({
    results: [raw(), raw({ id: 901, name: 'Outro' }), raw({ id: 902, name: 'Mais um' })]
  });
}

describe('getAffinityRails', () => {
  it('devolve uma faixa por título âncora, com base distinta em cada uma', async () => {
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' }),
      item({ id: 3, tmdb_id: 300, nome: 'C' }),
      item({ id: 4, tmdb_id: 400, nome: 'D' })
    ];
    // Cada âncora responde com um candidato só, para o filtro de repetição não
    // criar coincidência entre faixas diferentes.
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      return { results: [raw({ id: Number(id) + 1000, name: `Cand ${id}` })] };
    };
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 4 }));
    expect(faixas).toHaveLength(4);
    expect(faixas.map((f) => f.base.nome)).toEqual(['A', 'B', 'C', 'D']);
    // E as âncoras não se repetem, que é a garantia que o título pede.
    expect(new Set(faixas.map((f) => String(f.base.tmdb_id))).size).toBe(4);
  });

  it('nada aparece em duas faixas, mesmo quando o TMDb devolve o mesmo conjunto', async () => {
    // O TMDb devolve interseção pesada entre recomendações de séries parecidas.
    // Sem o `seen` compartilhado, as quatro faixas mostravam os mesmos
    // pôsteres em ordens diferentes — a forma *discreta* de a seção parecer
    // repetitiva.
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' }),
      item({ id: 3, tmdb_id: 300, nome: 'C' }),
      item({ id: 4, tmdb_id: 400, nome: 'D' })
    ];
    const faixas = await withMock(todasIguais(), (mod) => mod.getAffinityRails(catalogo, { count: 4 }));
    const vistos = faixas.flatMap((f) => f.pool.map((t) => String(t.id)));
    expect(vistos.length).toBeGreaterThan(0);
    expect(new Set(vistos).size, 'títulos repetidos entre faixas').toBe(vistos.length);
  });

  it('descarta a base que não devolve nada e usa a seguinte', async () => {
    // Base 100 volta vazia; a faixa tem de aparecer mesmo assim, ancorada na
    // 200. Uma faixa oca no meio da pilha é pior do que uma faixa a menos.
    const fake = async (endpoint) => {
      if (endpoint.startsWith('tv/100/')) return { results: [] };
      if (endpoint.startsWith('tv/200/')) return { results: [raw({ id: 1201, name: 'Só a B' })] };
      return { results: [] };
    };
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' })
    ];
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 4 }));
    expect(faixas).toHaveLength(1);
    expect(faixas[0].base.nome).toBe('B');
  });

  it('cai para `similar` quando `recommendations` falha', async () => {
    const fake = async (endpoint) => {
      if (endpoint.startsWith('tv/100/recommendations')) throw new Error('tmdb fora');
      if (endpoint.startsWith('tv/100/similar')) return { results: [raw({ id: 1400, name: 'Do similar' })] };
      return { results: [] };
    };
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails([item()], { count: 1 }));
    expect(faixas).toHaveLength(1);
    expect(faixas[0].pool[0].title).toBe('Do similar');
  });

  it('nunca sugere um título que já está no catálogo', async () => {
    // `filterNotInCatalog` roda antes do `seen`: sem isso, a faixa ofereceria
    // como novidade o título que o usuário acabou de adicionar.
    const fake = async () => ({
      results: [raw({ id: 100, name: 'O mesmo do catálogo' }), raw({ id: 1500, name: 'Novo' })]
    });
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails([item({ tmdb_id: 100 })], { count: 1 }));
    expect(faixas).toHaveLength(1);
    expect(faixas[0].pool.map((t) => t.id)).toEqual([1500]);
  });

  it('devolve menos faixas em vez de faixa vazia quando o material acaba', async () => {
    // Catálogo curto e um único candidato por âncora: no segundo round as bases
    // se repetem e não sobra título novo. O certo é devolver menos, não
    // inventar faixa.
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      if (id === '100') return { results: [raw({ id: 1100, name: 'C1' })] };
      return { results: [raw({ id: 1100, name: 'C1' })] };
    };
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' }),
      item({ id: 3, tmdb_id: 300, nome: 'C' }),
      item({ id: 4, tmdb_id: 400, nome: 'D' })
    ];
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 4 }));
    expect(faixas.length).toBeLessThan(4);
    expect(faixas.length).toBeGreaterThan(0);
  });

  it('o botão de atualizar troca as âncoras, sem repetir a faixa visível', async () => {
    // `offset` é o que rotaciona: sem ele, atualizar reordenaria o mesmo
    // conjunto e o clique não pareceria fazer nada.
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      return { results: [raw({ id: Number(id) + 1000, name: `Cand ${id}` })] };
    };
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' }),
      item({ id: 3, tmdb_id: 300, nome: 'C' })
    ];
    const primeiro = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 3 }));
    const segundo = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 3, offset: 1 }));
    expect(primeiro.map((f) => f.base.nome)).toEqual(['A', 'B', 'C']);
    expect(segundo.map((f) => f.base.nome)).toEqual(['B', 'C', 'A']);
  });

  it('o offset dá a volta na lista de âncoras em vez de estourar', async () => {
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      return { results: [raw({ id: Number(id) + 1000, name: `Cand ${id}` })] };
    };
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' })
    ];
    // Depois de duas voltas o offset é 4 com 2 bases: sem o módulo, a faixa
    // seguinte viria vazia e a home perderia a seção depois de três cliques.
    const faixas = await withMock(fake, (mod) => mod.getAffinityRails(catalogo, { count: 2, offset: 4 }));
    expect(faixas.map((f) => f.base.nome)).toEqual(['A', 'B']);
  });

  it('não chama a API sem âncora possível', async () => {
    const fake = async () => { throw new Error('não deveria chamar a API'); };
    const vazio = await withMock(fake, (mod) => mod.getAffinityRails([], { count: 4 }));
    expect(vazio).toEqual([]);
    const semTmdb = await withMock(fake, (mod) => mod.getAffinityRails([item({ tmdb_id: null })], { count: 4 }));
    expect(semTmdb).toEqual([]);
  });
});

describe('getAffinityRail', () => {
  it('devolve uma faixa só, e é ela que a home usa no botão de atualizar', async () => {
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' })
    ];
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      return { results: [raw({ id: Number(id) + 1000, name: `Cand ${id}` })] };
    };
    const faixa = await withMock(fake, (mod) => mod.getAffinityRail(catalogo, { offset: 0 }));
    expect(Array.isArray(faixa)).toBe(false);
    expect(faixa.base.nome).toBe('A');
  });

  it('pula a base que uma faixa vizinha já está usando', async () => {
    // É o que separa "atualizar uma faixa" de "as quatro oferecerem o mesmo
    // título com nomes diferentes". A faixa vizinha ocupa a base 100; esta tem
    // de cair na 200, e não voltar para a 100 com outro título no cabeçalho.
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' })
    ];
    const fake = async (endpoint) => {
      const id = /tv\/(\d+)\//.exec(endpoint)?.[1];
      return { results: [raw({ id: Number(id) + 1000, name: `Cand ${id}` })] };
    };
    const faixa = await withMock(fake, (mod) => mod.getAffinityRail(catalogo, {
      offset: 0,
      excludeBaseIds: new Set(['100'])
    }));
    expect(faixa.base.nome).toBe('B');
  });

  it('pula os títulos que uma faixa vizinha já está exibindo', async () => {
    const fake = async () => ({ results: [raw({ id: 1100 }), raw({ id: 1101, name: 'Novo' })] });
    const faixa = await withMock(fake, (mod) => mod.getAffinityRail([item()], {
      excludeTitles: new Set(['1100'])
    }));
    expect(faixa.pool.map((t) => t.id)).toEqual([1101]);
  });

  it('devolve null quando não sobra base livre', async () => {
    const fake = async () => ({ results: [raw({ id: 1100 })] });
    const catalogo = [
      item({ id: 1, tmdb_id: 100, nome: 'A' }),
      item({ id: 2, tmdb_id: 200, nome: 'B' })
    ];
    // Todas as bases ocupadas e todos os títulos vistos: a faixa se apaga em
    // vez de roubar material da vizinha.
    const faixa = await withMock(fake, (mod) => mod.getAffinityRail(catalogo, {
      excludeBaseIds: new Set(['100', '200']),
      excludeTitles: new Set(['1100'])
    }));
    expect(faixa).toBeNull();
  });
});

describe('AFFINITY_RAIL_COUNT', () => {
  it('é o que a home renderiza, e o container tem um esqueleto para cada', async () => {
    // Se o número mudar no módulo e o HTML gerar outro tanto, o esqueleto fica
    // sem par e a faixa aparece com a altura do nada.
    const mod = await withMock(todasIguais(), (m) => m);
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
    const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    expect(js).toContain('{ length: AFFINITY_RAIL_COUNT }');
    expect(mod.AFFINITY_RAIL_COUNT).toBe(4);
  });
});
