import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comentários saem antes de tudo: eles explicam a paleta em prosa e citam
// valores que não são mais os do bloco.
const css = readFileSync(join(raiz, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const mainJs = readFileSync(join(raiz, 'src/main.js'), 'utf8');
const stateJs = readFileSync(join(raiz, 'src/lib/state.js'), 'utf8');
const titlePageJs = readFileSync(join(raiz, 'src/pages/titlePage.js'), 'utf8');

const corpoDe = (seletor) => {
  const m = css.match(new RegExp(`${seletor}\\s*\\{([^}]*)\\}`));
  expect(m, `bloco ${seletor}`).toBeTruthy();
  return m[1];
};

const props = (corpo) =>
  Object.fromEntries(
    [...corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );

const raizTokens = props(corpoDe(':root'));
const claroTokens = props(corpoDe('\\[data-theme="light"\\]'));

// Tokens que o modo claro PRECISA redefinir: superfície, borda, texto,
// acento, sombra e a rampa de tema. Se um deles faltar, tem componente
// ficando escuro (ou branco sobre branco) sem ninguém perceber.
const obrigatorios = [
  '--bg-primary', '--bg-primary-rgb', '--bg-surface', '--bg-elevated',
  '--bg-elevated-hover', '--bg-secondary', '--bg-hover', '--bg-well',
  '--border', '--border-strong',
  '--text-primary', '--text-secondary', '--text-muted', '--text',
  '--accent', '--accent-rgb', '--accent-hover', '--accent-ink', '--accent-soft',
  '--shadow', '--shadow-lg', '--scrollbar-thumb',
  '--ghost-bg', '--ghost-border', '--ghost-bg-hover', '--ghost-strong',
  '--text-faintest', '--text-faint', '--text-dim', '--text-soft', '--text-strong',
  '--danger-ghost-bg', '--danger-ghost-border', '--danger-ghost-text',
  '--danger-text', '--success-text', '--warning-text'
];

const luminancia = (hex) => {
  const h = hex.replace('#', '');
  const canais = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
};

describe('tema: o claro é override de token, não regra nova', () => {
  it('os dois blocos declaram color-scheme para os controles nativos', () => {
    expect(corpoDe(':root')).toContain('color-scheme: dark');
    expect(corpoDe('\\[data-theme="light"\\]')).toContain('color-scheme: light');
  });

  it('o claro redefine a lista inteira de superfície, texto e tema', () => {
    const faltando = obrigatorios.filter((t) => !(t in claroTokens));
    expect(faltando, 'tokens que o claro precisa inverter').toEqual([]);
  });

  it('o claro não inventa token que o :root não tem', () => {
    const orfaos = Object.keys(claroTokens).filter((t) => !(t in raizTokens));
    expect(orfaos, 'todo token claro existe na base').toEqual([]);
  });

  it('o claro inverte a luminância: fundo sob texto, não o contrário', () => {
    const fundoEscuro = raizTokens['--bg-primary'];
    const textoEscuro = raizTokens['--text-primary'];
    expect(luminancia(fundoEscuro), 'escuro: fundo mais fundo que o texto')
      .toBeLessThan(luminancia(textoEscuro));
    expect(luminancia(claroTokens['--bg-primary']), 'claro: fundo mais claro que o texto')
      .toBeGreaterThan(luminancia(claroTokens['--text-primary']));
  });

  it('a rampa de texto fraco segue ordenada nos dois temas', () => {
    // Hierarquia do Title Page: cada degrau precisa continuar mais denso que
    // o anterior, senão o "quase imperceptível" vira mais legível que o título.
    const rampa = ['--text-faintest', '--text-faint', '--text-dim', '--text-soft', '--text-strong'];
    const alfa = (v) => {
      const n = Number(v.match(/[\d.]+\)$/)?.[0]?.replace(')', ''));
      return Number.isFinite(n) ? n : NaN;
    };
    for (const bloco of [raizTokens, claroTokens]) {
      const medidas = rampa.map((t) => alfa(bloco[t]));
      expect(medidas.every((v) => Number.isFinite(v)), 'alfa legível em ' + JSON.stringify(medidas)).toBe(true);
      expect(medidas, 'degraus crescentes').toEqual([...medidas].sort((a, b) => a - b));
      expect(new Set(medidas).size, 'sem degraus repetidos').toBe(rampa.length);
    }
  });

  it('o CSS de interface não tem mais branco escrito à mão fora dos tokens', () => {
    // O que sobra de `rgba(255,255,255,` compacto é só chrome sobre imagem
    // (pôster, backdrop, bandeira): branco em cima de foto, e foto não
    // inverte com o tema. Superfície de app em branco solto seria bug claro.
    const soltos = css.match(/rgba\(255,255,255,[^)]*\)/g) || [];
    expect(soltos.length, `branco solto restante: ${soltos.join(', ')}`)
      .toBeLessThanOrEqual(8);
    // E a rampa de tema está toda em uso, não só declarada.
    for (const t of ['--ghost-bg', '--ghost-border', '--text-faintest', '--text-strong']) {
      expect(css, `${t} usado em regra`).toContain(`var(${t})`);
    }
    expect(titlePageJs).not.toContain('rgba(255,255,255,');
  });
});

describe('tema: a escolha do usuário', () => {
  it('o tema é aplicado no <head>, antes do style.css, sem flash', () => {
    const iScript = html.indexOf('dataset.theme');
    const iCss = html.indexOf('<link rel="stylesheet" href="style.css"');
    expect(iScript, 'script anti-flash existe').toBeGreaterThan(-1);
    expect(iCss, 'link do style.css existe').toBeGreaterThan(-1);
    expect(iScript, 'script ANTES do CSS').toBeLessThan(iCss);
    expect(html).toContain("localStorage.getItem('theme')");
    expect(html).toContain("prefers-color-scheme: light");
  });

  it('o dropdown do perfil oferece os três estados', () => {
    for (const valor of ['system', 'dark', 'light']) {
      expect(html, `rádio ${valor}`).toContain(`name="themeChoice" value="${valor}"`);
    }
    expect(html).toContain('role="radiogroup"');
  });

  it('state.js guarda a chave e conta ausência como system', () => {
    expect(stateJs).toContain("THEME: 'theme'");
    // Quem nunca escolheu nada segue o sistema; não cai num modo fixo.
    expect(stateJs).toContain(": 'system'");
  });

  it('main.js aplica o tema, persiste a escolha e escuta o sistema', () => {
    expect(mainJs).toContain('document.documentElement.dataset.theme = resolveTheme()');
    expect(mainJs).toContain('STORAGE_KEYS.THEME');
    expect(mainJs, 'troca ao vivo quando o SO muda')
      .toContain("prefersLight.addEventListener('change'");
    // O rádio 'Sistema' só pode reagir ao SO; os outros dois, ao clique.
    expect(mainJs).toContain("state.theme === 'system'");
  });
});

/**
 * No claro, três coisas brancas somem: o rosto da marca na navbar, o logo
 * do login e os PNGs de título do TMDB. Todas eram "invisível no escuro,
 * ok" que o override de token não alcança — cor de imagem não é token de
 * texto. Cada uma tem um conserto diferente e aqui fica o contrato das
 * três, para a próxima troca de tema não desfazer em silêncio.
 */
describe('modo claro: a marca e os logos não somem', () => {
  it('a marca troca para a variante clara junto com o data-theme', () => {
    // Os arquivos `-dark` da marca são brancos. O `content` troca a imagem
    // renderizada já na primeira pintura, sem esperar o JS — o `src` no
    // HTML continua sendo o `-dark` e o CSS vence na hora.
    expect(css).toContain('[data-theme="light"] .navbar-brand-icon');
    expect(css).toContain("content: url('assets/icon/icon-face-light.svg')");
    expect(css).toContain('[data-theme="light"] .auth-logo-img');
    expect(css).toContain("content: url('assets/logo/stacked-light.svg')");
    // Caminho escrito no CSS é caminho que existe: typo aqui vira ícone
    // quebrado que só aparece no tema errado.
    for (const asset of ['assets/icon/icon-face-light.svg', 'assets/logo/stacked-light.svg']) {
      expect(existsSync(join(raiz, asset)), asset).toBe(true);
    }
  });

  it('o favicon tem variante clara e main.js aplica a troca', () => {
    // Único ativo da marca que não troca por CSS: `content` não muda o
    // `href` de um <link>, então a troca é em applyTheme().
    expect(existsSync(join(raiz, 'assets/favicon/favicon-32-light.svg'))).toBe(true);
    expect(mainJs).toContain("'assets/favicon/favicon-32-light.svg'");
    expect(mainJs).toContain("'assets/favicon/favicon-32-dark.svg'");
  });

  it('o nome do card é branco nos dois temas, porque o overlay é preto sempre', () => {
    expect(css).toContain('--text-on-photo: #fff');
    const titulo = corpoDe('.card-title');
    expect(titulo, '.card-title usa o token de foto').toMatch(/color:\s*var\(--text-on-photo\)/);
    expect(titulo, '.card-title não herda a rampa').not.toMatch(/--text-primary/);
  });

  it('todo logo de título ganha contorno colado na forma, só no claro', () => {
    // PNG branco com transparência não tem borda: no claro ele se dissolve.
    // A cadeia de drop-shadow em quatro direções desenha o contorno pelo
    // canal alfa — um `outline` desenharia o retângulo da caixa, no do logo.
    // O seletor é o bloco dos dois lugares onde o logo ainda renderiza:
    // info do título e página de título.
    const regra = css.match(
      /\[data-theme="light"\] #titleLogoImg,\s*\[data-theme="light"\] #titleInfoLogoImg\s*\{([^}]*)\}/
    );
    expect(regra, 'bloco dos logos de título').toBeTruthy();
    expect((regra[1].match(/drop-shadow/g) || []).length, 'quatro direções')
      .toBe(4);
    // Cinza, não preto: preto marcava demais a borda (decisão depois de
    // ver no claro). Fino, não 1px: cheio pesava nos logos de 40px.
    // O tom e a espessura ficam no contrato para a próxima troca de tema
    // não "melhorar" a borda de volta.
    expect(regra[1], 'contorno cinza').toContain('#808080');
    expect(regra[1], 'sem preto').not.toMatch(/#000\b|#000000/);
    expect(regra[1], 'espessura de 0.1px').toContain('0.1px');
    // Sem 1px cheio: a espessura é 0.1, então um "1px" avulso (sem 0. antes)
    // seria a borda pesada voltando.
    expect(regra[1], 'sem 1px cheio').not.toMatch(/(^|[^.\d])1px/);
    // No escuro o PNG branco já declara sozinho: a regra só existe no claro,
    // sem uma gêmea escura que colocaria halo cinza no logo preto.
    expect(css, 'sem contorno no escuro').not.toMatch(
      /\[data-theme="dark"\] #titleLogoImg|\[data-theme="dark"\] #titleInfoLogoImg/
    );
    // Os dois lugares onde o logo renderiza entram no mesmo bloco.
    for (const id of ['#titleLogoImg', '#titleInfoLogoImg']) {
      expect(css, id).toContain(id);
    }
  });
});
