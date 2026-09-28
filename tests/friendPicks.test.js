import { describe, it, expect, vi } from 'vitest';
import {
  anchorScore,
  pickAnchors,
  extractCreators,
  findSharedCreator,
  buildReason,
  creatorProfileUrl,
  isPickableCandidate,
  getFriendPicks,
  MIN_ANCHOR_SCORE,
  CREDIT_BUDGET
} from '../src/lib/friendPicks.js';
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
      profile_path: c.profilePath ?? null,
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
    expect(out[0].profilePath).toBe('/vg.jpg');
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

describe('creatorProfileUrl', () => {
  it('monta a URL do TMDB e preserva URL absoluta', () => {
    expect(creatorProfileUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
    expect(creatorProfileUrl('https://x/y.jpg')).toBe('https://x/y.jpg');
    expect(creatorProfileUrl(null)).toBe('');
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
    expect(out[0].person.name).toBe('Vince');
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
    const chamadas = { n: 0 };
    const fake = async (endpoint) => {
      chamadas.n += 1;
      if (endpoint === 'tv/100/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/900/aggregate_credits') return credits([{ id: 1, name: 'Vince', jobs: ['Director'] }]);
      if (endpoint === 'tv/100/recommendations') {
        return { results: [raw({ id: 78670, name: 'Impulse' }), raw()] };
      }
      return { results: [] };
    };
    const out = await withMock(fake, mod => mod.getFriendPicks([item()], { limit: 1 }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(900);
    // 1 crédito da âncora + 1 do candidato escolhido. O bloqueado nunca é
    // conferido, que é o ponto: o filtro roda antes de gastar chamada.
    expect(chamadas.n).toBe(3);
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
