/**
 * viewHistory - Histórico dos títulos que o usuário abriu (app mobile).
 *
 * O problema que isto resolve: as sugestões da home (Em Alta, afinidade,
 * roleta, busca, destaques do ano) saem de um pool cacheado e mudam a cada
 * atualização. Sem histórico, abrir um card e dar F5 significava perder aquele
 * título para sempre. Aqui cada abertura vira um registro persistido, com o
 * `raw` mínimo necessário para reabrir até um título que nunca entrou no
 * catálogo.
 *
 * Duas regras de desenho:
 *
 * - a chave é por usuário (o mesmo esquema do layout da home), então trocar de
 *   conta no aparelho não mistura históricos;
 * - o blob é local, não vai para o Supabase. É preferência de navegação, como
 *   `showProgressBar` e a memória de afinidade: não deve exigir migration nem
 *   ficar indisponível quando a rede falha.
 *
 * Sem localStorage (modo privado, quota estourada, Node de teste) o módulo
 * degrada para memória de processo: a tela continua funcionando na sessão.
 */

/** Prefixo da chave no localStorage; o id do usuário é sufixo. */
const LS_PREFIX = 'datmovie_view_history_v1';

/** Teto de registros. Historico é navegação, não catálogo: 200 já cobre meses de uso. */
export const MAX_HISTORY = 200;

/** Memória por usuário, para não reparsear o JSON a cada abertura de título. */
const caches = new Map();

function keyFor(userId) {
  return `${LS_PREFIX}_${userId || 'anon'}`;
}

function store() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Aceita só o que a tela precisa. Além de evitar JSON inchado, é a fronteira
 * que impede um campo renomeado no futuro de virar referência quebrada.
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const nome = String(raw.nome || raw.title || '').trim();
  if (!key || !nome) return null;
  const tmdbId = raw.tmdbId != null && String(raw.tmdbId) ? String(raw.tmdbId) : null;
  const rawOriginal = raw.raw && typeof raw.raw === 'object' ? raw.raw : null;
  return {
    key,
    itemId: raw.itemId != null && String(raw.itemId) ? String(raw.itemId) : null,
    tmdbId,
    nome: nome.slice(0, 200),
    imagem: typeof raw.imagem === 'string' ? raw.imagem.slice(0, 600) : '',
    ano: raw.ano != null ? String(raw.ano).slice(0, 4) : null,
    tipo: raw.tipo === 'movie' ? 'movie' : 'serie',
    // O raw é o que permite reabrir uma sugestão após o F5. Sem id TMDB não
    // há como remontar o preview, então ele não é guardado.
    raw: tmdbId ? {
      id: rawOriginal?.id ?? tmdbId,
      title: nome,
      posterUrl: String(rawOriginal?.posterUrl || raw.imagem || '').slice(0, 600),
      date: String(rawOriginal?.date || raw.ano || '').slice(0, 20),
    } : null,
    viewedAt: raw.viewedAt || new Date().toISOString(),
  };
}

function load(userId) {
  if (caches.has(userId)) return caches.get(userId);
  let entries = [];
  const ls = store();
  if (ls) {
    try {
      const parsed = JSON.parse(ls.getItem(keyFor(userId)) || '[]');
      if (Array.isArray(parsed)) {
        entries = parsed.map(normalize).filter(Boolean).slice(0, MAX_HISTORY);
      }
    } catch {}
  }
  caches.set(userId, entries);
  return entries;
}

function persist(userId) {
  const ls = store();
  if (!ls) return;
  try {
    ls.setItem(keyFor(userId), JSON.stringify(load(userId)));
  } catch {}
}

/** Cópia do histórico, do mais recente para o mais antigo. */
export function getViewHistory(userId) {
  return load(userId).map(e => ({ ...e }));
}

/**
 * Registra uma abertura. Reabrir o mesmo título não duplica: ele volta para o
 * topo com a data atualizada, que é o comportamento esperado de "vistos
 * recentemente".
 */
export function recordView(userId, entry) {
  const item = normalize(entry);
  if (!item) return getViewHistory(userId);
  const atual = load(userId).filter(e => e.key !== item.key);
  atual.unshift(item);
  if (atual.length > MAX_HISTORY) atual.length = MAX_HISTORY;
  caches.set(userId, atual);
  persist(userId);
  return getViewHistory(userId);
}

/** Remove um registro pela chave (`item:<id>` ou `tmdb:<id>`). */
export function removeView(userId, key) {
  caches.set(userId, load(userId).filter(e => e.key !== key));
  persist(userId);
}

/** Esvazia o histórico do usuário corrente. */
export function clearViewHistory(userId) {
  caches.set(userId, []);
  persist(userId);
}

/** Só para testes: simulate uma aba nova sem mexer no storage. */
export function resetViewHistoryCache() {
  caches.clear();
}
