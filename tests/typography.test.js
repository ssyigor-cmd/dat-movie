import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cssBruto = readFileSync(join(raiz, 'style.css'), 'utf8');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

/**
 * Comentários fora. A folha explica as decisões no código, e explicar inclui
 * nomear tokens que não são mais regras — `sans-serif` e `--font-mono` aparecem
 * hoje só nas notas que contam por que a família é esta. Varrer o texto cru
 * trataria a nota como se fosse uma declaração.
 */
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
const css = semComentarios(cssBruto);

/**
 * Cada regra com os seletores separados, um por elemento.
 *
 * O que vem antes do `{` é o seletor colado ao resto da regra anterior, e o
 * seletor pode ocupar várias linhas. Pegar só a última linha deixa de fora os
 * 27 seletores de um bloco e faz o teste passar errado: ele via o bloco de
 * display como se fossem trinta regras de uma linha cada.
 */
const regras = () =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    corpo: m[2],
    seletores: m[1].split('}').pop().split(',').map((s) => s.trim()).filter(Boolean)
  }));

/** Todo arquivo .js/.html em src, para o markup inteiro e não três arquivos. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(js|html)$/.test(e.name) ? [p] : [];
  });
}

/** Regras que declaram `font-family` de verdade (`:root` guarda o token, não uma regra). */
const regrasComFamilia = () => regras().filter((r) => /font-family:\s*[^;]/.test(r.corpo));

/** Os pesos que a folha inteira aplica a um seletor, somando todas as regras que o nomeiam. */
function pesosDoSeletor(sel) {
  const out = new Set();
  for (const r of regras()) {
    if (!r.seletores.includes(sel)) continue;
    for (const m of r.corpo.matchAll(/font-weight:\s*(\d+)/g)) out.add(Number(m[1]));
  }
  return out;
}

/** As famílias e os pesos que cada `family=` do link carrega de verdade. */
const familiasDoLink = () =>
  [...html.matchAll(/family=([^&"]+)/g)].map((m) => {
    const familia = decodeURIComponent(m[1].split(':')[0]).replace(/\+/g, ' ');
    const trecho = m[1].split(':')[1] || '';
    // `14..32,400;14..32,500` → os números depois de cada vírgula, que são os
    // pesos; o eixo antes da vírgula (`opsz`, `wght`) não entra.
    const pesos = [...new Set(trecho.split('@')[1]?.split(';').map((p) => Number(p.split(',').pop())).filter(Number.isFinite) ?? [])];
    return { familia, pesos };
  });

/**
 * Três famílias, três papéis, e a hierarquia feita da diferença.
 *
 * Inter é a base: corpo de texto, botões, episódios e a interface geral.
 * Space Grotesk nomeia — título, cabeçalho, destaque. JetBrains Mono fica
 * reservada a dado técnico, código e texto que precisa alinhar em coluna:
 * número de episódio, data, ano, contagem, porcentagem, campo de busca.
 *
 * A tentativa de fazer isso com uma fonte só (JetBrains Mono) e a seguinte com
 * uma fonte só de display (Bebas Neue) tocaram as duas metades do problema: a
 * Bebas Neue tem um peso só, então os `font-weight` viraram negrito sintético em
 * cima de um desenho estreito, e a sinopse em 0.85rem condensado ficou ilegível.
 *
 * Estes testes existem para o `font-family` não voltar a ser marcação de papel
 * item a item, para nenhuma família literal escapar dos tokens, e para o mono
 * não invadir o papel de nomear.
 */
describe('tipografia: três famílias, três papéis', () => {
  it('carrega as três famílias, e elas são as dos tokens', () => {
    // No link do Google Fonts o espaço vai como `+` (`Space+Grotesk`), e
    // `decodeURIComponent` não sabe disso — ele só entende `%20`.
    const familias = familiasDoLink().map((f) => f.familia).sort();
    expect(familias, 'famílias no link de fontes').toEqual(['Inter', 'JetBrains Mono', 'Space Grotesk']);

    expect(css.match(/--font-body:\s*'([^']+)'/)?.[1], 'a família da base, que é o texto').toBe('Inter');
    expect(css.match(/--font-display:\s*'([^']+)'/)?.[1], 'a família de display').toBe('Space Grotesk');
    expect(css.match(/--font-mono:\s*'([^']+)'/)?.[1], 'a família de dado técnico').toBe('JetBrains Mono');
  });

  it('as três famílias continuam onde estavam, para o layout não dançar', () => {
    // O `body` continua sendo a base, e a fonte de sistema é o fallback.
    expect(css, 'body com a base').toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-body\)/);

    // input, select, textarea e button não herdam `font-family` no navegador.
    // Sem esta regra eles caem na fonte de sistema — a segunda fonte do CSS,
    // invisível numa revisão.
    const FORMS = /\b(input|select|textarea|button|option|optgroup)\b/i;
    const controles = regras().filter((r) => r.seletores.some((s) => FORMS.test(s)));
    expect(controles.length, 'regras de controle de formulário').toBeGreaterThan(0);

    // O seletor sozinho não diz se a regra é "para um botão": `.home-empty-btn`
    // e `.home-backtop` são `<button>` no markup. Por isso a checagem resolve a
    // classe na tag que a carrega, em vez de confiar no nome.
    const markup = semComentarios(
      [join(raiz, 'index.html'), ...walk(join(raiz, 'src'))].map((f) => readFileSync(f, 'utf8')).join('\n')
    );

    /** classe → tag de formulário que a carrega, no markup inteiro. */
    const controlesEmMarkup = new Map();
    for (const m of markup.matchAll(/<(input|select|textarea|button|option|optgroup)\b([^>]*)>/g)) {
      for (const c of m[2].matchAll(/class="([^"]*)"/g)) {
        for (const classe of c[1].split(/\s+/).filter(Boolean)) {
          if (!controlesEmMarkup.has(classe)) controlesEmMarkup.set(classe, m[1].toLowerCase());
        }
      }
    }
    const classeDeFormulario = (classe) => controlesEmMarkup.has(classe);

    // Nenhum controle pode ficar sem família: sem isso ele cai na fonte de
    // sistema, que é a segunda fonte do CSS e não aparece em revisão nenhuma.
    // Qualquer um dos três tokens serve, porque um botão pode legitimamente
    // estar no papel de display (`.season-toggle`, `.tier-option`); o defeito
    // é não declarar, não declarar a base.
    const semFamilia = [];
    for (const { seletores } of controles) {
      for (const sel of seletores) {
        const classes = [...sel.matchAll(/\.([a-z][\w-]*)/g)].map((c) => c[1]);
        // Só a última classe está no elemento: `.title-page .dm-status-btn` é
        // um botão dentro de uma seção, e `.title-page` é o contêiner.
        const tag = classes[classes.length - 1];
        if (!tag || !classeDeFormulario(tag)) continue;
        // Pseudo-elemento não carrega `font-family` sozinho: herda do elemento.
        if (sel.includes('::')) continue;

        // A cobertura pode vir da regra do próprio seletor, de uma regra base mais
        // genérica (`.tier-option` cobre `#addTierDropdown .tier-option`), ou
        // do reset por elemento. O reset é o que fecha o caso: sem ele,
        // input/select/textarea/button não herdam `font-family` e caem na
        // fonte de sistema.
        const cobre = (alvo) =>
          regras().some(
            (r) =>
              /font-family:\s*(var\(--font-[a-z]+\)|inherit)/.test(r.corpo) &&
              r.seletores.some((s) => {
                const limpo = s.replace(/::?[a-z-]+(\([^)]*\))?/g, '').trim();
                return limpo === alvo || alvo.startsWith(`${limpo} `);
              })
          );

        // O reset por elemento: `button { ... }` vale para todo botão, e é o
        // que garante que nenhum controle fica na fonte de sistema.
        const resetDeElemento = new Set(
          regras()
            .filter((r) => /font-family:\s*(var\(--font-[a-z]+\)|inherit)/.test(r.corpo))
            .flatMap((r) => r.seletores)
            .filter((s) => /^(?:[a-z]+|\*|html|body)(?:\s*,|$)/.test(s.trim()) && !s.includes('.'))
            .flatMap((s) => s.split(',').map((p) => p.trim()))
        );

        // O reset por elemento cobre pela *tag*, não pela classe: `button { ... }`
        // fecha todo botão, e `.tier-option:hover` herda do `.tier-option` e do
        // reset. Como a classe já foi resolvida em tag acima, basta ver se a
        // tag do controle aparece em algum reset.
        const tagDoControle = controlesEmMarkup.get(tag);
        const emReset = tagDoControle && [...resetDeElemento].some((r) =>
          new RegExp(`(^|[\\s,])${tagDoControle}(?![\\w-])`).test(r)
        );
        if (!cobre(sel) && !emReset) semFamilia.push(sel);
      }
    }
    expect(semFamilia, 'controles de formulário sem família declarada').toEqual([]);
  });

  it('nenhuma família literal escapa dos três tokens', () => {
    // `sans-serif`, `Arial`, `system-ui`: qualquer literal fora dos três
    // tokens é a segunda fonte entrando pela porta dos trás. Os fallbacks dos
    // tokens não contam — estão dentro da declaração do custom property.
    const literais = [...css.matchAll(/font-family:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((v) => !['var(--font-body)', 'var(--font-display)', 'var(--font-mono)', 'inherit'].includes(v));
    expect(literais, 'font-family que não vem de um token').toEqual([]);
  });

  it('o papel de nomear é um bloco só, mais o reset de headings', () => {
    // O bloco de display é um bloco só. Qualquer outro seletor com
    // `--font-display` seria display espalhado pela folha, que é o que este
    // teste existe para impedir.
    const soHeadings = (r) => r.seletores.every((s) => /^h[1-6]$/.test(s));
    const blocosDeDisplay = regrasComFamilia().filter((r) => r.corpo.includes('var(--font-display)'));
    const bloco = blocosDeDisplay.find((r) => !soHeadings(r));
    expect(bloco, 'bloco único que declara --font-display').toBeTruthy();
    expect(
      blocosDeDisplay.filter(soHeadings).length,
      'regras de display fora do bloco e do reset de headings'
    ).toBe(1);

    // O reset cobre o `h3` que ninguém nomeou, e é legítimo por conta própria.
    const resetDeHeadings = new Set(
      blocosDeDisplay.flatMap((r) => r.seletores).filter((s) => /^h[1-6]$/.test(s))
    );
    expect(resetDeHeadings.size, 'h1..h6 no reset de headings').toBe(6);
  });

  it('o mono fica reservado a dado técnico, e não invade o nome', () => {
    // A lista é o contrato: é o que separa "isto é um dado" de "isto nomeia
    // alguma coisa". Se um item entra aqui por ser pequeno, e não por ser
    // dado, o mono deixa de alinhar em coluna e vira só mais uma textura.
    const esperados = [
      '.card-body .badge',
      '.episode-airdate',
      '.episode-number',
      '.group-header .group-count',
      '.home-affinity-option small',
      '.home-calendar-dnum',
      '.home-calendar-epnum',
      '.home-field-row .toolbar-search input',
      '.nav-section-label',
      '.progress-pct'
    ];

    const blocosMono = regras().filter((r) => r.corpo.includes('var(--font-mono)'));
    const noMono = new Set(blocosMono.flatMap((r) => r.seletores));

    // Cada regra de mono tem um seletor só. Isso não é marcação item a item: é
    // o que separa dado de nome, e cada item da lista está aqui por ser dado.
    // O que o teste segura é a lista, não a forma — se alguém agrupar os 10 em
    // um bloco só, a reserva continua igualmente legível.
    expect(
      blocosMono.every((r) => r.seletores.length === 1),
      'toda regra de mono declara um seletor só'
    ).toBe(true);
    expect([...noMono].sort(), 'seletores com mono').toEqual(esperados);

    // E nenhum deles está no bloco de display: o papel é um ou o outro.
    const blocoDisplay = regras().find(
      (r) => r.corpo.includes('var(--font-display)') && !r.seletores.every((s) => /^h[1-6]$/.test(s))
    );
    const emDisplay = new Set(blocoDisplay.seletores);
    const nosDois = [...noMono].filter((s) => emDisplay.has(s));
    expect(nosDois, 'seletor nos dois papéis ao mesmo tempo').toEqual([]);
  });

  it('o card nomeia em display e o rodapé detalha em mono', () => {
    // O caso que o usuário reclamou, e a razão de existirem três famílias. O
    // título do card nomeia o filme e a porcentagem da barra detalha o dado:
    // uma nomeia, a outra detalha. Com uma fonte só, qualquer escolha quebra
    // metade — uma larga deixa o card sem o ar de cartaz, uma condensada deixa
    // a porcentagem ilegível a 0.56rem. A antiga linha de metadado (`.info`)
    // saiu da anatomia; o mono do rodapé agora é só a barra de progresso.
    const blocoDisplay = regras().find(
      (r) => r.corpo.includes('var(--font-display)') && !r.seletores.every((s) => /^h[1-6]$/.test(s))
    );
    const selDoDisplay = new Set(blocoDisplay.seletores);

    expect(selDoDisplay.has('.card-title'), '.card-title tem que estar no bloco de display').toBe(true);

    // E a hierarquia dentro do card continua: o título tem cor própria, e o
    // dado do rodapé não disputa com ele nem herda o display. A cor não é da
    // rampa: o nome mora sobre o overlay PRETO do pôster, em qualquer tema —
    // se voltar para `--text-primary`, no claro o texto fica quase-preto
    // sobre quase-preto e o hover não mostra nada.
    const h3 = regras().find((r) => r.seletores.includes('.card-title') && r.corpo.includes('line-clamp'));
    expect(h3, '.card-title do modelo').toBeTruthy();
    expect(h3.corpo).toMatch(/color:\s*var\(--text-on-photo\)/);
    expect(selDoDisplay.has('.progress-pct'), '.progress-pct é dado, não nome').toBe(false);

    const pct = regras().find((r) => r.seletores.includes('.progress-pct'));
    expect(pct, '.progress-pct do rodapé').toBeTruthy();
    expect(pct.corpo).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(pct.corpo).toMatch(/color:\s*var\(--text-(?:secondary|muted)\)/);
  });

  it('todo peso usado é carregado de verdade, em cada família', () => {
    // O link e a folha não podem divergir: o navegador não avisa que está
    // fabricando negrito — ele só engrossa os traços, e o resultado aparece
    // como texto ilegível. Foi o que reprovou a Bebas Neue, que tem um peso só.
    //
    // A verificação é por papel, não pela folha inteira: `font-weight: 700` em
    // `.nav-section-label` é problema da JetBrains Mono, e exigir que o Inter
    // carregue 700 por causa disso não diria nada sobre o mono. Cada família
    // responde pelos pesos que a folhamaplica nos seus seletores.
    const usados = [...new Set([...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    expect(usados.length, 'pesos na folha').toBeGreaterThan(0);

    const link = new Map(familiasDoLink().map((f) => [f.familia, new Set(f.pesos)]));

    for (const [familia, token] of [
      ['Inter', 'var(--font-body)'],
      ['Space Grotesk', 'var(--font-display)'],
      ['JetBrains Mono', 'var(--font-mono)']
    ]) {
      const carregados = link.get(familia);
      expect(carregados, `${familia} no link`).toBeTruthy();

      // A base não tem lista de seletores — ela é o `body`, e a folha inteira
      // pode pedir qualquer peso que a Inter tenha.
      const seletoresDoPapel = token === 'var(--font-body)'
        ? null
        : new Set(regras().filter((r) => r.corpo.includes(token)).flatMap((r) => r.seletores));
      expect(seletoresDoPapel?.size ?? 1, `seletores no papel ${familia}`).toBeGreaterThan(0);

      for (const sel of seletoresDoPapel ?? ['body']) {
        for (const p of pesosDoSeletor(sel)) {
          expect(carregados, `${familia}: ${sel} pede ${p}, que o link não carrega`).toContain(p);
        }
      }

      if (token === 'var(--font-body)') {
        for (const p of usados) {
          expect(carregados, `font-weight: ${p} sem estar no link de ${familia}`).toContain(p);
        }
      }
    }

    // E nenhuma família carrega peso que a folha não usa: cada peso a mais no
    // link é download que ninguém pediu.
    const tokenDe = {
      Inter: 'var(--font-body)',
      'Space Grotesk': 'var(--font-display)',
      'JetBrains Mono': 'var(--font-mono)'
    };
    for (const [familia, carregados] of link) {
      const token = tokenDe[familia];
      const seletoresDoPapel = token === 'var(--font-body)'
        ? null
        : new Set(regras().filter((r) => r.corpo.includes(token)).flatMap((r) => r.seletores));
      const pedidos = seletoresDoPapel === null
        ? usados
        : [...new Set([...seletoresDoPapel].flatMap((s) => [...pesosDoSeletor(s)]))];
      for (const p of carregados) {
        expect(pedidos, `${familia} carrega ${p}, que nenhum seletor usa`).toContain(p);
      }
    }
  });
});