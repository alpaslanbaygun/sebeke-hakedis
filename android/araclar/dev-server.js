// Arayüzü bilgisayarda önizlemek için basit dosya sunucusu: node android/araclar/dev-server.js [port]
// Tarayıcıda http://localhost:8765/ui/index.html açılır; Android köprüsü yerine ui/dev/mock.js kullanılır.
//   /ui/...       arayüz dosyaları (app/src/main/assets/ui)
//   /katalog/...  malzeme kataloğu ve katsayılar (ortak/katalog)
//   /dev/demo.sebeke.json  önizleme için üretilen örnek saha projesi
//   /tiles/osm/z/x/y       OpenStreetMap karoları (internet varsa)
//   /foto/...              fotoğraf yerine örnek resim
const http = require('http');
const fs = require('fs');
const path = require('path');
const demo = require('./demo-proje.js');

const root = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets');
const katalog = path.resolve(__dirname, '..', '..', 'ortak', 'katalog');
const port = Number(process.argv[2] || 8765);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8'
};

const tileCache = new Map();
async function tile(url, res) {
  const m = url.match(/^\/tiles\/([\w-]+)\/(\d+)\/(\d+)\/(\d+)$/);
  if (!m || m[1] !== 'osm') {
    res.writeHead(m ? 401 : 404);
    res.end();
    return;
  }
  const key = m.slice(2).join('/');
  try {
    let body = tileCache.get(key);
    if (!body) {
      const r = await fetch('https://tile.openstreetmap.org/' + key + '.png', { headers: { 'User-Agent': 'SebekeHakedis-onizleme/0.2 (gelistirme sunucusu)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      body = Buffer.from(await r.arrayBuffer());
      tileCache.set(key, body);
    }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(502);
    res.end(String(e.message));
  }
}

function foto(res, name) {
  const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="hsl(' + hue + ',35%,72%)"/>' +
    '<path d="M60 260 L200 90 L340 260 Z" fill="hsl(' + hue + ',30%,45%)"/><rect x="190" y="40" width="20" height="220" fill="#334155"/>' +
    '<text x="200" y="290" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#0F172A">' + name.replace(/[<&]/g, '') + '</text></svg>';
  res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
  res.end(svg);
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(302, { Location: '/ui/index.html' });
    res.end();
    return;
  }
  if (url.startsWith('/tiles/')) return tile(url, res);
  if (url.startsWith('/foto/')) return foto(res, url.split('/').pop());
  if (url === '/dev/demo.sebeke.json') {
    res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
    res.end(demo.uret());
    return;
  }
  let file;
  if (url.startsWith('/katalog/')) file = path.join(katalog, url.slice('/katalog/'.length));
  else file = path.join(root, url);
  const base = url.startsWith('/katalog/') ? katalog : root;
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('yok');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('http://localhost:' + port + '/ui/index.html'));
