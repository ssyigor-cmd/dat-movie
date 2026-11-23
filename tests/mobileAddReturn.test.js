/**
 * Regressão: depois de adicionar um título no mobile, o app deve voltar para
 * a tela de origem (pesquisa, home, roleta...) — não ficar no detalhe.
 *
 * Antes, addRouletteTitle trocava o hash por #/titulo/<novo id> e fazia
 * location.reload(), mantendo a tela de detalhe aberta. O desktop já volta
 * (titlePage.js chama onBack() depois de onCreateItem); esta é a paridade.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = readFileSync(join(raiz, 'src/mobile.js'), 'utf8');
const titlePage = readFileSync(join(raiz, 'src/pages/titlePage.js'), 'utf8');

/** Recorta o corpo de uma `function nome(...) { ... }` por contagem de chaves. */
function corpoDe(codigo, nome) {
  const inicio = codigo.indexOf(`function ${nome}(`);
  if (inicio < 0) return '';
  const abertura = codigo.indexOf('{', codigo.indexOf(') {', inicio));
  if (abertura < 0) return '';
  let profundidade = 0;
  for (let i = abertura; i < codigo.length; i++) {
    if (codigo[i] === '{') profundidade++;
    else if (codigo[i] === '}') {
      profundidade--;
      if (profundidade === 0) return codigo.slice(inicio, i + 1);
    }
  }
  return '';
}

describe('adicionar título no mobile volta para a tela de origem', () => {
  it('addRouletteTitle volta com hideTitlePage em vez de recarregar no detalhe', () => {
    const codigo = corpoDe(mobile, 'addRouletteTitle')
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(codigo).toContain('hideTitlePage()');
    expect(codigo).toContain('showToast(');
    expect(codigo).not.toContain('location.reload()');
    expect(codigo).not.toContain('#/titulo/');
  });

  it('não usa mais o toast via sessionStorage (que só existia por causa do reload)', () => {
    expect(mobile).not.toContain('datmovie_added_toast');
  });

  it('hideTitlePage retorna à tela de origem e limpa o hash da tela de detalhe', () => {
    const hide = corpoDe(mobile, 'hideTitlePage');
    expect(hide).toContain('switchScreen(titleOriginScreen || \'catalog\')');
    const switchScreen = corpoDe(mobile, 'switchScreen');
    expect(switchScreen).toMatch(/name !== 'title'[\s\S]*?location\.hash\.startsWith\('#\/titulo\/'\)/);
    expect(switchScreen).toContain('history.replaceState');
  });

  it('mantém paridade com o desktop, que chama onBack após criar o item', () => {
    const inicio = titlePage.indexOf("const addBtn = container.querySelector('#titleAdd');");
    const fim = titlePage.indexOf('const cancelBtn', inicio);
    const criar = titlePage.slice(inicio, fim);
    expect(criar).toMatch(/await onCreateItem\(payload\)[\s\S]*?onBack\(\)/);
  });
});
