import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
const api = readFileSync(join(raiz, 'src/lib/trendingApi.js'), 'utf8');
const css = readFileSync(join(raiz, 'style.css'), 'utf8');

/**
 * A seção "Em Breve" fica depois da descoberta por afinidade, no meio da
 * página: estreias são o que ainda vai acontecer, não o primeiro quadro. Os
 * testes prendem as decisões que sustentam isso — a posição no template, a
 * chamada na mesma ordem em `renderHome`, o pedido de data ao TMDB e o corpo
 * do cartão que carrega a estreia. Sem a data, o cartão é idêntico ao de
 * qualquer outro trilho e a seção não tem motivo de existir.
 */

describe('Em Breve: posição no template', () => {
  it('vem depois da descoberta por afinidade, e não abre a página', () => {
    const inicio = js.indexOf('id="homeUpcomingSection"');
    const saudacao = js.indexOf('id="homeContinueSection"');
    const afinidade = js.indexOf('id="homeAffinitySection"');
    expect(inicio, 'homeUpcomingSection').toBeGreaterThan(-1);
    expect(afinidade, 'homeAffinitySection').toBeGreaterThan(-1);
    // Abrir a página é Continuar: estreias são o que ainda vai acontecer,
    // não o primeiro quadro que a pessoa vê.
    expect(saudacao, 'depois de Continuar').toBeLessThan(inicio);
    expect(afinidade, 'depois da afinidade').toBeLessThan(inicio);
  });

  it('é uma seção como as outras: cabeçalho, trilho e esqueleto', () => {
    const i = js.indexOf('id="homeUpcomingSection"');
    const bloco = js.slice(i, js.indexOf('</section>', i));
    expect(bloco).toContain('class="home-section-head"');
    expect(bloco).toContain('Em Breve');
    // Trilho no grid e no esqueleto: a troca de um pelo outro não muda a
    // área rolável, senão a página "pula" quando os dados chegam.
    expect(bloco.match(/class="home-h-scroll/g), 'grid + esqueleto no trilho').toHaveLength(2);
    expect(bloco).toContain('id="homeUpcomingGrid"');
    expect(bloco).toContain('id="homeUpcomingSkeleton"');
    expect(bloco).toContain('home-skeleton');
    // Escondida até os dados chegarem: nada de faixa vazia piscando no topo.
    expect(bloco).toContain('style="display:none;"');
  });
});

describe('Em Breve: carregamento', () => {
  it('renderHome dispara junto da seção em que a seção aparece', () => {
    const i = js.indexOf('export async function renderHome(');
    const corpo = js.slice(i, js.indexOf('\n}', i));
    const chamada = corpo.indexOf('loadAndRenderUpcoming(');
    expect(chamada, 'loadAndRenderUpcoming em renderHome').toBeGreaterThan(-1);
    // A ordem de resolução acompanha a de leitura: Em Breve fica depois da
    // afinidade no template, e a chamada vem depois da da afinidade.
    expect(chamada, 'depois da afinidade').toBeGreaterThan(corpo.indexOf('setupAffinityDiscovery('));
    // E antes das assíncronas do fim da página.
    for (const outra of ['loadAndRenderTrending(', 'loadAndRenderCategories(']) {
      expect(chamada, `antes de ${outra}`).toBeLessThan(corpo.indexOf(outra));
    }
    // Antes da chamada vem a renderização síncrona, que monta o template.
    expect(chamada, 'depois do template').toBeGreaterThan(corpo.indexOf('renderHomeBase('));
  });

  it('o loader existe, é exportado e atualiza com semente própria', () => {
    expect(js).toMatch(/export async function loadAndRenderUpcoming\(/);
    const i = js.indexOf('export async function loadAndRenderUpcoming(');
    const corpo = js.slice(i, js.indexOf('\n}', i));
    expect(corpo, 'alvo do botão de atualizar').toContain("setupSectionRefresh(section,");
    expect(corpo, 'semente própria').toContain("bumpSeed('upcoming')");
    expect(corpo, 'ordem alterna pelo par de listas').toContain("getVariety('upcoming').seed");
    // Spec: busca falhou ou veio vazia, a seção some — não fica um buraco.
    expect(corpo.match(/section\.style\.display = 'none'/g).length).toBeGreaterThanOrEqual(2);
  });

  it('a seleção escolhe dentro de um pool maior, e o refresh vai à rede', () => {
    const i = js.indexOf('export async function loadAndRenderUpcoming(');
    const corpo = js.slice(i, js.indexOf('\n}', i));
    // Sem seleção, o clique de atualizar repintava o topo do mesmo pool: a
    // semente trocava a ordem da busca, mas quem vinha primeiro era sempre o
    // mesmo material.
    expect(corpo, 'seleção de verdade').toContain("pickForSection('upcoming'");
    expect(corpo, 'pool dobrado para sobrar o que variar').toContain('largura * 2');
    // O botão precisa levar `fresh` adiante; sem ele, o getter lê o mesmo
    // cache de 1h e o refresh continua só reorganizando a lista velha.
    expect(corpo, 'flag de refresh repassada').toContain('fresh: opts.fresh');
    expect(corpo, 'refresh força a rede').toContain("{ fresh: true }");
  });

  it('o cartão carrega a data da estreia', () => {
    const i = js.indexOf('export async function loadAndRenderUpcoming(');
    const corpo = js.slice(i, js.indexOf('\n}', i));
    expect(corpo).toContain('home-upcoming-date');
    expect(corpo, 'data formatada para ler como data').toContain('formatAirDate(t.date)');
    // Sem data não há linha: a seção existe por causa dela.
    expect(corpo).toMatch(/t\.date \? `<div class="home-upcoming-date"/);
  });
});

describe('Em Breve: busca no TMDB', () => {
  it('getUpcomingTitles pede a partir de hoje, em discover/tv', () => {
    const i = api.indexOf('export async function getUpcomingTitles(');
    expect(i, 'getUpcomingTitles').toBeGreaterThan(-1);
    const corpo = api.slice(i, api.indexOf('\n}', i));
    expect(corpo, 'endpoint TV-only').toContain("'discover/tv'");
    // `first_air_date.gte` com a data de hoje montada por fatiamento da
    // string: filtrar no cliente traria o que a API devolve inteiro.
    expect(corpo, 'janela de estreias').toContain("'first_air_date.gte': iso");
    expect(corpo).toMatch(/const iso = `\$\{hoje\.getFullYear\(\)\}/);
    expect(corpo, 'ordenável pelas duas janelas do refresh').toContain('opts.sortBy');
    // Só entra o que tem pôster, e o limite é o da faixa.
    expect(corpo).toContain('r.poster_path');
    expect(corpo).toContain('.slice(0, lim)');
    expect(corpo, 'normaliza para o formato das outras faixas').toContain('normalizeTrendingItem');
  });

  it('exclui o que já está no catálogo e dobra a busca para sobrar pôster', () => {
    const i = api.indexOf('export async function getUpcomingTitles(');
    const corpo = api.slice(i, api.indexOf('\n}', i));
    // O `collectFiltered` é quem filtra o catálogo; o pedido é maior que o
    // exibido porque títulos futuros sem pôster caem no caminho.
    expect(corpo, 'passa o catálogo adiante').toContain('catalogItems || []');
    expect(corpo, 'pool dobrado').toMatch(/lim \* 2/);
  });
});

describe('Em Breve: o corpo do cartão tem regra', () => {
  it('.home-upcoming-date usa meta e muted, sem mono e sem disputar do título', () => {
    const i = css.indexOf('.home-upcoming-date {');
    expect(i, 'regra .home-upcoming-date').toBeGreaterThan(-1);
    const bloco = css.slice(i, css.indexOf('}', i));
    expect(bloco).toContain('font-size: var(--fs-meta)');
    expect(bloco).toContain('color: var(--text-muted)');
    // O mono é contrato de dado técnico alinhado em coluna (typography.test);
    // a estreia é uma linha por cartão, não uma coluna de datas.
    expect(bloco).not.toContain('var(--font-mono)');
    expect(bloco, 'o ícone não encolhe o texto ao lado').not.toContain('font-family');
  });
});
