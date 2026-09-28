import { describe, it, expect } from 'vitest';
import { pickCanonicalLogo } from '../src/lib/logoPicker.js';

const br = { file_path: '/pt-br.png', iso_639_1: 'pt', iso_3166_1: 'BR', vote_average: 5, vote_count: 2, width: 1764 };
const pt = { file_path: '/pt-pt.png', iso_639_1: 'pt', iso_3166_1: 'PT', vote_average: 5.4, vote_count: 30, width: 1785 };
const ptSemPais = { file_path: '/pt-generico.png', iso_639_1: 'pt', vote_average: 5.1, vote_count: 9, width: 1000 };
const en = { file_path: '/en.png', iso_639_1: 'en', iso_3166_1: 'US', vote_average: 5.8, vote_count: 80, width: 1200 };
const semIdioma = { file_path: '/null.png', iso_639_1: null, vote_average: 5.9, vote_count: 90, width: 2000 };

describe('pickCanonicalLogo', () => {
  it('prefere pt-BR mesmo com menos votos que pt-PT', () => {
    expect(pickCanonicalLogo([pt, br])).toBe('https://image.tmdb.org/t/p/w500/pt-br.png');
  });

  it('cai para pt de outro país quando não há pt-BR', () => {
    expect(pickCanonicalLogo([semIdioma, pt])).toBe('https://image.tmdb.org/t/p/w500/pt-pt.png');
  });

  it('trata logo pt sem país como pt-BR válido', () => {
    expect(pickCanonicalLogo([ptSemPais, en])).toBe('https://image.tmdb.org/t/p/w500/pt-generico.png');
  });

  it('prefere en-US a pt de outro país', () => {
    expect(pickCanonicalLogo([pt, en])).toBe('https://image.tmdb.org/t/p/w500/en.png');
  });

  it('usa logo sem idioma por último', () => {
    expect(pickCanonicalLogo([semIdioma])).toBe('https://image.tmdb.org/t/p/w500/null.png');
  });

  it('desempata por votação, votos e largura dentro do grupo', () => {
    const fraco = { file_path: '/fraco.png', iso_639_1: 'pt', iso_3166_1: 'BR', vote_average: 4, vote_count: 50, width: 3000 };
    const medio = { file_path: '/medio.png', iso_639_1: 'pt', iso_3166_1: 'BR', vote_average: 5, vote_count: 5, width: 1000 };
    const forte = { file_path: '/forte.png', iso_639_1: 'pt', iso_3166_1: 'BR', vote_average: 5, vote_count: 40, width: 1000 };
    expect(pickCanonicalLogo([fraco, medio, forte])).toBe('https://image.tmdb.org/t/p/w500/forte.png');
  });

  it('escolhe o clássico quando o do arco atual tem menos votos', () => {
    const classico = { file_path: '/classico.png', iso_639_1: null, vote_average: 5.6, vote_count: 40, width: 1000 };
    const arcoAtual = { file_path: '/arco.png', iso_639_1: null, vote_average: 5.2, vote_count: 6, width: 2000 };
    expect(pickCanonicalLogo([arcoAtual, classico])).toBe('https://image.tmdb.org/t/p/w500/classico.png');
  });

  it('aceita tamanho customizado', () => {
    expect(pickCanonicalLogo([br], { size: 'w300' })).toBe('https://image.tmdb.org/t/p/w300/pt-br.png');
  });

  it('aceita preferências customizadas', () => {
    const prefs = [{ lang: 'en', country: 'US' }, { lang: null, country: null }];
    expect(pickCanonicalLogo([br, en], { preferences: prefs })).toBe('https://image.tmdb.org/t/p/w500/en.png');
  });

  it('mantém URL absoluta de outro host (ex.: Fanart)', () => {
    const fanart = { file_path: 'https://fanart.tv/media/abc.png', vote_average: 5, vote_count: 2, width: 900 };
    expect(pickCanonicalLogo([fanart])).toBe('https://fanart.tv/media/abc.png');
  });

  it('ignora entradas sem file_path', () => {
    expect(pickCanonicalLogo([{ iso_639_1: 'pt' }, br])).toBe('https://image.tmdb.org/t/p/w500/pt-br.png');
  });

  it('retorna null para lista vazia ou inválida', () => {
    expect(pickCanonicalLogo([])).toBeNull();
    expect(pickCanonicalLogo(null)).toBeNull();
    expect(pickCanonicalLogo([{ vote_average: 5 }])).toBeNull();
  });

  it('não altera a lista de entrada', () => {
    const input = [pt, br];
    pickCanonicalLogo(input);
    expect(input[0]).toBe(pt);
    expect(input[1]).toBe(br);
  });
});
