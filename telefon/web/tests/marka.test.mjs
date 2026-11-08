// Marka kuralları (DEVIR §1): ürün adı "Şebeke-M Hakediş"; eski hakediş programının adı ve dağıtım şirketinin adı depoda
// (kod, belge, çıktı metni, katalog) hiçbir yerde geçmez. Adlar bu dosyada da açık yazılmaz (parçalardan kurulur).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ATLA = new Set(['.git', 'node_modules', 'dist', 'bin', 'obj', 'paket', '.vs']);
const METIN = /\.(cs|csproj|xml|json|js|mjs|cjs|html|css|md|txt|bat|py|java|gradle|yml|yaml|svg|props|targets|cuix|kts|sh)$/i;

function dosyalar(klasor, out = []) {
  for (const d of fs.readdirSync(klasor, { withFileTypes: true })) {
    if (ATLA.has(d.name)) continue;
    const yol = path.join(klasor, d.name);
    if (d.isDirectory()) dosyalar(yol, out);
    else if (METIN.test(d.name)) out.push(yol);
  }
  return out;
}

test('M1 · eski programın ve dağıtım şirketinin adı depoda geçmez', () => {
  const yasak = [
    new RegExp(['PRO', 'MAG[İIı]S'].join(''), 'i'),
    new RegExp(['K[CÇ]E', 'TA[SŞ]'].join(''), 'i'),
  ];
  const bulunan = [];
  for (const f of dosyalar(KOK)) {
    const s = fs.readFileSync(f, 'utf8');
    for (const y of yasak) if (y.test(s)) bulunan.push(path.relative(KOK, f));
  }
  assert.deepEqual(bulunan, [], 'yasak ad geçen dosyalar');
});

test('M2 · ürün adı Şebeke-M Hakediş: eklenti, paket, Android uygulaması ve Hakkında metni', () => {
  const oku = (y) => fs.readFileSync(path.join(KOK, y), 'utf8');
  assert.match(oku('autocad/src/Eklenti/Marka.cs'), /public const string Ad = "Şebeke-M Hakediş";/);
  assert.match(oku('autocad/paket/PackageContents.xml'), /Name="Şebeke-M Hakediş"/);
  assert.match(oku('telefon/android/res/values/strings.xml'), /<string name="app_name">Şebeke-M Hakediş<\/string>/);
  assert.match(oku('ortak/marka/hakkinda.json'), /Şebeke-M Hakediş,/);
  // Logo: kaynak ve üretilen dosyalar yerinde (araclar/marka-uret.py)
  for (const y of ['ortak/marka/kaynak/sebeke-m-hakedis-logo.png', 'ortak/marka/sebeke-m-logo.png', 'ortak/marka/sebeke-m-simge-32.png', 'telefon/web/assets/sebeke-m-logo.png'])
    assert.ok(fs.existsSync(path.join(KOK, y)), y);
});
