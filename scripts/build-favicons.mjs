/* Gera os raster da marca a partir dos SVGs fonte:
 *   - favicon-16.png / favicon-32.png / favicon-48.png (true-size, cantos arredondados transparentes)
 *   - favicon.ico (multi-resolução 16/32/48, PNGs embutidos) para navegadores legados
 *   - assets/icon/apple-touch-icon.png (180x180, fundo opaco, sem cantos — o iOS mascara)
 *
 * Uso: node scripts/build-favicons.mjs
 * Os arquivos vão para assets/ (espelhados em public/assets/, de onde o Vite
 * serve em runtime). Rode de novo sempre que um SVG fonte mudar. */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'assets/favicon/favicon-32-dark.svg');
const APPLE_SRC = join(root, 'assets/icon/apple-touch-icon.svg');
const APPLE_SIZE = 180;
const SIZES = [16, 32, 48];

const svg = readFileSync(SRC, 'utf8');

const pngs = SIZES.map(size => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0, 0, 0, 0)',
  });
  return { size, data: resvg.render().asPng() };
});

for (const { size, data } of pngs) {
  writeFileSync(join(root, `assets/favicon/favicon-${size}.png`), data);
}

// favicon.ico com PNGs embutidos (suportado desde o Windows Vista e por todo
// navegador que ainda lê .ico): ICONDIR + N ICONDIRENTRY + blobs PNG.
const HEADER = 6;
const ENTRY = 16;
const offset0 = HEADER + ENTRY * pngs.length;
const buf = Buffer.alloc(offset0 + pngs.reduce((acc, p) => acc + p.data.length, 0));
buf.writeUInt16LE(0, 0);       // reserved
buf.writeUInt16LE(1, 2);       // type: icon
buf.writeUInt16LE(pngs.length, 4);

let offset = offset0;
pngs.forEach(({ size, data }, i) => {
  const e = HEADER + ENTRY * i;
  buf.writeUInt8(size & 0xff, e);       // width (0 significa 256)
  buf.writeUInt8(size & 0xff, e + 1);   // height
  buf.writeUInt8(0, e + 2);             // palette colors
  buf.writeUInt8(0, e + 3);             // reserved
  buf.writeUInt16LE(1, e + 4);          // planes
  buf.writeUInt16LE(32, e + 6);         // bit count
  buf.writeUInt32LE(data.length, e + 8);
  buf.writeUInt32LE(offset, e + 12);
  data.copy(buf, offset);
  offset += data.length;
});
writeFileSync(join(root, 'assets/favicon/favicon.ico'), buf);

// Espelha para public/assets/favicon/ (Vite serve de lá em runtime)
const out = join(root, 'public/assets/favicon');
mkdirSync(out, { recursive: true });
for (const { size } of pngs) {
  copyFileSync(join(root, `assets/favicon/favicon-${size}.png`), join(out, `favicon-${size}.png`));
}
copyFileSync(join(root, 'assets/favicon/favicon.ico'), join(out, 'favicon.ico'));

// apple-touch-icon do iOS: PNG opaco 180x180, fundo papel chapado (tema claro)
const appleSvg = readFileSync(APPLE_SRC, 'utf8');
const apple = new Resvg(appleSvg, {
  fitTo: { mode: 'width', value: APPLE_SIZE },
  background: '#F4F1EA',
});
const applePng = apple.render().asPng();
writeFileSync(join(root, 'assets/icon/apple-touch-icon.png'), applePng);
const appleOut = join(root, 'public/assets/icon');
mkdirSync(appleOut, { recursive: true });
copyFileSync(join(root, 'assets/icon/apple-touch-icon.png'), join(appleOut, 'apple-touch-icon.png'));

console.log(`favicons gerados: ${pngs.map(p => p.size).join(', ')}px + favicon.ico (${buf.length} bytes)`);
console.log(`apple-touch-icon gerado: ${APPLE_SIZE}px (assets/icon + public/assets/icon)`);
