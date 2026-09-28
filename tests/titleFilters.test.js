import { describe, it, expect } from 'vitest';
import {
  NON_LATIN_SCRIPTS,
  MAX_FUTURE_DAYS,
  BLOCKED_TMDB_IDS,
  ALLOWED_ORIGINAL_LANGUAGES,
  isStrictlyNonLatinTitle,
  isAbsurdFutureDate,
  hasArtwork,
  displayTitle,
  isBlockedProduction,
  isAllowedLanguage,
  readOriginalLanguage,
  normalizeText
} from '../src/lib/titleFilters.js';

const NOW = new Date('2026-09-27T12:00:00');

describe('isStrictlyNonLatinTitle', () => {
  it('detecta títulos só em japonês, chinês, coreano e sânscrito', () => {
    expect(isStrictlyNonLatinTitle('進撃の巨人')).toBe(true);
    expect(isStrictlyNonLatinTitle('流浪地球')).toBe(true);
    expect(isStrictlyNonLatinTitle('사랑의 불시착')).toBe(true);
    expect(isStrictlyNonLatinTitle('महाभारत')).toBe(true);
    expect(isStrictlyNonLatinTitle('พระพุทธเจ้า')).toBe(true);
  });

  it('mantém títulos dos mesmos países quando estão em alfabeto latino', () => {
    expect(isStrictlyNonLatinTitle('Shogun')).toBe(false);
    expect(isStrictlyNonLatinTitle('Round 6')).toBe(false);
    expect(isStrictlyNonLatinTitle('Naruto')).toBe(false);
    expect(isStrictlyNonLatinTitle('Dune')).toBe(false);
    expect(isStrictlyNonLatinTitle('A Viagem no Tempo')).toBe(false);
  });

  it('aceita título mixto com ao menos uma letra latina', () => {
    expect(isStrictlyNonLatinTitle('進撃の巨人 Attack on Titan')).toBe(false);
    expect(isStrictlyNonLatinTitle('Olaf Presents')).toBe(false);
  });

  it('rejeita título não latino que tem uma palavra em inglês grudada', () => {
    // Regressão real: este título passou porque "BOSS" é latino.
    expect(isStrictlyNonLatinTitle('聚宝仙盆之杂灵根才是真BOSS')).toBe(true);
    expect(isStrictlyNonLatinTitle('愛の在其他 2 Fast')).toBe(true);
  });

  it('aceita título não latino com subtítulo em inglês dominante', () => {
    // "進撃の巨人 Attack on Titan" e "進撃の巨人 THE FINAL SEASON" têm a mesma
    // estrutura, então precisam do mesmo veredito: subtítulo latino domina.
    expect(isStrictlyNonLatinTitle('進撃の巨人 THE FINAL SEASON')).toBe(false);
  });

  it('aceita título misto quando o alfabeto latino domina', () => {
    expect(isStrictlyNonLatinTitle('進撃の巨人 Attack on Titan')).toBe(false);
    expect(isStrictlyNonLatinTitle('Round 6 愛の 불시착')).toBe(false);
  });

  it('não confunde número, símbolo ou texto vazio', () => {
    expect(isStrictlyNonLatinTitle('1899')).toBe(false);
    expect(isStrictlyNonLatinTitle('?!')).toBe(false);
    expect(isStrictlyNonLatinTitle('')).toBe(false);
    expect(isStrictlyNonLatinTitle(null, undefined)).toBe(false);
  });

  it('verifica todas as variações passadas', () => {
    expect(isStrictlyNonLatinTitle('Round 6', '사랑의 불시착')).toBe(true);
    expect(isStrictlyNonLatinTitle('Naruto', '(attrs)')).toBe(false);
  });

  it('círilico e grego não entram na lista de alfabetos estranhos', () => {
    expect(NON_LATIN_SCRIPTS).not.toContain('Cyrillic');
    expect(NON_LATIN_SCRIPTS).not.toContain('Greek');
  });
});

describe('isAbsurdFutureDate', () => {
  it('rejeita datas muito futuras', () => {
    expect(isAbsurdFutureDate('2030-01-01', NOW)).toBe(true);
    expect(isAbsurdFutureDate('2040-06-15', NOW)).toBe(true);
    expect(isAbsurdFutureDate('2088-12-31', NOW)).toBe(true);
  });

  it('aceita lançamento, passado e anúncio próximo', () => {
    expect(isAbsurdFutureDate('2026-09-27', NOW)).toBe(false);
    expect(isAbsurdFutureDate('2019-03-10', NOW)).toBe(false);
    expect(isAbsurdFutureDate('2027-01-15', NOW)).toBe(false);
  });

  it('trata data ausente ou inválida como não absurda', () => {
    expect(isAbsurdFutureDate(null, NOW)).toBe(false);
    expect(isAbsurdFutureDate('', NOW)).toBe(false);
    expect(isAbsurdFutureDate('data inválida', NOW)).toBe(false);
  });

  it('respeita a tolerância configurada', () => {
    expect(isAbsurdFutureDate('2027-09-27', NOW, 365)).toBe(false);
    expect(isAbsurdFutureDate('2027-10-27', NOW, 365)).toBe(true);
    expect(isAbsurdFutureDate('2027-10-27', NOW, 800)).toBe(false);
  });

  it('a tolerância padrão é de um ano', () => {
    expect(MAX_FUTURE_DAYS).toBe(365);
  });
});

describe('hasArtwork', () => {
  it('aceita pôster normalizado ou caminho cru', () => {
    expect(hasArtwork({ posterUrl: 'https://x/y.jpg' })).toBe(true);
    expect(hasArtwork({ posterPath: '/y.jpg' })).toBe(true);
    expect(hasArtwork({ raw: { poster_path: '/y.jpg' } })).toBe(true);
    expect(hasArtwork({ raw: { backdrop_path: '/b.jpg' } })).toBe(true);
  });

  it('rejeita item sem imagem', () => {
    expect(hasArtwork({ posterUrl: '', posterPath: null, raw: { poster_path: null } })).toBe(false);
    expect(hasArtwork({ id: 1, title: 'X' })).toBe(false);
    expect(hasArtwork(null)).toBe(false);
  });

  it('lê o pôster do objeto cru do TMDB, que é o que os carrosséis entregam', () => {
    // Regressão real: o filtro só olhava item.raw.poster_path e marcava 100% dos
    // itens reais como "sem imagem".
    expect(hasArtwork({ id: 1, name: 'Round 6', poster_path: '/abc.jpg' })).toBe(true);
    expect(hasArtwork({ id: 1, name: 'Round 6', poster_path: null, backdrop_path: '/b.jpg' })).toBe(true);
  });
});

describe('displayTitle', () => {
  it('lê o título nos formatos normalizado e cru', () => {
    expect(displayTitle({ title: 'Round 6' })).toBe('Round 6');
    expect(displayTitle({ raw: { name: 'Round 6' } })).toBe('Round 6');
    expect(displayTitle({ raw: { title: 'Dune' } })).toBe('Dune');
    expect(displayTitle({ raw: { original_name: '進撃の巨人' } })).toBe('進撃の巨人');
    expect(displayTitle(null)).toBe('');
  });
});

describe('normalizeText', () => {
  it('remove acento, pontuação e caixa, colapsando espaços', () => {
    expect(normalizeText('Séries  Ação!  ')).toBe('series acao');
    expect(normalizeText('Temporada 3 Completa')).toBe('temporada 3 completa');
    expect(normalizeText('—')).toBe('');
    expect(normalizeText(null)).toBe('');
  });
});

describe('isBlockedProduction', () => {
  it('bloqueia produção de canal pelo id do TMDB', () => {
    BLOCKED_TMDB_IDS.forEach(id => {
      expect(isBlockedProduction({ id })).toBe(true);
      expect(isBlockedProduction({ tmdb_id: id })).toBe(true);
    });
  });

  it('bloqueia marcação de canal no título', () => {
    expect(isBlockedProduction({ id: 1, name: 'Filme Completo Dublado' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Séries Temporada 3 Completa' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Inscreva-se no canal' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Meu Vlog de Família' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Full Movie' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'loja no Youtube' })).toBe(true);
  });

  it('bloqueia quando a sinopse é que menciona o canal', () => {
    expect(isBlockedProduction({ id: 1, name: 'Algum Show', overview: 'Série do canal do youtube' })).toBe(true);
    expect(isBlockedProduction({ id: 1, title: 'Show', raw: { overview: 'Gravado com o celular' } })).toBe(true);
  });

  it('bloqueia vídeo caseiro', () => {
    expect(isBlockedProduction({ id: 1, name: 'Found Footage na Floresta' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Vídeo Caseiro' })).toBe(true);
    expect(isBlockedProduction({ id: 1, name: 'Tour da Minha Casa' })).toBe(true);
  });

  it('não bloqueia produção legítima com nome parecido', () => {
    // Regressão real: `search/tv` por nome devolvia estes homônimos, e um id
    // escolhido por busca-ingênua derrubaria conteúdo bom.
    expect(isBlockedProduction({ id: 51817, name: 'As Tartarugas Ninjas' })).toBe(false);
    expect(isBlockedProduction({ id: 202307, name: 'So Help Me Todd' })).toBe(false);
    expect(isBlockedProduction({ id: 157226, name: 'Sunny' })).toBe(false);
    expect(isBlockedProduction({ id: 70153, name: 'The Toy Box' })).toBe(false);
    expect(isBlockedProduction({ id: 214920, name: 'Jingle All the Way!' })).toBe(false);
    expect(isBlockedProduction({ id: 112164, name: 'Aunty Donna' })).toBe(false);
    expect(isBlockedProduction({ id: 18497, name: 'Foursome' })).toBe(false);
  });

  it('não bloqueia por padrões genéricos que caem em conteúdo legítimo', () => {
    // Five Nights at Freddy's e similares não podem ser barrados.
    expect(isBlockedProduction({ id: 1, name: "Five Nights at Freddy's" })).toBe(false);
    expect(isBlockedProduction({ id: 1, name: 'BTS' })).toBe(false);
    expect(isBlockedProduction({ id: 1, name: 'Fandom' })).toBe(false);
    expect(isBlockedProduction({ id: 1, name: 'Round 6' })).toBe(false);
    expect(isBlockedProduction({ id: 1, name: 'Cobra Kai' })).toBe(false);
  });

  it('ignora item nulo e título vazio', () => {
    expect(isBlockedProduction(null)).toBe(false);
    expect(isBlockedProduction({ id: 1, name: '' })).toBe(false);
  });
});

describe('readOriginalLanguage / isAllowedLanguage', () => {
  it('aceita ingles, japones e coreano, que e o conjunto pedido', () => {
    expect([...ALLOWED_ORIGINAL_LANGUAGES].sort()).toEqual(['en', 'ja', 'ko']);
    expect(isAllowedLanguage({ original_language: 'en' })).toBe(true);
    expect(isAllowedLanguage({ original_language: 'ja' })).toBe(true);
    expect(isAllowedLanguage({ original_language: 'ko' })).toBe(true);
  });

  it('rejeita as producoes que o usuario apontou na home', () => {
    // Medido no pool real: tr 11, ar 35, hi 21, fr 42, de 21, ru 17, th 46, id 14, zh 167.
    ['tr', 'ar', 'hi', 'fr', 'de', 'ru', 'it', 'th', 'id', 'zh', 'es', 'pt', 'nl', 'ms']
      .forEach(lang => expect(isAllowedLanguage({ original_language: lang }), lang).toBe(false));
  });

  it('normaliza caixa e espacos do codigo', () => {
    expect(readOriginalLanguage({ original_language: ' EN ' })).toBe('en');
    expect(readOriginalLanguage({ original_language: 'KO' })).toBe('ko');
  });

  it('le o idioma no formato cru e aninhado do TMDB', () => {
    expect(readOriginalLanguage({ id: 1, name: 'X', original_language: 'ja' })).toBe('ja');
    expect(readOriginalLanguage({ id: 1, name: 'X', raw: { original_language: 'ko' } })).toBe('ko');
  });

  it('falha aberta quando o campo nao vem, para nao esvaziar a lista', () => {
    expect(readOriginalLanguage({ id: 1, name: 'Sem idioma' })).toBe('');
    expect(isAllowedLanguage({ id: 1, name: 'Sem idioma' })).toBe(true);
    expect(isAllowedLanguage(null)).toBe(true);
  });
});