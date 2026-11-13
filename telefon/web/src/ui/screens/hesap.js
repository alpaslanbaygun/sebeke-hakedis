// Teknik hesaplar (Hesap Merkezi): hesap listesi, seçili direğe / hatta / trafoya uygun hesaplar, kayıtlı sonuçlar
// ve hesabın açıldığı tam ekran sayfa. Hesap sayfaları ortak/hesap/paket'ten gelir (APK içinde www/hesap/); sayfa ile
// uygulama postMessage ile konuşur (ortak/hesap/kopru.js): bağlam, kayıt, yazdırma, dosya.
import { html, useState, useEffect, useRef, useBus, Icon, Badge, Title, Empty } from '../kit.js';
import { app } from '../ctx.js';
import { uygunluk } from '../../../../../ortak/hesap/kurallar.mjs';
import { BaglamKurucu } from '../../hesap/baglam.js';
import { MODUL, GRUPLAR, DURUM_ADI, HEDEF_ADI, hesapKayitlari, kayitBul, hedefKayitlari, guncellik, hesapKaydet, hesapSil } from '../../hesap/kayitlar.js';

const kullanici = () => { const u = (app.ds && app.ds.user) || {}; return u.name && u.name !== 'Operatör' ? u.name : null; };
const DURUM_RENK = { uygun: 'ok', 'uygun-degil': 'err', bilgi: 'cy' };
const tarihYaz = (t) => { try { return new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return t || ''; } };
function hedefYazisi(b) {
  if (!b || !b.hedef || b.hedef.tur === 'proje') return 'Proje geneli';
  return (HEDEF_ADI[b.hedef.tur] || '') + (b.hedef.no ? ' ' + b.hedef.no : '') + (b.hedef.ad ? ' · ' + b.hedef.ad : '');
}

function KayitRozeti({ k }) {
  if (!k) return null;
  const g = guncellik(app.ps, k, kullanici());
  return html`<span class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">
    <${Badge} k=${DURUM_RENK[k.durum] || 'mut'}>${(DURUM_ADI[k.durum] || 'Bilgi').toUpperCase()}</${Badge}>
    ${g.hedefYok ? html`<${Badge} k="err">HEDEF YOK</${Badge}>` : g.farklar.length ? html`<${Badge} k="warn">GÜNCEL DEĞİL</${Badge}>` : null}</span>`;
}

async function hesapAc(m, hedef) {
  app.nav.go('hesap', { modul: m.id, hedef: hedef || { tur: 'proje', id: '' } });
}

export function HesapMerkeziScreen({ hedef }) {
  useBus(['project:computed', 'hesap:kayit']);
  const ps = app.ps;
  const [acik, setAcik] = useState(false);
  const b = new BaglamKurucu(ps, { kullanici: kullanici() }).kur(hedef || { tur: 'proje' });
  const hedefli = !!(hedef && hedef.tur && hedef.tur !== 'proje');
  const moduller = [...MODUL.values()];
  const deg = moduller.map((m) => ({ m, u: hedefli ? uygunluk(m, b) : { uygun: true }, k: hedefli ? kayitBul(ps, m.id, b.hedef, true) : null }));
  const uygun = deg.filter((x) => x.u.uygun), uygunsuz = deg.filter((x) => !x.u.uygun);
  const kayitlar = hedefli ? hedefKayitlari(ps, b.hedef) : hesapKayitlari(ps);
  const satir = (x) => html`<button class="li" onClick=${() => hesapAc(x.m, hedefli ? Object.assign({}, b.hedef) : null)} style="align-items:flex-start">
      <${Icon} n=${x.m.grup === 'yerlesim' ? 'grid' : x.m.grup === 'elektrik' ? 'note' : 'pole'} s=${20} c=${x.u.uygun ? '#f59e0b' : 'var(--mut2)'} />
      <span class="grow" style="min-width:0"><b style="display:block;font-size:14px">${x.m.ad}</b><span class="note" style="display:block">${x.u.uygun ? x.m.aciklama : x.u.neden}</span>${x.u.not ? html`<span class="note" style="display:block;color:var(--warn2)">${x.u.not}</span>` : null}</span>
      ${x.k ? html`<${KayitRozeti} k=${x.k} />` : html`<${Icon} n="next" s=${18} c="var(--mut2)" />`}</button>`;
  return html`<${Title} title="Teknik hesaplar" sub=${hedefYazisi(b)} />
    ${hedefli ? html`<div class="alert info" style="margin-bottom:6px"><${Icon} n="info" s=${16} /><span>Bu ${(HEDEF_ADI[hedef.tur] || '').toLowerCase()} için uygun hesaplar. Açılan hesaba ${(HEDEF_ADI[hedef.tur] || '').toLowerCase()}in bilgileri (tip, açıklıklar, iletken…) kendiliğinden yazılır; projede olmayan bilgiler turuncu çerçeveyle istenir.</span></div>` : null}
    ${GRUPLAR.map((g) => { const l = uygun.filter((x) => x.m.grup === g.id); return l.length ? html`<div class="sect">${g.ad}</div><div class="card tight"><div class="list">${l.map(satir)}</div></div>` : null; })}
    ${uygunsuz.length ? html`<button class="sect" style="background:none;border:0;padding:0;cursor:pointer" onClick=${() => setAcik(!acik)}><${Icon} n=${acik ? 'down' : 'next'} s=${14} />Bu hedefe uygun olmayanlar (${uygunsuz.length})</button>
      ${acik ? html`<div class="card tight"><div class="list">${uygunsuz.map(satir)}</div></div>` : null}` : null}
    <div class="sect">Kayıtlı sonuçlar${hedefli ? ' (bu hedef)' : ''}</div>
    ${kayitlar.length ? html`<div class="card tight"><div class="list">${kayitlar.map((k) => { const m = MODUL.get(k.modul) || { ad: k.modulAdi }; return html`<button class="li" style="align-items:flex-start" onClick=${() => app.nav.go('hesap', { modul: k.modul, hedef: k.hedef, kayitId: k.id })}>
        <span class="grow" style="min-width:0"><b style="display:block">${m.ad || k.modulAdi}</b><span class="mono" style="font-size:12px;color:var(--og)">${(HEDEF_ADI[(k.hedef || {}).tur] || '') + ((k.hedef || {}).no ? ' ' + k.hedef.no : '') + ((k.hedef || {}).hatId ? ' · çıkış ' + (((ps.lineById(k.hedef.hatId) || {}).lineNo) || '?') : '')}</span>
        <span class="note" style="display:block">${k.ozet}</span><span class="note" style="display:block">${tarihYaz(k.tarih)} · ${k.kaynak === 'autocad' ? 'AutoCAD' : 'telefon'}${k.yapan ? ' · ' + k.yapan : ''}</span></span>
        <${KayitRozeti} k=${k} /></button>`; })}</div></div>` : html`<${Empty}>Henüz kayıtlı hesap yok. Bir hesabı açıp üstteki <b>Kaydet</b> ile projeye kaydedin.</${Empty}>`}
    <div class="note" style="margin:12px 2px">Hesap araçlarının formülleri ve tabloları değiştirilmeden Şebeke-M Hakediş'e eklenmiştir; her hesabın içindeki ⓘ düğmesi kaynak ve bilinen sınırları gösterir.</div>`;
}
HesapMerkeziScreen.compactHud = true;

// ---------------------------------------------------------------- hesap sayfası (çerçeve)
const b64Bayt = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

export function HesapScreen({ modul, hedef, kayitId }) {
  const ps = app.ps;
  const ref = useRef(null);
  const kirli = useRef(false);
  const m = MODUL.get(modul) || { id: modul, ad: modul };
  const sayfa = m.sayfa || m.id;
  const src = 'hesap/' + encodeURIComponent(sayfa) + '.html?ortam=telefon' + (m.bolum ? '&bolum=' + encodeURIComponent(m.bolum) : '');
  useEffect(() => {
    const yanit = (e, id, veri, hata) => { try { e.source.postMessage({ sm: 'hesap', tip: 'yanit', id, veri, hata }, '*'); } catch (x) { /* */ } };
    const dinle = async (e) => {
      const f = ref.current;
      if (!f || e.source !== f.contentWindow) return;
      const msg = e.data;
      if (!msg || msg.sm !== 'hesap') return;
      try {
        if (msg.tip === 'basla') {
          const kk = new BaglamKurucu(ps, { kullanici: kullanici() });
          const baglam = kk.kur(hedef || { tur: 'proje' });
          const kayit = (kayitId && hesapKayitlari(ps).find((d) => d.id === kayitId)) || kayitBul(ps, modul, baglam.hedef);
          yanit(e, msg.id, { baglam, hedef: baglam.hedef, kayit: kayit || null, guncel: kayit && !kayit.hedef ? null : baglam });
        } else if (msg.tip === 'kaydet') {
          const v = Object.assign({}, msg.veri || {});
          if (!v.hedef || !v.hedef.tur) v.hedef = Object.assign({}, hedef || { tur: 'proje', id: '' });
          if (hedef && hedef.hatId) v.hedef.hatId = hedef.hatId;
          const id = await hesapKaydet(ps, v, kullanici());
          kirli.current = false;
          yanit(e, msg.id, { id, mesaj: 'Kaydedildi: ' + (v.hedef.no ? (HEDEF_ADI[v.hedef.tur] || '') + ' ' + v.hedef.no : 'proje') });
        } else if (msg.tip === 'kapat') { app.nav.back(); }
        else if (msg.tip === 'kirli') { kirli.current = !!(msg.veri && msg.veri.kirli); }
        else if (msg.tip === 'yazdir') { await app.bridge.printHtml((msg.veri && msg.veri.baslik) || m.ad, msg.veri.html); }
        else if (msg.tip === 'dosya') {
          const r = await app.bridge.saveFile(msg.veri.ad, msg.veri.tur || 'application/octet-stream', b64Bayt(msg.veri.veri), { dir: ((ps.p && ps.p.code) || 'PROJE') + '/HESAPLAR' });
          app.toast('Kaydedildi: ' + msg.veri.ad + (r && r.uri ? '' : ''));
        } else if (msg.tip === 'dis') { try { window.open(msg.veri.url, '_blank'); } catch (x) { /* */ } }
        else if (msg.tip === 'hata') { app.toast((msg.veri && msg.veri.mesaj) || 'Hata', 'err'); }
        else if (msg.id) yanit(e, msg.id, null, 'Bilinmeyen istek: ' + msg.tip);
      } catch (err) {
        if (msg.id) yanit(e, msg.id, null, err.message || String(err));
        else app.toast(err.message || String(err), 'err');
      }
    };
    window.addEventListener('message', dinle);
    const eskiKanca = app.backHook;
    app.backHook = () => {
      if (!kirli.current) return false;
      try { ref.current.contentWindow.postMessage({ sm: 'hesap', tip: 'geri' }, '*'); } catch (x) { return false; }
      return true;
    };
    return () => { window.removeEventListener('message', dinle); app.backHook = eskiKanca; };
  }, [modul, kayitId]);
  if (!MODUL.has(modul)) {
    // Uygulamadan kaldırılmış bir hesabın eski kaydı: sayfası yok, yalnız saklanan özet gösterilir
    const k = kayitId ? hesapKayitlari(ps).find((d) => d.id === kayitId) : null;
    return html`<${Title} title=${(k && k.modulAdi) || modul} sub="Bu hesap uygulamada artık yok" />
      <div class="alert info"><${Icon} n="info" s=${16} /><span>Hesap Merkezi'nde yalnız direk tepe kuvveti (cer vektörü) ve kanal planı kaldı. Bu kayıt bilgi olarak saklanır; AutoCAD dosyasıyla gidip gelir.</span></div>
      ${k ? html`<div class="card stack"><div class="kv mono" style="font-size:12px"><b>Sonuç</b><span>${k.ozet || '—'}</span><b>Durum</b><span>${DURUM_ADI[k.durum] || k.durum || '—'}</span><b>Tarih</b><span>${tarihYaz(k.tarih)}</span></div>
        <button class="btn dang" onClick=${async () => { if (await app.confirm('Kaydı sil', 'Bu hesap kaydı silinsin mi?', { danger: true, ok: 'Sil' })) { await hesapSil(ps, k.id); app.nav.back(); } }}>Kaydı sil</button></div>` : null}`;
  }
  return html`<iframe ref=${ref} class="hesapcerceve" src=${src} title=${m.ad} allow="clipboard-write"></iframe>`;
}
HesapScreen.flush = true;
HesapScreen.noTabs = true;
HesapScreen.noHud = true;

export { hesapAc, hesapSil };
