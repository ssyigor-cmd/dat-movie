/**
 * A memória das faixas "Se você gostou de X vai gostar disso".
 *
 * Estas faixas são as únicas da home cujo material vem de um pool pequeno e
 * cacheado por 1h, então a seleção delas é a única que precisa atravessar um
 * F5: sem isso, mesma âncora + mesma semente + mesmo cache davam os mesmos
 * cartões a cada abertura, e o botão de atualizar parecia não fazer nada.
 *
 * O que estes testes prendem é esse "atravessar": o que foi exibido, a semente
 * do sorteio e o offset da âncora sobrevivem ao recarregamento — e o teto de
 * exibidos faz os mais antigos voltarem a ser candidatos, porque um catálogo
 * pequeno encheria a lista uma vez e passaria a repetir para sempre.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

/** Storage falso no formato do `localStorage`. */
function fakeStorage() {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; }
  };
}

/** Importa o módulo como se a aba tivesse acabado de abrir. */
async function abrirDeNovo(storage) {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  return await import('../src/lib/affinityMemory.js');
}

const LS_KEY = 'datmovie_affinity_memory_v1';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('affinityMemory', () => {
  it('o que foi exibido, a semente e o offset vencem o F5', async () => {
    const ls = fakeStorage();
    const antes = await abrirDeNovo(ls);
    antes.rememberAffinity([1, 2]);
    expect(antes.nextAffinitySeed()).toBe(0);
    expect(antes.nextAffinityOffset()).toBe(0);

    // Mesmo storage, módulo novo: é a abertura seguinte, não a mesma sessão.
    const depois = await abrirDeNovo(ls);
    expect([...depois.affinityShown()], 'exibidos atravessam').toEqual(['1', '2']);
    expect(depois.nextAffinitySeed(), 'semente continua').toBe(1);
    expect(depois.nextAffinityOffset(), 'offset continua').toBe(1);
  });

  it('grava um blob que a próxima sessão lê tal e qual', async () => {
    // O formato é contrato: um campo renomeado aqui vira memória perdida no
    // navegador do usuário, e a home volta a repetir sem ninguém perceber.
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.rememberAffinity(['1']);
    m.nextAffinitySeed();
    m.nextAffinityOffset();
    expect(JSON.parse(ls.getItem(LS_KEY))).toEqual({ seed: 1, offset: 1, shown: ['1'] });
  });

  it('a semente avança a cada pintura, mesmo com o mesmo material', async () => {
    // Quando o pool se esgota, a repetição que sobra precisa sair em outra
    // composição — e é a semente que muda a composição, não o pool.
    const m = await abrirDeNovo(fakeStorage());
    expect([m.nextAffinitySeed(), m.nextAffinitySeed(), m.nextAffinitySeed()]).toEqual([0, 1, 2]);
    expect([m.nextAffinityOffset(), m.nextAffinityOffset()]).toEqual([0, 1]);
  });

  it('não repete id já exibido e ignora entradas inválidas', async () => {
    const m = await abrirDeNovo(fakeStorage());
    m.rememberAffinity(['1']);
    m.rememberAffinity(['1', '2', '']);
    m.rememberAffinity([]);
    m.rememberAffinity(null);
    m.rememberAffinity([3]);
    expect([...m.affinityShown()].sort()).toEqual(['1', '2', '3']);
  });

  it('o teto de exibidos é FIFO: os mais antigos voltam a ser candidatos', async () => {
    const m = await abrirDeNovo(fakeStorage());
    const { MAX_SHOWN } = m;
    const ids = Array.from({ length: MAX_SHOWN + 10 }, (_, i) => String(i + 1));
    m.rememberAffinity(ids);
    const shown = m.affinityShown();
    expect(shown.size, 'nunca cresce além do teto').toBe(MAX_SHOWN);
    expect(shown.has('1'), 'os mais antigos saem').toBe(false);
    expect(shown.has(String(MAX_SHOWN + 10)), 'os recentes ficam').toBe(true);
  });

  it('blob corrompido não derruba a memória: recomeça do zero', async () => {
    const ls = fakeStorage();
    ls.setItem(LS_KEY, '{isto não é json');
    const m = await abrirDeNovo(ls);
    expect(m.affinityShown().size).toBe(0);
    expect(m.nextAffinitySeed()).toBe(0);
    m.rememberAffinity(['5']);
    expect(m.affinityShown().has('5'), 'e volta a funcionar').toBe(true);
  });

  it('sem localStorage (Node de teste, modo privado) degrada para memória de módulo', async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const m = await import('../src/lib/affinityMemory.js');
    expect(() => m.rememberAffinity(['9'])).not.toThrow();
    expect(m.affinityShown().has('9'), 'ainda funciona na sessão').toBe(true);
    expect(m.nextAffinitySeed()).toBe(0);
    expect(m.nextAffinityOffset()).toBe(0);
    expect(() => m.resetAffinityMemory()).not.toThrow();
  });

  it('resetAffinityMemory zera a memória e apaga o blob', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.rememberAffinity(['1']);
    m.nextAffinitySeed();
    m.resetAffinityMemory();
    expect(ls.getItem(LS_KEY)).toBeNull();
    expect([...m.affinityShown()]).toEqual([]);
    expect(m.nextAffinitySeed(), 'semente volta ao início').toBe(0);
  });
});
