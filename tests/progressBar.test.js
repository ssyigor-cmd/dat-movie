import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'style.css'), 'utf8');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const main = readFileSync(join(raiz, 'src/main.js'), 'utf8');
const stateSrc = readFileSync(join(raiz, 'src/lib/state.js'), 'utf8');
const domSrc = readFileSync(join(raiz, 'src/lib/dom.js'), 'utf8');

/** O corpo da regra cujo seletor casa com `sel`. */
function regra(sel) {
  const m = css.match(new RegExp(`^([^\\n{}]*${sel}[^\\n{}]*)\\{([^}]*)\\}`, 'm'));
  return m ? { seletores: m[1].trim().split(',').map((s) => s.trim()), corpo: m[2] } : null;
}

/**
 * A barra de progresso é opcional, e o toggle mora no menu do perfil. O que
 * estes testes seguram é o alvo da preferência: que ela esconda o conjunto
 * inteiro, e não uma parte dele. A barra tem três peças — trilha, barra e
 * porcentagem — e esconder só uma delas deixa a linha fina e sem número, que
 * parece um defeito de layout em vez de uma escolha.
 */
describe('barra de progresso: a preferência', () => {
  it('esconde o conjunto inteiro, por classe no body, sem re-renderizar', () => {
    // Se a regra dependesse de passar um parâmetro para cada card, o toggle só
    // valeria para o que fosse desenhado depois dele — a Home já na tela ficaria
    // com a barra, e pareceria que o botão não funciona.
    const r = regra('is-progress-bar-hidden');
    expect(r).toBeTruthy();
    expect(r.corpo).toMatch(/display:\s*none/);
    expect(r.seletores.join(',')).toContain('.progress-wrap');
  });

  it('não deixa nenhuma peça para trás', () => {
    // As três peças são filhas do mesmo contêiner, então o alvo tem de ser o
    // contêiner. Se a regra apontar para `.progress-pct`, a trilha volta a
    // aparecer sozinha e o toggle entrega metade do que promete.
    const r = regra('is-progress-bar-hidden');
    const alvos = r.seletores.join(',');
    for (const peca of ['.progress-track', '.progress-bar', '.progress-pct']) {
      expect(alvos, `a regra não deveria mirar ${peca} diretamente`).not.toContain(peca);
    }
  });

  it('alcança as duas telas que desenham a barra', () => {
    // Catálogo e Home têm modelos de card separados, mas o contêiner é o mesmo.
    // Se só um deles emitir `.progress-wrap`, o toggle funciona em metade do app
    // sem nenhum aviso.
    const catalogos = ['src/components/cards.js', 'src/components/homePage.js'];
    for (const arq of catalogos) {
      const src = readFileSync(join(raiz, arq), 'utf8');
      expect(src, arq).toContain('class="progress-wrap"');
    }
  });

  it('aplica a classe pelo estado, e o estado vem do storage', () => {
    expect(main).toMatch(/document\.body\.classList\.toggle\(\s*'is-progress-bar-hidden'/);
    expect(stateSrc).toContain('showProgressBar:');
  });
});

describe('barra de progresso: o que sobrevive a um refresh', () => {
  it('grava e lê na mesma chave', () => {
    // `gridDensity` é lido de `gridDensity` e gravado em `state.gridDensity`:
    // a preferência não sobrevive ao refresh e nada avisa. As duas pontas têm
    // que citar a mesma constante, não a mesma string.
    const chave = stateSrc.match(/SHOW_PROGRESS_BAR:\s*'([^']+)'/);
    expect(chave).toBeTruthy();
    expect(stateSrc).toContain('localStorage.getItem(STORAGE_KEYS.SHOW_PROGRESS_BAR)');
    expect(main).toContain('localStorage.setItem(STORAGE_KEYS.SHOW_PROGRESS_BAR');
    expect(main).not.toContain(`'state.${chave[1]}'`);
  });

  it('padrão é mostrar, para quem não escolheu nada', () => {
    // O padrão muda a tela de quem só atualiza o app. Ausência de chave conta
    // como "não escolheu" — e não como "escolheu não ver".
    expect(stateSrc).toMatch(/showProgressBar:\s*localStorage\.getItem\(STORAGE_KEYS\.SHOW_PROGRESS_BAR\)\s*!==\s*'false'/);
  });
});

describe('barra de progresso: o item do menu', () => {
  it('é um checkbox nativo com rótulo', () => {
    // Native em vez de `<div role="switch">`: teclado, leitor de tela e
    // ESPAÇO funcionam sem código, e o desenho é `accent-color`, que já é o
    // padrão do app para checkbox.
    expect(html).toContain('<input type="checkbox" id="showProgressBar"');
    expect(html).toMatch(/<label[^>]*for="showProgressBar"/);
    expect(css).toMatch(/\.profile-pref input\[type="checkbox"\][^}]*accent-color:\s*var\(--accent\)/);
  });

  it('nomeia a barra, e não só a porcentagem', () => {
    // O rótulo diz o que o toggle faz. Chamar de "% de progresso" depois que
    // a barra inteira passou a sumir seria descrever outra coisa.
    expect(html).toContain('Mostrar barra de progresso');
    expect(html).not.toContain('Mostrar % de progresso');
  });

  it('está registrado no dom.js', () => {
    expect(domSrc).toContain("showProgressBar: $('showProgressBar')");
  });
});