// Arayüzde kullanılan Material Symbols adlarının, gömülü yazı tipi alt kümesinde
// (vendor/icon-names.txt) bulunduğunu denetler: node android/araclar/simge-denetimi.js
'use strict';
const fs = require('fs');
const path = require('path');

const ui = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'ui');
const names = new Set(fs.readFileSync(path.join(ui, 'vendor', 'icon-names.txt'), 'utf8').trim().split(/[,\s]+/));
const used = new Map();

function note(name, where) {
  if (!/^[a-z0-9_]+$/.test(name)) return;
  if (!used.has(name)) used.set(name, new Set());
  used.get(name).add(where);
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'vendor') walk(p);
      continue;
    }
    if (!/\.(html|js)$/.test(f)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const rel = path.relative(ui, p);
    // HTML: <span class="material-symbols-outlined ...">ad</span>
    for (const m of text.matchAll(/material-symbols-outlined[^"]*"[^>]*>\s*([a-z0-9_]+)\s*</g)) note(m[1], rel);
    // JS: icon: 'ad', 'xxx-icon': 'ad', textContent = 'ad'
    for (const m of text.matchAll(/icon'?\s*:\s*'([a-z0-9_]+)'/g)) note(m[1], rel);
    for (const m of text.matchAll(/Icon'?\s*:\s*'([a-z0-9_]+)'/g)) note(m[1], rel);
    for (const m of text.matchAll(/textContent\s*=\s*(?:[^;]*\?\s*)?'([a-z0-9_]+)'(?:\s*:\s*'([a-z0-9_]+)')?/g)) {
      note(m[1], rel);
      if (m[2]) note(m[2], rel);
    }
    for (const m of text.matchAll(/'icon'\s*:\s*[^,}]*\?\s*'([a-z0-9_]+)'\s*:\s*'([a-z0-9_]+)'/g)) { note(m[1], rel); note(m[2], rel); }
    for (const m of text.matchAll(/ICONS\s*=\s*\{([^}]*)\}/g)) for (const n of m[1].matchAll(/:\s*'([a-z0-9_]+)'/g)) note(n[1], rel);
    // ['eylem', 'simge', 'Yazı'] üçlüleri (seçim paneli eylemleri)
    for (const m of text.matchAll(/\['[a-zA-Z]+', '([a-z0-9_]+)', '[A-ZÇĞİÖŞÜ][^']*'\]/g)) note(m[1], rel);
    // material-symbols-outlined">' + (koşul ? 'a' : 'b') + '
    for (const m of text.matchAll(/material-symbols-outlined[^>]*>' \+ \(?[^?]*\?\s*'([a-z0-9_]+)'\s*:\s*'([a-z0-9_]+)'/g)) { note(m[1], rel); note(m[2], rel); }
  }
}

walk(ui);
let missing = 0;
for (const [name, where] of [...used].sort()) {
  if (names.has(name)) continue;
  missing++;
  console.log('YOK  ' + name + '  (' + [...where].join(', ') + ')');
}
console.log(used.size + ' simge adı tarandı; ' + (missing ? missing + ' tanesi yazı tipinde yok' : 'hepsi yazı tipinde var'));
process.exit(missing ? 1 : 0);
