import { describe, it, expect } from 'vitest';
import {
  normalizeForSearch,
  editDistance,
  allowedEdits,
  matchScore,
  matchesQuery,
  buildFallbackQueries,
  sortByRelevance,
} from '../src/lib/fuzzySearch.js';

describe('normalizeForSearch', () => {
  it('tira acento', () => {
    expect(normalizeForSearch('Ação')).toBe('acao');
    expect(normalizeForSearch('Coração Selvagem')).toBe('coracao selvagem');
  });
  it('minúsculas e espaços colapsados', () => {
    expect(normalizeForSearch('  ONE   Piece  ')).toBe('one piece');
  });
  it('remove pontuação', () => {
    expect(normalizeForSearch('Marvel: What If...?!')).toBe('marvel what if');
  });
  it('aceita null/undefined sem quebrar', () => {
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
  });
});

describe('editDistance', () => {
  it('zero para iguais', () => {
    expect(editDistance('piece', 'piece')).toBe(0);
  });
  it('inserção, remoção e substituição', () => {
    expect(editDistance('cat', 'cart')).toBe(1);
    expect(editDistance('cart', 'cat')).toBe(1);
    expect(editDistance('cat', 'cut')).toBe(1);
  });
  it('transposição custa 1 (erro de digitação mais comum)', () => {
    // Levenshtein puro daria 2; com Damerau dá 1
    expect(editDistance('peice', 'piece')).toBe(1);
    expect(editDistance('recieve', 'receive')).toBe(1);
  });
  it('casos de borda', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('', '')).toBe(0);
  });
});

describe('allowedEdits', () => {
  it('não tolera nada em termo curto (trava o fuzzy)', () => {
    expect(allowedEdits(1)).toBe(0);
    expect(allowedEdits(3)).toBe(0);
  });
  it('tolera 1 em termo médio', () => {
    expect(allowedEdits(4)).toBe(1);
    expect(allowedEdits(6)).toBe(1);
  });
  it('tolera 2 em termo longo', () => {
    expect(allowedEdits(7)).toBe(2);
    expect(allowedEdits(20)).toBe(2);
  });
});

describe('matchScore — casos reais', () => {
  it('acha por substring normal', () => {
    expect(matchScore('one piece', 'One Piece')).toBe(100);
  });
  it('ignora maiúsculas', () => {
    expect(matchesQuery('breaking', 'Breaking Bad')).toBe(true);
  });
  it('ignora acento', () => {
    expect(matchesQuery('acao', 'Ação')).toBe(true);
    expect(matchesQuery('coracao', 'Coração Selvagem')).toBe(true);
  });
  it('acha em qualquer ordem de palavras', () => {
    expect(matchesQuery('piece one', 'One Piece')).toBe(true);
  });
  it('acha sem espaços colados', () => {
    expect(matchesQuery('breakingbad', 'Breaking Bad')).toBe(true);
  });
  it('tolera erro de digitação', () => {
    expect(matchesQuery('one peice', 'One Piece')).toBe(true);
    expect(matchesQuery('braking bad', 'Breaking Bad')).toBe(true);
    expect(matchesQuery('hARRY POTTR', 'Harry Potter')).toBe(true);
  });
});

describe('matchScore — o que NÃO pode casar', () => {
  it('termo curto não vira "acha tudo"', () => {
    // com 3 letras a tolerância é 0: "one" não pode puxar "Once Upon a Time"
    expect(matchesQuery('one', 'Once Upon a Time')).toBe(false);
  });
  it('palavra diferente não casa', () => {
    expect(matchesQuery('dragon', 'One Piece')).toBe(false);
    expect(matchesQuery('shogun', 'Fullmetal Alchemist')).toBe(false);
  });
  it('título curto não casa com consulta longa', () => {
    expect(matchesQuery('one piece', 'Friends')).toBe(false);
  });
  it('vazio não casa com tudo', () => {
    expect(matchScore('', 'One Piece')).toBe(0);
    expect(matchScore('one', '')).toBe(0);
    expect(matchesQuery('', 'One Piece')).toBe(false);
  });
});

describe('matchScore — ordenação', () => {
  it('ordena por relevância, não pela ordem original', () => {
    const q = 'one piece';
    const exato = matchScore(q, 'One Piece');
    const parcial = matchScore(q, 'One Piece: Fishman Island');
    expect(exato).toBeGreaterThan(parcial);
  });
  it('título com todos os termos pontua acima do título parcial', () => {
    const q = 'harry potter';
    const completo = matchScore(q, 'Harry Potter e a Pedra filosofal');
    const parcial = matchScore(q, 'Harry');
    expect(completo).toBeGreaterThan(parcial);
  });
});

describe('sortByRelevance', () => {
  // Simula o fallback da busca do TMDb: a query original não acha nada, tenta
  // "banks", e o TMDb devolve vários títulos. O pretendido tem de ir ao topo.
  const resultadosTMDb = [
    { name: 'Silverpoint' },
    { name: 'The Banks' },
    { name: 'Outer Banks' },
    { name: 'Banks' },
  ];
  const nome = (r) => r.name || r.title || '';

  it('coloca o título pretendido no topo mesmo vindo do fallback', () => {
    const out = sortByRelevance('auter banks', resultadosTMDb, nome);
    expect(out[0].name).toBe('Outer Banks');
  });
  it('não depende da ordem em que o TMDb devolveu', () => {
    const embaralhado = [...resultadosTMDb].reverse();
    const out = sortByRelevance('auter banks', embaralhado, nome);
    expect(out[0].name).toBe('Outer Banks');
  });
  it('aceita lista vazia ou inválida', () => {
    expect(sortByRelevance('x', [], nome)).toEqual([]);
    expect(sortByRelevance('x', null, nome)).toEqual([]);
  });
});

describe('buildFallbackQueries', () => {
  it('sugere a versão sem acento', () => {
    expect(buildFallbackQueries('Ação')).toContain('acao');
  });
  it('sugere sem artigo inicial', () => {
    expect(buildFallbackQueries('The Office')).toContain('office');
  });
  it('sugere a palavra mais longa quando há várias', () => {
    const out = buildFallbackQueries('senhor dos aneis');
    expect(out).toContain('senhor');
  });
  it('sugere cada palavra isolada, nao so a mais longa', () => {
    // Regressão: com "auter banks" as duas palavras tem 5 letras, e o sort
    // estável escolhia "auter" (a errada). O TMDb não acha "auter", mas
    // acha "banks" — entao todas precisam entrar na fila.
    const out = buildFallbackQueries('auter banks');
    expect(out).toContain('banks');
    expect(out).toContain('auter');
  });
  it('ordena as palavras da mais longa para a mais curta', () => {
    const out = buildFallbackQueries('senhor dos aneis do rei');
    const isoladas = out.filter(w => !w.includes(' '));
    const tam = isoladas.map(w => w.length);
    expect(tam).toEqual([...tam].sort((a, b) => b - a));
  });
  it('nunca repete a query original', () => {
    const out = buildFallbackQueries('one piece');
    expect(out).not.toContain('one piece');
  });
  it('não devolve duplicatas', () => {
    const out = buildFallbackQueries('Ação Ação');
    expect(new Set(out).size).toBe(out.length);
  });
  it('devolve lista vazia quando não há o que tentar', () => {
    expect(buildFallbackQueries('one')).toEqual([]);
  });
});
