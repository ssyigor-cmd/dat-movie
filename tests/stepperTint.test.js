import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comentários saem antes de tudo: os de cascade citam o próprio seletor
// que estão explicando, e um teste que lê o texto da explicação passa
// por acaso — achando a regra dentro de um parágrafo sobre ela.
const css = readFileSync(join(raiz, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Devolve as declarações de uma regra simples (sem aninhamento). */
function bloco(seletor) {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(escapado + '[^{]*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

/**
 * Hover dos steppers de temporada/episódio: o sentido vira cor.
 *
 * Somar fica levemente verde, subtrair levemente vermelho. O que este
 * teste protege é o Title Page, cujos botões só têm `data-step` e por
 * isso caem num hover genérico que APAGA o fundo com `!important`. Se
 * alguém tirar o `:not(.stepper-plus)` da
 * especificidade, ou trocar o sinal do mapeamento, o hover volta ao
 * cinza e ninguém percebe até alguém reclamar.
 */
describe('steppers do Title Page: somar verde, subtrair vermelho', () => {
  it('a base declara as duas tintas translúcidas, que valem nos dois temas', () => {
    const root = css.match(/:root\s*\{([\s\S]*?)\}/);
    expect(root, 'bloco :root existe').not.toBeNull();
    const verde = root[1].match(/--success-soft:\s*([^;]+);/);
    const vermelho = root[1].match(/--danger-soft:\s*([^;]+);/);
    expect(verde, '--success-soft no :root').not.toBeNull();
    expect(vermelho, '--danger-soft no :root').not.toBeNull();
    // Translúcida de propósito: o fundo aparece embaixo, então o mesmo
    // valor serve no escuro e no claro sem override.
    expect(verde[1]).toMatch(/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.15\s*\)/);
    expect(vermelho[1]).toMatch(/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.15\s*\)/);
  });

  it('mapeia o sinal para a cor certa, com fundo importante e sem apagar', () => {
    const sobe = bloco('.title-page .poster-stepper-btn[data-step="1"]:not(.stepper-plus):hover');
    const desce = bloco('.title-page .poster-stepper-btn[data-step="-1"]:not(.stepper-plus):hover');
    expect(sobe, 'regra do +').not.toBeNull();
    expect(desce, 'regra do -').not.toBeNull();
    expect(sobe).toContain('background: var(--success-soft) !important');
    expect(sobe).toContain('color: var(--success-text) !important');
    expect(desce).toContain('background: var(--danger-soft) !important');
    expect(desce).toContain('color: var(--danger-text) !important');
    // O apagador (`background: none`, `opacity: 0.7`) também é importante:
    // ou a regra vence por especificidade, ou o tinte não aparece.
    expect(sobe).toContain('opacity: 1 !important');
    expect(desce).toContain('opacity: 1 !important');
  });

  it('o tinte entra suave: transition no estado base dos botões', () => {
    const base = bloco('.title-page .poster-stepper-btn[data-step]');
    expect(base, 'regra base com data-step').not.toBeNull();
    expect(base).toContain('transition');
    expect(base).toMatch(/transition:[^;]*background/);
  });
});
