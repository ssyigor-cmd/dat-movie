/**
 * prng - Gerador pseudoaleatório determinístico (mulberry32).
 *
 * Vive em módulo próprio porque `recommendScoring` e `trendingApi` precisam da
 * **mesma** sequência para a mesma semente. Havia duas cópias idênticas: o
 * sorteio da home e a ordem dos carrosséis andavam juntos por coincidência, e
 * corrigir o gerador em um arquivo deixaria o outro para trás — o mesmo seed
 * passaria a produzir ordens diferentes conforme o caminho chamado.
 *
 * Determinístico de propósito: `Math.random` tornaria o comportamento
 * impossível de testar.
 */

/**
 * @param {number} seed - Semente inteira.
 * @returns {Function} Gerador de números em [0, 1).
 */
export function seededRandom(seed) {
  let a = (Math.trunc(seed) || 0) >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
