// Web paketini üretir: dist/www (APK assets) — app.js + app.css + fonts + seed + index.html
// --web ile: dist/web (tarayıcı / ofis sürümü). index.html tam sayfa (yerel deneme ve kendi sunucun için), page.html yayın parçası.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const WEB = process.argv.includes('--web');
const out = path.join(root, WEB ? 'dist/web' : 'dist/www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'seed'), { recursive: true });
const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', target: ['chrome90'], minify: WEB || process.argv.includes('--min'),
  sourcemap: false, outfile: path.join(out, 'app.js'), loader: { '.woff2': 'file' }, external: ['fonts/*'], logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' }, metafile: true
});
for (const f of fs.readdirSync(path.join(root, 'fonts'))) fs.copyFileSync(path.join(root, 'fonts', f), path.join(out, 'fonts', f));
fs.copyFileSync(path.join(root, 'seed/standard-tedas-2026.json'), path.join(out, 'seed/standard-tedas-2026.json'));
if (WEB) {
  const ver = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version + '-web';
  const page = fs.readFileSync(path.join(root, 'web.html'), 'utf8').replace('__VERSION__', ver);
  fs.writeFileSync(path.join(out, 'page.html'), page);
  fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + page + '</body></html>\n');
} else fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
const sz = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log(WEB ? 'web:' : 'www:', 'app.js', sz('app.js'), '· app.css', sz('app.css'), '· seed', sz('seed/standard-tedas-2026.json'));
