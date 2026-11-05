const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const SYNC_FILE = path.join(ROOT, 'sync-state.json');

let sharedSyncState = {
  dayOrder: [0, 1, 2, 3, 4, 5, 6],
  people: {},
  shoppingStatus: {},
  customShoppingItems: [],
  coupleChatMessages: [],
  doctorNotes: [],
  timestamp: 0
};

if (fs.existsSync(SYNC_FILE)) {
  try {
    sharedSyncState = { ...sharedSyncState, ...JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8')) };
  } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/scarica-apk') {
    const apkPath = path.join(ROOT, 'Dieta-Leonardo-Vita.apk');
    if (fs.existsSync(apkPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="Dieta-PassoPasso-PRO-v5.apk"'
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    }
  }

  if (parsedUrl.pathname === '/api/sync') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sharedSyncState));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const inc = JSON.parse(body);
          if (inc && inc.people) {
            ['leonardo', 'vitalucia'].forEach((pk) => {
              const incP = inc.people[pk];
              const curP = sharedSyncState.people?.[pk];
              if (incP && (!curP || (incP.lastUpdated || 0) >= (curP.lastUpdated || 0))) {
                sharedSyncState.people[pk] = incP;
              }
            });
            if (Array.isArray(inc.dayOrder)) sharedSyncState.dayOrder = inc.dayOrder;
            if (inc.shoppingStatus) {
              sharedSyncState.shoppingStatus = { ...sharedSyncState.shoppingStatus, ...inc.shoppingStatus };
            }
            if (inc.customShoppingItems) sharedSyncState.customShoppingItems = inc.customShoppingItems;
            if (inc.coupleChatMessages) sharedSyncState.coupleChatMessages = inc.coupleChatMessages;
            if (inc.doctorNotes) sharedSyncState.doctorNotes = inc.doctorNotes;
            sharedSyncState.timestamp = Date.now();
            fs.writeFileSync(SYNC_FILE, JSON.stringify(sharedSyncState, null, 2), 'utf8');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, state: sharedSyncState }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // Qualsiasi percorso principale (/, /aggiorna, /v4, /v5, /index.html) serve direttamente il bundle v5.0 completo con CSS e JS incorporati
  const isMainEntry = ['/', '/aggiorna', '/v4', '/v5', '/index.html'].includes(parsedUrl.pathname);
  const targetFile = isMainEntry ? '/Dieta-Leonardo-Vita.html' : parsedUrl.pathname;
  const safePath = path.normalize(targetFile).replace(/^(\.\.[\/\\])+/, '');
  const absPath = path.join(ROOT, safePath);

  fs.readFile(absPath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File non trovato');
      return;
    }
    const ext = path.extname(absPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

// Ascolta sia su IPv6 [::1] (usato da cloudflared su Windows) sia su IPv4 0.0.0.0 (usato dalla rete Wi-Fi locale)
server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
      }
    }
  }
  console.log(`====================================================`);
  console.log(`🥗 App Dieta PassoPasso PRO v5.0 attiva (Dual-Stack IPv4/IPv6)!`);
  console.log(`💻 Su questo PC:       http://localhost:${PORT}/aggiorna`);
  console.log(`📱 Sui Dispositivi:    http://${lanIp}:${PORT}/aggiorna`);
  console.log(`====================================================`);
});
