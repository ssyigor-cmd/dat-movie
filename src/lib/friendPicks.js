/**
 * friendPicks - "Títulos para você": indicação ancorada em **quem fez** o que o
 * usuário já curtiu.
 *
 * A regra que define esta seção: nada é indicado sem um criador em comum
 * **verificado** entre o título candidato e um título que o usuário já tem no
 * catálogo. Sem esse vínculo a frase seria catálogo, não indicação — e aí a
 * seção simplesmente se esconde. É essa honestidade que a separa de
 * `getRecommendationsForUser`, que só compara similaridade e não tem o que dizer.
 *
 * Por que o TMDb não resolve isso direto: `discover/tv` **não** aceita
 * `with_crew` nem `with_people` (confirmado na lista de parâmetros da API), então
 * não existe "obras do diretor X" como consulta. O caminho é semear candidatos
 * pela similaridade (`recommendations` com queda para `similar`, ambos já
 * allowlisted) e só então conferir, com `aggregate_credits`, se o criador
 * realmente coincide. Por isso a verificação é explícita e nunca pulada.
 *
 * Coste: `tv/{id}/aggregate_credits` devolve o elenco inteiro, e ele é pesado.
 * As buscas são limitadas por `CANDIDATE_PROBE` e `CREDIT_BUDGET`, e os créditos
 * já vistos no ciclo são reaproveitados.
 */

import { callTMDB } from './api.js';
import { calcularProgresso, filterNotInCatalog } from './catalog.js';
import { cacheGet, cacheSet } from './cache.js';
import { normalizeTrendingItem } from './trendingApi.js';
import {
  isBlockedProduction,
  isAllowedLanguage,
  isStrictlyNonLatinTitle,
  hasArtwork,
  displayTitle,
  isAbsurdFutureDate
} from './titleFilters.js';

/** Cards exibidos. Curado e pequeno de propósito: é indicação, não vitrine. */
export const PICK_COUNT = 3;

/**
 * Quantos títulos do usuário viram âncora.
 *
 * São 5 para preencher 3 cards, e não 3, porque o que limita a quantidade não
 * é falta de âncora e sim a chance de o candidato ter criador em comum: com 3
 * âncoras a seção viabilizava só 3 tentativas independentes, e qualquer uma que
 * não achasse vínculo deixava o card vazio. Âncora extra é uma rolagem nova na
 * sorte; sondar mais fundo na mesma âncora não é, porque o creators em comum se
 * esgota rápido.
 */
export const ANCHOR_LIMIT = 5;

/**
 * Quantos criadores de uma âncora têm as obras consultadas antes de desistir.
 *
 * Só os primeiros da lista (ordenada por função) entram: normalmente é um
 * criador ou roteirista, e o resto já é o mesmo time de sempre.
 */
export const CREATOR_WORK_PROBE = 2;

/** Quantos candidatos de uma âncora têm os créditos conferidos atrás de um criador em comum. */
export const CANDIDATE_PROBE = 3;

/**
 * Teto de chamadas a `aggregate_credits` por montagem da seção.
 *
 * É o que limita o custo de verdade: cada chamada traz o elenco inteiro da
 * série. 22 dá 5 âncoras + 17 candidatos, e o que sobra é cortado — sempre
 * pela âncora mais fraca, que é a ordem correta, já que a pontuação do anchor
 * é o que garante a qualidade da frase.
 */
export const CREDIT_BUDGET = 22;

/** Abaixo deste score o título não serve de âncora, e a seção não aparece. */
export const MIN_ANCHOR_SCORE = 30;

/** Peso do tier na hora de medir a força de uma âncora. */
const TIER_WEIGHT = { 'S+': 30, S: 20, A: 10, B: 4, C: 1, D: 0 };

/**
 * Verbo por função na série, e o quanto ela identifica a pessoa.
 *
 * A lista é de verdade uma allow-list, não uma deny-list. Um `aggregate_credits`
 * traz 40 a 80 nomes, e a imensa maioria é figurino, mixagem, coordinator,
 * fotografia, produção executiva — funções que **toda** série tem. Deixar
 * qualquer função desconhecida entrar com o verbo genérico "fez" enchia a lista
 * de coincidências que não dizem nada: "o mesmo produtor de Viu aqm, e fez isto
 * aqui" é afirmação vazia, e vazia é o oposto de indicação de amigo.
 */
const CREATOR_ROLES = {
  Director: { verb: 'dirigiu', rank: 3 },
  'Co-Director': { verb: 'dirigiu', rank: 3 },
  Creator: { verb: 'criou', rank: 3 },
  'Original Creator': { verb: 'criou', rank: 3 },
  'Series Creator': { verb: 'criou', rank: 3 },
  'Co-Creator': { verb: 'criou', rank: 3 },
  'Head Writer': { verb: 'roteirizou', rank: 2 },
  'Lead Writer': { verb: 'roteirizou', rank: 2 },
  Writer: { verb: 'roteirizou', rank: 2 },
  Screenplay: { verb: 'roteirizou', rank: 2 },
  Story: { verb: 'roteirizou', rank: 2 },
  Teleplay: { verb: 'roteirizou', rank: 2 }
};

/**
 * Variantes de função que não estão na lista literal mas indicam a mesma autoria.
 *Testadas **depois** da lista literal e antes de qualquer coisa ser aceito.
 */
const CREATOR_VARIANTS = [
  { re: /creator/i, verb: 'criou', rank: 3 },
  { re: /director/i, verb: 'dirigiu', rank: 3 },
  { re: /writer|screenplay|story|teleplay/i, verb: 'roteirizou', rank: 2 }
];

/**
 * Funções que passam longe, mesmo quando o nome casa com um dos padrões acima.
 *
 * `Art Director` contém "director" e `Executive Producer` aparece em toda
 * produção: sem esta lista, a allow-list seria furada pela própria regra de
 * variação. Por isso o teste de ruído vem **primeiro**.
 */
const NOISE_ROLES = [
  /executive producer|co-?producer|line producer|producer/i,
  /photograph|cinematograph/i,
  /art director|art direction|production design|set decor|graphic/i,
  /costume|make-?up|hair|wardrobe/i,
  /sound|music|composer/i,
  /editing|editor|post-?production|visual effects|\bvfx\b/i,
  /assistant|coordinator|manager|account|finance|legal/i,
  /stunt|choreograph|casting/i
];

/**
 * Prefixo de cache. Sobrevive a `clearTrendingCache`, e deve: crédito não muda.
 *
 * A versão V2 não é vaidade: a V1 guardava a lista já extraída por uma leitura
 * errada do payload (`job` singular num endpoint que devolve `jobs`), então
 * gravou `[]` para todo título. Como o valor é a lista final e não o payload
 * bruto, essa entrada vazia continuaria sendo servida por uma hora inteira
 * depois da correção — a seção seguiria escondida com o código já certo. Trocar
 * o prefixo é o que invalida isso na hora. Mesmo motivo do `logoV2_` do api.js.
 */
const CREDITS_CACHE_PREFIX = 'creditsV2_';

/**
 * Classifica uma função do `aggregate_credits`.
 * @param {string} job - Função como o TMDb escreve.
 * @returns {{verb:string, rank:number}|null} null se a função não diz nada.
 */
function classifyRole(job) {
  const value = String(job || '').trim();
  if (!value) return null;
  if (NOISE_ROLES.some(re => re.test(value))) return null;
  const exact = CREATOR_ROLES[value];
  if (exact) return exact;
  const variant = CREATOR_VARIANTS.find(v => v.re.test(value));
  return variant ? { verb: variant.verb, rank: variant.rank } : null;
}

/**
 * Força de um título como âncora de gosto.
 *
 * Não é só o tier: é o tier **somado ao que o usuário fez com o título**. Um S+
 * concluído é a evidência mais forte que existe; o mesmo S+ pausado no episódio
 * 2 é evidência fraca, e um título planejado não é evidência nenhuma — o
 * usuário ainda não viu, então não tem nada a dizer sobre o próprio gosto.
 * @param {Object} item - Item do catálogo.
 * @returns {number} Score (0 = não serve de âncora).
 */
export function anchorScore(item) {
  if (!item || !item.tmdb_id) return 0;
  if (item.status === 'planejado') return 0;
  const tier = TIER_WEIGHT[item.tier] ?? 0;
  if (tier === 0) return 0;
  if (item.status === 'concluido') return tier + 20;
  // Abandonar é o oposto de confirmar gosto: mantém algum valor, mas nunca
  // suficiente para ancorar sozinho.
  if (item.status === 'pausado') return Math.round(tier * 0.4);
  return tier + Math.round(calcularProgresso(item) / 5);
}

/**
 * Escolhe as âncoras: os títulos do catálogo que mais provam o gosto dele.
 * @param {Array} catalogItems - Catálogo do usuário.
 * @param {number} [limit] - Quantas âncoras.
 * @returns {Array<{item:Object, score:number}>} Em ordem de força.
 */
export function pickAnchors(catalogItems, limit = ANCHOR_LIMIT) {
  if (!Array.isArray(catalogItems) || catalogItems.length === 0) return [];
  return catalogItems
    .map(item => ({ item, score: anchorScore(item) }))
    .filter(entry => entry.score >= MIN_ANCHOR_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

/**
 * Extrai os criadores reconhecíveis de um `aggregate_credits`.
 *
 * Uma pessoa pode ter várias funções na mesma série (diretor e roteirista); fica
 * só a de maior peso, para o cartão não citar o mesmo nome duas vezes.
 * @param {Object} credits - Payload de `tv/{id}/aggregate_credits`.
 * @returns {Array<{personId:string, name:string, verb:string, rank:number, profilePath:string|null}>}
 */
export function extractCreators(credits) {
  const crew = Array.isArray(credits?.crew) ? credits.crew : [];
  const byPerson = new Map();
  for (const entry of crew) {
    if (!entry || !entry.id || !entry.name) continue;
    // Atenção ao formato: `aggregate_credits` devolve **`jobs`, um array**, porque
    // a mesma pessoa pode ter várias funções na série. O `job` no singular é o
    // formato de `movie/{id}/credits`, e aqui ele simplesmente não existe —
    // ler `entry.job` num payload real devolve `undefined` sempre, e a seção
    // some sem erro nenhum no console. `job` fica só como tolerância.
    const jobs = Array.isArray(entry.jobs) && entry.jobs.length > 0
      ? entry.jobs.map(j => j && j.job).filter(Boolean)
      : (entry.job ? [entry.job] : []);
    let best = null;
    for (const job of jobs) {
      const role = classifyRole(job);
      if (role && (!best || role.rank > best.rank)) best = role;
    }
    // Função de figurino, produção ou mixagem não entra: ver `classifyRole`.
    if (!best) continue;
    const personId = String(entry.id);
    const current = byPerson.get(personId);
    if (current && current.rank >= best.rank) continue;
    byPerson.set(personId, {
      personId,
      name: entry.name,
      verb: best.verb,
      rank: best.rank,
      profilePath: entry.profile_path || null
    });
  }
  return [...byPerson.values()].sort((a, b) => b.rank - a.rank);
}

/**
 * Acha o criador que aparece nos dois lados (âncora e candidato).
 * @param {Array} anchorCreators - Criadores da âncora.
 * @param {Array} pickCreators - Criadores do candidato.
 * @returns {Object|null} `{ personId, name, anchorVerb, pickVerb, profilePath }`.
 */
export function findSharedCreator(anchorCreators, pickCreators) {
  if (!Array.isArray(anchorCreators) || !Array.isArray(pickCreators)) return null;
  const byId = new Map();
  for (const c of pickCreators) {
    if (c && c.personId) byId.set(c.personId, c);
  }
  let best = null;
  for (const a of anchorCreators) {
    if (!a || !a.personId) continue;
    const p = byId.get(a.personId);
    if (!p) continue;
    const rank = (a.rank || 0) + (p.rank || 0);
    if (best && rank <= best.rank) continue;
    best = {
      personId: a.personId,
      name: a.name,
      anchorVerb: a.verb,
      pickVerb: p.verb,
      profilePath: p.profilePath || a.profilePath || null,
      rank
    };
  }
  return best;
}

/**
 * Monta a frase do cartão.
 *
 * O verbo vem do crédito **de cada lado**: se a pessoa dirigiu a âncora e
 * roteirizou o candidato, a frase diz exatamente isso. Nunca se afirma função
 * que o TMDb não registrava.
 * @param {Object} parts - { personName, anchorVerb, pickVerb, anchorTitle }.
 * @returns {string} Frase.
 */
export function buildReason({ personName, anchorVerb, pickVerb, anchorTitle }) {
  if (!personName || !anchorTitle) return '';
  return `${personName} ${anchorVerb} ${anchorTitle}. E ${pickVerb} isto aqui.`;
}

/** URL do rosto do criador, quando o TMDb devolve. */
export function creatorProfileUrl(profilePath) {
  if (!profilePath) return '';
  const path = String(profilePath);
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w185${path}`;
}

/**
 * Filtro de qualidade do candidato. Aqui **nada é relaxável**.
 *
 * Os carrosséis de 20 cards relaxam defeito para encher a lista; esta seção
 * precisa de 3 e só anda com material bom, então a lista curta nunca é desculpa
 * para exibir título bloqueado, de idioma errado ou sem arte.
 * @param {Object} raw - Título cru do TMDb.
 * @returns {boolean} true se o candidato pode entrar.
 */
export function isPickableCandidate(raw) {
  if (!raw || !raw.id) return false;
  if (isBlockedProduction(raw)) return false;
  if (!isAllowedLanguage(raw)) return false;
  if (isStrictlyNonLatinTitle(displayTitle(raw))) return false;
  if (isAbsurdFutureDate(raw.first_air_date)) return false;
  if (!hasArtwork(raw)) return false;
  return true;
}

/** Executa `tasks` com no máximo `limit` em voo por vez. */
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * Busca os créditos de um título, com cache e memo por ciclo.
 * @param {number|string} tmdbId - ID do TMDB.
 * @param {Object} ctx - { memo, budget }.
 * @returns {Promise<Array>} Criadores reconhecíveis ([] em caso de falha).
 */
async function fetchCreators(tmdbId, ctx) {
  const id = String(tmdbId);
  if (ctx.memo.has(id)) return ctx.memo.get(id);
  const cacheKey = `${CREDITS_CACHE_PREFIX}${id}`;
  let creators = [];
  if (ctx.budget.credits < CREDIT_BUDGET) {
    ctx.budget.credits += 1;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) {
      creators = Array.isArray(cached) ? cached : [];
    } else {
      try {
        const data = await callTMDB(`tv/${id}/aggregate_credits`, {}, 'pt-BR');
        creators = extractCreators(data);
        cacheSet(cacheKey, creators);
      } catch {
        creators = [];
      }
    }
  }
  ctx.memo.set(id, creators);
  return creators;
}

/**
 * Candidatos de uma âncora: similaridade do TMDb, já filtrados.
 *
 * Junta `recommendations` E `similar` em vez de usar o segundo só como
 * fallback de erro. As duas chamadas são baratas (uma lista, sem elenco), e o
 * `recommendations` do TMDb é justamente onde um título que divide o criador
 * com a âncora mais vezes aparece em posição baixa: sondar só os 4 primeiros
 * achados era a razão de a seção vir com 1 card só.
 * @param {number|string} anchorTmdbId - ID da âncora.
 * @param {Array} catalogItems - Catálogo do usuário.
 * @returns {Promise<Array>} Candidatos filtrados, sem repetição.
 */
/**
 * As séries de TV em que essa pessoa é conhecida, via `search/multi`.
 *
 * É o atalho que resolve a taxa de acerto. O caminho antigo semeava por
 * similaridade e depois conferia o `aggregate_credits` de cada candidato: das ~40
 * sugestões do TMDb, o criador em comum aparecia em uma minoria -- e gastar uma
 * chamada de elenco inteiro para descobrir isso é caro. Aqui a lista JÁ vem da
 * pessoa, e a verificação por id continua valendo: o `known_for` só vai para a
 * lista e o `aggregate_credits` ainda confirma o vínculo. Se a pessoa não
 * aparecer no resultado (ou vier sem `known_for`), devolve [] e o chamador cai
 * no caminho de similaridade.
 *
 * O match é por **id**, nunca por nome: dois homônimos não podem virar
 * "mesma pessoa" na frase.
 * @param {Object} creator - Criador da âncora ({ personId, name }).
 * @returns {Promise<Array>} Títulos de TV atribuídos à pessoa ([] se não achar).
 */
async function fetchCreatorWorks(creator) {
  if (!creator?.personId || !creator?.name) return [];
  let data = null;
  try {
    data = await callTMDB('search/multi', { query: creator.name, page: 1 }, 'pt-BR');
  } catch {
    return [];
  }
  const results = (data && data.results) || [];
  const person = results.find(
    r => r && r.media_type === 'person' && String(r.id) === String(creator.personId)
  );
  if (!person) return [];
  const known = Array.isArray(person.known_for) ? person.known_for : [];
  return known.filter(k => k && k.media_type === 'tv' && k.id);
}

async function fetchCandidates(anchorTmdbId, catalogItems) {
  const endpoints = [
    `tv/${anchorTmdbId}/recommendations`,
    `tv/${anchorTmdbId}/similar`
  ];
  const merged = [];
  const seen = new Set();
  for (const endpoint of endpoints) {
    let data = null;
    try {
      data = await callTMDB(endpoint, { page: 1 }, 'pt-BR');
    } catch {
      continue;
    }
    for (const raw of (data && data.results) || []) {
      const id = String(raw?.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(raw);
    }
  }
  return filterNotInCatalog(merged, catalogItems || []).filter(isPickableCandidate);
}

/**
 * Monta a lista de indicações.
 *
 * Devolve `null` — e a seção se esconde — quando não há âncora forte ou quando
 * nenhum candidato tem criador em comum verificado. Uma lista curta é aceitável;
 * uma lista sem lastro não é.
 *
 * @param {Array} catalogItems - Catálogo do usuário.
 * @param {Object} [opts] - { limit, anchorIndex } para o botão de atualizar.
 * @returns {Promise<Array|null>} Cards com `reason` e `person`, ou null.
 */
export async function getFriendPicks(catalogItems, opts = {}) {
  const limit = Math.max(0, Math.trunc(opts.limit ?? PICK_COUNT));
  if (limit === 0) return null;

  const anchors = pickAnchors(catalogItems, ANCHOR_LIMIT);
  if (anchors.length === 0) return null;

  // O botão de atualizar gira a âncora, como faz `getRecommendationsForUser`.
  const offset = ((Math.trunc(opts.anchorIndex || 0) % anchors.length) + anchors.length) % anchors.length;
  const ordered = [...anchors.slice(offset), ...anchors.slice(0, offset)];

  const ctx = { memo: new Map(), budget: { credits: 0 } };
  const used = new Set();
  const picks = [];
  // "1 card" tem duas causas bem diferentes -- ancora fraca no catalogo, ou
  // nenhum candidato com criador em comum -- e o usuario nao tem como
  // distinguir uma da outra na tela. O log separa.
  const stats = { anchors: anchors.length, tested: 0, hits: 0, credits: 0, works: 0, exhausted: false };

  /** Monta o card a partir do título cru, do criador em comum e da âncora. */
  const montar = (raw, shared, anchor) => ({
    ...normalizeTrendingItem(raw),
    reason: buildReason({
      personName: shared.name,
      anchorVerb: shared.anchorVerb,
      pickVerb: shared.pickVerb,
      anchorTitle: anchor.item.nome
    }),
    person: {
      name: shared.name,
      profileUrl: creatorProfileUrl(shared.profilePath)
    },
    anchor: {
      id: anchor.item.tmdb_id,
      nome: anchor.item.nome,
      tier: anchor.item.tier || ''
    }
  });

  /** Só entra candidato limpo e fora do que já foi indicado. */
  const aptos = (list) => filterNotInCatalog(list, catalogItems || [])
    .filter(isPickableCandidate)
    .filter(c => !used.has(String(c.id)));

  for (const anchor of ordered) {
    if (picks.length >= limit) break;
    if (ctx.budget.credits >= CREDIT_BUDGET) { stats.exhausted = true; break; }
    const anchorCreators = await fetchCreators(anchor.item.tmdb_id, ctx);
    if (anchorCreators.length === 0) continue;

    // Caminho 1: as obras do próprio criador. Custa uma request barata de
    // busca e tem taxa de acerto alta, porque a lista já vem da pessoa.
    let encontrado = null;
    for (const creator of anchorCreators.slice(0, CREATOR_WORK_PROBE)) {
      if (ctx.budget.credits >= CREDIT_BUDGET) break;
      const obras = aptos(await fetchCreatorWorks(creator));
      if (obras.length === 0) continue;
      stats.works += obras.length;
      for (const raw of obras.slice(0, CANDIDATE_PROBE)) {
        stats.tested += 1;
        const pickCreators = await fetchCreators(raw.id, ctx);
        const shared = findSharedCreator([creator], pickCreators);
        if (!shared) continue;
        encontrado = { raw, shared };
        break;
      }
      if (encontrado) break;
    }

    // Caminho 2: similaridade do TMDb, sondando os primeiros candidatos.
    if (!encontrado) {
      const probe = aptos(await fetchCandidates(anchor.item.tmdb_id, catalogItems))
        .slice(0, CANDIDATE_PROBE);
      stats.tested += probe.length;
      const checked = await mapLimit(probe, 4, (raw) => fetchCreators(raw.id, ctx));
      for (let i = 0; i < probe.length; i++) {
        const shared = findSharedCreator(anchorCreators, checked[i] || []);
        if (!shared) continue;
        encontrado = { raw: probe[i], shared };
        break;
      }
    }

    if (!encontrado) continue;
    stats.hits += 1;
    used.add(String(encontrado.raw.id));
    picks.push(montar(encontrado.raw, encontrado.shared, anchor));
  }

  stats.credits = ctx.budget.credits;
  if (typeof console !== 'undefined' && console.info) {
    console.info(
      `[títulos para você] ${picks.length}/${limit} cards — ` +
      `âncoras: ${stats.anchors}, candidatos conferidos: ${stats.tested}, ` +
      `vínculos achados: ${stats.hits}, créditos: ${stats.credits}` +
      (stats.exhausted ? ' (orçamento estourado)' : '')
    );
  }

  return picks.length > 0 ? picks : null;
}
