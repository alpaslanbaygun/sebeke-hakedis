// Web paketini üretir: dist/www (APK assets) — app.js + app.css + fonts + seed + index.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'dist/www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'seed'), { recursive: true });
const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', target: ['chrome90'], minify: process.argv.includes('--min'),
  sourcemap: false, outfile: path.join(out, 'app.js'), loader: { '.woff2': 'file' }, external: ['fonts/*'], logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' }, metafile: true
});
for (const f of fs.readdirSync(path.join(root, 'fonts'))) fs.copyFileSync(path.join(root, 'fonts', f), path.join(out, 'fonts', f));
fs.copyFileSync(path.join(root, 'seed/standard-tedas-2026.json'), path.join(out, 'seed/standard-tedas-2026.json'));
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
const sz = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log('www:', 'app.js', sz('app.js'), '· app.css', sz('app.css'), '· seed', sz('seed/standard-tedas-2026.json'));
