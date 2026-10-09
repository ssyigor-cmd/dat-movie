/**
 * Os botões "Atualizar" da home vão à rede de verdade.
 *
 * Antes do `fresh`, cada clique de atualizar só mexia na semente: o resultado
 * vinha do mesmo cache de 1h, então "atualizar" significava repintar a mesma
 * lista com outra ordem — e num carrossel pequeno, nem sempre isso. A flag
 * `fresh` pula a leitura do cache e regrava a chave, de modo que a próxima
 * visita normal já vê o dado novo em vez de esperar o TTL vencer.
 *
 * Estes testes prendem as duas metades do contrato:
 *
 * 1. O comportamento — cache serve a leitura comum, `fresh` vai à rede, e a
 *    chave regravada faz a leitura seguinte já devolver o dado novo.
 * 2. A fiação — cada seção remota da home passa `fresh: true` no seu botão, e
 *    as duas seções locais (favoritos e abandonados, que não consultam a TMDb)
 *    continuam sem ele. Sem o segundo pino, um loader novo nasce sem a flag e o
 *    botão dele continua fazendo refresh cosmético.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cacheClear } from '../src/lib/cache.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
const api = readFileSync(join(raiz, 'src/lib/trendingApi.js'), 'utf8');

const MOD = '../src/lib/trendingApi.js';

/** Recarrega o módulo com o `callTMDB` trocado e o cache limpo. */
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

/** Título cru do TMDb, como `discover`/`trending` devolvem. */
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

/** Item do catálogo que a TMDb já não deve devolver. */
function item(over = {}) {
  return {
    id: over.id || 1,
    nome: 'Título',
    tmdb_id: 100,
    status: 'assistindo',
    tipo: 'serie',
    tier: 'S',
    dataAtualizacao: new Date().toISOString(),
    ...over
  };
}

describe('fresh: o ciclo do cache', () => {
  it('sem fresh serve do cache; com fresh vai à rede e regrava a chave', async () => {
    let lote = 1;
    const api_ = vi.fn(async () => ({ results: [raw({ id: lote })], total_pages: 1 }));

    await withMock(api_, async (mod) => {
      const primeiro = await mod.getTrendingToSuggest([], 5);
      expect(primeiro[0].id, 'primeira leitura vai à rede').toBe(1);
      expect(api_).toHaveBeenCalledTimes(1);

      const segundo = await mod.getTrendingToSuggest([], 5);
      expect(segundo[0].id, 'segunda leitura é do cache').toBe(1);
      expect(api_, 'cache atende sem fresh').toHaveBeenCalledTimes(1);

      lote = 2;
      const terceiro = await mod.getTrendingToSuggest([], 5, { fresh: true });
      expect(terceiro[0].id, 'fresh busca o dado novo').toBe(2);
      expect(api_, 'fresh vai à rede mesmo com a chave quente').toHaveBeenCalledTimes(2);

      const quarto = await mod.getTrendingToSuggest([], 5);
      expect(quarto[0].id, 'fresh regrava a chave').toBe(2);
      expect(api_, 'e a leitura seguinte já é do dado novo').toHaveBeenCalledTimes(2);
    });
  });

  it('Em Breve: fresh refaz o discover paginado', async () => {
    const api_ = vi.fn(async () => ({ results: [raw()], total_pages: 1 }));

    await withMock(api_, async (mod) => {
      await mod.getUpcomingTitles([], 1);
      await mod.getUpcomingTitles([], 1);
      expect(api_, 'cache atende').toHaveBeenCalledTimes(1);

      await mod.getUpcomingTitles([], 1, { fresh: true });
      expect(api_, 'fresh vai à rede').toHaveBeenCalledTimes(2);
    });
  });

  it('Calendário: fresh refaz o detalhe de cada título assistindo', async () => {
    const emDoisDias = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const api_ = vi.fn(async (endpoint) => {
      if (endpoint === 'tv/42') {
        return { id: 42, next_episode_to_air: { air_date: emDoisDias, season_number: 2, episode_number: 5, name: 'Episódio' } };
      }
      return { results: [], total_pages: 1 };
    });
    const catalogo = [item({ tmdb_id: 42 })];

    await withMock(api_, async (mod) => {
      const semana = await mod.getCalendarWeek(catalogo);
      expect(semana.length, 'semana tem o episódio').toBeGreaterThan(0);
      expect(api_).toHaveBeenCalledTimes(1);

      await mod.getCalendarWeek(catalogo);
      expect(api_, 'cache do detalhe atende').toHaveBeenCalledTimes(1);

      await mod.getCalendarWeek(catalogo, { fresh: true });
      expect(api_, 'fresh refaz o detalhe').toHaveBeenCalledTimes(2);
    });
  });

  it('Afinidade: fresh refaz as recomendações da âncora', async () => {
    // A faixa pagina o `recommendations` e completa com o `similar`, então o
    // carregamento não é uma chamada só — e é justamente essa sequência que o
    // `fresh` tem de refazer por inteiro.
    const api_ = vi.fn(async (endpoint) => {
      if (endpoint.endsWith('/recommendations')) return { results: [raw()] };
      return { results: [raw({ id: 901 })], total_pages: 1 };
    });
    const catalogo = [item()];

    await withMock(api_, async (mod) => {
      const a = await mod.getAffinityRail(catalogo, { offset: 0 });
      expect(a, 'faixa montada').toBeTruthy();
      const montar = api_.mock.calls.length;
      expect(montar, 'recommendations paginado + similar').toBeGreaterThan(1);

      await mod.getAffinityRail(catalogo, { offset: 0 });
      expect(api_, 'cache atende').toHaveBeenCalledTimes(montar);

      await mod.getAffinityRail(catalogo, { offset: 0, fresh: true });
      expect(api_, 'fresh vai à rede').toHaveBeenCalledTimes(montar * 2);
    });
  });
});

describe('fresh: a fiação da home', () => {
  /** Corpo de cada callback `setupSectionRefresh(section, ...)` da home. */
  function callbacksDeRefresh() {
    const out = [];
    let i = -1;
    while ((i = js.indexOf('setupSectionRefresh(section, () => {', i + 1)) !== -1) {
      out.push(js.slice(i, js.indexOf('}, ', i)));
    }
    return out;
  }

  /**
   * Os loaders que uma seção remota volta a chamar. É o pino que impede o
   * defeito silencioso: um callback pode levar `{ fresh: true }` e ainda assim
   * invocar a função errada, e a tela só mostraria a lista antiga.
   */
  const LOADERS_REMOTOS = [
    'loadAndRenderTrending',
    'loadAndRenderUpcoming',
    'loadAndRenderAffinityRails',
    'renderCategorySection',
    'loadAndRenderCalendar'
  ];

  it('as cinco seções remotas levam fresh: true no seu botão', () => {
    const blocos = callbacksDeRefresh();
    // trending, calendário, afinidade, as 6 categorias (um só bloco) e Em Breve.
    expect(blocos, 'sete botões na home').toHaveLength(7);

    const remotos = blocos.filter((b) => b.includes('fresh: true'));
    // Só favoritos e abandonados ficam de fora: as duas listas saem do
    // catálogo local, não da TMDb, então não há rede para refazer.
    expect(remotos, 'cinco callbacks com fresh').toHaveLength(5);

    const loaders = remotos.filter((b) => b.includes(', { fresh: true })'));
    expect(loaders, 'flag passada como argumento da chamada').toHaveLength(5);
    expect(remotos.map((b) => LOADERS_REMOTOS.find((n) => b.includes(`${n}(`))).sort())
      .toEqual([...LOADERS_REMOTOS].sort());
  });

  it('favoritos e abandonados não levam fresh: não há rede para refazer', () => {
    const locais = callbacksDeRefresh().filter((b) => !b.includes('fresh: true'));
    expect(locais).toHaveLength(2);
    const juntos = locais.join('\n');
    expect(juntos, 'favoritos').toContain("bumpSeed('favorites')");
    expect(juntos, 'abandonados').toContain("bumpSeed('abandoned')");
    expect(juntos, 'nenhuma das duas passa a flag').not.toContain('fresh:');
  });

  it('Em Breve seleciona do pool em vez de pintar o topo', () => {
    const i = js.indexOf('export async function loadAndRenderUpcoming(');
    expect(i, 'loader exportado').toBeGreaterThan(-1);
    const corpo = js.slice(i, js.indexOf('\n}', i));
    expect(corpo, 'seleção de verdade').toContain("pickForSection('upcoming'");
    expect(corpo, 'pool maior que a faixa para ter o que variar').toContain('largura * 2');
    expect(corpo, 'fresh repassado ao getter').toContain('fresh: opts.fresh');
  });
});

describe('fresh: o que cada getter faz com a flag', () => {
  it('getUpcomingTitles e getTrendingToSuggest repassam ao collectFiltered', () => {
    for (const nome of ['getUpcomingTitles', 'getTrendingToSuggest']) {
      const i = api.indexOf(`export async function ${nome}(`);
      expect(i, nome).toBeGreaterThan(-1);
      const corpo = api.slice(i, api.indexOf('\n}', i));
      expect(corpo, `${nome} repassa fresh`).toContain('{ fresh: opts.fresh }');
    }
  });

  it('getTitlesByGenre leva fresh nas duas rotas: gênero e keyword', () => {
    const i = api.indexOf('export async function getTitlesByGenre(');
    const corpo = api.slice(i, api.indexOf('\n}', i));
    const repasses = corpo.match(/\{ fresh: opts\.fresh \}/g) || [];
    // Rota principal e fallback da keyword 315058; a categoria de terror sem
    // isso continuaria servindo cache no clique de atualizar.
    expect(repasses, 'gênero + keyword').toHaveLength(2);
  });

  it('getTitlesByYear não recebe fresh: fica com o cache de 1h', () => {
    const i = api.indexOf('export async function getTitlesByYear(');
    expect(i, 'getTitlesByYear').toBeGreaterThan(-1);
    const corpo = api.slice(i, api.indexOf('\n}', i));
    // Decisão registrada: "Destaques do ano" não tem botão de atualizar, então
    // não há caminho pelo qual fresh pudesse chegar aqui.
    expect(corpo, 'sem fresh').not.toMatch(/fresh/);
    expect(corpo, 'sem opts no collectFiltered').toContain('poolSizeFor(lim)\n');
  });
});
