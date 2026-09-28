import { hasArtwork, displayTitle, isStrictlyNonLatinTitle, isAbsurdFutureDate, isBlockedProduction, isAllowedLanguage } from './titleFilters.js';

/**
 * recommendScoring - Escolha equilibrada dos títulos exibidos nos carrosséis da home.
 *
 * Objetivo: devolver principalmente títulos conhecidos (mainstream), sem ficar
 * preso neles e sem despejar título de nicho aleatório.
 *
 * A seleção tem duas etapas:
 *  1. `scoreItems` classifica o pool (popularidade, qualidade, recência) e
 *     descarta o que não tem sinal mínimo (anti-nicho).
 *  2. `pickWithMix` sorteia por cotas: ~78% da faixa principal e ~22% da faixa
 *     de descoberta. Sorteio ponderado puro não resolvia, porque a cauda do pool
 *     voltava a aparecer a cada clique; a cota deixa a lista previsível.
 *
 * Dentro de cada faixa o sorteio continua ponderado pelo score (com
 * temperatura menor na faixa principal), então os títulos mudam entre cliques e
 * os já exibidos entram com peso baixo.
 */

/** Peso de cada sinal no score final (soma 1). */
export const SCORE_WEIGHTS = {
  popularity: 0.45,
  quality: 0.30,
  recency: 0.25
};

/**
 * Composição da lista exibida: 70% ancorada no topo do ranking e 30% explorando
 * uma janela mais larga.
 *
 * A ideia é do usuário: "trazer da API a maioria dos mais populares, uns 70%, e
 * o restante dar uma aleatoriedade". A parte que funciona é a âncora de
 * popularidade; a parte que não funciona é pegá-la de forma determinística,
 * porque isso devolve exatamente os mesmos 14 títulos a cada clique.
 *
 * Aqui a âncora é uma região do ranking, não uma lista fixa, e dentro dela a
 * seleção prefere o que ainda não foi exibido. Então a lista avança pelo topo
 * em vez de repetir, enquanto a qualidade fica garantida por construção: a
 * região da âncora é o topo do pool, então a calda nunca entra.
 */
export const MIX = {
  anchor: 0.7,
  explore: 0.3
};
/**
 * Fração do pool que conta como "topo" para a âncora. Itens abaixo disso só entram
 * pela cota de exploração.
 *
 * Medido no pool real (6 categorias, 10 refreshes cada):
 *
 *  - pool 160 (141 aceitos), janela 0.5: 131 distintos, 35% de repetição, e os
 *    títulos ficam no top 50% do pool;
 *  - pool 300 (260 aceitos), janela 0.5: 190 distintos, 5% de repetição, e os
 *    títulos ficam no top 37% do pool.
 *
 * O segundo domina o primeiro nos dois eixos. A Repetição não vinha da janela
 * ser grande, e sim do pool acabar: 10 refreshes × 20 vagas = 200 sorteios num
 * pool de 141 aceitos, então qualquer configuração cicla o pool inteiro e a
 * mediana vai para o meio. Ampliar o pool é o que resolve.
 */
export const ANCHOR_POOL_FRACTION = 0.5;

/**
 * Temperatura do sorteio dentro de cada região: maior = mais espalhado.
 *
 * A âncora é concentrada de propósito: min-max comprime a variação dentro de cada faixa
 * de popularidade, então o score vira grupos apertados (0.83 conhecidos / 0.45
 * nicho / 0.36 sem sinal). Com temperatura 0.55 o peso por vaga é ~2:1 e a
 * âncora de 27 itens saía 53/47 entre conhecidos e nicho. Baixando para 0.2 o
 * peso fica ~8:1 e a âncora é de fato o topo.
 *
 * Isso não traz a repetição de volta: a variedade vem de `excludeSeen`, que
 * prefere o que ainda não apareceu, e não da temperatura. Medido no pool real,
 * a lista caminha pela janela até esgotar e só então repete.
 */
export const TEMPERATURE = {
  anchor: 0.2,
  explore: 1.1
};

/** Votos mínimos para a média de avaliações ser considerada confiável. */
const MIN_VOTES = 250;

/** Média global usada para encolher ratings de títulos com poucos votos. */
const GLOBAL_MEAN_RATING = 6.5;

/** Meia-vida em anos para o sinal de recência. */
const RECENCY_HALF_LIFE = 6;

/** Peso aplicado a títulos que já apareceram (evita travar na mesma lista). */
const SEEN_PENALTY = 0.05;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * PRNG determinístico (mulberry32): mesma semente, mesma seleção.
 * @param {number} seed - Semente inteira.
 * @returns {Function} Gerador de números em [0, 1).
 */
function seededRandom(seed) {
  let a = (Math.trunc(seed) || 0) >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rating bayesiano: encolhe a média para a média global quando há poucos votos,
 * evitando que um 9,8 com 12 votos domine um 8,7 com 3.000 votos.
 * @param {number} voteAverage - Nota média (0-10).
 * @param {number} voteCount - Quantidade de votos.
 * @returns {number} Nota ajustada (0-10).
 */
export function bayesianRating(voteAverage, voteCount) {
  const rating = clamp(Number(voteAverage) || 0, 0, 10);
  const votes = Math.max(0, Number(voteCount) || 0);
  return (votes / (votes + MIN_VOTES)) * rating + (MIN_VOTES / (votes + MIN_VOTES)) * GLOBAL_MEAN_RATING;
}

/**
 * Popularidade em escala log: o TMDB distorce muito (o topo passa de centenas),
 * então usar o valor cru faria o sorteio quase sempre escolher o mesmo título.
 * @param {number} popularity - Popularidade do TMDB.
 * @returns {number} Valor > 0.
 */
export function logPopularity(popularity) {
  return Math.log10(1 + Math.max(0, Number(popularity) || 0));
}

/**
 * Interpreta a data do TMDB ("YYYY-MM-DD") no fuso local. `new Date('2026-09-27')`
 * é tratado como UTC e, em fusos negativos, cai no dia anterior.
 * @param {string|Date} value - Data.
 * @returns {Date|null} Data válida ou null.
 */
function parseLocalDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Sinal de recência com decaimento exponencial: 1 ao lançar, ~0.37 após 6 anos.
 * Títulos sem data conhecida recebem 0.5 (neutro, sem punir nem premiar).
 * Data absurda no futuro (2040 e afins) recebe 0: sem isso o lixo de catálogo
 * pontuava recência máxima e dominava o sorteio.
 * @param {string} dateStr - Data ISO de estreia.
 * @param {Date} [now] - Referência.
 * @returns {number} Valor entre 0 e 1.
 */
export function recencyScore(dateStr, now = new Date()) {
  if (!dateStr) return 0.5;
  const d = parseLocalDate(dateStr);
  if (!d) return 0.5;
  if (isAbsurdFutureDate(d, now)) return 0;
  const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = (startOfDay(now) - startOfDay(d)) / 86400000;
  if (days <= 0) return 1;
  return Math.exp(-days / (365.25 * RECENCY_HALF_LIFE));
}

/**
 * Lê os sinais de um item, aceitando o formato normalizado da home
 * ({ voteAverage, raw }) ou o objeto cru do TMDB.
 * @param {Object} item - Item do pool.
 * @returns {{popularity:number, rating:number, votes:number, date:string|null}}
 */
export function readSignals(item) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
  const popularity = item?.popularity ?? raw.popularity ?? 0;
  const voteAverage = item?.voteAverage ?? item?.vote_average ?? raw.vote_average ?? 0;
  const voteCount = item?.voteCount ?? item?.vote_count ?? raw.vote_count ?? 0;
  const date = item?.date || raw.first_air_date || raw.release_date || item?.first_air_date || null;
  return { popularity, rating: voteAverage, votes: voteCount, date };
}

/**
 * Calcula o score final de cada item do pool (0 a 1).
 * A popularidade é normalizada min-max dentro do próprio pool, para que a
 * comparação seja justa entre listas de origens e tamanhos diferentes.
 * @param {Array} pool - Candidatos.
 * @param {Object} [opts] - { now, weights }.
 * @returns {Array<{item:Object, pop:number, score:number}>} Ordem decrescente de score.
 */
export function scoreItems(pool, opts = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const now = opts.now || new Date();
  const weights = { ...SCORE_WEIGHTS, ...(opts.weights || {}) };
  const signals = pool.map(item => readSignals(item));
  const logs = signals.map(s => logPopularity(s.popularity));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = max - min || 1;

  return pool
    .map((item, i) => {
      const pop = (logs[i] - min) / span;
      const quality = bayesianRating(signals[i].rating, signals[i].votes) / 10;
      const recency = recencyScore(signals[i].date, now);
      const score = weights.popularity * pop + weights.quality * quality + weights.recency * recency;
      return { item, pop, score: clamp(score, 0, 1) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Identificador estável de um item (aceita o formato normalizado ou o cru do TMDB).
 * @param {Object} item - Item do pool.
 * @returns {string} Id como string, ou '' se não houver.
 */
export function itemId(item) {
  return String(item?.id ?? item?.tmdb_id ?? '');
}

/**
 * Temperatura efetiva: aceita número explícito ou o preset da região.
 * @param {Object} [opts] - { temperature, band }.
 * @returns {number} Temperatura (> 0).
 */
function resolveTemperature(opts = {}) {
  if (opts.temperature > 0) return opts.temperature;
  if (opts.band === 'explore') return TEMPERATURE.explore;
  return TEMPERATURE.anchor;
}

/**
 * Sorteia `count` itens com probabilidade proporcional ao score
 * (esquema de Efraimidis-Spirakis: chave = random^(1/peso), fica com as maiores).
 * Títulos já exibidos entram com peso reduzido, então raramente se repetem.
 * @param {Array} pool - Candidatos.
 * @param {number} count - Quantidade desejada.
 * @param {Object} [opts] - { seed, temperature, band, seen, excludeSeen, weights, now }.
 * @returns {Array} Itens escolhidos (sem repetição).
 */
export function pickWeighted(pool, count, opts = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const wanted = Math.max(0, Math.trunc(count));
  if (wanted === 0) return [];
  const temperature = resolveTemperature(opts);
  const seen = opts.seen instanceof Set ? opts.seen : new Set();
  const rand = seededRandom(opts.seed || 0);

  // `excludeSeen` é rígido: é o que segura a cota de conhecidos entre cliques.
  const candidates = opts.excludeSeen
    ? pool.filter(item => !seen.has(itemId(item)))
    : pool;
  if (candidates.length === 0) return [];

  const scored = scoreItems(candidates, { now: opts.now, weights: opts.weights });
  const keys = scored.map(({ item, score }) => {
    const id = itemId(item);
    const weight = Math.exp(score / temperature) * (id && seen.has(id) ? SEEN_PENALTY : 1);
    return { item, key: Math.pow(rand(), 1 / weight) };
  });
  keys.sort((a, b) => b.key - a.key);

  const chosen = keys.slice(0, Math.min(wanted, keys.length)).map(k => k.item);
  for (const item of chosen) {
    const id = itemId(item);
    if (id) seen.add(id);
  }
  return chosen;
}

/**
 * Proibições do usuário: nunca relaxáveis, em nenhuma hipótese.
 *
 * Excluem o item do pool inteiro, antes de qualquer lógica de preenchimento.
 * São diferentes dos "defeitos" porque o usuário foi categórico nestas duas
 * (produção de canal do YouTube e vídeo caseiro são "terminantemente
 * proibidos"; o corte de idioma é o que mantém a home em conteúdo mainstream).
 *
 * Sem essa separação elas viravam "defeito" e o preenchimento de lista curta as
 * furava: em Drama + `vote_average.desc` o pool limpo caía para 11 e a lista
 * completava com 24 títulos de idioma errado e 15 em alfabeto não latino.
 */
const PROHIBITED_FILTERS = [
  { name: 'producao', test: e => !isBlockedProduction(e.item) },
  { name: 'idioma', test: e => isAllowedLanguage(e.item) }
];

/**
 * Defeitos visíveis no card, reportados pelo usuário. Relaxáveis: o item só é
 * usado quando não existe material limpo para preencher a lista.
 *
 * O filtro rígido de votos/popularidade saiu daqui de propósito. Ele era
 * heurística interna (não defeito do título) e, por estar nesta camada, fazia
 * a lista voltar com 2-3 cards em categorias de título recém-lançado. Curadoria
 * de nicho é feita pelas faixas de popularidade e pela cota 78/22, não excluindo
 * item do pool.
 */
const CONTENT_FILTERS = [
  { name: 'alfabeto', test: e => !isStrictlyNonLatinTitle(displayTitle(e.item)) },
  { name: 'data', test: e => !isAbsurdFutureDate(readSignals(e.item).date, e.now) },
  { name: 'arte', test: e => hasArtwork(e.item) }
];

function isProhibited(entry) {
  return !PROHIBITED_FILTERS.every(f => f.test(entry));
}

function hasVisibleDefect(entry) {
  return !CONTENT_FILTERS.every(f => f.test(entry));
}

/**
 * Separa o pool em itens exibíveis e itens com defeito, preservando a ordem de score.
 * @param {Array} scored - Entradas de `scoreItems` (com `now` anexado).
 * @returns {{clean:Array, defective:Array}} Partição por defeito visível.
 */
function splitByDefect(scored) {
  const clean = [];
  const defective = [];
  for (const entry of scored) {
    if (isProhibited(entry)) continue;
    (hasVisibleDefect(entry) ? defective : clean).push(entry);
  }
  return { clean, defective };
}

/**
 * Preenche a cota de uma região sem nunca "emprestar" vaga para a outra.
 *
 * Primeiro usa só o que ainda não foi exibido. Se a região acabar, repete um
 * título dela em vez de devolver menos conhecidos: repetir um título conhecido
 * é melhor do que exibir título aleatório, que era o problema reportado.
 * @param {Array} region - Região (entradas de `scoreItems`).
 * @param {number} quota - Cota da região.
 * @param {string} name - 'anchor' | 'explore'.
 * @param {Object} opts - Opções repassadas ao sorteio.
 * @param {Set} seen - Ids já exibidos (é atualizado).
 * @returns {Array} Itens escolhidos.
 */
function takeRegion(region, quota, name, opts, seen) {
  if (quota <= 0 || region.length === 0) return [];
  const picked = pickWeighted(region.map(e => e.item), quota, {
    ...opts,
    band: name,
    seen,
    excludeSeen: true
  });
  if (picked.length >= quota) return picked;

  const taken = new Set(picked.map(itemId));
  const rest = region.map(e => e.item).filter(item => !taken.has(itemId(item)));
  picked.push(...pickWeighted(rest, quota - picked.length, { ...opts, band: name, seen }));
  return picked;
}

/**
 * Escolhe os títulos de um carrossel da home ancorando no topo do ranking.
 *
 * Ex.: count 10 => 7 da âncora (topo do ranking) + 3 explorando a janela
 * seguinte, numa ordem estável por score (os mais fortes aparecem primeiro).
 * @param {Array} pool - Candidatos.
 * @param {number} count - Quantidade exibida.
 * @param {Object} [opts] - { seed, seen, weights, now, mix }.
 * @returns {Array} Itens escolhidos (sem repetição).
 */
export function pickWithMix(pool, count, opts = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const wanted = Math.max(0, Math.trunc(count));
  if (wanted === 0) return [];

  const seen = opts.seen instanceof Set ? opts.seen : new Set();
  const now = opts.now || new Date();
  const scored = scoreItems(pool, { now, weights: opts.weights }).map(e => ({ ...e, now }));
  if (scored.length === 0) return [];

  const { clean, defective } = splitByDefect(scored);
  const chosen = pickBalanced(clean, wanted, opts, now, seen);

  // Só entra item com defeito quando não sobrou material limpo: assim a lista
  // completa sem reintroduzir título em alfabeto estranho, data de 2040 ou
  // card sem imagem.
  if (chosen.length < wanted) {
    const taken = new Set(chosen.map(itemId));
    const extra = defective
      .filter(e => !taken.has(itemId(e.item)))
      .slice(0, wanted - chosen.length)
      .map(e => e.item);
    for (const item of extra) {
      const id = itemId(item);
      if (id) seen.add(id);
    }
    chosen.push(...extra);
  }

  const order = new Map(scored.map((e, i) => [itemId(e.item), i]));
  return chosen
    .sort((a, b) => (order.get(itemId(a)) ?? 0) - (order.get(itemId(b)) ?? 0))
    .slice(0, wanted);
}

/**
 * Sorteia `wanted` itens de um pool já filtrado, com a lista ancorada no topo do
 * ranking e uma cota explorando a janela seguinte.
 *
 * A âncora é uma região do ranking de score (topo `ANCHOR_POOL_FRACTION` do pool),
 * não uma lista fixa de títulos. Dentro dela a seleção prefere o que ainda não
 * foi exibido, então a lista avança pelo topo a cada clique em vez de repetir os
 * mesmos. A qualidade vem da região; a temperatura só controla a variação.
 * @param {Array} source - Pool filtrado (entradas de `scoreItems` com `now`).
 * @param {number} wanted - Quantidade desejada.
 * @param {Object} opts - Opções repassadas ao sorteio.
 * @param {Date} now - Referência de data.
 * @param {Set} seen - Ids já exibidos (é atualizado).
 * @returns {Array} Itens escolhidos (sem repetição).
 */
function pickBalanced(source, wanted, opts, now, seen) {
  if (source.length === 0 || wanted === 0) return [];

  // Ordena por score uma vez só: a âncora é o topo, a exploração é o resto.
  const ordered = [...source].sort((a, b) => b.score - a.score);
  const anchorSize = Math.min(ordered.length, Math.max(wanted, Math.round(ordered.length * ANCHOR_POOL_FRACTION)));
  const anchor = ordered.slice(0, anchorSize);
  const explore = ordered.slice(anchorSize);

  const mix = { ...MIX, ...(opts.mix || {}) };
  let quotaAnchor = Math.round(wanted * mix.anchor);
  // Garante variedade: no mínimo 2 na âncora e 1 explorando quando há espaço.
  if (wanted >= 4) quotaAnchor = clamp(quotaAnchor, 2, wanted - 1);

  const baseOpts = { ...opts, now };
  const anchorItems = takeRegion(anchor, quotaAnchor, 'anchor', baseOpts, seen);
  const taken = new Set(anchorItems.map(itemId));

  // A exploração nunca pega de volta o que a âncora já levou.
  const explorePool = explore.filter(e => !taken.has(itemId(e.item)));
  const quotaExplore = Math.min(wanted - anchorItems.length, explorePool.length);
  const exploreItems = quotaExplore > 0
    ? takeRegion(explorePool, quotaExplore, 'explore', baseOpts, seen)
    : [];

  const chosen = [...anchorItems, ...exploreItems];

  // Região de exploração esgotada: completa com o que sobrou da âncora, sem repetir.
  if (chosen.length < wanted) {
    const already = new Set(chosen.map(itemId));
    const rest = ordered.filter(e => !already.has(itemId(e.item)));
    chosen.push(...rest.slice(0, wanted - chosen.length).map(e => e.item));
  }
  return chosen;
}
