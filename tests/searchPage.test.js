/**
 * Prende a fiação da tela de pesquisa com filtros.
 *
 * A parte pura (parâmetros do discover, modo busca/discover) é testada em
 * `discoverSearch.test.js`. Aqui garantimos que a interface existe, que o
 * main.js usa o componente (e não a busca inline antiga) e que a decisão de
 * produto "sem nota" está respeitada — nada de `vote_average`/`vote_count`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const main = readFileSync(join(raiz, 'src/main.js'), 'utf8');
const pagina = readFileSync(join(raiz, 'src/components/searchPage.js'), 'utf8');
const lib = readFileSync(join(raiz, 'src/lib/discoverSearch.js'), 'utf8');

describe('interface da pesquisa avançada', () => {
  const ids = [
    'advFilters', 'advFiltersCount', 'advFiltersPanel', 'advGenres', 'advCountries',
    'advCertification', 'advRuntime', 'advLanguage', 'advStatus', 'advType', 'advSort',
    'advYearFrom', 'advYearTo', 'advClear', 'pesquisaSummary', 'pesquisaMore', 'pesquisaMoreBtn'
  ];

  it('tem todos os pontos de montagem no HTML', () => {
    for (const id of ids) {
      expect(html, `faltou #${id}`).toContain(`id="${id}"`);
    }
  });

  it('o main.js monta a tela pelo componente, não mais inline', () => {
    expect(main).toContain("import { setupSearchPage } from './components/searchPage.js'");
    expect(main).toContain('setupSearchPage({ onOpenTitle: openTitlePageForSearch })');
    // A busca inline antiga chamava callTMDB('search/tv') dentro do listener.
    expect(main).not.toContain("callTMDB('search/tv', { query: q }");
  });

  it('carregar mais e limpar filtros têm handler', () => {
    expect(pagina).toContain('moreBtn.addEventListener');
    expect(pagina).toContain('clearBtn.addEventListener');
    expect(pagina).toContain('searchTitles');
  });

  it('seleção rápida de vários filtros não é descartada', () => {
    // Um guard de "ocupado" faria o segundo clique em gênero/país não buscar.
    // A corrida é resolvida por sequência: só a resposta mais recente aplica.
    expect(pagina).not.toContain('if (busy) return');
    expect(pagina).toMatch(/my !== seq/);
    expect(pagina).toMatch(/const my = \+\+seq/);
  });

  it('carregar mais descarta títulos já carregados (mesmo id)', () => {
    expect(pagina).toMatch(/const known = new Set\(results\.map\(i => String\(i\.id\)\)\)/);
    expect(pagina).toMatch(/if \(known\.has\(id\)\) return false/);
  });

  it('chip de gênero/país alterna incluir, excluir e neutro', () => {
    expect(pagina).toContain('readChipStates');
    expect(pagina).toContain("classList.toggle('active', proximo === 'include')");
    expect(pagina).toContain("classList.toggle('excluded', proximo === 'exclude')");
    expect(pagina).toMatch(/closest\('\.adv-chip'\)/);
  });

  it('a barra superior esconde a cápsula de filtros na aba Pesquisar', () => {
    // Status/tier, ordenar, agrupar e densidade agem sobre a grade do
    // catálogo, que na Pesquisar está escondida. Sem isso fica um grupo de
    // botões mortos ao lado do campo de busca.
    expect(main).toMatch(/toolbarFilters\.style\.display\s*=\s*state\.currentTab === 'pesquisa' \? 'none'/);
  });
});

describe('decisão de produto: sem nota', () => {
  // Ignora comentários: o porquê da decisão mora no JsDoc e pode citar os nomes.
  const soCodigo = lib
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n');

  it('a lib não monta filtro nem ordena por nota', () => {
    expect(soCodigo).not.toMatch(/vote_average/);
    expect(soCodigo).not.toMatch(/vote_count/);
  });

  it('a interface não tem campo de nota', () => {
    expect(html).not.toMatch(/id="adv(Vote|Rating|Nota)/i);
    expect(html.toLowerCase()).not.toContain('nota mínima');
  });
});
