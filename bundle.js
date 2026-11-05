const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = __dirname;

// Generatore PNG puro in Node.js (senza dipendenze esterne) per icone 192x192 e 512x512
function createPngIcon(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const cx = width / 2;
  const cy = height / 2;
  const rDrop = size * 0.26;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      const t = (x + y) / (width + height);
      let r = Math.round(5 * (1 - t) + 14 * t);
      let g = Math.round(150 * (1 - t) + 165 * t);
      let b = Math.round(105 * (1 - t) + 233 * t);

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < size * 0.34) {
        r = 255;
        g = 255;
        b = 255;
      }
      if (dist < rDrop * 0.78) {
        r = 16;
        g = 185;
        b = 129;
      }

      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(path.join(dir, 'icon-192.png'), createPngIcon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPngIcon(512));

const manifest = {
  id: '/dieta-pastoressa-leo-vita',
  name: 'Dieta PassoPasso PRO v5.0',
  short_name: 'Dieta PRO',
  description: 'Piano terapeutico Dott. Pastoressa v5.0: App personale con Widget Live, sveglie pasti intelligenti, 2L acqua e Chat Coppia con notifiche.',
  start_url: './?v=5.0',
  scope: './',
  display: 'standalone',
  background_color: '#f8f7f4',
  theme_color: '#0f766e',
  orientation: 'portrait-primary',
  lang: 'it-IT',
  icons: [
    {
      src: './icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: './icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: './icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any'
    }
  ],
  shortcuts: [
    {
      name: '✅ Segna Pasto di Oggi',
      short_name: 'Segna Pasto',
      description: 'Apri subito il menu di oggi e spunta il pasto',
      url: './?v=5.0',
      icons: [{ src: './icon-192.png', sizes: '192x192' }]
    },
    {
      name: '💧 +1 Bicchiere Acqua',
      short_name: '+250ml Acqua',
      description: 'Aggiungi rapidamente 1 bicchiere di acqua (250ml)',
      url: './?quickWater=1',
      icons: [{ src: './icon-192.png', sizes: '192x192' }]
    },
    {
      name: '💬 Chat Coppia & Percorso',
      short_name: 'Chat Coppia',
      description: 'Apri la Bacheca Messaggi tra Leonardo e Vita Lucia',
      url: './?tab=progressi',
      icons: [{ src: './icon-192.png', sizes: '192x192' }]
    }
  ]
};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

// Crea il file singolo autonomo Dieta-Leonardo-Vita.html con CSS, data.js e app.js incorporati (zero problemi di cache!)
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css[^"]*"\s*\/?>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script src="\.\/data\.js[^"]*"><\/script>/, `<script>\n${dataJs}\n</script>`);
html = html.replace(/<script src="\.\/app\.js[^"]*"><\/script>/, `<script>\n${appJs}\n</script>`);

fs.writeFileSync(path.join(dir, 'Dieta-Leonardo-Vita.html'), html, 'utf8');
console.log('Bundle v5.0 completato! Dimensione Dieta-Leonardo-Vita.html:', Buffer.byteLength(html, 'utf8'), 'bytes');
