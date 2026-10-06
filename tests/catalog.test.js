import { describe, it, expect } from 'vitest';
import {
  escapeHTML,
  formatDateBR,
  getTierClass,
  calcularProgresso,
  totalDeEpisodiosDaSerie,
  filterItems,
  sortItems
} from '../src/lib/catalog.js';

describe('escapeHTML', () => {
  it('escapa caracteres especiais de HTML para prevenir XSS', () => {
    expect(escapeHTML('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHTML("title & 'subtitle'")).toBe('title &amp; &#39;subtitle&#39;');
  });

  it('retorna string vazia para valores nulos ou indefinidos', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });
});

describe('filterItems — busca tolerante a erro', () => {
  const catalogo = [
    { nome: 'One Piece', status: 'assistindo' },
    { nome: 'Ação', status: 'assistindo' },
    { nome: 'The Office', status: 'assistindo' },
    { nome: 'Breaking Bad', status: 'assistindo' },
    { nome: 'Friends', status: 'assistindo' },
  ];
  const buscar = (search) => filterItems(catalogo, { currentTab: 'all', search })
    .map(i => i.nome);

  it('acha por substring normal', () => {
    expect(buscar('one')).toContain('One Piece');
  });
  it('ignora acento', () => {
    expect(buscar('acao')).toContain('Ação');
  });
  it('tolera erro de digitação', () => {
    expect(buscar('one peice')).toContain('One Piece');
    expect(buscar('braking bad')).toContain('Breaking Bad');
  });
  it('acha em qualquer ordem de palavras', () => {
    expect(buscar('piece one')).toContain('One Piece');
  });
  it('não traz título que não tem relação', () => {
    expect(buscar('one peice')).not.toContain('Friends');
  });
  it('coloca o título exato antes do que só contém a busca', () => {
    const itens = [
      { nome: 'One Piece: Fishman Island', status: 'assistindo' },
      { nome: 'One Piece', status: 'assistindo' },
    ];
    const out = filterItems(itens, { currentTab: 'all', search: 'one piece' }).map(i => i.nome);
    expect(out[0]).toBe('One Piece');
  });
  it('busca vazia devolve tudo, sem fuzzy acidental', () => {
    expect(buscar('').length).toBe(5);
  });
});

describe('formatDateBR', () => {

  it('formata data ISO AAAA-MM-DD para DD/MM/AAAA', () => {
    expect(formatDateBR('2024-10-25')).toBe('25/10/2024');
  });

  it('retorna o próprio texto para dados inválidos ou nulos', () => {
    expect(formatDateBR('Data desconhecida')).toBe('Data desconhecida');
    expect(formatDateBR(null)).toBeNull();
  });
});

describe('getTierClass', () => {
  it('retorna a classe CSS correta para cada tier', () => {
    expect(getTierClass('S+')).toBe('tier-Splus');
    expect(getTierClass('A')).toBe('tier-A');
    expect(getTierClass('invalido')).toBe('');
  });
});

describe('calcularProgresso', () => {
  it('calcula o progresso simples por episódio sobre o total', () => {
    const item = { episodio: 5, totalEpisodios: 10 };
    expect(calcularProgresso(item)).toBe(50);
  });

  it('calcula o progresso acumulado considerando episódios de temporadas anteriores', () => {
    const item = {
      temporada: 2,
      episodio: 5,
      totalEpisodios: 24,
      seasonEpisodesMap: { 1: 12, 2: 12 }
    };
    // 12 eps da Temp 1 + 5 eps da Temp 2 = 17 / 24 = 71%
    expect(calcularProgresso(item)).toBe(71);
  });

  it('limita o resultado a 100% no máximo', () => {
    const item = { episodio: 15, totalEpisodios: 10 };
    expect(calcularProgresso(item)).toBe(100);
  });

  it('ignora o total por temporada e usa a soma do mapa', () => {
    // Regressão do bug do 100%: a página do título gravava a contagem só da
    // temporada atual em `totalEpisodios`, e o acumulador somava as
    // temporadas anteriores contra esse denominador menor.
    const item = {
      temporada: 3,
      episodio: 2,
      totalEpisodios: 10,
      seasonEpisodesMap: { 1: 10, 2: 10, 3: 10 }
    };
    // 10 + 10 + 2 = 22 / 30 = 73%
    expect(calcularProgresso(item)).toBe(73);
  });

  it('soma as 12 temporadas anteriores em antologia sem estourar 100%', () => {
    const mapa = {};
    for (let t = 1; t <= 13; t++) mapa[t] = 9;
    const item = { temporada: 13, episodio: 2, totalEpisodios: 9, seasonEpisodesMap: mapa };
    // 12 temporadas de 9 + 2 = 110 / 117 = 94%
    expect(calcularProgresso(item)).toBe(94);
  });

  it('não marca 100% quando o totalEpisodios veio do DEFAULT 1 do banco', () => {
    const item = { temporada: 1, episodio: 3, totalEpisodios: 1, seasonEpisodesMap: { 1: 10 } };
    expect(calcularProgresso(item)).toBe(30);
  });

  it('não acumula temporadas anteriores sem seasonEpisodesMap', () => {
    const item = { temporada: 4, episodio: 3, totalEpisodios: 40 };
    expect(calcularProgresso(item)).toBe(8);
  });

  it('não marca 100% com o DEFAULT 1 do banco e sem mapa de temporadas', () => {
    // Furo que sobreviveu à primeira correção: sem mapa, a coluna vira o único
    // denominador, e o DEFAULT 1 do banco transforma qualquer episódio em
    // 100%. Divisão por total Known-errado não devolve porcentagem nenhuma.
    const item = { temporada: 13, episodio: 2, totalEpisodios: 1 };
    expect(calcularProgresso(item)).toBe(0);
  });

  it('ignora total por temporada que não fecha com o que foi assistido', () => {
    const item = { temporada: 13, episodio: 2, totalEpisodios: 9 };
    expect(calcularProgresso(item)).toBe(0);
  });

  it('devolve 0 quando não há mapa nem total gravado', () => {
    expect(calcularProgresso({ temporada: 1, episodio: 0 })).toBe(0);
    expect(calcularProgresso({ temporada: 1, episodio: 0, totalEpisodios: 0 })).toBe(0);
  });

  it('aceita 100% real quando o mapa fecha com o que foi assistido', () => {
    const item = {
      temporada: 2,
      episodio: 12,
      totalEpisodios: 12,
      seasonEpisodesMap: { 1: 12, 2: 12 }
    };
    // 12 + 12 = 24 / 24: concluído de verdade, não o clamp de total furado.
    expect(calcularProgresso(item)).toBe(100);
  });
});

describe('totalDeEpisodiosDaSerie', () => {
  it('soma as contagens de todas as temporadas', () => {
    expect(totalDeEpisodiosDaSerie({ 1: 10, 2: 8, 3: 12 })).toBe(30);
  });

  it('devolve 0 para mapa ausente, vazio ou de tipo inesperado', () => {
    expect(totalDeEpisodiosDaSerie(null)).toBe(0);
    expect(totalDeEpisodiosDaSerie({})).toBe(0);
    expect(totalDeEpisodiosDaSerie([10, 8])).toBe(0);
  });

  it('ignora contagens não numéricas em vez de virar NaN', () => {
    expect(totalDeEpisodiosDaSerie({ 1: 10, 2: null, 3: '8' })).toBe(18);
  });
});

describe('filterItems', () => {
  const items = [
    { id: 1, nome: 'Naruto', tipo: 'anime', status: 'assistindo', tier: 'S+' },
    { id: 2, nome: 'Arcane', tipo: 'animacao', status: 'concluido', tier: 'S' },
    { id: 3, nome: 'Breaking Bad', tipo: 'serie', status: 'assistindo', tier: 'S+' },
    { id: 4, nome: 'One Piece', tipo: 'anime', status: 'planejado', tier: null }
  ];

  it('filtra por tipo (aba)', () => {
    const res = filterItems(items, { currentTab: 'anime' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('Naruto');
  });

  it('filtra por aba planejado', () => {
    const res = filterItems(items, { currentTab: 'planejado' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('One Piece');
  });

  it('filtra por texto de busca', () => {
    const res = filterItems(items, { search: 'Arc' });
    expect(res).toHaveLength(1);
    expect(res[0].nome).toBe('Arcane');
  });

  it('filtra por tier', () => {
    const res = filterItems(items, { tierFilter: 'S+' });
    expect(res).toHaveLength(2);
  });
});

describe('sortItems', () => {
  const items = [
    { nome: 'Zelda', dataCriacao: '2024-01-01' },
    { nome: 'Attack on Titan', dataCriacao: '2024-06-01' }
  ];

  it('ordena por nome ascendente (A-Z)', () => {
    const res = sortItems(items, 'nome-asc');
    expect(res[0].nome).toBe('Attack on Titan');
    expect(res[1].nome).toBe('Zelda');
  });

  it('ordena por data descendente (mais recente primeiro)', () => {
    const res = sortItems(items, 'data-desc');
    expect(res[0].nome).toBe('Attack on Titan');
  });

  it('inverte o nome em ordem decrescente (Z-A)', () => {
    const res = sortItems(items, 'nome-desc');
    expect(res[0].nome).toBe('Zelda');
    expect(res[1].nome).toBe('Attack on Titan');
  });

  it('inverte a data (mais antiga primeiro)', () => {
    const res = sortItems(items, 'data-asc');
    expect(res[0].nome).toBe('Zelda');
  });

  it('ordena o ano nas duas direções', () => {
    const comAno = [
      { nome: 'Meio', ano: 1999 },
      { nome: 'Antigo', ano: 1987 },
      { nome: 'Novo', ano: 2015 }
    ];
    expect(sortItems(comAno, 'ano-desc').map(i => i.nome)).toEqual(['Novo', 'Meio', 'Antigo']);
    expect(sortItems(comAno, 'ano-asc').map(i => i.nome)).toEqual(['Antigo', 'Meio', 'Novo']);
  });

  it('joga o título sem ano para o fim nas duas direções', () => {
    // Sem a sentinela, `ano || 0` punha o ausente no topo da ordem ascendente —
    // e "sem ano" não é "o mais antigo do acervo".
    const comSem = [
      { nome: 'Sem ano' },
      { nome: 'Novo', ano: 2015 },
      { nome: 'Antigo', ano: 1987 }
    ];
    expect(sortItems(comSem, 'ano-asc').map(i => i.nome)).toEqual(['Antigo', 'Novo', 'Sem ano']);
    expect(sortItems(comSem, 'ano-desc').map(i => i.nome)).toEqual(['Novo', 'Antigo', 'Sem ano']);
  });

  it('ordena o tier nas duas direções e mantém o sem tier no fim', () => {
    const comTier = [
      { nome: 'D', tier: 'D' },
      { nome: 'S+', tier: 'S+' },
      { nome: 'B', tier: 'B' },
      { nome: 'Sem tier' }
    ];
    expect(sortItems(comTier, 'tier-asc').map(i => i.nome)).toEqual(['S+', 'B', 'D', 'Sem tier']);
    expect(sortItems(comTier, 'tier-desc').map(i => i.nome)).toEqual(['D', 'B', 'S+', 'Sem tier']);
  });

  it('ordena o progresso nas duas direções', () => {
    // O progresso é episódio sobre total; `temporada` só entra com o mapa de
    // episódios por temporada, então o teste usa os dois campos que ele lê.
    const comProgresso = [
      { nome: 'Baixo', episodio: 2, totalEpisodios: 10 },
      { nome: 'Alto', episodio: 8, totalEpisodios: 10 }
    ];
    expect(sortItems(comProgresso, 'progresso-desc').map(i => i.nome)).toEqual(['Alto', 'Baixo']);
    expect(sortItems(comProgresso, 'progresso-asc').map(i => i.nome)).toEqual(['Baixo', 'Alto']);
  });
});
