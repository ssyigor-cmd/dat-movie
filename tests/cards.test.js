import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cardMarkup } from '../src/components/cards.js';
import { escapeHTML } from '../src/lib/catalog.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'style.css'), 'utf8');

/**
 * `cardMarkup` é o único lugar do projeto que escreve a anatomia de um card.
 * Estes testes existem porque "um modelo só" é uma afirmação que apodrece
 * sozinha: basta uma tela montar o `<div class="card-body">` no próprio template
 * para o segundo modelo voltar, e ele volta sempre em silêncio — aparece só
 * como "aqui a fonte é outra".
 */
describe('cardMarkup: a anatomia do card', () => {
  const completo = cardMarkup({
    posterUrl: 'https://image.tmdb.org/t/p/w500/x.jpg',
    titleHtml: escapeHTML('Breaking Bad') + ' (2008)',
    titleAttr: 'Breaking Bad (2008)',
    stampHtml: '<div class="tier-stamp tier-S">S</div>',
    extraHtml: '<div class="progress-wrap"></div>'
  });

  it('tem pôster 2/3 e corpo, nessa ordem', () => {
    expect(completo.indexOf('class="card-img"')).toBeLessThan(completo.indexOf('class="card-body"'));
    expect(completo).toContain('class="card-body"');
  });

  it('põe o título dentro da imagem, e o corpo vem depois', () => {
    // O nome mora sobre o pôster — hover escurece e mostra, toque revela — e
    // não no rodapé: se ele voltar para dentro de `.card-body`, a barra de
    // progresso volta a ser empurrada por texto que não é dela.
    const img = completo.slice(completo.indexOf('class="card-img"'), completo.indexOf('class="card-body"'));
    expect(img).toContain('class="card-title"');
    const corpo = completo.slice(completo.indexOf('class="card-body"'));
    expect(corpo).not.toContain('<h3');
    expect(corpo).toContain('class="progress-wrap"');
  });

  it('no toque, o primeiro clique revela o nome e o segundo entra no card', () => {
    // Sem hover não existe passar o mouse: o contrato é um clique para ver o
    // nome e outro para abrir. O CSS precisa responder à mesma classe que o
    // JS aplica — os dois lados do contrato, cada um no seu arquivo.
    const src = readFileSync(join(raiz, 'src/components/cards.js'), 'utf8');
    expect(src).toContain("matchMedia('(hover: none)')");
    expect(src).toContain("'is-revealed'");
    expect(css).toMatch(/\.card\.is-revealed \.card-img::after[^}]*opacity:\s*1/);
    expect(css).toMatch(/\.card\.is-revealed \.card-title[^}]*opacity:\s*1/);
  });

  it('esconde as peças que a tela não tem, em vez de renderizar vazio', () => {
    const semNada = cardMarkup({ titleHtml: 'X', titleAttr: 'X' });
    expect(semNada).not.toContain('class="progress-wrap"');
    expect(semNada).not.toContain('class="tier-stamp"');
  });

  it('usa o mesmo placeholder de pôster em toda tela', () => {
    // Havia `fa-video` com `style` inline no Catálogo e `fa-film` com regra
    // CSS na Home: o mesmo vão vazio em dois tamanhos, um deles fora da folha.
    const semPoster = cardMarkup({ titleHtml: 'X', titleAttr: 'X' });
    expect(semPoster).toContain('<i class="fas fa-film"></i>');
    expect(semPoster).not.toMatch(/<i[^>]*\sstyle=/);
    expect(css).toMatch(/^\.card-img i \{[^}]*font-size/m);
  });

  it('escapa o texto do atributo title uma vez só', () => {
    // O `title` é puro e escapado aqui; o `titleHtml` vem já escapado de quem
    // chama. Derivar um do outro (removendo tags do HTML) escaparia em dobro
    // num nome com `&`.
    const comAmp = cardMarkup({ titleHtml: 'A &amp; B', titleAttr: 'A & B' });
    expect(comAmp).toContain('title="A &amp; B"');
    expect(comAmp).not.toContain('&amp;amp;');
  });
});

describe('cardMarkup: uma anatomia, uma escrita', () => {
  it('só cards.js escreve a estrutura do card', () => {
    const arquivos = ['components/cards.js', 'components/homePage.js', 'main.js'];
    for (const arq of arquivos) {
      const src = readFileSync(join(raiz, 'src', arq), 'utf8');
      // `.card-img` e `.card-body` no template de quem monta o card é o
      // segundo modelo começando a existir de novo.
      for (const tag of ['<div class="card-img"', '<div class="card-body"']) {
        const dono = arq === 'components/cards.js' ? 1 : 0;
        expect([...src.matchAll(new RegExp(tag.replace(/[<>"]/g, '\\$&'), 'g'))].length, `${arq}: ${tag}`).toBe(dono);
      }
    }
  });
});
