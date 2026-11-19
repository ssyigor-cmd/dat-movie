/**
 * O toast é `position:fixed` e vive fora das telas — serve para todas, inclusive
 * a de pesquisa. O estado oculto, portanto, precisa esconder de verdade: um
 * `translateY(100px)` não basta quando o `bottom` já é ~86px (ou ~120px com a
 * safe-area do iPhone), e a mensagem ficava colada na tela para sempre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'mobile.html'), 'utf8');

function regra(seletor) {
  const ini = html.indexOf(`${seletor} {`);
  expect(ini, seletor).toBeGreaterThan(-1);
  return html.slice(ini, html.indexOf('}', ini));
}

describe('toast do mobile', () => {
  it('o estado oculto some de fato, não só por transform', () => {
    const base = regra('.toast');
    expect(base).toContain('opacity:0');
    expect(base).toContain('visibility:hidden');
    expect(base).toContain('pointer-events:none');
  });

  it('o estado visível restaura opacidade e visibilidade', () => {
    const visivel = regra('.toast.show');
    expect(visivel).toContain('opacity:1');
    expect(visivel).toContain('visibility:visible');
    expect(visivel).toContain('pointer-events:auto');
    expect(visivel).toContain('transform:translateX(-50%) translateY(0)');
  });
});
