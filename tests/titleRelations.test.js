import { describe, it, expect } from 'vitest';
import {
  normalizeTitleName,
  getBaseTitle,
  isContinuationTitle,
  getContinuationTag,
  sortSearchResults,
  findParentCandidate
} from '../src/lib/titleRelations.js';

describe('normalizeTitleName', () => {
  it('remove acentos e pontuação', () => {
    expect(normalizeTitleName('Sennen Kessen-hen')).toBe('sennen kessen hen');
    expect(normalizeTitleName('Dr. Stone: New World')).toBe('dr stone new world');
  });
  it('trata vazio', () => {
    expect(normalizeTitleName('')).toBe('');
    expect(normalizeTitleName(null)).toBe('');
  });
});

describe('getBaseTitle', () => {
  it('pega o que vem antes dos dois-pontos', () => {
    expect(getBaseTitle('Bleach: Sennen Kessen-hen')).toBe('Bleach');
  });
  it('devolve o nome inteiro se não houver dois-pontos', () => {
    expect(getBaseTitle('Bleach')).toBe('Bleach');
  });
  it('ignora dois-pontos no início', () => {
    expect(getBaseTitle(': something')).toBe(': something');
  });
});

describe('isContinuationTitle', () => {
  it('detecta continuação', () => {
    expect(isContinuationTitle('Bleach: TYBW')).toBe(true);
    expect(isContinuationTitle('Bleach')).toBe(false);
  });
});

describe('getContinuationTag', () => {
  it('classifica temporada', () => {
    expect(getContinuationTag('Bleach: Temporada 2')).toBe('temporada');
  });
  it('classifica parte', () => {
    expect(getContinuationTag('Bleach: Parte 3 - Ketsubetsu')).toBe('parte');
  });
  it('classifica continuação genérica', () => {
    expect(getContinuationTag('Bleach: Sennen Kessen-hen')).toBe('continuação');
  });
  it('devolve null para nome normal', () => {
    expect(getContinuationTag('Bleach')).toBeNull();
  });
});

describe('sortSearchResults', () => {
  const results = [
    { id: 1, name: 'Bleach: Sennen Kessen-hen', popularity: 99 },
    { id: 2, name: 'Bleach', popularity: 10 }
  ];
  it('coloca o nome exato na frente', () => {
    expect(sortSearchResults(results, 'Bleach')[0].id).toBe(2);
  });
  it('sem query usa popularidade', () => {
    expect(sortSearchResults(results)[0].id).toBe(1);
  });
  it('não muta a lista original', () => {
    const arr = [...results];
    sortSearchResults(arr, 'Bleach');
    expect(arr[0].id).toBe(1);
  });
});

describe('findParentCandidate', () => {
  const arc = { id: 100, name: 'Bleach: Sennen Kessen-hen', popularity: 500 };
  const parent = { id: 30984, name: 'Bleach', first_air_date: '2004-10-05', popularity: 300 };
  const unrelated = { id: 7, name: 'Boruto', popularity: 400 };

  it('encontra a série pelo nome exato do prefixo', () => {
    expect(findParentCandidate(arc, [arc, parent, unrelated])?.id).toBe(30984);
  });

  it('prefere o mais antigo quando há duplicados', () => {
    const remake = { id: 55, name: 'Bleach', first_air_date: '2023-01-01' };
    expect(findParentCandidate(arc, [arc, remake, parent])?.id).toBe(30984);
  });

  it('não retorna nada para nome sem dois-pontos', () => {
    expect(findParentCandidate(parent, [arc, parent])).toBeNull();
  });

  it('não retorna nada se não houver candidato', () => {
    expect(findParentCandidate(arc, [arc, unrelated])).toBeNull();
  });

  it('ignora o próprio resultado', () => {
    expect(findParentCandidate(arc, [arc])).toBeNull();
  });

  it('aceita nome com acento diferente', () => {
    const accented = { id: 9, name: 'Shingeki no Kyojin: Temporada Final' };
    const base = { id: 10, name: 'Shingeki no Kyojin' };
    expect(findParentCandidate(accented, [accented, base])?.id).toBe(10);
  });
});
