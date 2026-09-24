/**
 * Cache único com TTL e limite de tamanho (LRU simples)
 * Substitui logoCache, cache de tendências, seasonDataCache e addSeasonDataCache
 */
const DEFAULT_TTL = 5 * 60 * 1000; // 5 min
const DEFAULT_MAX = 100;

class LRUCache {
  constructor(ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX) {
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.map = new Map(); // key -> { value, expiresAt }
  }
  _isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    // LRU: reinsert to mark as recent
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }
  set(key, value, ttl = this.ttl) {
    const expiresAt = Date.now() + ttl;
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt });
  }
  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) { this.map.delete(key); return false; }
    return true;
  }
  delete(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
  size() { return this.map.size; }
}

export const appCache = new LRUCache(DEFAULT_TTL, DEFAULT_MAX);

export function cacheGet(key) { return appCache.get(key); }
export function cacheSet(key, value, ttl) { appCache.set(key, value, ttl); }
export function cacheHas(key) { return appCache.has(key); }
export function cacheClear() { appCache.clear(); }
export function createCache(ttl, maxSize) { return new LRUCache(ttl, maxSize); }
