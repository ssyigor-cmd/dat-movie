# Dat-Movie Brand Guidelines

## Logo System

### File Structure
```
assets/
├── logo/
│   ├── logotype-dark.svg     # Navbar: só o glifo (tema escuro)
│   ├── logotype-light.svg    # Navbar: só o glifo (tema claro)
│   ├── stacked-dark.svg      # Vertical: só o glifo, sem nome (escuro)
│   └── stacked-light.svg     # Vertical: só o glifo, sem nome (claro)
├── icon/
│   ├── icon-face.svg         # Marca isolada (tema escuro)
│   └── icon-face-light.svg   # Marca isolada (tema claro)
└── favicon/
    ├── favicon-32-dark.svg   # Favicon 32px (escuro)
    ├── favicon-32-light.svg  # Favicon 32px (claro)
    ├── favicon-16.png        # Raster 16px (gerado, ver scripts/build-favicons.mjs)
    ├── favicon-32.png        # Raster 32px (gerado)
    ├── favicon-48.png        # Raster 48px (gerado)
    └── favicon.ico           # .ico multi-resolução 16/32/48 (legado; gerado)
```

Os raster (`favicon-16/32/48.png`, `favicon.ico`) são **gerados** a partir do
`favicon-32-dark.svg` por `scripts/build-favicons.mjs` (`npm run build:favicons`)
e versionados no repo — eles existem só para navegadores que não
consomem SVG em aba/atalho. Não edite à mão; rode o script.

Os mesmos arquivos vivem em `public/assets/` — é de lá que o Vite serve em
runtime. Ao trocar um ativo, copie para os dois lugares, senão o build e o
`npm run dev` mostram marcas diferentes.

## Color Palette

A paleta é quente e tem o areia como única cor sólida de marca. O gradiente
"nascer do sol" (a faixa brasa→noite) é a base da identidade, mas atua como
**filete** — nunca como fill grande.

### Cores base
- **Fundo (escuro)**: `#08080b` (carvão quente)
- **Cartão / superfície (escuro)**: `#0D0D10`
- **Controle aninhado (escuro)**: `#121216`
- **Acento areia**: `#E5D8BF` (marca, progresso, foco)
- **Texto claro (escuro)**: `#F2EDE3`

### Cores base (tema claro)
- **Fundo**: `#F4F1EA`
- **Superfície**: `#FFFFFF`
- **Acento areia escurecido**: `#7A663B` (o creme cheio não se lê como texto)
- **Texto escuro**: `#1B1915`

### O filete "nascer do sol" (gradiente único)
Gradiente linear horizontal, uma única direção: da brasa à meia-noite.
Stops exatos (fonte: tokens `--horizon` em `style.css` e `<linearGradient>` nos
SVG — os dois devem mudar juntos):

```
#8c2d10 0% · #d95f0e 18% · #fdba74 36% · #fff7ed 50%
#bfdbfe 68% · #60a5fa 84% · #0f172a 100%
```

Usos: sublinhado do item ativo do menu (`.nav-item.active::after`, 2px, cantos em pílula) e
filete na base do mark (icon, favicon, lockups). Vale nos dois temas. Nunca
como fill, nunca em bordas, sombras ou fundos.

Os valores vivem nos tokens do `style.css` (`--accent`, `--bg-primary`, …):
o guia descreve a intenção, o token é a fonte de verdade.

## Typography

Três famílias, três papéis. Inter é a base e descreve, Sora nomeia,
e IBM Plex Mono fica reservada ao dado técnico que precisa alinhar em coluna.

| Papel | Família | Onde |
|---|---|---|
| Texto | **Inter** | corpo, sinopse, botões, inputs, episódios, interface geral |
| Display | **Sora** | título de cartão, cabeçalhos, títulos de seção, destaques |
| Mono | **IBM Plex Mono** | número de episódio, data, ano, contagem, porcentagem, código |

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
```

Os ícones são da **Font Awesome 6.5.0**, em CDN e fora do Google Fonts:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
```

- **Pesos**: Inter carrega 400–700; Sora carrega 400, 600 e 700 (os pesos que
  o display usa); IBM Plex Mono carrega 500, 600 e 700 (os pesos que o dado
  usa)
- **Fallbacks**: a base cai nos sans de sistema (`-apple-system`,
  `BlinkMacSystemFont`, `sans-serif`); o display cai em `sans-serif` e o mono
  em `monospace`. Tudo que é dimensionado em `ch` ou `em` de fonte muda de
  métrica se a substituta for de outra largura, então o fallback não é
  decoração.

`tests/typography.test.js` impede que uma família literal escape dos três
tokens, que o display se espalhe pela folha, que o mono invada o papel de nomear
e que um `font-weight` caia fora da faixa do link — nos dois sentidos: nem um
peso usado sem carregar, nem um carregado sem uso.

### Regra de peso

Nenhum `font-weight` pode ficar fora da faixa carregada. O navegador não avisa
que está fabricando negrito — ele só engrossa os traços, e o resultado aparece
como texto ilegível. Foi o que reprovou a Bebas Neue (peso único, 400).

O link original carregava Space Grotesk em 600/700 e JetBrains Mono em 500, e
nove regras pediam fora disso: `.header-subtitle` e `.epp-season-text` em 400,
`.stat-label` em 500, e `.episode-number`, `.home-calendar-dnum`,
`.stat-number`, `.nav-section-label`, `.pesquisa-card-body .badge` e o campo de
busca da home em 600/700. Nove elementos renderizavam em negrito sintético.
Resolvido em 28/09/2026, com os pesos somados ao link — o conserto é de uma
linha, mas o link passa a ser consequência da folha e não herança do design.

Em 10/10/2026 a Space Grotesk saiu do sistema em duas etapas: primeiro o
display caiu para JetBrains Mono, depois a revisão completa trocou o display
para **Sora** (400/600/700), com o mono de volta a 500/600/700. Na sequência,
a JetBrains Mono foi substituída por **IBM Plex Mono** nos mesmos pesos. O
link carrega Inter + Sora + IBM Plex Mono, cada peso como consequência da
folha.

### Nota sobre texto nos SVG da marca

Nenhum SVG da marca carrega `<text>` — todos são só geometria (o glifo "d" e o
filete). Então não há dependência de webfont nem item pendente de conversão
para contorno. A palavra datmovie não aparece nos ativos de marca.

## Logo Usage

### Logotype (marca da navbar)
- **Use cases**: Headers, navigation
- **Dark theme**: `assets/logo/logotype-dark.svg`
- **Light theme**: `assets/logo/logotype-light.svg`
- **Dimensions**: 48x48px (viewBox quadrado)
- **Minimum size**: 24x24px
- **Só o glifo**: sem o nome — a marca na barra é apenas o "d" com o filete

### Stacked Logo (marca isolada em formato quadrado)
- **Use cases**: Splash screens, login, mobile headers, condensed spaces
- **Dark theme**: `assets/logo/stacked-dark.svg`
- **Light theme**: `assets/logo/stacked-light.svg`
- **Dimensions**: 160x160px (viewBox)
- **Minimum size**: 80x80px
- **Só o glifo**: sem o nome — nenhum ativo de marca carrega "datmovie"

### Marca isolada (icon)
- **Use cases**: favicon, marca sem texto
- **Dark theme**: `assets/icon/icon-face.svg`
- **Light theme**: `assets/icon/icon-face-light.svg`
- **Dimensions**: 96x96px

> O app não tem ícone de app nem camada de instalação: é **desktop-only** e
> roda no navegador. A experiência mobile é outro projeto.

### Favicon
- **Use cases**: Browser tabs, bookmarks
- **Dark theme**: `assets/favicon/favicon-32-dark.svg`
- **Light theme**: `assets/favicon/favicon-32-light.svg`
- **Dimensions**: 32x32px
- **Available sizes**: SVG (16/32/48 via escala), PNG 16/32/48, `.ico` multi-resolução
- **Legacy**: `<link rel="alternate icon" href="assets/favicon/favicon.ico" sizes="any">`
  ao lado do link SVG — navegadores sem suporte a SVG caem no `.ico`;
  os demais seguem com o SVG (e com a troca clara/escura via JS)

## Icon Design

The mark is a **geometric lowercase "d"** (the initial of datmovie) with a
"nascer do sol" filete under it:

- **Bowl**: rounded-square 27×24 (rx 8.5), `#E5D8BF` no escuro / `#7A663B` no claro
- **Counter**: square hole 10×10 (rx 2.5), na cor do fundo (`#08080b` / `#F4F1EA`)
- **Stem**: rounded-rect 9.5×40 (rx 4.75), mesma cor do bowl
- **Filete**: gradiente único nascer do sol, 56×2.3 (rx 1.15) em y=74,
  correndo de `#8c2d10` a `#0f172a`; no favicon de 32px o filete sobe para
  ~3.6 de espessura para legibilidade
- **Geometry is theme-independent**: muda só a cor do glifo (areia/bronze);
  o filete é idêntico nos dois temas
- **Favicon / app icon**: o glifo vem sobre uma pastilha (fundo sólido
  `#08080b` no escuro, `#F4F1EA` no claro), porque glifos transparentes
  somem na aba do navegador
- **No text in the icon**: o glifo e o filete bastam

## Theme Implementation

### Dark Theme
- Background: `#08080b` (carvão quente)
- Glyph: `#E5D8BF` (areia)
- Logotype/stacked text: `#F2EDE3`
- Accent filete: gradiente nascer do sol (`--horizon`)

### Light Theme
- Background: `#F4F1EA`
- Glyph: `#7A663B`
- Logotype/stacked text: `#1B1915`
- Accent filete: gradiente nascer do sol (`--horizon`)

## Usage Guidelines

### Do's
- Use SVG format for scalability
- Maintain aspect ratio
- Ensure adequate contrast
- Use appropriate theme variant

### Don'ts
- Don't stretch or distort the logo
- Don't change colors without approval
- Don't add drop shadows or effects
- Don't rotate the logo
- Don't use low-resolution versions

## File Formats

### SVG (Recommended)
- Scalable vector format
- Best for web and print
- File size: ~2KB per logo

### PNG (Raster)
- Servem só ao favicon legado: `favicon-16/32/48.png` e `favicon.ico`,
  gerados de `favicon-32-dark.svg` por `scripts/build-favicons.mjs` e
  versionados porque o `.ico` não dá para gerar no build do app.
- O app continua **desktop-only**: não há ícone de app, manifest,
  `apple-touch-icon` nem camada de instalação — usar PNGs para isso seria
  reintroduzir a camada PWA que foi removida de propósito.
- Fora do favicon legado, todo ativo de marca é SVG. Se algum dia precisar de
  outro raster (ex.: um e-mail), gere a partir do SVG e não versione.

## Web Implementation

### HTML Example
```html
<!-- Dark theme logotype -->
<img src="assets/logo/logotype-dark.svg" alt="Dat-Movie" class="logo">

```

### CSS Example
```css
.logo {
  height: 40px;
  width: auto;
}

/* Theme-aware logo */
@media (prefers-color-scheme: dark) {
  .logo {
    content: url('assets/logo/logotype-dark.svg');
  }
}

}
```

### Favicon Implementation
```html
<link rel="icon" type="image/svg+xml" href="assets/favicon/favicon-32-dark.svg" />
<link rel="alternate icon" href="assets/favicon/favicon.ico" sizes="any" />
```

## Maintenance

### Version Control
- Keep SVG files in version control
- Document any changes to this guide
- Maintain consistent naming convention

### Updates
- When updating the logo, update all variants
- Test across different backgrounds
- Verify accessibility and contrast
- Update documentation accordingly

## Contact

For brand-related questions or usage permissions, refer to the project repository.
