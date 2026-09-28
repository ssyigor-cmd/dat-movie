import { describe, it, expect, vi } from 'vitest';
import { createCache, cacheGet, cacheSet, cacheClear, cacheClearPrefix, appCache } from '../src/lib/cache.js';

describe('cache', () => {
  it('set e get funcionam', () => {
    const c = createCache(1000, 10);
    c.set('a', 123);
    expect(c.get('a')).toBe(123);
  });
  it('expira após TTL', async () => {
    const c = createCache(10, 10);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    await new Promise(r => setTimeout(r, 20));
    expect(c.get('a')).toBeUndefined();
  });
  it('LRU evict quando atinge maxSize', () => {
    const c = createCache(10000, 2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
  it('cacheClear limpa singleton', () => {
    cacheSet('x', 999);
    expect(cacheGet('x')).toBe(999);
    cacheClear();
    expect(cacheGet('x')).toBeUndefined();
  });
  describe('deleteByPrefix', () => {
    it('remove só as chaves com o prefixo', () => {
      const c = createCache(10000, 10);
      c.set('trending_a', 1);
      c.set('trending_b', 2);
      c.set('tvcache_1', 3);
      expect(c.deleteByPrefix('trending_')).toBe(2);
      expect(c.get('trending_a')).toBeUndefined();
      expect(c.get('trending_b')).toBeUndefined();
      expect(c.get('tvcache_1')).toBe(3);
    });
    it('prefixo que não casa não remove nada', () => {
      const c = createCache(10000, 10);
      c.set('tvcache_1', 1);
      expect(c.deleteByPrefix('trending_')).toBe(0);
      expect(c.get('tvcache_1')).toBe(1);
    });
    it('não casa prefixo que está no meio da chave', () => {
      const c = createCache(10000, 10);
      c.set('meu_trending_x', 1);
      expect(c.deleteByPrefix('trending_')).toBe(0);
      expect(c.get('meu_trending_x')).toBe(1);
    });
    it('prefixo vazio casa todas as chaves', () => {
      const c = createCache(10000, 10);
      c.set('a', 1);
      c.set('b', 2);
      expect(c.deleteByPrefix('')).toBe(2);
      expect(c.size()).toBe(0);
    });
  });
  it('cacheClearPrefix invalida por prefixo no singleton', () => {
    cacheClear();
    cacheSet('trending_x', 1);
    cacheSet('logoV2_1_tv', 'logo');
    expect(cacheClearPrefix('trending_')).toBe(1);
    expect(cacheGet('trending_x')).toBeUndefined();
    expect(cacheGet('logoV2_1_tv')).toBe('logo');
    cacheClear();
  });
});
