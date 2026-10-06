import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comentários saem antes de tudo: eles citam seletor e até valores de sombra
// antigos ao explicar o que mudou, e um teste que lê o próprio texto de
// explicação pode passar ou falhar por causa delas.
const css = readFileSync(join(raiz, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * O projeto não usa halo: nenhum elemento brilha na cor de destaque.
 *
 * Isto é uma regra de aparência, e regras de aparência voltam sem aviso —
 * alguém quer "realçar o item ativo", escreve `box-shadow` com a cor do
 * accent e o glow reaparece. Por isso a regra está em teste, e não só no
 * código.
 *
 * O que NÃO é glow e precisa sobreviver:
 *   - `0 0 0 Npx` → anel de foco e de erro de validação. É acessibilidade;
 *     tirar deixa quem navega pelo teclado sem saber onde está.
 *   - `rgba(0, 0, 0, ...)` → sombra de profundidade. Dropdown solto do nada
 *     some do contexto.
 *   - `var(--shadow)` / `var(--shadow-lg)` → as mesmas, por token.
 */
function boxShadows() {
  const achados = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const seletor = m[1].trim().replace(/\s+/g, ' ');
    const linha = css.slice(0, m.index).split('\n').length;
    for (const bs of m[2].matchAll(/box-shadow:\s*([^;]+);/g)) {
      achados.push({ seletor, linha, valor: bs[1].trim() });
    }
  }
  return achados;
}

const ehAnel = (v) => /(^|,\s*)0 0 0 [1-9]/.test(v);
const ehPreto = (v) => !/var\(--/.test(v) && /rgba\(\s*0\s*,\s*0\s*,\s*0/.test(v);
const ehTokenDeSombra = (v) => /var\(--shadow(-lg)?\)/.test(v);
const ehTokenDeAnel = (v) => /var\(--focus-ring\)/.test(v);
const ehNenhum = (v) => /^none/.test(v);

describe('glow: nenhum halo na cor de destaque', () => {
  it('não sobra nenhum box-shadow de cor clara que não seja anel', () => {
    const halos = boxShadows().filter(
      (s) => !ehNenhum(s.valor) && !ehAnel(s.valor) && !ehPreto(s.valor)
        && !ehTokenDeSombra(s.valor) && !ehTokenDeAnel(s.valor)
    );
    expect(
      halos.map((s) => `L${s.linha} ${s.seletor} → ${s.valor}`),
      'todo box-shadow restante ou é anel, ou é sombra preta de profundidade'
    ).toEqual([]);
  });

  it('não sobrou nenhum token com nome de glow', () => {
    // Havia `--accent-glow`, que nunca produziu brilho: só pintava a barra de
    // rolagem. O nome prometia um efeito que não existia.
    expect(css).not.toMatch(/--[a-z-]*glow[a-z-]*\s*:/);
  });
});

describe('glow: o que foi removido não era o estado', () => {
  it('os quatro halos que existiam perderam só o box-shadow', () => {
    // Cada um destes tinha um estado selecionado por outro meio. Se o halo
    // estava fazendo o trabalho, apagar a sombra deixa o item indistinguível
    // de um item comum — e isso é um defeito silencioso, do tipo que só
    // aparece para quem olha a tela.
    const alvos = [
      ['.nav-item.active', 'background: var(--accent-soft)'],
      ['.episode-item.episode-current', 'border-left: 3px solid var(--accent)'],
      ['.title-page .dm-status-btn.active', 'background: var(--accent)'],
      ['.title-status-overlay .dm-status-btn.active', 'background: var(--accent)']
    ];
    for (const [seletor, marca] of alvos) {
      const regra = css.match(new RegExp(`${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
      expect(regra, seletor).toBeTruthy();
      expect(regra[1], seletor).toContain(marca);
      expect(regra[1], seletor).not.toContain('box-shadow');
    }
  });
});

describe('glow: as sombras que continuam', () => {
  it('anel de foco e erro seguem no lugar', () => {
    // these are the accessibility ones; deleting them is a regression, not a cleanup
    const aneis = boxShadows().filter((s) => ehAnel(s.valor) && !ehPreto(s.valor));
    expect(aneis.length, 'aneis de foco/validacao preservados').toBeGreaterThan(0);
    expect(css).toMatch(/--focus-ring:\s*0 0 0 2px/);
    expect(css).toMatch(/:focus[^{]*\{[^}]*box-shadow/);
  });

  it('sombra de profundidade continua nos menus e modais', () => {
    expect(css).toMatch(/--shadow:\s*0 4px 16px/);
    expect(css).toMatch(/--shadow-lg:\s*0 8px 24px/);
    expect(css).toMatch(/\.modal\s*\{[^}]*var\(--shadow-lg\)/);
  });
});