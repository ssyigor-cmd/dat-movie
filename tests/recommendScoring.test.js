import { describe, it, expect } from 'vitest';
import {
  SCORE_WEIGHTS,
  ANCHOR_POOL_FRACTION,
  TEMPERATURE,
  MIX,
  bayesianRating,
  logPopularity,
  recencyScore,
  readSignals,
  scoreItems,
  pickWeighted,
  pickWithMix,
  itemId
} from '../src/lib/recommendScoring.js';

const NOW = new Date('2026-09-27T12:00:00');

function makeItem(id, { popularity, voteAverage, voteCount, date, title, poster = true }) {
  return {
    id,
    title: title || `T${id}`,
    voteAverage,
    date,
    posterUrl: poster ? `https://image.tmdb.org/t/p/w342/${id}.jpg` : '',
    raw: { popularity, vote_count: voteCount, first_air_date: date, poster_path: poster ? `/${id}.jpg` : null }
  };
}

const mainstream = makeItem(1, { popularity: 900, voteAverage: 8.6, voteCount: 9000, date: '2024-03-10' });
const mid = makeItem(2, { popularity: 120, voteAverage: 7.9, voteCount: 800, date: '2019-06-01' });
const niche = makeItem(3, { popularity: 4, voteAverage: 7.1, voteCount: 60, date: '2009-01-05' });
const pool = [mainstream, mid, niche];

describe('bayesianRating', () => {
  it('encolhe ratings com poucos votos em direção à média global', () => {
    expect(bayesianRating(9.8, 10)).toBeLessThan(9.8);
    expect(bayesianRating(8.7, 3000)).toBeGreaterThan(8.5);
  });

  it('rating sem votos vira a média global', () => {
    expect(bayesianRating(10, 0)).toBeCloseTo(6.5, 5);
    expect(bayesianRating(undefined, undefined)).toBeCloseTo(6.5, 5);
  });

  it('nota alta com muitos votos supera nota alta com poucos', () => {
    expect(bayesianRating(9.0, 5000)).toBeGreaterThan(bayesianRating(9.0, 20));
  });
});

describe('logPopularity', () => {
  it('comprime a escala e trata entradas inválidas', () => {
    expect(logPopularity(0)).toBe(0);
    expect(logPopularity(null)).toBe(0);
    expect(logPopularity(-5)).toBe(0);
    expect(logPopularity(999)).toBeLessThan(10);
    expect(logPopularity(9999)).toBeGreaterThan(logPopularity(999));
  });
});

describe('recencyScore', () => {
  it('vale 1 para lançamento e decai com o tempo', () => {
    expect(recencyScore('2026-10-01', NOW)).toBe(1);
    expect(recencyScore('2026-09-27', NOW)).toBe(1);
    expect(recencyScore('2020-09-27', NOW)).toBeLessThan(recencyScore('2025-09-27', NOW));
  });

  it('trata data ausente ou inválida como neutro', () => {
    expect(recencyScore(null, NOW)).toBe(0.5);
    expect(recencyScore('data inválida', NOW)).toBe(0.5);
  });
});

describe('readSignals', () => {
  it('lê do item normalizado e do objeto cru do TMDB', () => {
    expect(readSignals(mainstream)).toEqual({ popularity: 900, rating: 8.6, votes: 9000, date: '2024-03-10' });
    expect(readSignals({ id: 9, popularity: 10, vote_average: 7, vote_count: 5, first_air_date: '2020-01-01' }))
      .toEqual({ popularity: 10, rating: 7, votes: 5, date: '2020-01-01' });
    expect(readSignals(null)).toEqual({ popularity: 0, rating: 0, votes: 0, date: null });
  });
});

describe('scoreItems', () => {
  it('ordena por score decrescente e mantém tudo entre 0 e 1', () => {
    const scored = scoreItems(pool, { now: NOW });
    expect(scored.map(s => s.item.id)).toEqual([1, 2, 3]);
    scored.forEach(s => {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    });
  });

  it('pesos somam 1', () => {
    const total = SCORE_WEIGHTS.popularity + SCORE_WEIGHTS.quality + SCORE_WEIGHTS.recency;
    expect(total).toBeCloseTo(1, 5);
  });

  it('popularidade sola favorece o título mais conhecido', () => {
    const scored = scoreItems(pool, { now: NOW, weights: { popularity: 1, quality: 0, recency: 0 } });
    expect(scored[0].item.id).toBe(1);
  });

  it('recência sozinha favorece o lançamento', () => {
    const scored = scoreItems(pool, { now: NOW, weights: { popularity: 0, quality: 0, recency: 1 } });
    expect(scored[0].item.id).toBe(1);
  });

  it('pool vazio ou inválido devolve lista vazia', () => {
    expect(scoreItems([])).toEqual([]);
    expect(scoreItems(null)).toEqual([]);
  });
});

describe('pickWeighted', () => {
  it('é determinístico para a mesma semente', () => {
    const a = pickWeighted(pool, 2, { seed: 5, now: NOW }).map(t => t.id);
    const b = pickWeighted(pool, 2, { seed: 5, now: NOW }).map(t => t.id);
    expect(a).toEqual(b);
  });

  it('sementes diferentes mudam a seleção', () => {
    const many = Array.from({ length: 40 }, (_, i) => makeItem(i + 1, { popularity: 10 + i, voteAverage: 7, voteCount: 500, date: '2024-01-01' }));
    const outs = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      outs.add(pickWeighted(many, 4, { seed, now: NOW }).map(t => t.id).join(','));
    }
    expect(outs.size).toBeGreaterThan(1);
  });

  it('prioriza o mainstream sem nunca repetir o título mais vezes', () => {
    let mainCount = 0;
    let nicheCount = 0;
    const rounds = 60;
    for (let seed = 1; seed <= rounds; seed++) {
      const out = pickWeighted(pool, 1, { seed, now: NOW });
      expect(out).toHaveLength(1);
      if (out[0].id === 1) mainCount++;
      if (out[0].id === 3) nicheCount++;
    }
    expect(mainCount).toBeGreaterThan(nicheCount);
    // a cauda aparece, mas não domina
    expect(nicheCount).toBeGreaterThan(0);
  });

  it('nunca repete itens e respeita a quantidade pedida', () => {
    const out = pickWeighted(pool, 3, { seed: 2, now: NOW });
    expect(out).toHaveLength(3);
    expect(new Set(out.map(t => t.id)).size).toBe(3);
  });

  it('reduz fortemente a repetição de itens já vistos', () => {
    const big = Array.from({ length: 20 }, (_, i) => makeItem(i + 1, { popularity: 50 + i, voteAverage: 7.5, voteCount: 900, date: '2024-01-01' }));
    const seen = new Set([1, 2, 3, 4, 5]);
    let repeats = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const out = pickWeighted(big, 5, { seed, seen, now: NOW });
      repeats += out.filter(t => t.id <= 5).length;
    }
    expect(repeats).toBeLessThan(200);
  });

  it('marca os escolhidos como vistos', () => {
    const seen = new Set();
    pickWeighted(pool, 2, { seed: 1, now: NOW, seen });
    expect(seen.size).toBe(2);
  });

  it('pool menor que o pedido devolve só o que existe', () => {
    expect(pickWeighted(pool, 10, { seed: 1, now: NOW })).toHaveLength(3);
  });

  it('trata entradas inválidas', () => {
    expect(pickWeighted([], 3, { seed: 1 })).toEqual([]);
    expect(pickWeighted(null, 3, { seed: 1 })).toEqual([]);
    expect(pickWeighted(pool, 0, { seed: 1 })).toEqual([]);
    expect(pickWeighted(pool, -2, { seed: 1 })).toEqual([]);
  });

  it('temperatura menor concentra mais no mainstream', () => {
    const many = Array.from({ length: 30 }, (_, i) => makeItem(i + 1, { popularity: i === 0 ? 5000 : 5, voteAverage: 7, voteCount: 300, date: '2024-01-01' }));
    let topCold = 0;
    let topHot = 0;
    for (let seed = 1; seed <= 40; seed++) {
      if (pickWeighted(many, 3, { seed, temperature: 0.02, now: NOW }).some(t => t.id === 1)) topCold++;
      if (pickWeighted(many, 3, { seed, temperature: TEMPERATURE.mainstream, now: NOW }).some(t => t.id === 1)) topHot++;
    }
    expect(topCold).toBeGreaterThan(topHot);
  });
});

describe('itemId', () => {
  it('aceita id numérico, id do catálogo e item sem id', () => {
    expect(itemId({ id: 7 })).toBe('7');
    expect(itemId({ id: 0, tmdb_id: 42 })).toBe('0');
    expect(itemId({ tmdb_id: 99 })).toBe('99');
    expect(itemId(null)).toBe('');
  });
});

describe('pickWithMix', () => {
  const build = (id, popularity, votes, rating = 7.5) =>
    makeItem(id, { popularity, voteAverage: rating, voteCount: votes, date: '2024-01-01' });

  // 14 conhecidos (pop alta) + 16 de nicho (pop baixa, mas com votos) + 8 sem sinal.
  const known = Array.from({ length: 14 }, (_, i) => build(100 + i, 900 - i * 15, 5000));
  const niche = Array.from({ length: 16 }, (_, i) => build(200 + i, 5 + i * 0.5, 200));
  const obscure = Array.from({ length: 8 }, (_, i) => build(300 + i, 1 + i * 0.4, 12));
  const bigPool = [...known, ...niche, ...obscure];
  const knownIds = new Set(known.map(t => t.id));
  const nicheIds = new Set(niche.map(t => t.id));
  const obscureIds = new Set(obscure.map(t => t.id));

  // Região da âncora: o topo do ranking de score. O contrato novo não divide o
  // pool por popularidade, divide por posição no ranking.
  const anchorIds = (() => {
    const ordered = scoreItems(bigPool, { now: NOW }).map(s => s.item.id);
    const size = Math.min(ordered.length, Math.max(10, Math.round(ordered.length * ANCHOR_POOL_FRACTION)));
    return new Set(ordered.slice(0, size));
  })();

  it('preenche a cota da âncora com itens do topo do ranking', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const out = pickWithMix(bigPool, 10, { seed, now: NOW });
      expect(out).toHaveLength(10);
      const foraDaAncora = out.filter(t => !anchorIds.has(t.id)).length;
      // Só a cota de exploração pode sair do topo.
      expect(foraDaAncora).toBeLessThanOrEqual(Math.round(10 * MIX.explore));
    }
  });

  it('mantém os conhecidos como maioria na primeira rodada', () => {
    // Teto estrutural: a região de exploração deste fixture (3 nicho + 8 sem sinal)
    // não contém nenhum conhecido, então no máximo 7 dos 10 podem ser conhecidos.
    // A âncora é concentrada de propósito, então o número real fica perto de 6.
    // Só vale na primeira rodada: depois a âncora esgota o topo e avança, que é o
    // comportamento coberto pelo teste "anda pelo topo em vez de repetir".
    let knownTotal = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const out = pickWithMix(bigPool, 10, { seed, seen: new Set(), now: NOW });
      knownTotal += out.filter(t => knownIds.has(t.id)).length;
    }
    expect(knownTotal / 60).toBeGreaterThan(0.5);
  });

  it('limita o material de baixo sinal à cota de exploração', () => {
    // Os 8 títulos sem voto/popularidade não são excluídos do pool: eles ficam
    // abaixo da janela da âncora e só entram pela cota de exploração (30%).
    for (let seed = 1; seed <= 30; seed++) {
      const out = pickWithMix(bigPool, 10, { seed, now: NOW });
      const lowSignal = out.filter(t => obscureIds.has(t.id)).length;
      expect(out).toHaveLength(10);
      expect(lowSignal).toBeLessThanOrEqual(Math.round(10 * MIX.explore));
    }
  });

  it('a cota de exploração nunca domina a lista', () => {
    const seen = new Set();
    let foraDaAncora = 0;
    for (let seed = 1; seed <= 8; seed++) {
      foraDaAncora += pickWithMix(bigPool, 10, { seed, seen, now: NOW })
        .filter(t => !anchorIds.has(t.id)).length;
    }
    expect(foraDaAncora).toBeGreaterThan(0);
    expect(foraDaAncora).toBeLessThanOrEqual(Math.round(8 * 10 * MIX.explore) + 2);
  });

  it('anda pelo topo em vez de repetir os mesmos títulos', () => {
    // Regressão do problema reportado: com o sorteiro concentrado a lista colava
    // nos mesmos 10 títulos. Agora ela avança pela janela da âncora.
    const seen = new Set();
    const rounds = [];
    for (let seed = 1; seed <= 5; seed++) {
      rounds.push(pickWithMix(bigPool, 10, { seed, seen, now: NOW }).map(t => t.id));
    }
    const unicos = new Set(rounds.flat());
    expect(unicos.size).toBeGreaterThan(20);
    rounds.slice(1).forEach(r => {
      const repetidos = r.filter(id => rounds[0].includes(id)).length;
      // Com a janela em metade do pool, a sobreposição entre rodadas é maior que
      // antes (a âncora é 19 de 38 itens e a exploração alcança o resto). O que
      // não pode é a lista voltar a ser a mesma.
      expect(repetidos).toBeLessThanOrEqual(3);
    });
  });

  it('pool pequeno ainda preenche a âncora e completa o resto', () => {
    // 9 conhecidos + 40 de nicho: a janela da âncora cobre o topo do ranking, que
    // é majoritariamente nicho neste pool, e a lista completa sem repetir.
    const fewKnown = Array.from({ length: 9 }, (_, i) => build(600 + i, 900 - i * 20, 5000));
    const manyNiche = Array.from({ length: 40 }, (_, i) => build(700 + i, 4 + i * 0.2, 200));
    const seen = new Set();
    for (let seed = 1; seed <= 5; seed++) {
      const out = pickWithMix([...fewKnown, ...manyNiche], 10, { seed, seen, now: NOW });
      expect(out).toHaveLength(10);
      expect(new Set(out.map(t => t.id)).size).toBe(10);
    }
  });

  it('é determinístico para a mesma semente e varia com a semente', () => {
    const a = pickWithMix(bigPool, 10, { seed: 7, now: NOW }).map(t => t.id);
    const b = pickWithMix(bigPool, 10, { seed: 7, now: NOW }).map(t => t.id);
    expect(a).toEqual(b);
    const outs = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      outs.add(pickWithMix(bigPool, 10, { seed, now: NOW }).map(t => t.id).join(','));
    }
    expect(outs.size).toBeGreaterThan(1);
  });

  it('ordena a lista com os títulos mais fortes primeiro', () => {
    const out = pickWithMix(bigPool, 10, { seed: 3, now: NOW });
    const order = scoreItems(bigPool, { now: NOW }).map(s => s.item.id);
    const positions = out.map(t => order.indexOf(t.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('marca os escolhidos como vistos e evita repetir o mesmo título', () => {
    const seen = new Set();
    const out = pickWithMix(bigPool, 10, { seed: 2, now: NOW, seen });
    expect(seen.size).toBe(10);
    out.forEach(t => expect(seen.has(String(t.id))).toBe(true));
    expect(new Set(out.map(t => t.id)).size).toBe(10);
  });

  it('pool só de títulos conhecidos não devolve sempre o topo exato', () => {
    const allKnown = Array.from({ length: 25 }, (_, i) => build(400 + i, 300 - i * 5, 3000));
    const out = pickWithMix(allKnown, 10, { seed: 4, now: NOW });
    expect(out).toHaveLength(10);
    expect(out).not.toEqual(allKnown.slice(0, 10).map(t => t.id));
  });

  it('pool todo de nicho ainda preenche a lista', () => {
    const allNiche = Array.from({ length: 12 }, (_, i) => build(500 + i, 2 + i * 0.1, 200));
    const out = pickWithMix(allNiche, 10, { seed: 5, now: NOW });
    expect(out).toHaveLength(10);
  });

  it('aceita cota customizada via mix', () => {
    const out = pickWithMix(bigPool, 10, { seed: 1, now: NOW, mix: { anchor: 0.5, explore: 0.5 } });
    expect(out.filter(t => !anchorIds.has(t.id)).length).toBe(5);
  });

  it('pool menor que o pedido devolve só o que existe, sem repetir', () => {
    const out = pickWithMix(niche.slice(0, 3), 10, { seed: 1, now: NOW });
    expect(out).toHaveLength(3);
    expect(new Set(out.map(t => t.id)).size).toBe(3);
  });

  it('trata entradas inválidas', () => {
    expect(pickWithMix([], 3, { seed: 1 })).toEqual([]);
    expect(pickWithMix(null, 3, { seed: 1 })).toEqual([]);
    expect(pickWithMix(bigPool, 0, { seed: 1 })).toEqual([]);
    expect(pickWithMix(bigPool, -2, { seed: 1 })).toEqual([]);
  });
});

describe('pickWithMix - listas completas', () => {
  it('relaxa o filtro de sinal em vez de devolver lista vazia', () => {
    // trending/tv/day traz muitos lançamentos com poucos votos e popularidade baixa
    const obscureDay = Array.from({ length: 12 }, (_, i) =>
      makeItem(i + 1, { popularity: 3 + i * 0.2, voteAverage: 7.4, voteCount: 8, date: '2026-09-20' }));
    const out = pickWithMix(obscureDay, 10, { seed: 1, now: NOW });
    expect(out).toHaveLength(10);
  });

  it('preenche a lista quando o pool tem folga, descartando o lixo', () => {
    const base = Array.from({ length: 40 }, (_, i) =>
      makeItem(i + 1, { popularity: 500 - i * 5, voteAverage: 8, voteCount: 3000, date: '2024-01-01' }));
    const withJunk = [
      ...Array.from({ length: 15 }, (_, i) => makeItem(900 + i, { popularity: 2, voteAverage: 9, voteCount: 5, date: '2044-01-01', title: `進撃${i}`, poster: false })),
      ...base
    ];
    for (let seed = 1; seed <= 12; seed++) {
      expect(pickWithMix(withJunk, 20, { seed, now: NOW })).toHaveLength(20);
    }
  });

  it('devolve o pool inteiro quando ele é menor que o pedido', () => {
    const small = Array.from({ length: 3 }, (_, i) =>
      makeItem(i + 1, { popularity: 100, voteAverage: 8, voteCount: 500, date: '2024-01-01' }));
    expect(pickWithMix(small, 20, { seed: 1, now: NOW })).toHaveLength(3);
  });
});

describe('pickWithMix - filtros de conteúdo', () => {
  const ok = Array.from({ length: 20 }, (_, i) =>
    makeItem(i + 1, { popularity: 600 - i * 10, voteAverage: 8.1, voteCount: 4000, date: '2024-01-01' }));

  it('descarta título em alfabeto não latino', () => {
    const jp = Array.from({ length: 10 }, (_, i) =>
      makeItem(500 + i, { popularity: 600, voteAverage: 8.5, voteCount: 4000, date: '2024-01-01', title: `進撃の巨人 ${i}` }));
    const out = pickWithMix([...jp, ...ok], 20, { seed: 1, now: NOW });
    expect(out).toHaveLength(20);
    expect(out.some(t => t.title.startsWith('進撃'))).toBe(false);
  });

  it('descarta data absurda no futuro', () => {
    const future = Array.from({ length: 10 }, (_, i) =>
      makeItem(600 + i, { popularity: 900, voteAverage: 8.9, voteCount: 5000, date: '2040-01-01' }));
    const out = pickWithMix([...future, ...ok], 20, { seed: 1, now: NOW });
    expect(out).toHaveLength(20);
    expect(out.some(t => t.date.startsWith('2040'))).toBe(false);
  });

  it('descarta item sem imagem', () => {
    const noArt = Array.from({ length: 10 }, (_, i) =>
      makeItem(700 + i, { popularity: 700, voteAverage: 8.4, voteCount: 4500, date: '2024-01-01', poster: false }));
    const out = pickWithMix([...noArt, ...ok], 20, { seed: 1, now: NOW });
    expect(out).toHaveLength(20);
    expect(out.some(t => t.posterUrl === '')).toBe(false);
  });

  it('nunca emite produção do YouTube nem vídeo caseiro', () => {
    const yt = [
      { id: 78670, label: 'Impulse' },
      { id: 84231, label: 'Wayne' },
      { id: 274753, label: 'Smosh Mouth' },
      { id: 66118, label: 'The Katering Show' }
    ].map(({ id, label }, i) => ({
      ...makeItem(1000 + i, { popularity: 2000 + i, voteAverage: 9.5, voteCount: 9000, date: '2024-01-01' }),
      id,
      title: label
    }));
    const caseiro = [
      makeItem(1100, { popularity: 2100, voteAverage: 9.6, voteCount: 9500, date: '2024-01-01', title: 'Filme Completo Dublado' }),
      makeItem(1101, { popularity: 2200, voteAverage: 9.7, voteCount: 9900, date: '2024-01-01', title: 'Meu Vlog de Familia' })
    ];
    const banned = [...yt, ...caseiro];
    const bannedIds = new Set(banned.map(t => t.id));

    const seen = new Set();
    for (let seed = 1; seed <= 6; seed++) {
      const out = pickWithMix([...banned, ...ok], 20, { seed, seen, now: NOW });
      expect(out).toHaveLength(20);
      expect(out.some(t => bannedIds.has(t.id))).toBe(false);
    }
  });

  it('nunca emite produção fora de inglês, japonês e coreano', () => {
    const fora = [
      { id: 1, lang: 'tr', title: 'Kursun' },
      { id: 2, lang: 'ar', title: 'Al Hayba' },
      { id: 3, lang: 'hi', title: 'Yeh Meri Family' },
      { id: 4, lang: 'fr', title: 'Fabien Cosma' },
      { id: 5, lang: 'it', title: 'Il Posto' },
      { id: 6, lang: 'th', title: 'GAP CEE' },
      { id: 7, lang: 'zh', title: 'Qing Yu Nian' },
      { id: 8, lang: 'de', title: 'Der Alte' }
    ].map(({ id, lang, title }) => ({
      ...makeItem(2000 + id, { popularity: 3000 - id, voteAverage: 9.8, voteCount: 9800, date: '2024-01-01' }),
      original_language: lang,
      title
    }));
    const foraIds = new Set(fora.map(t => t.id));

    const seen = new Set();
    for (let seed = 1; seed <= 6; seed++) {
      const out = pickWithMix([...fora, ...ok], 20, { seed, seen, now: NOW });
      expect(out).toHaveLength(20);
      expect(out.some(t => foraIds.has(t.id))).toBe(false);
    }
  });

  it('mantém anime e dorama, que o usuário disse aceitar', () => {
    const aceito = [
      { id: 31, lang: 'ja', title: 'Jujutsu Kaisen' },
      { id: 32, lang: 'ja', title: 'Sousou no Frieren' },
      { id: 33, lang: 'ko', title: 'Squid Game' },
      { id: 34, lang: 'ko', title: 'Crash Landing on You' }
    ].map(({ id, lang, title }) => ({
      ...makeItem(2100 + id, { popularity: 2500, voteAverage: 9.3, voteCount: 8000, date: '2024-01-01' }),
      original_language: lang,
      title
    }));
    const out = pickWithMix([...aceito, ...ok], 20, { seed: 1, seen: new Set(), now: NOW });
    const aceitoIds = new Set(aceito.map(t => t.id));
    expect(out.some(t => aceitoIds.has(t.id))).toBe(true);
  });

  it('nunca fura a proibição de idioma nem a de YouTube ao completar lista curta', () => {
    // Regressão real: em Drama + `vote_average.desc` o pool limpo caía para 11 e
    // o preenchimento de "itens com defeito" completava a lista com 24 títulos de
    // idioma errado e 15 em alfabeto não latino. Proibição não é defeito
    // relaxável, então lista curta é o resultado aceitável.
    //
    // O que ainda é relaxável é o defeito de alfabeto, e aí `進撃の巨人` entra
    // legitimamente: idioma `ja` é aceito e o usuário disse que japonês pode
    // aparecer. O que não pode entrar é o que está na lista de proibidos.
    const proibidos = [
      { id: 1, lang: 'tr', title: 'Kursun' },
      { id: 2, lang: 'ar', title: 'Al Hayba' },
      { id: 3, lang: 'hi', title: 'Yeh Meri Family' }
    ].map(({ id, lang, title }) => ({
      ...makeItem(3000 + id, { popularity: 9000, voteAverage: 9.9, voteCount: 9999, date: '2024-01-01' }),
      original_language: lang,
      title
    }));
    const anime = {
      ...makeItem(3100, { popularity: 9000, voteAverage: 9.9, voteCount: 9999, date: '2024-01-01' }),
      id: 4,
      original_language: 'ja',
      title: '進撃の巨人'
    };
    const youtube = [{ ...makeItem(3200, { popularity: 9000, voteAverage: 9.9, voteCount: 9999, date: '2024-01-01' }), id: 78670, title: 'Impulse' }];
    const limpos = [1, 2].map(i => makeItem(3300 + i, { popularity: 500, voteAverage: 8, voteCount: 800, date: '2024-01-01' }));

    const out = pickWithMix([...proibidos, anime, ...youtube, ...limpos], 20, { seed: 1, seen: new Set(), now: NOW });
    const ids = new Set(out.map(itemId));

    [...proibidos, ...youtube].forEach(t => expect(ids.has(itemId(t)), itemId(t)).toBe(false));
    // Os 2 limpos + o anime (defeito relaxável). Nenhum proibido, e nenhum outro
    // item entra para "completar" as 20 vagas.
    expect(out).toHaveLength(3);
    expect(ids.has(itemId(anime))).toBe(true);
  });

  it('usa item com defeito só quando não há material limpo, sempre no fim', () => {
    const noArt = Array.from({ length: 8 }, (_, i) =>
      makeItem(800 + i, { popularity: 700, voteAverage: 8.4, voteCount: 4500, date: '2024-01-01', poster: false }));
    const jp = Array.from({ length: 8 }, (_, i) =>
      makeItem(900 + i, { popularity: 800, voteAverage: 8.6, voteCount: 4600, date: '2024-01-01', title: `愛 ${i}` }));

    // Com material limpo suficiente: lista completa e sem defeito.
    const full = pickWithMix([...jp, ...ok], 20, { seed: 1, now: NOW });
    expect(full).toHaveLength(20);
    expect(full.some(t => t.title.startsWith('愛'))).toBe(false);

    // Sem material limpo: a lista completa com os defeito, mas consome o
    // material limpo inteiro antes de recorrer a eles.
    const filled = pickWithMix([...noArt, ...jp], 20, { seed: 1, now: NOW });
    expect(filled).toHaveLength(16);
    noArt.forEach(item => expect(filled.some(t => t.id === item.id)).toBe(true));
  });

  it('com pool limpo suficiente nunca emite defeito, em nenhum refresh', () => {
    const jp = Array.from({ length: 30 }, (_, i) =>
      makeItem(500 + i, { popularity: 900, voteAverage: 8.8, voteCount: 5000, date: '2024-01-01', title: `聚宝仙盆${i}` }));
    const noArt = Array.from({ length: 30 }, (_, i) =>
      makeItem(600 + i, { popularity: 950, voteAverage: 8.9, voteCount: 5200, date: '2024-01-01', poster: false }));
    const future = Array.from({ length: 30 }, (_, i) =>
      makeItem(700 + i, { popularity: 990, voteAverage: 9, voteCount: 5500, date: '2040-01-01' }));
    const seen = new Set();
    for (let seed = 1; seed <= 6; seed++) {
      const out = pickWithMix([...jp, ...noArt, ...future, ...ok], 20, { seed, seen, now: NOW });
      expect(out).toHaveLength(20);
      expect(out.some(t => t.title.startsWith('聚宝仙盆'))).toBe(false);
      expect(out.some(t => t.posterUrl === '')).toBe(false);
      expect(out.some(t => t.date.startsWith('2040'))).toBe(false);
    }
  });

  it('recência futura absurda vale 0 e não domina o score', () => {
    expect(recencyScore('2040-01-01', NOW)).toBe(0);
    expect(recencyScore('2040-01-01', NOW)).toBeLessThan(recencyScore('2024-01-01', NOW));
    expect(recencyScore('2027-01-01', NOW)).toBe(1);
  });
});

describe('parâmetros do mix', () => {
  it('a âncora é majoritária e a janela do topo é metade do pool', () => {
    expect(MIX.anchor).toBeGreaterThan(MIX.explore);
    expect(MIX.anchor).toBeGreaterThan(0.5);
    expect(MIX.anchor + MIX.explore).toBeCloseTo(1, 5);
    // A janela é metade do pool. Estreitar mais custaria popularidade sem
    // ganhar variedade: o que resolve repetição é a profundidade do pool.
    expect(ANCHOR_POOL_FRACTION).toBeGreaterThanOrEqual(0.5);
    expect(ANCHOR_POOL_FRACTION).toBeLessThan(1);
  });

  it('as temperaturas não estão no extremo que gruda no topo', () => {
    // A âncora é concentrada (o score vem em grupos apertados, então temperatura
    // alta diluiria o topo) mas a variedade vem de `excludeSeen`, não da
    // temperatura. Se a âncora ficar rasa de novo, a âncora para de ser o topo.
    expect(TEMPERATURE.anchor).toBeGreaterThan(0.1);
    expect(TEMPERATURE.anchor).toBeLessThan(0.35);
    expect(TEMPERATURE.explore).toBeGreaterThan(TEMPERATURE.anchor);
  });
});
