# Dat-Movie Brand Guidelines

## Logo System

### File Structure
```
assets/
├── logo/
│   ├── logotype-dark.svg    # Full horizontal logotype (dark theme)
│   ├── logotype-light.svg   # Full horizontal logotype (light theme)
│   ├── stacked-dark.svg     # Stacked vertical logo (dark theme)
│   └── stacked-light.svg    # Stacked vertical logo (light theme)
├── icon/
│   ├── icon-96-dark.svg     # App icon 96px (dark theme)
│   └── icon-96-light.svg    # App icon 96px (light theme)
└── favicon/
    ├── favicon-32-dark.svg  # Favicon 32px (dark theme)
    └── favicon-32-light.svg # Favicon 32px (light theme)
```

## Color Palette

### Primary Colors
- **Dark Background**: `#08080F`
- **Light Background**: `#F4F4F8`
- **Accent Blue**: `#4A9EFF`
- **Text Dark**: `#08080F`
- **Text Light**: `#FFFFFF`
- **Divider Gray**: `#666666`

## Typography

### Font Family
- **Primary**: Inter (sans-serif)
- **Weight**: 600 (semibold)
- **Alternative**: System sans-serif fonts

## Logo Usage

### Full Logotype (Horizontal)
- **Use cases**: Headers, navigation, main branding
- **Dark theme**: `assets/logo/logotype-dark.svg`
- **Light theme**: `assets/logo/logotype-light.svg`
- **Dimensions**: 320x80px
- **Minimum size**: 160x40px

### Stacked Logo (Vertical)
- **Use cases**: Splash screens, mobile headers, condensed spaces
- **Dark theme**: `assets/logo/stacked-dark.svg`
- **Light theme**: `assets/logo/stacked-light.svg`
- **Dimensions**: 200x200px
- **Minimum size**: 100x100px

### App Icon
- **Use cases**: App launcher, mobile icons, PWA
- **Dark theme**: `assets/icon/icon-96-dark.svg`
- **Light theme**: `assets/icon/icon-96-light.svg`
- **Dimensions**: 96x96px
- **Available sizes**: 32px, 48px, 64px, 96px, 128px, 192px

### Favicon
- **Use cases**: Browser tabs, bookmarks
- **Dark theme**: `assets/favicon/favicon-32-dark.svg`
- **Light theme**: `assets/favicon/favicon-32-light.svg`
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

### Light Theme
- Background: `#F4F4F8`
- Text: `#08080F`
- Icon elements: Dark with varying opacity

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

<!-- Light theme logotype -->
<img src="assets/logo/logotype-light.svg" alt="Dat-Movie" class="logo">
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

@media (prefers-color-scheme: light) {
  .logo {
    content: url('assets/logo/logotype-light.svg');
  }
}
```

### Favicon Implementation
```html
<link rel="icon" type="image/svg+xml" href="assets/favicon/favicon-32-dark.svg">
<link rel="icon" type="image/svg+xml" href="assets/favicon/favicon-32-light.svg" media="(prefers-color-scheme: light)">
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