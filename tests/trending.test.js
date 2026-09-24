import { describe, it, expect } from 'vitest';
import { isWithin7DaysWindow, getFavorites, getCatalogStats } from '../src/lib/trendingApi.js';

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
    expect(s).toEqual({ total: 5, assistindo: 2, concluidos: 1, planejados: 1, totalEpisodiosAssistidos: 28 });
  });
  it('retorna zeros para lista vazia', () => {
    expect(getCatalogStats([])).toEqual({ total: 0, assistindo: 0, concluidos: 0, planejados: 0, totalEpisodiosAssistidos: 0 });
  });
});
