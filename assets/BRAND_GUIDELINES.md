# Dat-Movie Brand Guidelines

## Logo System

### File Structure
```
assets/
├── logo/
│   ├── logotype-dark.svg    # Full horizontal logotype (dark theme)
│   └── stacked-dark.svg     # Stacked vertical logo (dark theme)
├── icon/
│   └── icon-96-dark.svg     # App icon 96px (dark theme)
└── favicon/
    └── favicon-32-dark.svg  # Favicon 32px (dark theme)
```

## Color Palette

### Primary Colors
- **Dark Background**: `#08080F`
- **Accent Blue**: `#4A9EFF`
- **Text Light**: `#FFFFFF`
- **Divider Gray**: `#666666`

## Typography

Três famílias, três papéis. Inter é a base e descreve, Space Grotesk nomeia,
e JetBrains Mono fica reservada ao dado técnico que precisa alinhar em coluna.

| Papel | Família | Onde |
|---|---|---|
| Texto | **Inter** | corpo, sinopse, botões, inputs, episódios, interface geral |
| Display | **Space Grotesk** | título de cartão, cabeçalhos, títulos de seção, destaques |
| Mono | **JetBrains Mono** | número de episódio, data, ano, contagem, porcentagem, código |

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
```

Os ícones são da **Font Awesome 6.5.0**, em CDN e fora do Google Fonts:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
```

- **Pesos**: as três famílias carregam 400, 500, 600 e 700 (a JetBrains Mono
  parte de 500; 400 nela não é usado)
- **Fallbacks**: a base cai nos sans de sistema (`-apple-system`,
  `BlinkMacSystemFont`, `sans-serif`); o display e o mono caem em `sans-serif`
  e `monospace`. Tudo que é dimensionado em `ch` ou `em` de fonte muda de
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

### Nota sobre os SVG do logo

Os SVG carregam `<text font-family="Inter, sans-serif">` em vez de contorno em
`<path>`. Como o logo é carregado por `<img src>`, o SVG é renderizado num
contexto isolado e **não enxerga a webfont da página**: ele usa a Inter
instalada no sistema, ou cai no `sans-serif` genérico. Para a marca ficar
idêntica em qualquer máquina, o texto precisa ser convertido em `<path>` na
exportação. É o item em aberto desta seção.

## Logo Usage

### Full Logotype (Horizontal)
- **Use cases**: Headers, navigation, main branding
- **Dark theme**: `assets/logo/logotype-dark.svg`
- **Dimensions**: 320x80px
- **Minimum size**: 160x40px

### Stacked Logo (Vertical)
- **Use cases**: Splash screens, mobile headers, condensed spaces
- **Dark theme**: `assets/logo/stacked-dark.svg`
- **Dimensions**: 200x200px
- **Minimum size**: 100x100px

### App Icon
- **Use cases**: App launcher, mobile icons, PWA
- **Dark theme**: `assets/icon/icon-96-dark.svg`
- **Dimensions**: 96x96px
- **Available sizes**: 32px, 48px, 64px, 96px, 128px, 192px

### Favicon
- **Use cases**: Browser tabs, bookmarks
- **Dark theme**: `assets/favicon/favicon-32-dark.svg`
- **Dimensions**: 32x32px
- **Available sizes**: 16px, 32px, 48px

## Icon Design

The galaxy/atom icon features:
- **Three concentric rings** with varying opacity
- **Central blue dot** (`#4A9EFF`)
- **Scattered white/blue dots** simulating stars/atomic particles
- **Minimalist geometric style**

## Theme Implementation

### Dark Theme
- Background: `#08080F`
- Text: `#FFFFFF`
- Icon elements: White with varying opacity

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
- Use for legacy systems
- Required sizes: 32, 48, 64, 96, 128, 192, 512px
- Export from SVG using appropriate tools

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
<link rel="icon" type="image/svg+xml" href="assets/favicon/favicon-32-dark.svg">
```

## PWA Configuration

### manifest.json
```json
{
  "name": "Dat-Movie",
  "short_name": "Dat-Movie",
  "icons": [
    {
      "src": "assets/icon/icon-96-dark.svg",
      "sizes": "96x96",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "theme_color": "#08080F",
  "background_color": "#08080F"
}
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
