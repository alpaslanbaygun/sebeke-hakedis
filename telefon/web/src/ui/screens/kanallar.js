// Kanal listesi (proje bazında): AutoCAD eklentisinin Proje Özeti › Kanal listesi ve çizime konan kanal tablosuyla aynı
// liste (sh-core kanalListesi ↔ eklentideki Cekirdek/KanalListesi.cs; ortak deneme ortak/deneme/kanal-listesi.json).
// Excel: Dışa Aktar › Excel dosyasında "Kanal Listesi" ve "Kanal Özeti" sayfaları.
import { html, useState, useBus, Chip, Title, Empty, trn } from '../kit.js';
import { app } from '../ctx.js';
import SH from '../../interop/sh-core.cjs';
import { eklentiModeli } from '../../export/exporter.js';
import { projeAdi, kaplamaYazisi, numara } from '../../export/kanal.js';

export function KanalListesiScreen() {
  useBus('project:computed');
  const ps = app.ps;
  const [proje, setProje] = useState(null);
  const [hak, setHak] = useState(0);
  let kl;
  try { kl = SH.kanalListesi(eklentiModeli(ps)); } catch (e) { kl = { satirlar: [], projeler: [], ozet: [], hata: e.message }; }
  const projeler = kl.projeler.filter((t) => !t.tumu);
  const hakedisler = [...new Set(kl.satirlar.map((s) => s.hakedis))].sort((a, b) => a - b);
  const sat = kl.satirlar.filter((s) => (proje === null || s.proje === proje) && (!hak || s.hakedis === hak));
  const gruplar = [];
  for (const s of sat) { let g = gruplar[gruplar.length - 1]; if (!g || g.proje !== s.proje) gruplar.push(g = { proje: s.proje, kod: s.projeKodu, satirlar: [], uzunluk: 0, hacim: 0 }); g.satirlar.push(s); g.uzunluk += s.uzunluk; g.hacim += s.hacim; }
  const top = sat.reduce((a, s) => ({ uzunluk: a.uzunluk + s.uzunluk, hacim: a.hacim + s.hacim }), { uzunluk: 0, hacim: 0 });
  return html`<${Title} title="Kanal listesi" sub=${ps.p.name + ' · proje bazında'} back />
    ${kl.hata ? html`<div class="alert err">${kl.hata}</div>` : null}
    ${kl.satirlar.length ? html`
      <div class="chips"><${Chip} on=${proje === null} onClick=${() => setProje(null)}>Tüm projeler</${Chip}>${projeler.map((t) => html`<${Chip} on=${proje === t.proje} onClick=${() => setProje(t.proje)}>${projeAdi(t.proje)}</${Chip}>`)}</div>
      ${hakedisler.length > 1 ? html`<div class="chips"><${Chip} on=${!hak} onClick=${() => setHak(0)}>Bütün hakedişler</${Chip}>${hakedisler.map((h) => html`<${Chip} on=${hak === h} onClick=${() => setHak(h)}>${h}. hakediş</${Chip}>`)}</div>` : null}
      ${gruplar.map((g) => html`<div class="sect">${projeAdi(g.proje)}${g.kod ? ' · ' + g.kod : ''} <span class="r mono">${g.satirlar.length} kanal</span></div>
        <div class="card tight list">${g.satirlar.map((s) => html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${numara(s) || 'Numarasız kanal'} · ${s.kablolar || '—'}</div>
          <div class="s">${s.cins}${kaplamaYazisi(s) ? ' · ' + kaplamaYazisi(s) : ''} · ${trn(s.alt, 0)}/${trn(s.ust, 0)} × ${trn(s.derinlik, 0)} cm · ${s.durum} · ${s.hakedis}. hak.</div></div>
          <div class="mono" style="text-align:right;font-size:12px">${trn(s.uzunluk, 2)} m<br/>${trn(s.hacim, 3)} m³</div></div>`)}
          <div class="li"><b class="grow" style="font-size:13px">Toplam</b><b class="mono" style="font-size:12px">${trn(g.uzunluk, 2)} m · ${trn(g.hacim, 3)} m³</b></div></div>`)}
      <div class="card"><div class="row"><b class="grow">Genel toplam · ${sat.length} kanal</b><b class="mono">${trn(top.uzunluk, 2)} m · ${trn(top.hacim, 3)} m³</b></div>
        <div class="note">Excel: Dışa Aktar › Excel dosyasındaki "Kanal Listesi" ve "Kanal Özeti" sayfaları. AutoCAD'de aynı liste Proje Özeti'nde ve çizime tablo olarak (Kanal Listesi).</div></div>` : html`<${Empty} icon="list" title="Kanal yok" sub="Yeraltı kablosu ya da yalnız kanal çizilince liste burada görünür." />`}`;
}
