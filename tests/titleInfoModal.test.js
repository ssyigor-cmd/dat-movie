import { describe, it, expect } from 'vitest';
import { flagEmoji, flagUrl, LANG_PT, STATUS_ICON, STATUS_TONE } from '../src/components/titleInfoModal.js';

describe('flagEmoji', () => {
  it('converte ISO 3166-1 alpha-2 no par de simbolos regionais', () => {
    // Cada letra vira U+1F1E6 + (letra - 'A'), e o par de simbolos e a bandeira.
    expect(flagEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}');
    expect(flagEmoji('JP')).toBe('\u{1F1EF}\u{1F1F5}');
    expect(flagEmoji('KR')).toBe('\u{1F1F0}\u{1F1F7}');
    expect(flagEmoji('GB')).toBe('\u{1F1EC}\u{1F1E7}');
    expect(flagEmoji('BR')).toBe('\u{1F1E7}\u{1F1F7}');
  });

  it('aceita minuscula e espacos, que e como o campo as vezes vem', () => {
    expect(flagEmoji('jp')).toBe(flagEmoji('JP'));
    expect(flagEmoji('  us  ')).toBe(flagEmoji('US'));
  });

  it('nao gera lixo visual com entrada inesperada', () => {
    // `production_countries` traz `name` alem do `iso_3166_1`, e `origin_country`
    // as vezes vem vazio. Nada disso pode virar um emoji quebrado na tela.
    for (const ruim of ['USA', 'U1', '1', '', null, undefined, 0, 12, {}, '🙂', 'U1;drop']) {
      expect(flagEmoji(ruim)).toBe('');
    }
  });

  it('ainda aceita codigo valido que nao existe de verdade', () => {
    // Nao da para validar contra a ISO aqui, e um emoji de "pais inexistente"
    // e inofensivo: o texto ao lado continua sendo a informacao confiavel.
    expect(flagEmoji('XX')).toBe('\u{1F1FD}\u{1F1FD}');
  });
});

describe('LANG_PT', () => {
  it('traduz os tres idiomas permitidos', () => {
    expect(LANG_PT.en).toBe('Inglês');
    expect(LANG_PT.ja).toBe('Japonês');
    expect(LANG_PT.ko).toBe('Coreano');
  });

  it('nao tem codigo duplicado nem vazio', () => {
    const chaves = Object.keys(LANG_PT);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const k of chaves) {
      expect(k).toMatch(/^[a-z]{2}$/);
      expect(LANG_PT[k]).toBeTruthy();
    }
  });
});

describe('flagUrl', () => {
  it('monta a URL da bandeira em SVG, em minuscula', () => {
    // SVG e nao PNG: aceita o tema escuro sem borda branca e nao borra no hidpi.
    expect(flagUrl('JP')).toBe('https://flagcdn.com/jp.svg');
    expect(flagUrl('US')).toBe('https://flagcdn.com/us.svg');
    expect(flagUrl('BR')).toBe('https://flagcdn.com/br.svg');
  });

  it('normaliza caixa e espacos, como o TMDB as vezes devolve', () => {
    expect(flagUrl('jp')).toBe(flagUrl('JP'));
    expect(flagUrl('  us  ')).toBe('https://flagcdn.com/us.svg');
  });

  it('nao monta URL com entrada invalida', () => {
    // `production_countries` traz `name` alem do `iso_3166_1`; sem esta checagem a
    // URL sairia com o nome inteiro e o img viraria um pedido invalido.
    for (const ruim of ['USA', 'U1', '1', '', null, undefined, {}, 'us/../x', 'a b']) {
      expect(flagUrl(ruim)).toBe('');
    }
  });

  it('só monta URL para codigo que tambem tem emoji de reserva', () => {
    // O fallback do `onerror` depende do par de simbolos regionais. Se a URL
    // passar, o emoji tem que existir.
    for (const iso of ['US', 'jp', 'KR', 'GB', 'BR', 'FR', 'IT', 'TR', 'AR', 'IN']) {
      expect(flagUrl(iso)).not.toBe('');
      expect(flagEmoji(iso)).not.toBe('');
    }
  });
});

describe('marcador de status', () => {
  const casados = ['Returning Series', 'Ended', 'Canceled', 'In Production', 'Planned'];

  it('cobre todos os status que STATUS_PT traduz', () => {
    for (const s of casados) {
      expect(STATUS_ICON[s]).toBeTruthy();
      expect(STATUS_TONE[s]).toBeTruthy();
    }
  });

  it('usa check no encerrado, X no cancelado e play no em andamento', () => {
    // O icons Alone nao ajuda: o que separa "Em exibicao" de "Finalizada" sem ler
    // e o marcador, entao cada estado tem o seu.
    expect(STATUS_ICON.Ended).toBe('fa-check');
    expect(STATUS_ICON.Canceled).toBe('fa-xmark');
    expect(STATUS_ICON['Returning Series']).toBe('fa-play');
  });

  it('a cor tambem distingue o estado', () => {
    expect(STATUS_TONE.Ended).toBe('is-done');
    expect(STATUS_TONE.Canceled).toBe('is-canceled');
    expect(STATUS_TONE['Returning Series']).toBe('is-live');
  });

  it('nao repete tom entre estados que precisam ser lidos de forma diferente', () => {
    expect(new Set(casados.map(s => STATUS_TONE[s])).size).toBe(4);
  });

  it('usa classes de icone existentes, nao texto solto', () => {
    for (const cls of Object.values(STATUS_ICON)) {
      expect(cls).toMatch(/^fa-[a-z0-9-]+$/);
    }
  });

  it('cai num tom neutro para status desconhecido do TMDB', () => {
    // A API pode devolver status novo; nao pode estourar a classe de cor.
    expect(STATUS_TONE['Algum Status Novo']).toBeUndefined();
  });
});
