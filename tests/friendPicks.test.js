import { describe, it, expect, vi } from 'vitest';
import {
  anchorScore,
  pickAnchors,
  extractCreators,
  findSharedCreator,
  buildReason,
  isPickableCandidate,
  getFriendPicks,
  MIN_ANCHOR_SCORE,
  CREDIT_BUDGET,
  CANDIDATE_PROBE
} from '../src/lib/friendPicks.js';

// O teste de fronteira fala da posição exata do probe, então lê o valor em vez
// de repetir o número: mudar CANDIDATE_PROBE não pode quebrar o teste por causa
// de um literal desatualizado aqui.
const PROBE = CANDIDATE_PROBE;
import { cacheClear } from '../src/lib/cache.js';

/**
 * Monta um `aggregate_credits` no formato REAL da API.
 *
 * O campo é `jobs` (array), não `job` (singular) — o singular é do
 * `movie/{id}/credits`. Os fixtures deste arquivo foram escritos com `job`
 * durante a implementação e os 39 testes passaram: o harness reproduzia um
 * payload que a API não devolve. O helper aceita os dois para que essa
 * diferença continue visível nos testes em vez de implícita.
 * @param {Array} crew - Entradas. Use `{ id, name, jobs: ['Creator'] }` ou `{ id, name, jobs: ['Creator'] }`.
 * @returns {Object} Payload.
 */
function credits(crew) {
  return {
    id: 1,
    cast: [],
    crew: crew.map((c) => ({
      adult: false,
      id: c.id,
      name: c.name,
      original_name: c.name,
      known_for_department: 'Writing',
      department: 'Writing',
      total_episode_count: 12,
      ...(c.jobs
        ? { jobs: c.jobs.map((job) => ({ credit_id: 'x', job, episode_count: 12 })) }
        : { job: c.job })
    }))
  };
}

/** Cria um catálogo com um item. */
function item(over = {}) {
  return {
    id: 'i1', nome: 'Título', tmdb_id: 100, tier: 'S', status: 'concluido',
    temporada: 1, episodio: 12, totalEpisodios: 12, ...over
  };
}

/** Candidate cru do TMDb. */
function raw(over = {}) {
  return {
    id: 900, name: 'Candidato', poster_path: '/p.jpg', first_air_date: '2019-01-01',
    original_language: 'en', overview: '', vote_average: 8, popularity: 10, ...over
  };
}

describe('anchorScore', () => {
  it('trata concluído com tier alto como a evidência mais forte', () => {
    expect(anchorScore(item({ tier: 'S+', status: 'concluido' })))
      .toBeGreaterThan(anchorScore(item({ tier: 'S', status: 'concluido' })));
    expect(anchorScore(item({ tier: 'S+', status: 'concluido' })))
      .toBeGreaterThan(anchorScore(item({ tier: 'S+', status: 'assistindo', episodio: 6, totalEpisodios: 12 })));
  });

  it('não usa título planejado: o usuário ainda não viu, não tem gosto provado', () => {
    expect(anchorScore(item({ tier: 'S+', status: 'planejado' }))).toBe(0);
  });

  it('não usa título sem tier nem sem tmdb_id', () => {
    expect(anchorScore(item({ tier: null }))).toBe(0);
    expect(anchorScore(item({ tier: undefined }))).toBe(0);
    expect(anchorScore(item({ tmdb_id: null }))).toBe(0);
    expect(anchorScore(null)).toBe(0);
  });

  it('rebaixa abandonado: largar no episódio 2 não é confirmar gosto', () => {
    const pausado = anchorScore(item({ tier: 'S+', status: 'pausado' }));
    const concluido = anchorScore(item({ tier: 'B', status: 'concluido' }));
    expect(pausado).toBeLessThan(concluido);
    expect(pausado).toBeLessThan(MIN_ANCHOR_SCORE);
  });

  it('considera progresso em quem está assistindo', () => {
    const quase = anchorScore(item({ tier: 'S', status: 'assistindo', episodio: 11, totalEpisodios: 12 }));
    const comecando = anchorScore(item({ tier: 'S', status: 'assistindo', episodio: 1, totalEpisodios: 12 }));
    expect(quase).toBeGreaterThan(comecando);
  });
});

describe('pickAnchors', () => {
  it('descarta tudo abaixo da barra e devolve null quando nada serve', () => {
    expect(pickAnchors([])).toEqual([]);
    expect(pickAnchors(null)).toEqual([]);
    expect(pickAnchors([item({ tier: 'D' })])).toEqual([]);
  });

  it('ordena da âncora mais forte para a mais fraca', () => {
    const anchors = pickAnchors([
      item({ id: 'a', nome: 'A', tier: 'A', status: 'concluido' }),
      item({ id: 'b', nome: 'B', tier: 'S+', status: 'concluido' }),
      item({ id: 'c', nome: 'C', tier: 'S', status: 'concluido' })
    ]);
    expect(anchors.map(a => a.item.nome)).toEqual(['B', 'C', 'A']);
  });

  it('respeita o limite pedido', () => {
    const many = Array.from({ length: 10 }, (_, i) => item({ id: 'x' + i, tier: 'S+', status: 'concluido' }));
    expect(pickAnchors(many, 2)).toHaveLength(2);
  });
});

describe('extractCreators', () => {
  it('lê o array `jobs`, que é o formato real do aggregate_credits', () => {
    // Regressão que derrubou a seção inteira: o payload real traz `jobs`
    // (array). Ler `entry.job` devolvia undefined em 100% das entradas, a
    // lista de criadores saía vazia e a home escondia "Títulos para você" sem
    // registrar erro nenhum. Os 39 testes passaram porque o fixture usava o
    // `job` singular, que existe no credits de filme e NÃO neste endpoint.
    const real = {
      id: 1396,
      cast: [{ id: 1, name: 'Elenco', roles: [{ character: 'X' }] }],
      crew: [
        {
          id: 66633, name: 'Vince Gilligan', known_for_department: 'Writing',
          department: 'Writing', profile_path: '/vg.jpg', total_episode_count: 62,
          jobs: [{ credit_id: 'a', job: 'Creator', episode_count: 62 }]
        },
        {
          id: 66634, name: 'Alguem', department: 'Art', total_episode_count: 62,
          jobs: [{ credit_id: 'b', job: 'Art Direction', episode_count: 62 }]
        }
      ]
    };
    const out = extractCreators(real);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ personId: '66633', name: 'Vince Gilligan', verb: 'criou', rank: 3 });
  });

  it('escolhe a função mais forte entre as várias da mesma pessoa', () => {
    const out = extractCreators(credits([
      { id: 1, name: 'Multi', jobs: ['Writer', 'Director', 'Story'] }
    ]));
    expect(out).toHaveLength(1);
    expect(out[0].verb).toBe('dirigiu');
  });

  it('ignora função de arte mesmo vinda no array de jobs', () => {
    const out = extractCreators(credits([{ id: 1, name: 'Arte', jobs: ['Art Direction', 'Production Design'] }]));
    expect(out).toEqual([]);
  });

  it('aceita `job` no singular como tolerância ao outro formato', () => {
    // Formato de movie/{id}/credits. Manter vivo evita que a mesma lógica
    // precise ser reescrita se a feature passar a ler o endpoint de filme.
    const out = extractCreators(credits([{ id: 1, name: 'Dir', job: 'Director' }]));
    expect(out).toHaveLength(1);
    expect(out[0].verb).toBe('dirigiu');
  });

  it('fica com diretor, criador e roteirista', () => {
    const out = extractCreators(credits([
      { id: 1, name: 'Dir', jobs: ['Director'] },
      { id: 2, name: 'Esc', jobs: ['Writer'] },
      { id: 3, name: 'Prod', jobs: ['Executive Producer'] }
    ]));
    expect(out.map(c => c.name)).toEqual(['Dir', 'Esc']);
  });

  it('não deixa o mesmo nome duas vezes quando a pessoa tem várias funções', () => {
    const out = extractCreators(credits([
      { id: 1, name: 'Vince', jobs: ['Writer'] },
      { id: 1, name: 'Vince', jobs: ['Director'] }
    ]));
    expect(out).toHaveLength(1);
    expect(out[0].verb).toBe('dirigiu');
  });

  it('ordena pela função que mais identifica a pessoa', () => {
    const out = extractCreators(credits([
      { id: 2, name: 'Esc', jobs: ['Writer'] },
      { id: 1, name: 'Dir', jobs: ['Director'] }
    ]));
    expect(out[0].name).toBe('Dir');
  });

  it('descarta função de produção, que toda série tem e não diz nada', () => {
    // Regressão de projeto: aceitar função desconhecida com o verbo "fez"
    // enchia a lista de "o mesmo produtor de X, e fez isto aqui", que é
    // afirmação vazia. Produtor e diretor de fotografia saem.
    const out = extractCreators(credits([
      { id: 1, name: 'Prod', jobs: ['Executive Producer'] },
      { id: 2, name: 'Foto', jobs: ['Director of Photography'] },
      { id: 3, name: 'Fig', jobs: ['Costume Supervisor'] },
      { id: 4, name: 'Alguem', jobs: ['Consultant'] }
    ]));
    expect(out).toEqual([]);
  });

  it('descarta Art Director, que casa com o padrão de diretor', () => {
    // "Art Director" contém "Director": a lista de ruído precisa ser testada
    // antes do padrão, senão a allow-list é furada pela própria variação.
    const out = extractCreators(credits([{ id: 1, name: 'Arte', jobs: ['Art Director'] }]));
    expect(out).toEqual([]);
  });

  it('aceita variante de função que indica a mesma autoria', () => {
    const out = extractCreators(credits([
      { id: 1, name: 'CoDir', jobs: ['Co-Director'] },
      { id: 2, name: 'CoLead', jobs: ['Lead Writer'] }
    ]));
    expect(out.map(c => [c.name, c.verb])).toEqual([['CoDir', 'dirigiu'], ['CoLead', 'roteirizou']]);
  });

  it('ignora entrada sem id ou sem nome e payload vazio', () => {
    expect(extractCreators(credits([{ jobs: ['Director'] }, { id: 3, jobs: ['Director'] }]))).toEqual([]);
    expect(extractCreators(null)).toEqual([]);
    expect(extractCreators({ crew: null })).toEqual([]);
  });
});

describe('findSharedCreator', () => {
  const anchor = [
    { personId: '1', name: 'Vince', verb: 'criou', rank: 3 },
    { personId: '2', name: 'Peter', verb: 'roteirizou', rank: 2 }
  ];

  it('acha o mesmo nome pelo id, e não pelo texto do nome', () => {
    const found = findSharedCreator(anchor, [{ personId: '1', name: 'Outro Nome', verb: 'dirigiu', rank: 3 }]);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Vince');
    expect(found.anchorVerb).toBe('criou');
    expect(found.pickVerb).toBe('dirigiu');
  });

  it('devolve null quando ninguém coincide', () => {
    expect(findSharedCreator(anchor, [{ personId: '77', name: 'Ninguém', verb: 'fez', rank: 1 }])).toBeNull();
    expect(findSharedCreator(anchor, [])).toBeNull();
    expect(findSharedCreator(null, anchor)).toBeNull();
  });

  it('prefere o vínculo mais forte quando há mais de um', () => {
    const found = findSharedCreator(anchor, [
      { personId: '2', name: 'Peter', verb: 'roteirizou', rank: 2 },
      { personId: '1', name: 'Vince', verb: 'dirigiu', rank: 3 }
    ]);
    expect(found.personId).toBe('1');
  });
});

describe('buildReason', () => {
  it('usa o verbo de cada lado, sem inventar função', () => {
    expect(buildReason({
      personName: 'Vince', anchorVerb: 'criou', pickVerb: 'dirigiu', anchorTitle: 'Breaking Bad'
    })).toBe('Vince criou Breaking Bad. E dirigiu isto aqui.');
  });

  it('sobrevive a repetição quando a função é a mesma nos dois lados', () => {
    expect(buildReason({
      personName: 'Yoshihiro', anchorVerb: 'dirigiu', pickVerb: 'dirigiu', anchorTitle: 'Vinte e onze'
    })).toBe('Yoshihiro dirigiu Vinte e onze. E dirigiu isto aqui.');
  });

  it('não inventa frase sem nome ou sem título de referência', () => {
    expect(buildReason({ personName: '', anchorVerb: 'criou', pickVerb: 'criou', anchorTitle: 'X' })).toBe('');
    expect(buildReason({ personName: 'P', anchorVerb: 'criou', pickVerb: 'criou', anchorTitle: '' })).toBe('');
  });
});

describe('isPickableCandidate', () => {
  it('aceita um título normal', () => {
    expect(isPickableCandidate(raw())).toBe(true);
  });

  it('rejeita produção de canal do YouTube, sem exceção', () => {
    expect(isPickableCandidate(raw({ name: 'Extreme Makeover: Home Edition Vlog' }))).toBe(false);
    expect(isPickableCandidate(raw({ id: 78670, name: 'Qualquer Coisa' }))).toBe(false);
  });

  it('rejeita idioma fora do aceito na home', () => {
    expect(isPickableCandidate(raw({ original_language: 'tr' }))).toBe(false);
    expect(isPickableCandidate(raw({ original_language: 'ko' }))).toBe(true);
  });

  it('rejeita título em alfabeto não latino, data absurda e falta de arte', () => {
    expect(isPickableCandidate(raw({ name: '進撃の巨人' }))).toBe(false);
    expect(isPickableCandidate(raw({ first_air_date: '2040-01-01' }))).toBe(false);
    expect(isPickableCandidate(raw({ poster_path: null, backdrop_path: null }))).toBe(false);
  });

  it('rejeita entrada sem id', () => {
    expect(isPickableCandidate(null)).toBe(false);
    expect(isPickableCandidate({ name: 'Sem id' })).toBe(false);
  });
});

describe('getFriendPicks', () => {
  async function withMock(callTMDB, fn) {
    vi.resetModules();
    cacheClear();
    vi.doMock('../src/lib/api.js', () => ({ callTMDB }));
    const mod = await import('../src/lib/friendPicks.js');
    try { return await fn(mod); } finally { vi.doUnmock('../src/lib/api.js'); vi.resetModules(); cacheClear(); }
  }

  /** Âncora 100 com o criador 1; candidato 900 com o mesmo criador. */
  const fakeVerificado = async (endpoint) => {
    if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
    if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
    if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
    if (endpoint === 'tv/100/similar') return { results: [] };
    return { results: [] };
  };

  it('indica o título e a frase cita o criador e o título que o usuário já tem', async () => {
    const out = await withMock(fakeVerificado, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Candidato');
    expect(out[0].reason).toBe('Vince dirigiu Título. E dirigiu isto aqui.');
    expect(out[0].anchor.nome).toBe('Título');
  });

  it('não indica nada quando nenhum candidato tem criador em comum', async () => {
    // Este é o teste que segura a promessa da feature: sem vínculo verificado,
    // a seção se esconde em vez de virar catálogo.
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 42, name: 'Outra Pessoa', jobs: ['Director'] }]);
      if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toBeNull();
  });

  it('não indica nada quando a chamada de créditos falha', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') throw new Error('tmdb fora');
      if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toBeNull();
  });

  it('se esconde quando o catálogo não tem âncora forte', async () => {
    const fake = async () => { throw new Error('não deveria chamar a API'); };
    const out = await withMock(fake, mod => mod.getFriendPicks([item({ tier: 'D' })], { limit: 1 }));
    expect(out).toBeNull();
  });

  it('se esconde com catálogo vazio sem tocar na API', async () => {
    const fake = async () => { throw new Error('não deveria chamar a API'); };
    expect(await withMock(fake, mod => mod.getFriendPicks([], { limit: 1 }))).toBeNull();
    expect(await withMock(fake, mod => mod.getFriendPicks(null, { limit: 1 }))).toBeNull();
  });

  it('nunca indica título que já está no catálogo', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item(), item({ id: 'i2', tmdb_id: 900 })], { limit: 1 }));
    expect(out).toBeNull();
  });

  it('cai para /similar quando /recommendations falha', async () => {
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/100/recommendations') throw new Error('indisponível');
      if (endpoint === 'tv/100/similar') return { results: [raw()] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Candidato');
  });

  it('descarta candidato bloqueado antes de gastar crédito com ele', async () => {
    const chamadas = { endpoints: [] };
    const fake = async (endpoint) => {
      chamadas.endpoints.push(endpoint);
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'search/multi') return { results: [] };
      if (endpoint === 'tv/100/recommendations') {
        return { results: [raw({ id: 78670, name: 'Impulse' }), raw()] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(900);
    // Só as chamadas de créditos contam para esta asserção: o bloqueado tem id
    // na BLOCKED list, então é descartado no filtro e nunca chega a ser
    // conferido, que é o ponto. 1 crédito da âncora + 1 do escolhido.
    const creditos = chamadas.endpoints.filter(e => e.endsWith('/aggregate_credits'));
    expect(creditos).toEqual(['tv/100/aggregate_credits', 'tv/900/aggregate_credits']);
  });

  /**
   * Áncoras e candidatos encadeados: a âncora N tem o criador N, e o candidato
   * que ela devolve (id 5000+N) carrega o mesmo criador N. Sem esse encadeamento
   * a verificação não acha vínculo e a função devolve null — que estava
   * acontecendo nos dois testes abaixo, com mock que não criava afinidade.
   */
  function fakeEncadeado(endpoint) {
    const m = /^tv\/(\d+)\/aggregate_credits$/.exec(endpoint);
    if (m) {
      const id = Number(m[1]);
      const dono = id >= 5000 ? id - 5000 : id;
      return credits([{ id: dono, name: 'P' + dono, jobs: ['Director'] }]);
    }
    const r = /^tv\/(\d+)\/recommendations$/.exec(endpoint);
    if (r) return { results: [raw({ id: Number(r[1]) + 5000 })] };
    return { results: [] };
  }

  it('respeita o limite e não repete título entre âncoras', async () => {
    const catalog = [
      item({ id: 'a', tmdb_id: 100, nome: 'A' }),
      item({ id: 'b', tmdb_id: 200, nome: 'B' }),
      item({ id: 'c', tmdb_id: 300, nome: 'C' }),
      item({ id: 'd', tmdb_id: 400, nome: 'D' })
    ];
    const out = await withMock(fakeEncadeado, mod => mod.getFriendPicks(catalog, { limit: 2 }));
    expect(out).toHaveLength(2);
    expect(new Set(out.map(p => p.id)).size).toBe(2);
    // Cada card carrega a âncora de onde veio: a frase não pode ser órfã.
    expect(out.map(p => p.anchor.nome).sort()).toEqual(['A', 'B']);
  });

  it('gira a âncora com anchorIndex, para o botão de atualizar variar', async () => {
    const catalog = [
      item({ id: 'a', tmdb_id: 100, nome: 'A' }),
      item({ id: 'b', tmdb_id: 200, nome: 'B' })
    ];
    const zero = await withMock(fakeEncadeado, mod => mod.getFriendPicks(catalog, { limit: 1, anchorIndex: 0 }));
    const um = await withMock(fakeEncadeado, mod => mod.getFriendPicks(catalog, { limit: 1, anchorIndex: 1 }));
    expect(zero[0].reason).toBe('P100 dirigiu A. E dirigiu isto aqui.');
    expect(um[0].reason).toBe('P200 dirigiu B. E dirigiu isto aqui.');
  });

  it('respeita o teto de chamadas a aggregate_credits', async () => {
    let creditos = 0;
    const fake = async (endpoint) => {
      if (endpoint.endsWith('/aggregate_credits')) {
        creditos += 1;
        // Criador sempre distinto: nada ever verifica, então o teto é quem corta.
        return credits([{ id: creditos, name: 'P' + creditos, jobs: ['Director'] }]);
      }
      if (endpoint.endsWith('/recommendations')) {
        return { results: Array.from({ length: 10 }, (_, i) => raw({ id: 5000 + i })) };
      }
      return { results: [] };
    };
    const catalog = Array.from({ length: 6 }, (_, i) => item({ id: 'x' + i, tmdb_id: 100 + i }));
    const out = await withMock(fake, mod => mod.getFriendPicks(catalog, { limit: 3 }));
    expect(out).toBeNull();
    expect(creditos).toBeLessThanOrEqual(CREDIT_BUDGET);
  });

  it('usa as obras do próprio criador via search/multi, sem sondar similaridade', async () => {
    // Caminho 1. O `known_for` da pessoa já é a lista de títulos DELA, então o
    // vínculo vem confirmado na conferida e não depende de a similaridade
    // acertar. Aqui o recommendations devolveria ruído de propósito: se a
    // implementação sondasse por lá, não acharia nada.
    const chamadas = [];
    const fake = async (endpoint, params) => {
      chamadas.push(endpoint);
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 66633, name: 'Vince Gilligan', jobs: ['Creator'] }]);
      if (endpoint === 'tv/950/aggregate_credits') return credits([{ id: 66633, name: 'Vince Gilligan', jobs: ['Director'] }]);
      if (endpoint === 'search/multi') {
        expect(params.query).toBe('Vince Gilligan');
        return { results: [
          { id: 66633, name: 'Vince Gilligan', media_type: 'person', known_for: [
            { id: 950, name: 'Pluribus', media_type: 'tv', poster_path: '/p.jpg', first_air_date: '2025-11-07', original_language: 'en', overview: '', vote_average: 8, popularity: 500 },
            { id: 951, name: 'Filme dele', media_type: 'movie', poster_path: '/q.jpg' }
          ] }
        ] };
      }
      if (endpoint.endsWith('/recommendations') || endpoint.endsWith('/similar')) {
        return { results: Array.from({ length: 10 }, (_, i) => raw({ id: 800 + i })) };
      }
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(950);
    expect(out[0].reason).toBe('Vince Gilligan criou Título. E dirigiu isto aqui.');
    // O caminho 1 resolveu, então nem chegou a sondar similaridade.
    expect(chamadas.filter(e => e.endsWith('/recommendations'))).toHaveLength(0);
  });

  it('ignora homônimo: só casa o person com o id certo', async () => {
    // Mesmo nome, pessoa diferente. Se casasse por texto, a frase seria uma
    // mentira — e é exatamente o tipo de erro que a feature não pode ter.
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 66633, name: 'Vince Gilligan', jobs: ['Creator'] }]);
      if (endpoint === 'search/multi') {
        return { results: [
          { id: 99999, name: 'Vince Gilligan', media_type: 'person', known_for: [
            { id: 960, name: 'Obra do homônimo', media_type: 'tv', poster_path: '/p.jpg', first_air_date: '2020-01-01', original_language: 'en', overview: '', vote_average: 7, popularity: 300 }
          ] }
        ] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    // Nenhum vínculo: a seção se esconde em vez de indicar o homônimo.
    expect(out).toBeNull();
  });

  it('cai para similaridade quando a pessoa não vem no search/multi', async () => {
    // O `known_for` é o atalho, não a garantia. Se a busca não trouxer a
    // pessoa, o caminho antigo tem de continuar funcionando sozinho.
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'search/multi') return { results: [] };
      if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
      if (endpoint === 'tv/100/similar') return { results: [] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(900);
  });

  it('não confia no known_for sem confirmar o crédito do candidato', async () => {
    // O `known_for` do TMDb é uma lista declarativa e pode estar desatualizada
    // ou trazer título que a pessoa não dirigiu. A conferida por id é o que
    // garante que a frase não está mentindo.
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 66633, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'tv/970/aggregate_credits') return credits([{ id: 777, name: 'Outra Pessoa', jobs: ['Director'] }]);
      if (endpoint === 'search/multi') {
        return { results: [{ id: 66633, name: 'Vince', media_type: 'person', known_for: [
          { id: 970, name: 'Título sem ele', media_type: 'tv', poster_path: '/p.jpg', first_air_date: '2020-01-01', original_language: 'en', overview: '', vote_average: 7, popularity: 300 }
        ] }] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toBeNull();
  });

  it('junta recommendations e similar, e não repete título entre os dois', async () => {
    // As duas listas se sobrepõem em parte. A repetição custaria uma chamada de
    // créditos inteira para reavaliar o mesmo título, que é o recurso mais caro
    // da seção.
    const chamadas = [];
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'tv/900/aggregate_credits') { chamadas.push(900); return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]); }
      if (endpoint === 'tv/901/aggregate_credits') { chamadas.push(901); return credits([{ id: 2, name: 'Outra', jobs: ['Director'] }]); }
      if (endpoint === 'tv/100/recommendations') return { results: [raw({ id: 900 }), raw({ id: 901 })] };
      if (endpoint === 'tv/100/similar') return { results: [raw({ id: 900 }), raw({ id: 902 })] };
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    // 900 veio nas duas listas e foi conferido uma vez só. 901 é o candidato
    // seguinte, e não tem vínculo — daí sair 1 card mesmo com 3 candidatos.
    expect(chamadas.filter(c => c === 900)).toHaveLength(1);
  });

  it('acha o vínculo na última posição do probe, e não além dela', async () => {
    // Regressão do sintoma reportado: o creator em comum estava entre os
    // primeiros candidatos, e a seção vinha com 1 card só.
    //
    // Esta é a fronteira honesta do custo. O TMDb devolve 20 candidatos por
    // recommendations, mas `aggregate_credits` traz o elenco inteiro: conferir
    // os 20 pagaria 20 chamadas pesadas para no máximo 3 cards. Então o probe
    // corta em CANDIDATE_PROBE, e o que salva a quantidade é ANCHOR_LIMIT --
    // mais âncoras, cada uma com sua rolagem nova de candidatos.
    const dentro = 900 + PROBE - 1;   // última posição conferida
    const fora = 900 + PROBE;         // primeira posição NÃO conferida

    // Só o último do probe tem criador em comum.
    const comVinculoNaFronteira = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === `tv/${dentro}/aggregate_credits`) return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'tv/100/recommendations') {
        return { results: Array.from({ length: PROBE + 1 }, (_, i) => raw({ id: 900 + i })) };
      }
      if (endpoint === 'tv/100/similar') return { results: [] };
      return { results: [] };
    };
    const achou = await withMock(comVinculoNaFronteira, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(achou).toHaveLength(1);
    expect(achou[0].id).toBe(dentro);

    // Mesmo arranjo, mas o vinculo está UMA posição além: deixa de ser conferido
    // e a seção se esconde. Não é defeito da ancora nem do endpoint, é o teto de
    // custo, e é intencional. O teste documenta esse limite para ninguem
    // descobrir depois que lista curta é bug.
    const soForaDaFronteira = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === `tv/${fora}/aggregate_credits`) return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]);
      if (endpoint === 'tv/100/recommendations') {
        return { results: Array.from({ length: PROBE + 1 }, (_, i) => raw({ id: 900 + i })) };
      }
      if (endpoint === 'tv/100/similar') return { results: [] };
      return { results: [] };
    };
    const semVinculo = await withMock(soForaDaFronteira, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(semVinculo).toBeNull();
  });

  it('reaproveita os créditos do cache em vez de buscar de novo', async () => {
    // A chave é `creditsV2_{id}` e guarda a lista já extraída, não o payload.
    // Por isso o prefixo teve que mudar de versão quando a extração mudou: uma
    // entrada antiga errada continuaria servida até expirar, com o código já
    // certo. Este teste é o que garante que a segunda visita não paga a busca.
    let creditos = 0;
    const fake = async (endpoint) => {
      if (endpoint === 'tv/100/aggregate_credits') { creditos += 1; return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]); }
      if (endpoint === 'tv/900/aggregate_credits') { creditos += 1; return credits([{ id: 1, name: 'Vince', jobs: ['Creator'] }]); }
      if (endpoint === 'tv/100/recommendations') return { results: [raw()] };
      return { results: [] };
    };
    const cat = [item()];
    // As duas chamadas dentro de um único `withMock`: ele limpa o cache ao
    // entrar e ao sair, e limpar entre elas tornaria a medição sem sentido.
    const resultado = await withMock(fake, async (mod) => {
      await mod.getFriendPicks(cat, { limit: 1 });
      const primeira = creditos;
      await mod.getFriendPicks(cat, { limit: 1 });
      return { primeira, segunda: creditos };
    });
    expect(resultado.primeira).toBe(2);
    expect(resultado.segunda).toBe(2);
  });

  it('devolve null com limit 0, sem chamar a API', async () => {
    const fake = async () => { throw new Error('não deveria chamar a API'); };
    expect(await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 0 }))).toBeNull();
  });
});
