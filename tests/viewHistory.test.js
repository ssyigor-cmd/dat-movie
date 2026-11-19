/**
 * Histórico de visualizações do mobile.
 *
 * O que estes testes prendem é a razão de o recurso existir: uma sugestão
 * aberta hoje precisa continuar reabrível depois do F5, mesmo sem nunca ter
 * entrado no catálogo. Também cobrem o que impede o histórico virar lixo:
 * reabrir o mesmo card não duplica, a chave é por usuário e o blob tem teto.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

function fakeStorage() {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
  };
}

async function abrirDeNovo(storage) {
  vi.resetModules();
  vi.stubGlobal('localStorage', storage);
  return await import('../src/lib/viewHistory.js');
}

const entry = (sobre = {}) => ({
  key: 'tmdb:42',
  itemId: null,
  tmdbId: '42',
  nome: 'Série da sugestão',
  imagem: 'https://image.tmdb.org/t/p/w500/x.jpg',
  ano: '2024',
  tipo: 'serie',
  raw: { id: 42, title: 'Série da sugestão', posterUrl: 'https://image.tmdb.org/t/p/w500/x.jpg', date: '2024-03-10' },
  viewedAt: '2026-01-01T10:00:00.000Z',
  ...sobre,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('viewHistory', () => {
  it('a sugestão aberta atravessa o F5 com o raw que permite reabri-la', async () => {
    const ls = fakeStorage();
    const antes = await abrirDeNovo(ls);
    antes.recordView('user-1', entry());

    const depois = await abrirDeNovo(ls);
    const historico = depois.getViewHistory('user-1');
    expect(historico).toHaveLength(1);
    expect(historico[0].nome).toBe('Série da sugestão');
    expect(historico[0].raw).toMatchObject({ id: 42, title: 'Série da sugestão', date: '2024-03-10' });
    expect(historico[0].itemId).toBeNull();
  });

  it('reabrir o mesmo card move para o topo sem duplicar', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.recordView('user-1', entry({ key: 'item:1', itemId: '1', nome: 'Primeira', viewedAt: '2026-01-01T10:00:00.000Z' }));
    m.recordView('user-1', entry({ key: 'item:2', itemId: '2', nome: 'Segunda', viewedAt: '2026-01-02T10:00:00.000Z' }));
    m.recordView('user-1', entry({ key: 'item:1', itemId: '1', nome: 'Primeira', viewedAt: '2026-01-03T10:00:00.000Z' }));

    const historico = m.getViewHistory('user-1');
    expect(historico.map(e => e.key)).toEqual(['item:1', 'item:2']);
    expect(historico[0].viewedAt).toBe('2026-01-03T10:00:00.000Z');
  });

  it('o histórico é isolado por usuário', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.recordView('user-1', entry({ key: 'item:1', itemId: '1', nome: 'Do primeiro' }));
    m.recordView('user-2', entry({ key: 'item:2', itemId: '2', nome: 'Do segundo' }));

    expect(m.getViewHistory('user-1').map(e => e.nome)).toEqual(['Do primeiro']);
    expect(m.getViewHistory('user-2').map(e => e.nome)).toEqual(['Do segundo']);
  });

  it('remove um registro e limpa o histórico inteiro', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.recordView('user-1', entry({ key: 'item:1', itemId: '1' }));
    m.recordView('user-1', entry({ key: 'item:2', itemId: '2' }));

    m.removeView('user-1', 'item:1');
    expect(m.getViewHistory('user-1').map(e => e.key)).toEqual(['item:2']);

    const fresca = await abrirDeNovo(ls);
    fresca.clearViewHistory('user-1');
    expect(fresca.getViewHistory('user-1')).toEqual([]);
  });

  it('mantém no máximo 200 registros, descartando os mais antigos', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    for (let i = 0; i < 205; i++) {
      m.recordView('user-1', entry({ key: `item:${i}`, itemId: String(i), nome: `Título ${i}` }));
    }
    const historico = m.getViewHistory('user-1');
    expect(historico).toHaveLength(200);
    expect(historico[0].key).toBe('item:204');
    expect(historico.at(-1).key).toBe('item:5');
  });

  it('registros sem nome ou sem chave são ignorados', async () => {
    const ls = fakeStorage();
    const m = await abrirDeNovo(ls);
    m.recordView('user-1', entry({ nome: '' }));
    m.recordView('user-1', entry({ key: '' }));
    expect(m.getViewHistory('user-1')).toEqual([]);
  });

  it('sem localStorage degrada para memória sem lançar', async () => {
    vi.stubGlobal('localStorage', undefined);
    const m = await import('../src/lib/viewHistory.js');
    expect(() => m.recordView('user-1', entry())).not.toThrow();
    expect(m.getViewHistory('user-1')).toHaveLength(1);
  });
});
