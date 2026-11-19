/**
 * Bandeiras a partir de ISO 3166-1 alpha-2 — compartilhado entre o modal
 * de detalhes do desktop (src/components/titleInfoModal.js) e o do mobile
 * (src/mobile.js). A URL é validada pelo mesmo regex do emoji, então nenhum
 * dado cru do TMDB vira URL.
 */

/** Converte `US` no emoji 🇺🇸; entrada inválida vira string vazia. */
export function flagEmoji(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/** SVG vetorial do flagcdn (o emoji não é bandeira no Windows). */
export function flagUrl(iso2) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}
