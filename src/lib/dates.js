/**
 * dates - Leitura de data no fuso local.
 *
 * `new Date('2026-09-27')` é interpretado como UTC e, em fuso negativo (o
 * Brasil é UTC-3), cai no dia anterior. Como o app compara data de estreia com
 * "hoje" para decidir o que é futuro, isso errava a data por um dia.
 *
 * Era a única lógica duplicada entre `recommendScoring` e `titleFilters`, com o
 * mesmo corpo nas duas: agora existe em um lugar só. Módulo folha, sem imports,
 * para poder ser usado por qualquer camada sem risco de ciclo.
 */

/**
 * @param {string|Date} value - Data ISO ("YYYY-MM-DD"), outro formato aceito por `Date`, ou `Date`.
 * @returns {Date|null} Data no fuso local, ou null quando inválida.
 */
export function parseLocalDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
