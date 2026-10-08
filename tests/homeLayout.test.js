import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getFullWidthCount } from '../src/lib/trendingApi.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'style.css'), 'utf8');

/**
 * O padrão da home só se sustenta se a medida morar em um lugar. Ela mora nos
 * tokens `--home-*` do CSS e, para a conta "quantos cards cabem", só em
 * `getFullWidthCount` — que é o que todas as seções usam. Estes testes existem
 * porque a duplicação era o elo fraco: a seção "Títulos para você" carregava
 * uma tabela própria de medidas e um cartão mais largo, e mudar a largura só
 * no CSS deixava a faixa pedindo 7 cards num trilho que cabe 5.
 */

/** Lê o valor de uma custom property declarada em `:root` ou em media query. */
function token(nome) {
  const re = new RegExp(`${nome}:\\s*([^;]+);`, 'g');
  const achados = [...css.matchAll(re)].map((m) => m[1].trim());
  if (achados.length === 0) throw new Error(`Token ${nome} não declarado em style.css`);
  return achados;
}

/**
 * Tira comentários antes de varrer classes.
 *
 * Este projeto explica as decisões no código, e explicar inclui nomear o que
 * foi removido — `home-card` aparece hoje só nas notas que contam por que o
 * segundo modelo de card sumiu. Sem isto, a varredura via qualquer palavra
 * `home-*` e cobra de uma classe que ninguém emite.
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* ... */ (JS e CSS)
    .replace(/<!--[\s\S]*?-->/g, ' ')   // <!-- ... --> (HTML)
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // // ... sem engolir o `://` de uma URL
}

describe('padrão da home: tokens', () => {
  it('declara a escala de espaço e de superfície usada pela página', () => {
    for (const nome of [
      '--home-space-section',
      '--home-space-block',
      '--home-space-item',
      '--home-space-inner',
      '--home-surface-panel',
      '--home-surface-card',
      '--home-surface-well',
      '--home-card-w',
      '--fs-body',
      '--fs-meta',
      '--tap-icon',
      '--z-dropdown'
    ]) {
      expect(token(nome).length, nome).toBeGreaterThan(0);
    }
  });

  it('o texto do card não tem token na home', () => {
    // A escala do card é do modelo, no bloco CARD. O `--fs-card` existia só
    // para o `h3` da home e foi embora com o segundo modelo — um token sem
    // consumidor é a forma mais barata de o segundo modelo voltar.
    expect(() => token('--fs-card')).toThrow();
  });

  it('a escala de espaço tem um só dono, não um por seção', () => {
    // O problema original: `gap: 28px` no contêiner e `margin-bottom: 30px` em
    // cada seção, somando 58px entre duas seções. O espaçamento entre seções
    // tem que existir em um lugar só — o token, com ajuste responsivo.
    const bloco = css.match(/^\.home-section \{[\s\S]*?\n\}/m);
    expect(bloco, '.home-section').not.toBeNull();
    expect(bloco[0]).toContain('gap: var(--home-space-block)');
    expect(bloco[0]).not.toContain('margin-bottom');
    const contêiner = css.match(/^\.home-section-container \{[\s\S]*?\n\}/m)[0];
    expect(contêiner).toContain('gap: var(--home-space-section)');
  });

  it('o cartão, o esqueleto e o calendário saem da mesma largura', () => {
    // O cartão do trilho é `.card` + a variante de largura. A variante mora no
    // bloco CARD, no topo da folha, e é ela — não a home — que carrega a
    // medida: o modelo em si não conhece `--home-card-w`.
    for (const sel of ['.card--rail {', '.home-skeleton-card {', '.card--calendar {']) {
      const i = css.indexOf(sel);
      expect(i, sel).toBeGreaterThan(-1);
      const bloco = css.slice(i, css.indexOf('}', i));
      expect(bloco, sel).toContain('var(--home-card-w)');
    }
  });
});

describe('padrão do card: um modelo só', () => {
  it('a home usa o card do Catálogo, com variante de largura e nada mais', () => {
    // A home tinha um segundo cartão completo — raio, `padding`, `gap`, imagem
    // em `cover`, `translateY(-4px)`, trilha de 3px e subtítulo com família
    // própria. Cada tela ajustava o seu, e a pergunta "por que a fonte aqui é
    // outra" era a resposta. O que pode sobrar da home é largura, e só.
    for (const sel of ['.home-card', '.home-card-img', '.home-card-body', '.home-card-subtitle', '.home-card-progress-track', '.home-card-progress-bar', '.home-pick-card', '.home-calendar-card']) {
      expect(css.includes(sel), sel).toBe(false);
    }

    const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    expect(js).not.toMatch(/className = 'home-card/);
    // O que a home emite é o modelo mais a variante do trilho.
    expect(js).toContain("card.className = 'card card--rail'");
  });

  it('as variantes só mexem em largura, nunca em aparência', () => {
    // Uma variante que redesenha o cartão é o começo do segundo modelo. Estas
    // duas regras podem fixar largura e snap — e nada mais.
    const proibido = ['background', 'border', 'border-radius', 'box-shadow', 'font', 'padding', 'transform', 'object-fit', 'height'];
    for (const sel of ['.card--rail {', '.card--calendar {']) {
      const i = css.indexOf(sel);
      expect(i, sel).toBeGreaterThan(-1);
      const bloco = css.slice(i, css.indexOf('}', i));
      for (const prop of proibido) {
        expect(bloco, `${sel} -> ${prop}`).not.toContain(prop);
      }
    }
  });

  it('o rodapé do card não tem linha de metadado', () => {
    // A linha `T1 · Ep 02` saiu da anatomia: com nome, temporada/episódio e
    // porcentagem no mesmo rodapé, o card era poluído demais. O dado vive no
    // modal de detalhe; aqui sobra título + barra de progresso. Nenhuma tela
    // pode voltar a emitir `.info` por conta própria.
    expect(css).not.toContain('.card-body .info');
    for (const arq of ['components/cards.js', 'components/homePage.js']) {
      const src = readFileSync(join(raiz, 'src', arq), 'utf8');
      expect(src, arq).not.toContain('class="info"');
    }
  });

  it('a anatomia do card é escrita num lugar só', () => {
    // `.card-img` > `img` + título, depois `.card-body` > barra. Duas fábricas
    // escreviam essa estrutura em templates separados; agora `cardMarkup` é a
    // única, e as duas telas passam por ela.
    const cards = readFileSync(join(raiz, 'src/components/cards.js'), 'utf8');
    const home = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    expect(cards.match(/<div class="card-img">/g), 'card-img em cards.js').toHaveLength(1);
    expect(home, 'homePage.js escreve markup de card?').not.toContain('<div class="card-img">');
    expect(home, 'homePage.js escreve markup de card?').not.toContain('<div class="card-body">');
  });
});

describe('padrão da home: o trilho é uma primitiva só', () => {
  it('todo carrossel da home usa a classe do trilho', () => {
    const html = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    // Grade de Continuar, Calendário, e o esqueleto de carregamento tinham
    // implementação própria. Sem `home-h-scroll`, o esqueleto não rolava e o
    // conteúdo saía da tela, cortado pelo `overflow-x: hidden` do `body`.
    for (const id of ['homeContinueGrid', 'homeCalendarGrid', 'homeTrendingSkeleton']) {
      const tag = html.match(new RegExp(`<div[^>]*id="${id}"[^>]*>`));
      expect(tag, id).not.toBeNull();
      expect(tag[0], id).toContain('home-h-scroll');
    }
  });

  it('o esqueleto não tem layout próprio: ele herda a primitiva', () => {
    // Duas regras para o mesmo elemento é como a inconsistência nasce: uma
    // pessoa ajusta a largura do esqueleto e esquece a do cartão. `home-skeleton`
    // continua no markup como marcação de estado, mas sem carregar layout.
    const regras = [...css.matchAll(/^\.home-skeleton[\s-]?\w* \{/gm)].map((m) => m[0]);
    expect(regras, 'regras .home-skeleton*').toEqual(['.home-skeleton-card {']);
    // E o que ele herda precisa ser o suficiente: trilho com rolagem.
    const trilho = css.match(/^\.home-h-scroll \{[\s\S]*?\n\}/m)[0];
    expect(trilho).toContain('overflow-x: auto');
    expect(trilho).toContain('display: flex');
  });

  it('não sobrou nenhuma implementação paralela de carrossel', () => {
    // As quatro antigas: sem snap, sem máscara ou sem scrollbar.
    for (const morto of ['.home-continue-grid', '.home-calendar-grid', '.home-year-row', '.home-card-epname']) {
      expect(css.includes(morto), morto).toBe(false);
    }
  });

  it('toda classe que o JavaScript emite tem regra, e toda regra tem uso', () => {
    // O par de-keyframes que faltava: uma classe no markup sem regra é
    // estilo que alguém vai duplicar depois, e uma regra sem uso é herança de
    // layout que ninguém mais tem coragem de apagar.
    const js = semComentarios(readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8'));
    const html = semComentarios(readFileSync(join(raiz, 'index.html'), 'utf8'));
    const emitidas = new Set(
      [...`${js}${html}`.matchAll(/home-[a-z0-9_-]+/g)].map((m) => m[0])
    );
    const comRegra = new Set([...semComentarios(css).matchAll(/\.(home-[a-z0-9_-]+)/g)].map((m) => m[1]));

    // Uma classe do markup sem carregar layout, e o teste acima trava ela.
    // `home-skeleton` é o contêiner de carregamento: o esqueleto é filho dele e
    // cada barra se posiciona por `nth-child`, sem classe própria.
    const semLayout = new Set(['home-skeleton']);
    const semRegra = [...emitidas].filter((c) => !comRegra.has(c) && !semLayout.has(c));
    expect(semRegra, 'classes do markup sem regra no CSS').toEqual([]);

    const semUso = [...comRegra].filter((c) => !emitidas.has(c));
    expect(semUso, 'regras .home-* que ninguém usa').toEqual([]);
  });
});

describe('padrão da home: cabeçalho de seção', () => {
  it('toda seção do template abre com o mesmo cabeçalho', () => {
    const html = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    // Oito seções literais, mais as quatro faixas de afinidade geradas (que o
    // teste seguinte cobre). O piso é sobre as literais: ele existe para a
    // varredura não passar a verde por acidente se a home encolher de novo.
    const secoes = [...html.matchAll(/<section class="home-section[^"]*" id="(\w+)"/g)].map((m) => m[1]);
    expect(secoes.length).toBeGreaterThanOrEqual(8);
    for (const id of secoes) {
      const bloco = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
      expect(bloco, id).toContain('class="home-section-head"');
    }
  });

  it('a faixa de afinidade é uma seção como as outras, repetida', () => {
    // As quatro faixas saem de `railHTML`, e não literais no template: é o que
    // deixa cada uma ser colocada num ponto diferente da página. Elas precisam
    // mesmo assim do mesmo cabeçalho — é o que dá a todas a mesma altura e o
    // mesmo lugar para o botão de atualizar.
    const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    const ini = js.indexOf('function railHTML(');
    expect(ini, 'railHTML').toBeGreaterThan(-1);
    const bloco = js.slice(ini, js.indexOf('\n}\n', ini));
    expect(bloco).toContain('class="home-section"');
    expect(bloco).toContain('class="home-section-head"');
    expect(bloco).toContain('home-refresh-btn');
    expect(bloco).toContain('class="home-h-scroll"');
  });

  it('as faixas ficam espalhadas, e não empilhadas', () => {
    // O defeito era as quatro "Se você gostou de" uma embaixo da outra: quatro
    // títulos com o mesmo formato, na mesma tela, é uma seção só repetida. Cada
    // `railHTML` tem de cair entre seções diferentes, e não duas no mesmo
    // intervalo do template.
    const js = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    const chamadas = [...js.matchAll(/\$\{railHTML\((\d)\)\}/g)].map((m) => Number(m[1]));
    // Uma chamada por faixa, sem número repetido: um `Array.from` colocaria
    // as quatro no mesmo ponto da página.
    expect([...chamadas].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);

    // E o que importa de verdade: nenhuma delas é vizinha da outra no
    // template. Conta-se quantas seções de verdade existem antes de cada faixa;
    // duas faixas com o mesmo número estão empilhadas, com uma seção no meio
    // não.
    const corpo = js.slice(js.indexOf('container.innerHTML = `'));
    const ids = [...corpo.matchAll(/<section class="home-section[^"]*" id="(home\w+)"/g)].map((m) => m[1]);
    const quantasAntes = chamadas.map((n) => {
      const p = corpo.indexOf(`\${railHTML(${n})}`);
      return ids.filter((id) => corpo.indexOf(`id="${id}"`) < p).length;
    });
    const distintas = [...new Set(quantasAntes)];
    expect(distintas.length, 'faixas no mesmo ponto do template').toBe(chamadas.length);
    // E nenhuma de duas em duas: uma seção inteira de respiro entre elas.
    for (const [i, n] of [...distintas].sort((a, b) => a - b).entries()) {
      if (i === 0) continue;
      expect(n - [...distintas].sort((a, b) => a - b)[i - 1], 'faixas adjacentes').toBeGreaterThanOrEqual(1);
    }
  });

  it('o botão de atualizar tem alvo de toque, não 20px', () => {
    const i = css.indexOf('.home-refresh-btn {');
    const bloco = css.slice(i, css.indexOf('}', i));
    expect(bloco).toContain('width: var(--tap-icon)');
    expect(bloco).toContain('height: var(--tap-icon)');
    // A opacidade 0.5 sobre um ícone de 20px era o que o deixava sumir.
    expect(bloco).not.toContain('opacity: 0.5');
  });
});

describe('padrão da home: JS e CSS medem a mesma coisa', () => {
  it('a largura do cartão da home tem um lugar só', () => {
    // A seção "Títulos para você" tinha `--home-card-w-pick` (170/150/140) ao
    // lado de `--home-card-w` (130/120) porque a frase de prosa que ela
    // carregava não cabia no cartão comum. Quando ela saiu, o token perdeu o
    // motivo de existir: um segundo lugar para a mesma medida é o que deixa a
    // faixa destoar das vizinhas sem ninguém mexer em nada.
    expect(() => token('--home-card-w-pick')).toThrow(/não declarado/);
    expect(css).not.toContain('.card--pick');
    // E nenhuma variante de cartão fixa a largura por outro caminho. Só as
    // variantes contam: o interior do cartão (`.card-body`, `.card-img img`)
    // mede a própria caixa e não compete com a medida do trilho.
    const variantes = [...css.matchAll(/^\s*\.card--[a-z-]+ \{[^}]*?\bwidth:\s*([^;]+);/gm)].map((m) => m[1].trim());
    expect(variantes.length, 'variantes com largura').toBeGreaterThan(0);
    for (const w of variantes) {
      expect(w, `largura literal em variante: ${w}`).toMatch(/^var\(--home-card-w\)$/);
    }
  });

  it('o padding da página não tem regra espalhada pela folha', () => {
    // A cascata antiga tinha sete regras para o mesmo padding, três delas
    // mortas, e um degrau invertido: em 480px o topo voltava a 80px com a
    // navbar ainda em duas linhas, e o conteúdo passava por baixo dela.
    const comPadding = [...css.matchAll(/^\s*\.main-content \{[^}]*padding[^}]*\}/gm)].map((m) => m[0]);
    expect(comPadding).toHaveLength(1);
    expect(comPadding[0]).toContain('padding: var(--page-pad-top) var(--page-pad-x) var(--page-pad-bottom)');
  });

  it('o padding do topo muda só onde a navbar muda de altura', () => {
    // Duas alturas de navbar (uma linha, duas linhas) e dois degraus. A
    // tabela antiga tinha três degraus por largura arbitrária, e um deles
    // era menor que a navbar que precisava cobrir.
    const degraus = [...css.matchAll(/@media \(max-width: (\d+)px\) \{\s*\n?\s*:root \{[^}]*--page-pad-top:\s*(\d+)px/g)]
      .map((m) => [Number(m[1]), Number(m[2])]);
    expect(degraus).toEqual([[700, 152], [480, 144]]);

    // E cada folga precisa ser positiva, com a folga real medida no DOM:
    // navbar 64/97/89px contra 120/152/144px de padding.
    const navbar = [64, 97, 89];
    const pads = [120, 152, 144];
    const folgas = pads.map((p, i) => p - navbar[i]);
    expect(folgas.every((f) => f > 0), `folgas: ${folgas}`).toBe(true);
    // 55 ou 56px em toda largura: a distância não "salta" de um degrau para
    // o outro, que era o defeito.
    expect(Math.max(...folgas) - Math.min(...folgas)).toBeLessThanOrEqual(2);
  });

  it('getFullWidthCount quebra nos mesmos degraus que o CSS', () => {
    // A tabela antiga quebrava em 640 e 1024, que não existem em lugar nenhum
    // do layout. A 700px ela devolvia 14 com o cartão já Reducedo a 120px, e a
    // 1000px encolhia o pedido sem o cartão ter mudado de tamanho — o
    // esqueleto dava um salto de largura sem o trilho acompanhar.
    const comLargura = (w) => {
      globalThis.window = { innerWidth: w };
      try { return getFullWidthCount(); } finally { delete globalThis.window; }
    };
    // Degraus do CSS: 480 e 768 mudam `--home-card-w`.
    expect(comLargura(400)).toBe(10);
    expect(comLargura(500)).toBe(14);   // antes: 10
    expect(comLargura(800)).toBe(18);   // antes: 14
    expect(comLargura(1500)).toBe(20);
    expect(comLargura(2560)).toBe(20);
  });

  it('pede mais do que cabe na tela, senão o atualizar não tem de onde escolher', () => {
    // O trilho rola: o excedente é o que permite a próxima rodada trazer
    // títulos diferentes em vez de reordenar a mesma lista.
    for (const w of [400, 700, 1200, 1920]) {
      globalThis.window = { innerWidth: w };
      try {
        const card = w <= 768 ? 120 : 130;
        const visiveis = Math.floor((w - (w <= 480 ? 24 : 64)) / (card + 12));
        expect(getFullWidthCount(), `${w}px`).toBeGreaterThan(visiveis);
      } finally {
        delete globalThis.window;
      }
    }
  });
});

describe('padrão da home: nada de estilo inline no template', () => {
  it('as dimensões dos campos vêm do CSS', () => {
    const html = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    const template = html.slice(html.indexOf('container.innerHTML = `'), html.indexOf('<div class="home-foot">'));
    const inlines = [...template.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    // Sobrevive só o que é estado (`display:none`), nunca medida.
    for (const st of inlines) {
      expect(st, st).toMatch(/^display:\s*(none|flex|''|);?$/);
    }
  });

  it('a miniatura do dropdown não tem tamanho escrito à mão', () => {
    const html = readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');
    const linha = html.split('\n').find((l) => l.includes('<img src=') && l.includes('onerror'));
    expect(linha, 'linha do <img> do dropdown').toBeDefined();
    expect(linha).not.toContain('style="width:32px');
    // A medida vive no CSS, ao lado das demais.
    expect(css).toMatch(/\.home-affinity-option img \{[^}]*width: 32px/);
  });

  describe('painéis de ação centralizados', () => {
    const html = () => readFileSync(join(raiz, 'src/components/homePage.js'), 'utf8');

    it('só a roleta e a afinidade são centralizados', () => {
      // "Destaques do ano" divide o mesmo `--panel` e NÃO é centralizado: tem
      // um campo de busca que precisa alinhar com o menu suspenso, e um trilho
      // de resultado que perde o sentido no meio da tela. A classe é o que
      // separa os dois, então o teste olha a classe, não o painel.
      for (const [id,centralizado] of [
        ['homeRouletteSection', true],
        ['homeAffinitySection', true],
        ['homeYearSection', false]
      ]) {
        const linha = html().split('\n').find((l) => l.includes(`id="${id}"`));
        expect(linha, id).toBeDefined();
        expect(
          /home-section--centered/.test(linha),
          `${id} ${centralizado ? 'tem' : 'nao tem'} a classe home-section--centered`
        ).toBe(centralizado);
      }
    });

    it('centralizar não é só text-align: os filhos também se alinham', () => {
      // `text-align: center` sozinho centraria o texto e deixaria o botão, o
      // campo e os chips grudados na esquerda. O painel precisa de
      // `align-items`, e o cabeçalho de `justify-content` — senão o título
      // continua na borda e o resto flutua no meio.
      expect(css).toMatch(/\.home-section--centered \{[^}]*align-items: center/);
      expect(css).toMatch(/\.home-section--centered \.home-section-head \{[^}]*justify-content: center/);
      // O botão de painel vem com `align-self: flex-start`; sem o override
      // explícito ele continua à esquerda mesmo com o painel centralizado.
      expect(css).toMatch(/\.home-section--centered \.home-empty-btn \{[^}]*align-self: center/);
    });

    it('a simetria vem da largura de leitura, não só do alinhamento', () => {
      // Centralizado num painel de 1400px, o campo de busca estica de ponta a
      // ponta e o resultado vira um item perdido no meio do vazio. A largura
      // máxima é o que fecha a caixa.
      // A largura máxima está num seletor agrupado, não numa regra por
      // elemento: os quatro filhos de prosa compartilham a mesma medida.
      const agrupado = /\.home-section--centered \.home-hint,([^}]*)\{([^}]*)\}/.exec(css);
      expect(agrupado, 'seletor agrupado dos filhos de prosa').toBeTruthy();
      expect(agrupado[1]).toMatch(/\.home-error/);
      expect(agrupado[1]).toMatch(/\.home-affinity-search/);
      expect(agrupado[1]).toMatch(/\.home-affinity-chips/);
      expect(agrupado[2], 'a medida do painel').toMatch(/max-width: 560px/);
      expect(agrupado[2], 'e ele ocupa o que der').toMatch(/width: 100%/);
    });

    it('o campo da busca ocupa o wrapper, não os 360px do toolbar-search', () => {
      // O bug que sobrou: o wrapper tem 560px, mas `.toolbar-search` herda
      // `max-width: 360px` e não é centralizado — o campo aparece 100px à
      // esquerda do centro e o `margin: 0 auto` do pai não move nada, porque
      // o pai já ocupa a linha toda. A correção é no filho.
      expect(css).toMatch(
        /\.home-section--centered \.home-affinity-search \.toolbar-search \{[^}]*width: 100%[^}]*max-width: none/
      );
      // E o menu segue o campo, senão a centralização quebra o dropdown.
      expect(css).toMatch(
        /\.home-section--centered \.home-affinity-dropdown \{[^}]*left: 50%[^}]*transform: translateX\(-50%\)[^}]*width: 100%/
      );
    });

    it('o menu suspenso da afinidade abre alinhado ao campo', () => {
      // O dropdown se ancora no campo por `left`/`right`. Se o campo for
      // centralizado e o dropdown continuar esticado, o menu abre deslocado
      // do campo — o pior dos dois mundos, e só aparece ao abrir a busca.
      expect(css).toMatch(
        /\.home-section--centered \.home-affinity-dropdown \{[^}]*left: 50%[^}]*transform: translateX\(-50%\)[^}]*width: 100%/
      );
      expect(css).toMatch(/\.home-section--centered \.home-affinity-search \{[^}]*margin: 0 auto/);
    });

    it('o resultado da roleta não tem alinhamento inline', () => {
      // `res.style.justifyContent = 'center'` era justificado na base da roleta
      // e redundante com o CSS. Inline wins sobre folha, entãopassava a
      // impedir ajuste futuro pelo CSS — e o teste anterior sobre miniatura
      // sem estilo inline é exatamente o mesmo problema, na mesma seção.
      const linha = html().split('\n').find((l) => l.includes("res.style.justifyContent"));
      expect(linha, 'alinhamento inline da roleta').toBeUndefined();
      expect(css).toMatch(/\.home-roulette-result \{[^}]*justify-content: center/);
    });
  });
});
