import { describe, it, expect } from 'vitest';
import {
  escapeHTML,
  formatDateBR,
  getTierClass,
  calcularProgresso,
  filterItems,
  sortItems
} from '../src/lib/catalog.js';

describe('escapeHTML', () => {
  it('escapa caracteres especiais de HTML para prevenir XSS', () => {
    expect(escapeHTML('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHTML("title & 'subtitle'")).toBe('title &amp; &#39;subtitle&#39;');
  });

  it('retorna string vazia para valores nulos ou indefinidos', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });
});

describe('formatDateBR', () => {
  it('formata data ISO AAAA-MM-DD para DD/MM/AAAA', () => {
    expect(formatDateBR('2024-10-25')).toBe('25/10/2024');
  });

  it('retorna o próprio texto para dados inválidos ou nulos', () => {
    expect(formatDateBR('Data desconhecida')).toBe('Data desconhecida');
    expect(formatDateBR(null)).toBeNull();
  });
});

describe('getTierClass', () => {
  it('retorna a classe CSS correta para cada tier', () => {
    expect(getTierClass('S+')).toBe('tier-Splus');
    expect(getTierClass('A')).toBe('tier-A');
    expect(getTierClass('invalido')).toBe('');
  });
});

describe('calcularProgresso', () => {
  it('calcula o progresso simples por episódio sobre o total', () => {
    const item = { episodio: 5, totalEpisodios: 10 };
    expect(calcularProgresso(item)).toBe(50);
  });

  it('calcula o progresso acumulado considerando episódios de temporadas anteriores', () => {
    const item = {
      temporada: 2,
      episodio: 5,
      totalEpisodios: 24,
      seasonEpisodesMap: { 1: 12, 2: 12 }
    };
    // 12 eps da Temp 1 + 5 eps da Temp 2 = 17 / 24 = 71%
    expect(calcularProgresso(item)).toBe(71);
  });

  it('limita o resultado a 100% no máximo', () => {
    const item = { episodio: 15, totalEpisodios: 10 };
    expect(calcularProgresso(item)).toBe(100);
  });
});

describe('filterItems', () => {
  const items = [
    { id: 1, nome: 'Naruto', tipo: 'anime', status: 'assistindo', tier: 'S+' },
    { id: 2, nome: 'Arcane', tipo: 'animacao', status: 'concluido', tier: 'S' },
    { id: 3, nome: 'Breaking Bad', tipo: 'serie', status: 'assistindo', tier: 'S+' },
    { id: 4, nome: 'One Piece', tipo: 'anime', status: 'planejado', tier: null }
  ];

  it('filtra por tipo (aba)', () => {
    const res = filterItems(items, { currentTab: 'anime' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('Naruto');
  });

  it('filtra por aba planejado', () => {
    const res = filterItems(items, { currentTab: 'planejado' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('One Piece');
  });

  it('filtra por texto de busca', () => {
    const res = filterItems(items, { search: 'Arc' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('Arcane');
  });

  it('filtra por tier', () => {
    const res = filterItems(items, { tierFilter: 'S+' });
    expect(res).toHaveLength(2);
  });
});

describe('sortItems', () => {
  const items = [
    { nome: 'Zelda', dataCriacao: '2024-01-01' },
    { nome: 'Attack on Titan', dataCriacao: '2024-06-01' }
  ];

  it('ordena por nome ascendente (A-Z)', () => {
    const res = sortItems(items, 'nome-asc');
    expect(res[0].nome).toBe('Attack on Titan');
    expect(res[1].nome).toBe('Zelda');
  });

  it('ordena por data descendente (mais recente primeiro)', () => {
    const res = sortItems(items, 'data-desc');
    expect(res[0].nome).toBe('Attack on Titan');
  });
});
