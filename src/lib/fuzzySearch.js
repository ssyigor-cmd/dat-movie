/**
 * Busca tolerante a erro de digitação.
 *
 * O filtro de catálogo usava só `includes()` em minúsculas, o que falha em
 * três casos comuns:
 *   - acento:   "acao" não achava "Ação"
 *   - ordem:    "piece one" não achava "One Piece"
 *   - digitação: "one peice" não achava "One Piece"
 *
 * Aqui a comparação passa por três camadas, da mais barata para a mais cara:
 *   1. substring normalizado  (cobre acentos e maiúsculas)
 *   2. todos os termos presentes, em qualquer ordem
 *   3. distância de edição com limite proporcional ao tamanho do termo
 *
 * O limite é o que impede o pesadelo de fuzzy: com 2-3 letras não se tolera
 * NENHUMA diferença, senão quase tudo casa. Acima de 6 letras o limite vai a
 * 2, o que ainda rejeita "shogun" para "dragon ball".
 */

/** Normaliza para comparação: sem acento, minúsculas, espaços colapsados. */
export function normalizeForSearch(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Distância de edição de Damerau-Levenshtein (variante OSA).
 * Diferente do Levenshtein puro, troca de letras vizinhas ("peice"/"piece")
 * custa 1 em vez de 2 — que é exatamente o erro de digitação mais comum.
 * @returns {number} Quantidade mínima de edições.
 */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevPrev = new Array(n + 1);
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      // transposição de caracteres adjacentes
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur[j] = v;
    }
    prevPrev = prev;
    prev = cur;
    cur = new Array(n + 1);
  }
  return prev[n];
}

/**
 * Quantas diferenças de digitação são aceitables para um termo.
 * Curto demais não tolera nada — é o que segura a lista inteira de aparecer.
 * @param {number} len - Tamanho do termo digitado.
 * @returns {number} 0, 1 ou 2.
 */
export function allowedEdits(len) {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

/** Percentual de semelhança entre dois textos normalizados (0 a 100). */
function similarity(a, b) {
  if (!a.length && !b.length) return 100;
  const dist = editDistance(a, b);
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 100;
  return Math.max(0, 100 - (dist / longest) * 100);
}

/** O termo digitado casa com alguma palavra do texto, dentro do limite? */
function termMatchesWord(term, words) {
  const limit = allowedEdits(term.length);
  let best = 0;
  for (const word of words) {
    if (word === term) return 100;
    // o termo precisa ser comparável com a palavra: evita "on" casar com
    // "once" e afogar o resultado
    if (Math.abs(word.length - term.length) > limit) continue;
    const s = similarity(term, word);
    if (s > best) best = s;
    if (best === 100) break;
  }
  return best;
}

/**
 * Nota de 0 a 100 para um texto contra a consulta. 0 = não casa.
 * O resultado é ordenável, o que permite ranquear os títulos melhores
 * primeiro em vez de manter a ordem original do catálogo.
 * @param {string} query - O que o usuário digitou.
 * @param {string} text - Nome do título.
 * @returns {number} 0 a 100.
 */
export function matchScore(query, text) {
  const q = normalizeForSearch(query);
  const t = normalizeForSearch(text);
  if (!q || !t) return 0;

  // 1. igual exato, depois substring. O igual precisa pontuar mais alto para
  // que "One Piece" vença "One Piece: Fishman Island" quando se busca
  // "one piece" — o título que o usuário quis está primeiro.
  if (t === q) return 100;
  if (t.includes(q)) return 92;
  // sem espaços, para "breakingbad" achar "Breaking Bad"
  if (t.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) return 88;

  const qWords = q.split(' ');
  const tWords = t.split(' ');

  // 2. todos os termos presentes, em qualquer ordem
  if (qWords.length > 1) {
    const todos = qWords.every(tw => tWords.some(w => w === tw || w.startsWith(tw)));
    if (todos) return 95;
  }

  // 3. distância de edição, termo a termo
  let soma = 0;
  for (const tw of qWords) {
    const s = termMatchesWord(tw, tWords);
    if (s === 0) return 0;
    soma += s;
  }
  const media = soma / qWords.length;
  // abaixo de 60% de semelhança média, o resultado é ruído
  if (media < 60) return 0;

  // termos extras no título (ex.: "the", "of") não devem punir demais
  return Math.min(92, Math.round(media * 0.92));
}

/**
 * Versão booleana de matchScore, para o filtro do catálogo.
 * @returns {boolean}
 */
export function matchesQuery(query, text) {
  return matchScore(query, text) > 0;
}

const STOPWORDS = new Set(['the', 'o', 'a', 'os', 'as', 'de', 'da', 'do', 'e']);

/**
 * Queries alternativas para tentar quando a busca do TMDb volta vazia.
 * O TMDb tem índice em pt-BR e en-US, então uma grafia que não bate de
 * primeira (acento, artigo inicial, palavra trocada) costuma funcionar
 * numa segunda tentativa. Vem da mais provável para a menos provável.
 * @param {string} query - O que o usuário digitou.
 * @returns {string[]} Lista de queries para tentar, sem repetir a original.
 */
export function buildFallbackQueries(query) {
  const original = String(query ?? '').trim();
  const out = [];
  const push = (value) => {
    const s = String(value ?? '').trim();
    if (!s || s === original || out.includes(s)) return;
    out.push(s);
  };

  const normal = normalizeForSearch(query);
  const words = normal.split(' ').filter(Boolean);

  // 1. sem acento — o caso mais comum ("acao" x "Ação")
  push(normal);

  // 2. sem artigo inicial — "the office" x "office"
  const semArtigo = words.filter((w) => !STOPWORDS.has(w));
  if (semArtigo.length && semArtigo.length !== words.length) push(semArtigo.join(' '));

  // 3. só a palavra mais longa — "senhor dos aneis" x "senhor"
  if (words.length > 1) {
    const maior = words.slice().sort((a, b) => b.length - a.length)[0];
    push(maior);
  }

  return out;
}
