/**
 * Cache único com TTL e limite de tamanho (LRU simples)
 * Substitui logoCache, cache de tendências, seasonDataCache e addSeasonDataCache
 */
const DEFAULT_TTL = 60 * 60 * 1000; // 1h - dados TMDb mudam pouco
const DEFAULT_MAX = 200;
const LS_KEY = 'datmovie_cache_v1';

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
  /**
   * Remove apenas as chaves com o prefixo informado.
   * Usado para invalidar um grupo de entradas (ex.: só as de tendências) sem
   * derrubar o cache inteiro — logos e detalhes de títulos são caros de
   * refazer e não têm relação com a invalidação.
   * @param {string} prefix - Prefixo das chaves a remover.
   * @returns {number} Quantidade de entradas removidas.
   */
  deleteByPrefix(prefix) {
    let removed = 0;
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) { try { this._persist(); } catch {} }
    return removed;
  }
  clear() { this.map.clear(); try { localStorage.removeItem(LS_KEY); } catch {} }
  size() { return this.map.size; }
  _persist() {
    try {
      const obj = {};
      for (const [k, v] of this.map.entries()) obj[k] = v;
      localStorage.setItem(LS_KEY, JSON.stringify({ data: obj, ts: Date.now() }));
    } catch {}
  }
  _restore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed.data) return;
      // Só restaura se não for muito antigo (24h)
      if (Date.now() - (parsed.ts || 0) > 24*60*60*1000) { localStorage.removeItem(LS_KEY); return; }
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v && v.expiresAt && Date.now() < v.expiresAt) this.map.set(k, v);
      }
    } catch {}
  }
}

export const appCache = new LRUCache(DEFAULT_TTL, DEFAULT_MAX);
try { appCache._restore(); } catch {}

// Persiste a cada set
const _origSet = appCache.set.bind(appCache);
appCache.set = (k,v,ttl) => { _origSet(k,v,ttl); try { appCache._persist(); } catch {} };
const _origClear = appCache.clear.bind(appCache);
appCache.clear = () => { _origClear(); try { localStorage.removeItem(LS_KEY); } catch {} };

export function cacheGet(key) { return appCache.get(key); }
export function cacheSet(key, value, ttl) { appCache.set(key, value, ttl); }
export function cacheHas(key) { return appCache.has(key); }
export function cacheClear() { appCache.clear(); }
/**
 * Invalida somente as entradas cujo prefixo bate, preservando o resto.
 * @param {string} prefix - Prefixo das chaves a invalidar.
 * @returns {number} Quantidade de entradas removidas.
 */
export function cacheClearPrefix(prefix) { return appCache.deleteByPrefix(prefix); }
export function createCache(ttl, maxSize) { return new LRUCache(ttl, maxSize); }
