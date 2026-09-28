/**
 * titleFilters - Filtros de qualidade de conteúdo aplicados às listas da home.
 *
 * Motivo: o TMDB devolve lixo em listas de catálogo (títulos com data de 2040,
 * títulos cujo nome só existe em japonês/chinês/coreano/sânscrito e itens sem
 * pôster). Esses itens quebravam a curadoria e ocupavam vaga na lista.
 *
 * Nenhum filtro aqui é absoluto: `pickWithMix` os aplica em ordem e relaxa o
 * menos importante quando a lista ficaria curta demais.
 */

/**
 * Alfabetos não latinos. Um título só é considerado "estritamente estranho" quando
 * tem letra desses alfabetos e nenhuma letra latina. Séries chinesas, coreanas,
 * japonesas e indianas continuam entrando normalmente quando têm título em
 * alfabeto latino (ex.: "Shogun", "Round 6", "Naruto").
 * Círilico e grego ficam de fora de propósito: chegam transliterados no pt-BR.
 */
export const NON_LATIN_SCRIPTS = [
  'Han', 'Hiragana', 'Katakana', 'Hangul',
  'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya',
  'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala',
  'Arabic', 'Hebrew', 'Syriac', 'Thaana',
  'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Khmer',
  'Georgian', 'Armenian', 'Ethiopic'
];

const HAS_LATIN = /\p{Script=Latin}/u;
const LETTERS = /\p{L}/gu;
const NON_LATIN_TESTS = NON_LATIN_SCRIPTS.map(script => new RegExp(`\\p{Script=${script}}`, 'u'));

/**
 * Conta as letras de um texto separando alfabeto latino dos demais.
 * @param {string} value - Texto.
 * @returns {{latin:number, nonLatin:number}} Quantidade de letras de cada tipo.
 */
function countLetters(value) {
  let latin = 0;
  let nonLatin = 0;
  for (const char of value.match(LETTERS) || []) {
    if (HAS_LATIN.test(char)) latin += 1;
    else if (NON_LATIN_TESTS.some(re => re.test(char))) nonLatin += 1;
  }
  return { latin, nonLatin };
}

/**
 * Detecta título cujo texto é predominantemente de um alfabeto não latino.
 *
 * Não basta ter letra latina: `聚宝仙盆之杂灵根才是真BOSS` termina em "BOSS" e
 * passaria num teste simples, sendo 11 caracteres chineses contra 4 latinos.
 * Conta-se a proporção, e o título só é aceito quando o alfabeto não latino
 * não domina. Assim "Shogun", "Round 6" e "Naruto" continuam entrando.
 * @param {...(string|null|undefined)} texts - Textos a verificar (título exibido e variações).
 * @returns {boolean} true se algum texto for predominantemente não latino.
 */
export function isStrictlyNonLatinTitle(...texts) {
  for (const text of texts) {
    const value = String(text || '').trim();
    if (!value) continue;
    const { latin, nonLatin } = countLetters(value);
    if (nonLatin > 0 && nonLatin > latin) return true;
  }
  return false;
}

/** Dias de tolerância para estreia futura (anúncios legíveis ficam, data absurda não). */
export const MAX_FUTURE_DAYS = 365;

function parseLocalDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Data de estreia improvável (ex.: 2030, 2040) vinda do catálogo do TMDB.
 * @param {string|Date} value - Data.
 * @param {Date} [now] - Referência.
 * @param {number} [toleranceDays] - Folga aceitável para anúncios.
 * @returns {boolean} true se a data for distante demais no futuro.
 */
export function isAbsurdFutureDate(value, now = new Date(), toleranceDays = MAX_FUTURE_DAYS) {
  const date = parseLocalDate(value);
  if (!date) return false;
  const nowTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return date.getTime() - nowTime > toleranceDays * 86400000;
}

/**
 * Produções de canal do YouTube e vídeo caseiro/amador.
 *
 * Proibido por decisão do usuário. Duas defesas, porque os ids do TMDB cobrem
 * só o que já foi mapeado e o texto cobre o que vier:
 *
 *  1. `BLOCKED_TMDB_IDS` — ids conferidos um a um contra `tv/{id}` no TMDB,
 *    olhando rede (`networks`) e produtora. Só entram ids cuja rede é
 *    YouTube / YouTube Premium / YouTube Red ou canal conhecido.
 *  2. `BLOCKED_TITLE_PATTERNS` — marcação de canal ("se inscreva", "vlog",
 *     "temporada 3 completa") e de filmagem caseira.
 *
 * A lista por id NÃO foi montada por busca por nome: `search/tv` devolve
 * homônimos legítimos (buscar "Ninja" devolveu As Tartarugas Ninjas, e "Jingle"
 * devolveu um filme de Natal), então cada id foi confirmado nos detalhes antes
 * de entrar.
 */
export const BLOCKED_TMDB_IDS = new Set([
  // Cobra Kai (77169) saiu de propósito: foi YouTube Original, mas hoje é
  // Netflix. O usuário decidiu que só vale barrar o que é do YouTube hoje.
  78670,   // Impulse — YouTube Premium
  84231,   // Wayne — YouTube Premium
  67235,   // Escape the Night — YouTube Premium / YouTube Red
  274753,  // Smosh Mouth — YouTube
  68833,   // Scare PewDiePie — YouTube Red
  67148,   // Haters Back Off! — YouTube Red
  76818,   // Chicken Girls — canal (Brat TV/YouTube)
  66118,   // The Katering Show — YouTube
  65701,   // Good Mythical Morning — YouTube
  38949,   // A gURLs wURLd (Troom Troom) — canal Troom Troom
  124837   // De Vlog van Fée (VanVlog) — canal VanVlog
]);

/**
 * Padrões de texto que indicam canal do YouTube, marcação de canal ou vídeo
 * caseiro. Aplicados sobre texto normalizado (sem acento, minúsculo, sem
 * pontuação).
 *
 * Deliberadamente apertados: padrões genéricos como `fandom`, `bts` ou
 * `animatronic` foram descartados porque caem em produção legítima (Five Nights
 * at Freddy's, por exemplo).
 */
export const BLOCKED_TITLE_PATTERNS = [
  // marcação de canal
  /youtube/,
  /yt original/,
  /vlog/,
  /vlogs/,
  /se inscreva/,
  /inscreva se/,
  /inscreva se no canal/,
  /clique aqui/,
  /link na bio/,
  /me inscreva/,
  /deixe o like/,
  // nomeação de upload / pirataria de catálogo
  /temporada \d+ completa/,
  /temporadas completas/,
  /episodio \d+ completo/,
  /filme completo/,
  /completo dublado/,
  /dublado completo/,
  /completo em hd/,
  /full movie/,
  /full episode/,
  /official full/,
  // vídeo caseiro / amador
  /home video/,
  /video caseiro/,
  /filme caseiro/,
  /camera caseira/,
  /found footage/,
  /vlog de familia/,
  /familia vlog/,
  /familia exibindo/,
  /tour da minha casa/,
  /meu dia a dia/,
  /diario de videos/,
  /gravado com o celular/
];

/**
 * Normaliza texto para comparação de padrões: sem acento, minúsculo, sem
 * pontuação e com espaços colapsados.
 * @param {string} value - Texto.
 * @returns {string} Texto normalizado.
 */
export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta produção de canal do YouTube ou vídeo caseiro/amador.
 *
 * Três sinais: id na lista bloqueada, padrão no título e padrão na sinopse (o
 * TMDB costuma marcar "YouTube"/"vlog" só no overview, com o título limpo).
 * @param {Object} item - Item normalizado ou cru do TMDB.
 * @returns {boolean} true se o título for proibido.
 */
export function isBlockedProduction(item) {
  if (!item) return false;
  const id = item.id ?? item.tmdb_id;
  if (id != null && BLOCKED_TMDB_IDS.has(Number(id))) return true;

  const raw = item.raw && typeof item.raw === 'object' ? item.raw : {};
  const texts = [
    displayTitle(item),
    raw.name,
    raw.title,
    raw.original_name,
    raw.overview,
    item.overview
  ].filter(Boolean);

  return texts.some(text => {
    const norm = normalizeText(text);
    if (!norm) return false;
    return BLOCKED_TITLE_PATTERNS.some(re => re.test(norm));
  });
}

/**
 * Idiomas de produção aceitos na home.
 *
 * Decisão do usuário: a home é para conteúdo mainstream de origem anglófona,
 * mais japonês e coreano, porque boa parte do anime/dorama já virou produção
 * de grande público. Fora disso entrou produção turca, árabe, indiana, francesa
 * e italiana que nada tem a ver com a home.
 *
 * Medido no pool real (1.800 itens em 6 categorias × 3 ordenações):
 * `en` 750, `ja` 348, `zh` 167, `ko` 77, `pt` 64, `es` 50, `th` 46, `fr` 42,
 * `ar` 35, `hi` 21, `de` 21, `ru` 17, `id` 14, `nl` 11, `tr` 11, `ms` 10.
 * Manter en+ja+ko preserva 65,3% do pool, bem acima do necessário para
 * preencher 20 cards.
 */
export const ALLOWED_ORIGINAL_LANGUAGES = new Set(['en', 'ja', 'ko']);

/**
 * Idioma original do item, nos formatos normalizado e cru do TMDB.
 * @param {Object} item - Item.
 * @returns {string} Código ISO 639-1 em minúscula (string vazia se ausente).
 */
export function readOriginalLanguage(item) {
  if (!item) return '';
  const raw = item.raw && typeof item.raw === 'object' ? item.raw : {};
  const value = item.original_language ?? item.originalLanguage ?? raw.original_language;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Item dentro dos idiomas aceitos.
 *
 * Falha aberta de propósito: se o campo não vier, o item passa. Dado medido no
 * pool real mostra `original_language` presente em 100% dos itens, então o
 * fallback nunca deve disparar; se um dia o TMDB mudar o payload, a home
 * degrada para "mostra tudo" em vez de esvaziar as listas.
 * @param {Object} item - Item normalizado ou cru do TMDB.
 * @returns {boolean} true se o idioma for aceito.
 */
export function isAllowedLanguage(item) {
  const lang = readOriginalLanguage(item);
  if (!lang) return true;
  return ALLOWED_ORIGINAL_LANGUAGES.has(lang);
}

/**
 * Item com pelo menos uma arte utilizável (pôster ou backdrop).
 *
 * Precisa aceitar os dois formatos: o normalizado da home (`posterUrl`,
 * `posterPath`, ou o TMDB aninhado em `raw`) e o objeto cru do TMDB
 * (`poster_path` direto), que é o que os carrosséis de trending/categoria
 * entregam ao scorer.
 * @param {Object} item - Item normalizado ou cru do TMDB.
 * @returns {boolean} true se houver imagem.
 */
export function hasArtwork(item) {
  if (!item) return false;
  const raw = item.raw && typeof item.raw === 'object' ? item.raw : {};
  return Boolean(
    item.posterUrl
    || item.posterPath
    || item.poster_path
    || item.backdrop_path
    || raw.poster_path
    || raw.backdrop_path
    || raw.profile_path
    || raw.still_path
  );
}

/**
 * Título exibido do item, considerando o formato normalizado e o cru do TMDB.
 * @param {Object} item - Item.
 * @returns {string} Título (string vazia se ausente).
 */
export function displayTitle(item) {
  if (!item) return '';
  return String(item.title || item.name || item.raw?.name || item.raw?.title || item.raw?.original_name || '');
}
