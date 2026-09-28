import { describe, it, expect } from 'vitest';
import {
  getTrackedSeason,
  seasonPosterPath,
  resolveSeasonPosterUrl,
  seasonPosterUrlFromSeason,
  shouldUseSeasonArt
} from '../src/lib/seasonArt.js';

const details = {
  poster_path: '/serie.jpg',
  seasons: [
    { season_number: 0, poster_path: '/especial.jpg' },
    { season_number: 1, poster_path: '/t1.jpg' },
    { season_number: 2, poster_path: null },
    { season_number: 3, poster_path: '/t3.jpg' }
  ]
};

describe('getTrackedSeason', () => {
  it('retorna a temporada do item', () => {
    expect(getTrackedSeason({ temporada: 2 })).toBe(2);
  });

  it('floor em valores fracionários', () => {
    expect(getTrackedSeason({ temporada: 3.7 })).toBe(3);
  });

  it('retorna null para item ausente', () => {
    expect(getTrackedSeason(null)).toBeNull();
  });

  it('retorna null para temporada inválida', () => {
    expect(getTrackedSeason({})).toBeNull();
    expect(getTrackedSeason({ temporada: 0 })).toBeNull();
    expect(getTrackedSeason({ temporada: -2 })).toBeNull();
    expect(getTrackedSeason({ temporada: 'abc' })).toBeNull();
  });
});

describe('seasonPosterPath', () => {
  it('acha o pôster da temporada', () => {
    expect(seasonPosterPath(details, 1)).toBe('/t1.jpg');
    expect(seasonPosterPath(details, 3)).toBe('/t3.jpg');
  });

  it('ignora a temporada 0 (especiais)', () => {
    expect(seasonPosterPath(details, 0)).toBeNull();
  });

  it('retorna null quando a temporada não tem pôster', () => {
    expect(seasonPosterPath(details, 2)).toBeNull();
    expect(seasonPosterPath(details, 99)).toBeNull();
  });

  it('retorna null para payload inválido', () => {
    expect(seasonPosterPath(null, 1)).toBeNull();
    expect(seasonPosterPath({}, 1)).toBeNull();
  });
});

describe('resolveSeasonPosterUrl', () => {
  it('prefere o pôster da temporada acompanhada', () => {
    expect(resolveSeasonPosterUrl(details, { temporada: 1 }))
      .toBe('https://image.tmdb.org/t/p/w500/t1.jpg');
  });

  it('cai para o pôster da série quando a temporada não tem arte', () => {
    expect(resolveSeasonPosterUrl(details, { temporada: 2 }))
      .toBe('https://image.tmdb.org/t/p/w500/serie.jpg');
  });

  it('aceita tamanho customizado', () => {
    expect(resolveSeasonPosterUrl(details, { temporada: 1 }, { size: 'w342' }))
      .toBe('https://image.tmdb.org/t/p/w342/t1.jpg');
  });

  it('retorna null sem nenhum pôster', () => {
    expect(resolveSeasonPosterUrl({ seasons: [] }, { temporada: 1 })).toBeNull();
    expect(resolveSeasonPosterUrl({}, { temporada: 1 })).toBeNull();
    expect(resolveSeasonPosterUrl(null, { temporada: 1 })).toBeNull();
  });

  it('usa o pôster da série quando a temporada é inválida', () => {
    expect(resolveSeasonPosterUrl(details, { temporada: 'x' }))
      .toBe('https://image.tmdb.org/t/p/w500/serie.jpg');
  });
});

describe('seasonPosterUrlFromSeason', () => {
  it('monta a URL do payload de temporada', () => {
    expect(seasonPosterUrlFromSeason({ poster_path: '/t1.jpg' }))
      .toBe('https://image.tmdb.org/t/p/w500/t1.jpg');
  });

  it('retorna null sem poster_path', () => {
    expect(seasonPosterUrlFromSeason({})).toBeNull();
    expect(seasonPosterUrlFromSeason(null)).toBeNull();
  });
});

describe('shouldUseSeasonArt', () => {
  it('usa para série com mais de 1 temporada em andamento', () => {
    expect(shouldUseSeasonArt({ tmdb_id: 30984, temporada: 1, status: 'assistindo' }, 2)).toBe(true);
  });

  it('não usa para série de uma temporada só', () => {
    expect(shouldUseSeasonArt({ tmdb_id: 1, temporada: 1, status: 'assistindo' }, 1)).toBe(false);
  });

  it('não usa para item concluído', () => {
    expect(shouldUseSeasonArt({ tmdb_id: 30984, temporada: 1, status: 'concluido' }, 2)).toBe(false);
  });

  it('não usa sem tmdb_id', () => {
    expect(shouldUseSeasonArt({ temporada: 1, status: 'assistindo' }, 5)).toBe(false);
    expect(shouldUseSeasonArt(null, 5)).toBe(false);
  });

  it('não usa com temporada inválida', () => {
    expect(shouldUseSeasonArt({ tmdb_id: 1, status: 'assistindo' }, 3)).toBe(false);
  });

  it('não usa quando o total de temporadas é desconhecido', () => {
    expect(shouldUseSeasonArt({ tmdb_id: 1, temporada: 1, status: 'assistindo' }, undefined)).toBe(false);
    expect(shouldUseSeasonArt({ tmdb_id: 1, temporada: 1, status: 'assistindo' }, 0)).toBe(false);
  });

  it('mantém a arte da série para concluídos mesmo em séries longas', () => {
    const item = { tmdb_id: 30984, temporada: 2, status: 'concluido' };
    expect(shouldUseSeasonArt(item, 4)).toBe(false);
    expect(resolveSeasonPosterUrl(details, item)).toBe('https://image.tmdb.org/t/p/w500/serie.jpg');
  });
});
