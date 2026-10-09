/**
 * affinityMemory - O que as faixas "Se você gostou de X vai gostar disso"
 * já exibiram, e por onde a seleção varia.
 *
 * A seleção da home é determinística de propósito: mesma semente, mesma lista,
 * para que os testes possam afirmar o resultado. O preço aparecia na abertura
 * da página: mesma semente (0), mesmo offset de âncora e mesmo cache de 1h
 * davam exatamente os mesmos cartões a cada F5, e o botão de atualizar só
 * mexia na memória do módulo, que morre junto com a aba.
 *
 * Este módulo é o que atravessa um recarregamento:
 *
 * - `shown` é o que já apareceu, para a abertura seguinte preferir o que ainda
 *   não apareceu em vez de redesenhar o mesmo conjunto;
 * - `seed` e `offset` avançam a cada pintura, então até quando o material novo
 *   acaba, a repetição que sobra vem em outra ordem e sob outra âncora.
 *
 * O teto de `shown` é o que impede a lista de crescer sem limite: passado ele,
 * os itens mais antigos saem e voltam a ser candidatos. Sem isso, um catálogo
 * pequeno encheria a lista uma vez e passaria a repetir para sempre, com a
 * diferença de que a repetição nem apareceria como escolha.
 *
 * Sem localStorage (modo privado, quota estourada, Node de teste) tudo isto
 * degrada para a mesma memória de módulo de antes, só que sem atravessar o F5.
 */

/** Chave do blob no localStorage. */
const LS_KEY = 'datmovie_affinity_memory_v1';

/** Teto de ids guardados. Mais que isso é JSON grande sem ganho: os mais antigos voltam a ser candidatos. */
export const MAX_SHOWN = 400;

/**
 * Estado corrente. `shown` é FIFO: entra no fim, sai do começo.
 * @type {{seed: number, offset: number, shown: string[]}}
 */
let mem = { seed: 0, offset: 0, shown: [] };
let carregado = false;

/**
 * O storage do navegador, ou null quando não há (ou não responde).
 * O `typeof` evita ReferenceError em ambiente sem a global; o try/catch cobre
 * o caso em que a global existe mas a leitura lança (quota, modo privado).
 * @returns {Storage|null}
 */
function store() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Lê o blob uma única vez por sessão. Defensivo: um JSON corrompido não pode
 * derrubar a home, então o pior caso é começar do zero.
 */
function load() {
  if (carregado) return;
  carregado = true;
  const ls = store();
  if (!ls) return;
  try {
    const raw = ls.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const seed = Number(parsed.seed);
    const offset = Number(parsed.offset);
    mem.seed = Number.isFinite(seed) ? seed : 0;
    mem.offset = Number.isFinite(offset) ? offset : 0;
    if (Array.isArray(parsed.shown)) {
      mem.shown = parsed.shown.map((id) => String(id)).filter(Boolean).slice(-MAX_SHOWN);
    }
  } catch {}
}

/** Grava o estado corrente. Uma escrita por pintura, sem janela: são poucas. */
function persist() {
  const ls = store();
  if (!ls) return;
  try {
    ls.setItem(LS_KEY, JSON.stringify(mem));
  } catch {}
}

/**
 * Ids que as faixas já exibiram, entre carregamentos.
 *
 * Devolve um conjunto novo a cada chamada: é ele que a seleção marca com o que
 * acabou de escolher, e a gravação em seguida é quem leva isso para o disco.
 * @returns {Set<string>}
 */
export function affinityShown() {
  load();
  return new Set(mem.shown);
}

/**
 * Registra o que uma acaba de pintar, para a próxima abertura não repetir.
 * @param {Array<string|number>} ids - Ids escolhidos.
 */
export function rememberAffinity(ids) {
  load();
  if (!Array.isArray(ids) || ids.length === 0) return;
  const atuais = new Set(mem.shown);
  for (const id of ids) {
    const s = String(id);
    if (!s || atuais.has(s)) continue;
    atuais.add(s);
    mem.shown.push(s);
  }
  if (mem.shown.length > MAX_SHOWN) mem.shown = mem.shown.slice(-MAX_SHOWN);
  persist();
}

/**
 * Próxima semente de sorteio. Avança sempre, inclusive quando o pool não mudou:
 * é o que faz uma repetição inevitável sair em outra composição.
 * @returns {number} Semente (começa em 0).
 */
export function nextAffinitySeed() {
  load();
  const atual = mem.seed;
  mem.seed = atual + 1;
  persist();
  return atual;
}

/**
 * Próximo offset das âncoras. É ele que muda o "Se você gostou de X" de
 * carregamento para carregamento, em vez de girar sempre pelo mesmo começo.
 * @returns {number} Offset (começa em 0).
 */
export function nextAffinityOffset() {
  load();
  const atual = mem.offset;
  mem.offset = atual + 1;
  persist();
  return atual;
}

/**
 * Zera a memória e apaga o blob. Existe para teste: sem isto, um caso deixaria
 * ids na chave e o seguinte começaria vendo o que o anterior "exibiu".
 */
export function resetAffinityMemory() {
  mem = { seed: 0, offset: 0, shown: [] };
  carregado = false;
  try {
    const ls = store();
    if (ls) ls.removeItem(LS_KEY);
  } catch {}
}
