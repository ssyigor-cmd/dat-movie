import { describe, it, expect } from 'vitest';
import { translateKeyword } from '../src/lib/keywordTranslations.js';

describe('translateKeyword', () => {
  it('traduz keywords comuns do TMDb', () => {
    expect(translateKeyword('based on novel or book')).toBe('baseado em romance ou livro');
    expect(translateKeyword('Zombie')).toBe('zumbi');
    expect(translateKeyword('time travel')).toBe('viagem no tempo');
  });

  it('mantém o original quando não há tradução', () => {
    expect(translateKeyword('very obscure keyword')).toBe('very obscure keyword');
  });

  it('aceita vazio sem quebrar', () => {
    expect(translateKeyword('')).toBe('');
    expect(translateKeyword(null)).toBe('');
  });
});
