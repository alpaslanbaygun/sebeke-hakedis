// Arayüzün uçtan uca denemesi ve ekran görüntüleri (Playwright + Chromium, telefon boyutu).
// Kullanım: önce  node android/araclar/dev-server.js  çalışsın, sonra
//           node android/araclar/ekran-testi.js <çıkış klasörü>
// Sahte köprüyle (ui/dev/mock.js) gerçek akışlar denenir: dosyadan proje açma, eleman koyma, hat,
// kanal, malzeme ekleme, özet, dışa aktarma. Sayfada JavaScript hatası olursa çıkış kodu 1 olur.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.UI_BASE || 'http://localhost:8765';
const out = process.argv[2] || 'ekranlar';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', e => hatalar.push('sayfa: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/tiles|favicon|Failed to load resource/.test(m.text())) hatalar.push('konsol: ' + m.text()); });
  const bekle = ms => page.waitForTimeout(ms || 400);
  const cek = async ad => {
    await bekle(350);
    await page.screenshot({ path: path.join(out, ad + '.png') });
    console.log('  📷 ' + ad);
  };
  const tikla = async sel => {
    await page.locator(sel).first().click();
    await bekle(250);
  };
  const ekran = () => page.evaluate(() => App.top().id);
  /** Haritada dünya koordinatındaki noktaya dokun. */
  const haritayaDokun = async (e, n) => {
    const [x, y] = await page.evaluate(([e, n]) => {
      const h = App.top().state.h;
      const r = document.querySelector('[data-map]').getBoundingClientRect();
      const [px, py] = h.ekran(e, n);
      return [r.left + px, r.top + py];
    }, [e, n]);
    await page.mouse.click(x, y);
    await bekle(300);
  };
  const adim = async (ad, fn) => {
    try {
      await fn();
      console.log('✓ ' + ad);
    } catch (e) {
      hatalar.push(ad + ': ' + e.message);
      console.log('✗ ' + ad + ': ' + e.message);
    }
  };

  await page.goto(BASE + '/ui/index.html');
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(BASE + '/ui/index.html');
  await bekle(800);

  await adim('Projeler (boş)', async () => {
    if (await ekran() !== 'projeler') throw new Error('açılış ekranı ' + await ekran());
    await cek('01-projeler-bos');
  });

  await adim('Dosyadan proje aç', async () => {
    await tikla('[data-a="ac"]');
    await page.waitForFunction(() => App.top().id === 'ana', null, { timeout: 8000 });
    await bekle(600);
    await cek('02-ana');
  });

  await adim('Harita', async () => {
    await tikla('nav [data-path="harita"]');
    await bekle(800);
    if (await ekran() !== 'harita') throw new Error('harita açılmadı');
    await cek('03-harita');
  });

  await adim('Eleman koy (GNSS ile)', async () => {
    await tikla('[data-a="koy"]');
    await bekle(400);
    await cek('04-eleman-koy');
    const once = await page.evaluate(() => App.oturum.p.elemanlar.length);
    await tikla('[data-a="koyKaydet"]');
    await bekle(400);
    const sonra = await page.evaluate(() => App.oturum.p.elemanlar.length);
    if (sonra !== once + 1) throw new Error('eleman eklenmedi');
    await cek('05-kaydedildi');
  });

  await adim('Tip seçici', async () => {
    await tikla('[data-a="koy"]');
    await tikla('[data-a="tipSec"]');
    await bekle(300);
    if (await ekran() !== 'tip-sec') throw new Error('tip seçici açılmadı');
    await cek('06-tip-secici');
    await page.locator('#tum [data-a="sec"]').nth(2).click();
    await bekle(400);
    if (await ekran() !== 'harita') throw new Error('geri dönülmedi');
    await tikla('[data-a="koyKaydet"]');
  });

  await adim('Hat çiz (iki direk arasında)', async () => {
    const [a, b] = await page.evaluate(() => {
      const el = App.oturum.p.elemanlar.filter(e => e.tur === 'AG_DIREK' && e.durum === 'MEVCUT');
      return [[el[2].saga, el[2].yukari], [el[3].saga, el[3].yukari]];
    });
    await page.evaluate(([a, b]) => App.top().state.h.fit([Math.min(a[0], b[0]) - 40, Math.min(a[1], b[1]) - 40, Math.max(a[0], b[0]) + 40, Math.max(a[1], b[1]) + 40]), [a, b]);
    await bekle(300);
    await tikla('[data-a="hat"]');
    await haritayaDokun(a[0], a[1]);
    await cek('07-hat-adim');
    await haritayaDokun(b[0], b[1]);
    await bekle(400);
    await cek('08-hat-panel');
    const once = await page.evaluate(() => App.oturum.p.hatlar.length);
    await tikla('[data-a="hatKaydet"]');
    const sonra = await page.evaluate(() => App.oturum.p.hatlar.length);
    if (sonra !== once + 1) throw new Error('hat eklenmedi');
  });

  await adim('Kanal çiz', async () => {
    await page.evaluate(() => App.top().state.h.tumu());
    await bekle(300);
    await tikla('[data-a="kanal"]');
    const bb = await page.evaluate(() => App.oturum.kutu);
    const cx = (bb[0] + bb[2]) / 2;
    const cy = (bb[1] + bb[3]) / 2;
    await haritayaDokun(cx - 60, cy - 40);
    await haritayaDokun(cx, cy - 45);
    await haritayaDokun(cx + 50, cy - 20);
    await cek('09-kanal-adim');
    await tikla('[data-a="bitir"]');
    await bekle(400);
    await cek('10-kanal-panel');
    const once = await page.evaluate(() => App.oturum.p.kanallar.length);
    await tikla('[data-a="kanalKaydet"]');
    const sonra = await page.evaluate(() => App.oturum.p.kanallar.length);
    if (sonra !== once + 1) throw new Error('kanal eklenmedi');
  });

  await adim('Seçim ve ayrıntı', async () => {
    const e = await page.evaluate(() => { const x = App.oturum.p.elemanlar.find(e => e.gisId === 'SC105'); return [x.saga, x.yukari]; });
    await page.evaluate(([e, n]) => App.top().state.h.merkez(e, n, 150), e);
    await bekle(300);
    await haritayaDokun(e[0], e[1]);
    await bekle(300);
    await cek('11-secim');
    await tikla('#secEylemler [data-a="ayrinti"]');
    await bekle(400);
    if (await ekran() !== 'nesne') throw new Error('ayrıntı açılmadı');
    await cek('12-ayrinti');
  });

  await adim('Malzeme ekle', async () => {
    await tikla('[data-a="malzemeEkle"]');
    await bekle(300);
    await cek('13-malzeme-ekle');
    await page.locator('#liste [data-a="sec"]').first().click();
    await bekle(300);
    await page.fill('[data-b="pMiktar"]', '2,5');
    await bekle(200);
    await cek('14-malzeme-miktar');
    const once = await page.evaluate(() => App.oturum.p.elemanlar.find(e => e.gisId === 'SC105').kalemler.length);
    await tikla('[data-a="ekle"]');
    await bekle(300);
    const sonra = await page.evaluate(() => App.oturum.p.elemanlar.find(e => e.gisId === 'SC105').kalemler.length);
    if (sonra !== once + 1) throw new Error('malzeme eklenmedi');
    await cek('15-ayrinti-malzemeli');
    await tikla('[data-a="foto"]');
    await bekle(900);
    const foto = await page.evaluate(() => (App.oturum.p.elemanlar.find(e => e.gisId === 'SC105').fotolar || []).length);
    if (foto !== 1) throw new Error('fotoğraf eklenmedi');
    await cek('16-ayrinti-foto');
    await tikla('[data-a="kapat"]');
  });

  await adim('Geri al', async () => {
    const once = await page.evaluate(() => App.oturum.p.kanallar.length);
    await page.evaluate(() => { App.oturum.geriAl(); App.oturum.geriAl(); App.oturum.geriAl(); });
    const sonra = await page.evaluate(() => App.oturum.p.kanallar.length);
    if (sonra !== once - 1) throw new Error('kanal geri alınmadı (' + once + ' → ' + sonra + ')');
  });

  await adim('Hakediş özeti', async () => {
    await page.evaluate(() => App.root('ozet'));
    await bekle(500);
    await cek('17-ozet');
    await tikla('[data-a="hepsiniAc"]');
    await cek('18-ozet-acik');
  });

  await adim('Excel ve dışa aktarma', async () => {
    await page.evaluate(() => App.push('disa-aktar'));
    await bekle(300);
    await cek('19-disa-aktar');
    const [indirme] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-a="excelKaydet"]').click()]);
    const yol = path.join(out, 'rapor.xlsx');
    await indirme.saveAs(yol);
    if (fs.statSync(yol).size < 2000) throw new Error('excel çok küçük');
    const [proje] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-a="projeKaydet"]').click()]);
    await proje.saveAs(path.join(out, 'proje.sebeke.json'));
    const [dxf] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-a="dxfKaydet"]').click()]);
    await dxf.saveAs(path.join(out, 'cizim.dxf'));
  });

  await adim('Ayarlar, bölgeler, konum', async () => {
    await page.evaluate(() => App.push('ayarlar'));
    await bekle(400);
    await cek('20-ayarlar');
    await page.evaluate(() => App.replace('bolgeler'));
    await bekle(300);
    await cek('21-bolgeler');
    await page.evaluate(() => App.replace('konum'));
    await bekle(300);
    await cek('22-konum');
  });

  await adim('Yeniden aç: değişiklikler kalıcı', async () => {
    const say = await page.evaluate(() => App.oturum.p.elemanlar.length + '/' + App.oturum.p.hatlar.length + '/' + App.oturum.p.kanallar.length);
    await page.reload();
    await bekle(1000);
    const say2 = await page.evaluate(() => App.oturum.p.elemanlar.length + '/' + App.oturum.p.hatlar.length + '/' + App.oturum.p.kanallar.length);
    if (say !== say2) throw new Error('yeniden açınca farklı: ' + say + ' → ' + say2);
    await cek('23-yeniden-acilis');
  });

  await adim('Yeni proje (telefonda)', async () => {
    await page.evaluate(() => { App.oturum.kapat(); App.root('projeler'); });
    await bekle(300);
    await cek('24-projeler');
    await tikla('[data-a="yeni"]');
    await cek('25-yeni-proje');
    await page.fill('[data-b="bolgeAd"]', 'DENEME AG ŞEBEKE TESİSİ');
    await page.fill('[data-b="bolgeKod"]', '23.01.01.02.30009');
    await tikla('[data-a="olustur"]');
    await bekle(700);
    if (await ekran() !== 'harita') throw new Error('yeni projede harita açılmadı: ' + await ekran());
    await tikla('[data-a="koy"]');
    await tikla('[data-a="koyKaydet"]');
    const e = await page.evaluate(() => App.oturum.p.elemanlar[0]);
    if (!e || !e.bolge) throw new Error('yeni elemanın bölgesi yok');
    await cek('26-yeni-proje-harita');
  });

  await browser.close();
  console.log(hatalar.length ? '\nHATALAR:\n' + hatalar.join('\n') : '\nHata yok.');
  process.exit(hatalar.length ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
