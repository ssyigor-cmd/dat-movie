/**
 * Regressão: abrir um resultado da busca no mobile não pode oferecer
 * "Adicionar" para um título que já está no catálogo.
 *
 * Os cards externos do mobile (busca, tendências, roleta, histórico) passam
 * pelo openExternalPreview. Antes ele montava sempre um preview `_isPreview`,
 * então a tela de detalhe mostrava o botão de adicionar e o progresso/status
 * do item real eram perdidos. A correção procura o item pelo tmdb_id antes
 * de montar o preview — o mesmo que o desktop já faz em
 * openTitlePageForSearch (main.js).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = readFileSync(join(raiz, 'src/mobile.js'), 'utf8');
const main = readFileSync(join(raiz, 'src/main.js'), 'utf8');

/** Recorta o corpo de uma `function nome(...) { ... }` por contagem de chaves. */
function corpoDe(nome) {
  const inicio = mobile.indexOf(`function ${nome}(`);
  if (inicio < 0) return '';
  // Começa depois dos parâmetros: `opts = {}` tem chaves que não são o corpo.
  const abertura = mobile.indexOf('{', mobile.indexOf(') {', inicio));
  if (abertura < 0) return '';
  let profundidade = 0;
  for (let i = abertura; i < mobile.length; i++) {
    if (mobile[i] === '{') profundidade++;
    else if (mobile[i] === '}') {
      profundidade--;
      if (profundidade === 0) return mobile.slice(inicio, i + 1);
    }
  }
  return '';
}

describe('busca no mobile não duplica título já listado', () => {
  it('o mobile importa e usa a busca por tmdb_id do catálogo', () => {
    expect(mobile).toMatch(/import \{[\s\S]*?findInCatalogByTmdbId,[\s\S]*?\} from '\.\/lib\/catalog\.js'/);
  });

  it('openExternalPreview abre o item existente antes de montar o preview', () => {
    const corpo = corpoDe('openExternalPreview');
    expect(corpo).toMatch(/findInCatalogByTmdbId\(raw\?\.id, state\.items\)/);
    expect(corpo).toContain('if (existing)');
    const guarda = corpo.indexOf('findInCatalogByTmdbId');
    const preview = corpo.indexOf('openTitleFromCatalog({');
    expect(guarda).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(guarda);
  });

  it('openTitle também resolve ids do TMDB para o item do catálogo', () => {
    const corpo = corpoDe('openTitle');
    expect(corpo).toContain('findInCatalogByTmdbId');
    expect(corpo.indexOf('findInCatalogByTmdbId'))
      .toBeLessThan(corpo.indexOf('openExternalPreview(raw'));
  });

  it('mantém paridade com a regra já existente no desktop', () => {
    expect(main).toMatch(/state\.items\.find\(it => String\(it\.tmdb_id\) === String\(tmdbId\)\)/);
  });
});
