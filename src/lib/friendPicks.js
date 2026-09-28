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

/** Quantos títulos do usuário são usados como âncora, na pior ordem possível. */
export const ANCHOR_LIMIT = 3;

/** Quantos candidatos de uma âncora têm os créditos conferidos atrás de um criador em comum. */
export const CANDIDATE_PROBE = 4;

/** Teto de chamadas a `aggregate_credits` por montagem da seção. */
export const CREDIT_BUDGET = 16;

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

/** Prefixo de cache. Sobrevive a `clearTrendingCache`, e deve: crédito não muda. */
const CREDITS_CACHE_PREFIX = 'credits_';

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
    const role = classifyRole(entry.job);
    // Função de figurino, produção ou mixagem não entra: ver `classifyRole`.
    if (!role) continue;
    const personId = String(entry.id);
    const current = byPerson.get(personId);
    if (current && current.rank >= role.rank) continue;
    byPerson.set(personId, {
      personId,
      name: entry.name,
      verb: role.verb,
      rank: role.rank,
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

/** Candidatos de uma âncora: similaridade do TMDb, já filtrados. */
async function fetchCandidates(anchorTmdbId, catalogItems) {
  let data = null;
  try {
    data = await callTMDB(`tv/${anchorTmdbId}/recommendations`, { page: 1 }, 'pt-BR');
  } catch {
    try {
      data = await callTMDB(`tv/${anchorTmdbId}/similar`, { page: 1 }, 'pt-BR');
    } catch {
      return [];
    }
  }
  const results = (data && data.results) || [];
  return filterNotInCatalog(results, catalogItems || []).filter(isPickableCandidate);
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

  for (const anchor of ordered) {
    if (picks.length >= limit) break;
    if (ctx.budget.credits >= CREDIT_BUDGET) break;
    const anchorName = anchor.item.nome;
    const anchorCreators = await fetchCreators(anchor.item.tmdb_id, ctx);
    if (anchorCreators.length === 0) continue;

    const candidates = await fetchCandidates(anchor.item.tmdb_id, catalogItems);
    const probe = candidates
      .filter(c => !used.has(String(c.id)))
      .slice(0, CANDIDATE_PROBE);
    if (probe.length === 0) continue;

    const checked = await mapLimit(probe, 4, raw => fetchCreators(raw.id, ctx));

    for (let i = 0; i < probe.length; i++) {
      const shared = findSharedCreator(anchorCreators, checked[i] || []);
      if (!shared) continue;
      const raw = probe[i];
      used.add(String(raw.id));
      picks.push({
        ...normalizeTrendingItem(raw),
        reason: buildReason({
          personName: shared.name,
          anchorVerb: shared.anchorVerb,
          pickVerb: shared.pickVerb,
          anchorTitle: anchorName
        }),
        person: {
          name: shared.name,
          profileUrl: creatorProfileUrl(shared.profilePath)
        },
        anchor: {
          id: anchor.item.tmdb_id,
          nome: anchorName,
          tier: anchor.item.tier || ''
        }
      });
      break;
    }
  }

  return picks.length > 0 ? picks : null;
}
