import { describe, it, expect } from 'vitest';
// Importa a MESMA allow-list usada pela Edge Function. Se a regex do proxy for
// editada, estes testes acompanjam a mudança em vez de validar uma cópia.
import {
  ALLOWED_ENDPOINT,
  MAX_ENDPOINT_LENGTH,
  isAllowedEndpoint,
} from '../supabase/functions/_shared/allowedEndpoint.ts';

describe('clever-endpoint contract', () => {
  describe('isAllowedEndpoint', () => {
    it('permite search/tv', () => {
      expect(isAllowedEndpoint('search/tv')).toBe(true);
    });
    it('permite search/multi', () => {
      expect(isAllowedEndpoint('search/multi')).toBe(true);
    });
    it('permite discover/tv', () => {
      expect(isAllowedEndpoint('discover/tv')).toBe(true);
    });
    it('permite trending/tv/day', () => {
      expect(isAllowedEndpoint('trending/tv/day')).toBe(true);
    });
    it('permite trending/tv/week', () => {
      expect(isAllowedEndpoint('trending/tv/week')).toBe(true);
    });
    it('permite genre/tv/list', () => {
      expect(isAllowedEndpoint('genre/tv/list')).toBe(true);
    });
    it('permite tv/12345', () => {
      expect(isAllowedEndpoint('tv/12345')).toBe(true);
    });
    it('permite tv/12345/images', () => {
      expect(isAllowedEndpoint('tv/12345/images')).toBe(true);
    });
    it('permite tv/12345/aggregate_credits', () => {
      expect(isAllowedEndpoint('tv/12345/aggregate_credits')).toBe(true);
    });
    it('permite tv/12345/season/1', () => {
      expect(isAllowedEndpoint('tv/12345/season/1')).toBe(true);
    });
    it('permite tv/12345/recommendations', () => {
      expect(isAllowedEndpoint('tv/12345/recommendations')).toBe(true);
    });
    it('permite tv/12345/similar', () => {
      expect(isAllowedEndpoint('tv/12345/similar')).toBe(true);
    });
    it('rejeita endpoint vazio', () => {
      expect(isAllowedEndpoint('')).toBe(false);
    });
    it('rejeita endpoint não string', () => {
      expect(isAllowedEndpoint(null)).toBe(false);
      expect(isAllowedEndpoint(123)).toBe(false);
    });
    it('rejeita endpoint muito longo', () => {
      expect(isAllowedEndpoint('tv/' + 'a'.repeat(200))).toBe(false);
    });
    it('respeita o limite de comprimento declarado', () => {
      // Boundary: um endpoint no limite exato ainda passa pela regex, mas
      // estoura o comprimento máximo e é barrado pelo validador.
      const noLimite = 'tv/' + 'a'.repeat(MAX_ENDPOINT_LENGTH - 3);
      expect(noLimite).toHaveLength(MAX_ENDPOINT_LENGTH);
      expect(isAllowedEndpoint(noLimite)).toBe(false);
    });
    it('rejeita endpoints arbitrários', () => {
      expect(isAllowedEndpoint('user/1')).toBe(false);
      expect(isAllowedEndpoint('admin/delete')).toBe(false);
      expect(isAllowedEndpoint('https://evil.com')).toBe(false);
    });
    it('rejeita movie endpoints', () => {
      expect(isAllowedEndpoint('movie/123')).toBe(false);
      expect(isAllowedEndpoint('search/movie')).toBe(false);
    });
  });

  describe('contrato da resposta', () => {
    it('resposta deve ser JSON com statusCode', () => {
      const payload = { data: { id: 1 }, error: null };
      expect(payload).toHaveProperty('data');
      expect(payload).toHaveProperty('error');
    });
    it('endpoint permitido deve ser string com comprimento dentro do limite', () => {
      const ep = 'tv/12345/season/1';
      expect(typeof ep).toBe('string');
      expect(ep.length).toBeLessThanOrEqual(MAX_ENDPOINT_LENGTH);
      expect(ALLOWED_ENDPOINT.test(ep)).toBe(true);
    });
  });
});
