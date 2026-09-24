import { describe, it, expect, vi } from 'vitest';
import { createCache, cacheGet, cacheSet, cacheClear, appCache } from '../src/lib/cache.js';

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
});
