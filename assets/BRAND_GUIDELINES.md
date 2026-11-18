# Dat-Movie Brand Guidelines

## Logo System

### File Structure
```
assets/
â”œâ”€â”€ logo/
â”‚   â”œâ”€â”€ logotype-dark.svg     # Navbar: sÃ³ o glifo (tema escuro)
â”‚   â”œâ”€â”€ logotype-light.svg    # Navbar: sÃ³ o glifo (tema claro)
â”‚   â”œâ”€â”€ stacked-dark.svg      # Vertical: sÃ³ o glifo, sem nome (escuro)
â”‚   â””â”€â”€ stacked-light.svg     # Vertical: sÃ³ o glifo, sem nome (claro)
â”œâ”€â”€ icon/
â”‚   â”œâ”€â”€ icon-face.svg         # Marca isolada (tema escuro)
â”‚   â”œâ”€â”€ icon-face-light.svg   # Marca isolada (tema claro)
â”‚   â”œâ”€â”€ apple-touch-icon.svg  # Fonte do Ã­cone de atalho iOS (opaco, sem cantos)
â”‚   â””â”€â”€ apple-touch-icon.png  # Ãcone de atalho iOS 180x180 (gerado)
â””â”€â”€ favicon/
    â”œâ”€â”€ favicon-32-dark.svg   # Favicon 32px (escuro)
    â”œâ”€â”€ favicon-32-light.svg  # Favicon 32px (claro)
    â”œâ”€â”€ favicon-16.png        # Raster 16px (gerado, ver scripts/build-favicons.mjs)
    â”œâ”€â”€ favicon-32.png        # Raster 32px (gerado)
    â”œâ”€â”€ favicon-48.png        # Raster 48px (gerado)
    â””â”€â”€ favicon.ico           # .ico multi-resoluÃ§Ã£o 16/32/48 (legado; gerado)
```

Os raster (`favicon-16/32/48.png`, `favicon.ico`) sÃ£o **gerados** a partir do
`favicon-32-dark.svg` por `scripts/build-favicons.mjs` (`npm run build:favicons`)
e versionados no repo â€” eles existem sÃ³ para navegadores que nÃ£o
consomem SVG em aba/atalho. NÃ£o edite Ã  mÃ£o; rode o script.

Os mesmos arquivos vivem em `public/assets/` â€” Ã© de lÃ¡ que o Vite serve em
runtime. Ao trocar um ativo, copie para os dois lugares, senÃ£o o build e o
`npm run dev` mostram marcas diferentes.

## Color Palette

A paleta Ã© quente e tem o areia como Ãºnica cor sÃ³lida de marca. O gradiente
"nascer do sol" (a faixa brasaâ†’noite) Ã© a base da identidade, mas atua como
**filete** â€” nunca como fill grande.

### Cores base
- **Fundo (escuro)**: `#08080b` (carvÃ£o quente)
- **CartÃ£o / superfÃ­cie (escuro)**: `#0D0D10`
- **Controle aninhado (escuro)**: `#121216`
- **Acento areia**: `#E5D8BF` (marca, progresso, foco)
- **Texto claro (escuro)**: `#F2EDE3`

### Cores base (tema claro)
- **Fundo**: `#F4F1EA`
- **SuperfÃ­cie**: `#FFFFFF`
- **Acento areia escurecido**: `#7A663B` (o creme cheio nÃ£o se lÃª como texto)
- **Texto escuro**: `#1B1915`

### O filete "nascer do sol" (gradiente Ãºnico)
Gradiente linear horizontal, uma Ãºnica direÃ§Ã£o: da brasa Ã  meia-noite.
Stops exatos (fonte: `<linearGradient>` nos SVGs de assets â€” eles sÃ£o a fonte
de verdade agora; o app nÃ£o tem mais token de gradiente):

```
#8c2d10 0% Â· #d95f0e 18% Â· #fdba74 36% Â· #fff7ed 50%
#bfdbfe 68% Â· #60a5fa 84% Â· #0f172a 100%
```

Usos: **somente no mark** â€” o filete na base dos assets (icon, favicon,
lockups). NÃ£o hÃ¡ gradiente na interface; o item ativo do menu e as tabs
usam `--accent` sÃ³lido. Nunca como fill, nunca em bordas, sombras ou
fundos.

Os valores vivem nos tokens do `style.css` (`--accent`, `--bg-primary`, â€¦):
o guia descreve a intenÃ§Ã£o, o token Ã© a fonte de verdade.

## Typography

TrÃªs famÃ­lias, trÃªs papÃ©is. Inter Ã© a base e descreve, Sora nomeia,
e IBM Plex Mono fica reservada ao dado tÃ©cnico que precisa alinhar em coluna.

| Papel | FamÃ­lia | Onde |
|---|---|---|
| Texto | **Inter** | corpo, sinopse, botÃµes, inputs, episÃ³dios, interface geral |
| Display | **Sora** | tÃ­tulo de cartÃ£o, cabeÃ§alhos, tÃ­tulos de seÃ§Ã£o, destaques |
| Mono | **IBM Plex Mono** | nÃºmero de episÃ³dio, data, ano, contagem, porcentagem, cÃ³digo |

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
```

Os Ã­cones sÃ£o da **Font Awesome 6.5.0**, em CDN e fora do Google Fonts:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
```

- **Pesos**: Inter carrega 400â€“700; Sora carrega 400, 600 e 700 (os pesos que
  o display usa); IBM Plex Mono carrega 500, 600 e 700 (os pesos que o dado
  usa)
- **Fallbacks**: a base cai nos sans de sistema (`-apple-system`,
  `BlinkMacSystemFont`, `sans-serif`); o display cai em `sans-serif` e o mono
  em `monospace`. Tudo que Ã© dimensionado em `ch` ou `em` de fonte muda de
  mÃ©trica se a substituta for de outra largura, entÃ£o o fallback nÃ£o Ã©
  decoraÃ§Ã£o.

`tests/typography.test.js` impede que uma famÃ­lia literal escape dos trÃªs
tokens, que o display se espalhe pela folha, que o mono invada o papel de nomear
e que um `font-weight` caia fora da faixa do link â€” nos dois sentidos: nem um
peso usado sem carregar, nem um carregado sem uso.

### Regra de peso

Nenhum `font-weight` pode ficar fora da faixa carregada. O navegador nÃ£o avisa
que estÃ¡ fabricando negrito â€” ele sÃ³ engrossa os traÃ§os, e o resultado aparece
como texto ilegÃ­vel. Foi o que reprovou a Bebas Neue (peso Ãºnico, 400).

O link original carregava Space Grotesk em 600/700 e JetBrains Mono em 500, e
nove regras pediam fora disso: `.header-subtitle` e `.epp-season-text` em 400,
`.stat-label` em 500, e `.episode-number`, `.home-calendar-dnum`,
`.stat-number`, `.nav-section-label`, `.pesquisa-card-body .badge` e o campo de
busca da home em 600/700. Nove elementos renderizavam em negrito sintÃ©tico.
Resolvido em 28/09/2026, com os pesos somados ao link â€” o conserto Ã© de uma
linha, mas o link passa a ser consequÃªncia da folha e nÃ£o heranÃ§a do design.

Em 10/10/2026 a Space Grotesk saiu do sistema em duas etapas: primeiro o
display caiu para JetBrains Mono, depois a revisÃ£o completa trocou o display
para **Sora** (400/600/700), com o mono de volta a 500/600/700. Na sequÃªncia,
a JetBrains Mono foi substituÃ­da por **IBM Plex Mono** nos mesmos pesos. O
link carrega Inter + Sora + IBM Plex Mono, cada peso como consequÃªncia da
folha.

### Nota sobre texto nos SVG da marca

Nenhum SVG da marca carrega `<text>` â€” todos sÃ£o sÃ³ geometria (o glifo "d" e o
filete). EntÃ£o nÃ£o hÃ¡ dependÃªncia de webfont nem item pendente de conversÃ£o
para contorno. A palavra datmovie nÃ£o aparece nos ativos de marca.

## Logo Usage

### Logotype (marca da navbar)
- **Use cases**: Headers, navigation
- **Dark theme**: `assets/logo/logotype-dark.svg`
- **Light theme**: `assets/logo/logotype-light.svg`
- **Dimensions**: 48x48px (viewBox quadrado)
- **Minimum size**: 24x24px
- **SÃ³ o glifo**: sem o nome â€” a marca na barra Ã© apenas o "d" com o filete

### Stacked Logo (marca isolada em formato quadrado)
- **Use cases**: Splash screens, login, mobile headers, condensed spaces
- **Dark theme**: `assets/logo/stacked-dark.svg`
- **Light theme**: `assets/logo/stacked-light.svg`
- **Dimensions**: 160x160px (viewBox)
- **Minimum size**: 80x80px
- **SÃ³ o glifo**: sem o nome â€” nenhum ativo de marca carrega "datmovie"

### Marca isolada (icon)
- **Use cases**: favicon, marca sem texto
- **Dark theme**: `assets/icon/icon-face.svg`
- **Light theme**: `assets/icon/icon-face-light.svg`
- **Dimensions**: 96x96px

> O app nÃ£o tem Ã­cone de app nem camada de instalaÃ§Ã£o: Ã© **desktop-only** e
> roda no navegador. A experiÃªncia mobile Ã© outro projeto.

### Favicon
- **Use cases**: Browser tabs, bookmarks
- **Dark theme**: `assets/favicon/favicon-32-dark.svg`
- **Light theme**: `assets/favicon/favicon-32-light.svg`
- **Dimensions**: 32x32px
- **Available sizes**: SVG (16/32/48 via escala), PNG 16/32/48, `.ico` multi-resoluÃ§Ã£o
- **Legacy**: `<link rel="alternate icon" href="assets/favicon/favicon.ico" sizes="any">`
  ao lado do link SVG â€” navegadores sem suporte a SVG caem no `.ico`;
  os demais seguem com o SVG (e com a troca clara/escura via JS)

## Icon Design

The mark is a **geometric lowercase "d"** (the initial of datmovie) with a
"nascer do sol" filete under it:

- **Bowl**: rounded-square 27Ã—24 (rx 8.5), `#E5D8BF` no escuro / `#7A663B` no claro
- **Counter**: square hole 10Ã—10 (rx 2.5), na cor do fundo (`#08080b` / `#F4F1EA`)
- **Stem**: rounded-rect 9.5Ã—40 (rx 4.75), mesma cor do bowl
- **Filete**: gradiente Ãºnico nascer do sol, 56Ã—2.3 (rx 1.15) em y=74,
  correndo de `#8c2d10` a `#0f172a`; no favicon de 32px o filete sobe para
  ~3.6 de espessura para legibilidade
- **Geometry is theme-independent**: muda sÃ³ a cor do glifo (areia/bronze);
  o filete Ã© idÃªntico nos dois temas
- **Favicon / app icon**: o glifo vem sobre uma pastilha (fundo sÃ³lido
  `#08080b` no escuro, `#F4F1EA` no claro), porque glifos transparentes
  somem na aba do navegador
- **No text in the icon**: o glifo e o filete bastam

## Theme Implementation

### Dark Theme
- Background: `#08080b` (carvÃ£o quente)
- Glyph: `#E5D8BF` (areia)
- Logotype/stacked text: `#F2EDE3`
- Accent filete: gradiente nascer do sol (somente nos SVG de marca)

### Light Theme
- Background: `#F4F1EA`
- Glyph: `#7A663B`
- Logotype/stacked text: `#1B1915`
- Accent filete: gradiente nascer do sol (somente nos SVG de marca)

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
- Servem ao favicon legado (`favicon-16/32/48.png`, `favicon.ico`) e ao
  Ã­cone de atalho do iOS/iPadOS â€” gerados por `scripts/build-favicons.mjs`
  e versionados.
- **apple-touch-icon** (`assets/icon/apple-touch-icon.png`, 180x180):
  fundo carvÃ£o **opaco**, quadrado e sem cantos arredondados â€” o iOS aplica
  a mÃ¡scara dele prÃ³prio. Usado quando o usuÃ¡rio faz "Adicionar Ã  Tela de
  InÃ­cio" a partir do Safari. Declarado com
  `<link rel="apple-touch-icon" href="assets/icon/apple-touch-icon.png" sizes="180x180">`.
- Continua **sem** manifest/Web App layer â€” sÃ³ o Ã­cone do atalho.
- Fora desses casos, todo ativo de marca Ã© SVG. Se algum dia precisar de
  outro raster (ex.: um e-mail), gere a partir do SVG e nÃ£o versione.

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
<link rel="apple-touch-icon" href="assets/icon/apple-touch-icon.png" sizes="180x180" />
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
