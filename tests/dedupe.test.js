import { describe, it, expect } from 'vitest';
import { isDuplicateInCatalog, filterNotInCatalog } from '../src/lib/catalog.js';

describe('filterNotInCatalog - bug String(undefined)', () => {
  it('não filtra incorretamente quando catalog tem tmdb_id undefined/null', () => {
    const tmdb = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const catalog = [{ tmdb_id: undefined }, { tmdb_id: null }, { tmdb_id: '' }, { tmdb_id: 2 }];
    const res = filterNotInCatalog(tmdb, catalog);
    expect(res.map(r => r.id)).toEqual([1, 3]);
  });
  it('filtra corretamente por tmdb_id string/number', () => {
    const tmdb = [{ id: 100 }, { id: '100' }, { id: 200 }];
    const catalog = [{ tmdb_id: 100 }];
    const res = filterNotInCatalog(tmdb, catalog);
    expect(res.map(r => r.id)).toEqual([200]);
  });
  it('retorna cópia quando catalog vazio', () => {
    const tmdb = [{ id: 1 }];
    expect(filterNotInCatalog(tmdb, [])).toEqual([{ id: 1 }]);
  });
});

describe('isDuplicateInCatalog', () => {
  it('detecta duplicado por tmdb_id (fonte da verdade)', () => {
    const catalog = [{ tmdb_id: 123, nome: 'Naruto', tipo: 'anime', ano: 2002 }];
    expect(isDuplicateInCatalog({ tmdb_id: 123, nome: 'Outro', tipo: 'serie', ano: 2020 }, catalog)).toBe(true);
    expect(isDuplicateInCatalog({ tmdb_id: '123', nome: 'Naruto', tipo: 'anime', ano: 2002 }, catalog)).toBe(true);
  });
  it('ignora nome quando tmdb_id presente', () => {
    const catalog = [{ tmdb_id: 999, nome: 'One Piece', tipo: 'anime', ano: 1999 }];
    expect(isDuplicateInCatalog({ tmdb_id: 1000, nome: 'One Piece', tipo: 'anime', ano: 1999 }, catalog)).toBe(false);
  });
  it('fallback nome+tipo+ano quando tmdb_id nulo', () => {
    const catalog = [{ tmdb_id: null, nome: 'Naruto', tipo: 'anime', ano: 2002 }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'naruto', tipo: 'anime', ano: 2002 }, catalog)).toBe(true);
  });
  it('homônimos com anos diferentes não são duplicados quando ambos têm ano', () => {
    const catalog = [{ tmdb_id: null, nome: 'One Piece', tipo: 'anime', ano: 1999 }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'One Piece', tipo: 'anime', ano: 2023 }, catalog)).toBe(false);
  });
  it('ano nulo no candidato ignora comparação de ano (mesmo nome+tipo)', () => {
    const catalog = [{ tmdb_id: null, nome: 'Bleach', tipo: 'anime', ano: 2004 }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'Bleach', tipo: 'anime', ano: null }, catalog)).toBe(true);
  });
  it('ano nulo no catálogo ignora comparação de ano', () => {
    const catalog = [{ tmdb_id: null, nome: 'Bleach', tipo: 'anime', ano: null }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'Bleach', tipo: 'anime', ano: 2004 }, catalog)).toBe(true);
  });
  it('tipos diferentes não são duplicados', () => {
    const catalog = [{ tmdb_id: null, nome: 'Naruto', tipo: 'anime', ano: 2002 }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'Naruto', tipo: 'serie', ano: 2002 }, catalog)).toBe(false);
  });
  it('respeita excludeIndex (edição)', () => {
    const catalog = [{ tmdb_id: 1, nome: 'A', tipo: 'anime' }, { tmdb_id: 1, nome: 'A', tipo: 'anime' }];
    expect(isDuplicateInCatalog({ tmdb_id: 1, nome: 'A', tipo: 'anime' }, catalog, 0)).toBe(true);
    const single = [{ tmdb_id: 1, nome: 'A', tipo: 'anime' }];
    expect(isDuplicateInCatalog({ tmdb_id: 1, nome: 'A', tipo: 'anime' }, single, 0)).toBe(false);
  });
  it('itens do catálogo com tmdb_id são ignorados no fallback', () => {
    const catalog = [{ tmdb_id: 123, nome: 'Naruto', tipo: 'anime', ano: 2002 }];
    expect(isDuplicateInCatalog({ tmdb_id: null, nome: 'Naruto', tipo: 'anime', ano: 2002 }, catalog)).toBe(false);
  });
});
