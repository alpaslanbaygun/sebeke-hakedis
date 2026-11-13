// Lisans ekranı (13.11.2026): durum (lisanslı / deneme / süresi doldu), bu cihazın kodu (kopyala, paylaş), lisans metni
// (yapıştır ya da .lisans dosyasından aç) ve Kaydet. Ayarlar › Lisans'tan açılır; deneme süresi dolmuşsa ya da lisans
// geçersizse uygulama yalnız bu ekranı gösterir (kilit; ui/app.js). Kurallar: core/lisans.js, services/lisans-service.js.
import { html, useState, useBus, Icon, Title, Badge } from '../kit.js';
import { app } from '../ctx.js';
import { lisansDene } from '../../services/lisans-service.js';
import { lisansAyikla } from '../../core/lisans.js';

const TUR = { lisansli: ['LİSANSLI', 'ok', 'var(--ok)'], deneme: ['DENEME SÜRÜMÜ', 'warn', 'var(--warn)'], bitti: ['LİSANS GEREKLİ', 'err', 'var(--err)'] };
const tarihTr = (t) => (/^\d{4}-\d{2}-\d{2}$/.test(t || '') ? t.slice(8, 10) + '.' + t.slice(5, 7) + '.' + t.slice(0, 4) : t || '—');

export function LisansScreen({ kilit }) {
  useBus(['lisans:change']);
  const L = app.state.lisans || {};
  const d = L.durum || { tur: 'deneme', mesaj: 'Lisans durumu okunamadı' };
  const cihaz = L.cihaz || { kod: '—' };
  const [metin, setMetin] = useState('');
  const [sonuc, setSonuc] = useState(null);
  const [tur, rozet, renk] = TUR[d.tur] || TUR.bitti;
  const dene = async (m) => {
    setMetin(m);
    if (!lisansAyikla(m)) { setSonuc(m.trim() ? { hata: 'Metinde lisans bulunamadı (SHL1. ile başlar).' } : null); return; }
    const y = await lisansDene({ ds: app.ds, cihaz, metin: m });
    setSonuc(y.tur === 'lisansli' ? { iyi: 'Geçerli · ' + y.mesaj } : { hata: y.hata || y.mesaj });
  };
  const kaydet = async () => {
    const y = await lisansDene({ ds: app.ds, cihaz, metin, kaydet: true });
    if (y.tur !== 'lisansli') { setSonuc({ hata: y.hata || y.mesaj }); return; }
    app.state.lisans = Object.assign({}, L, { durum: y });
    setMetin(''); setSonuc(null);
    app.bus.emit('lisans:change');
    app.toast('Lisans kaydedildi · ' + y.mesaj, 'ok', 5000);
  };
  const kopyala = async () => {
    try { await navigator.clipboard.writeText(cihaz.kod); app.toast('Cihaz kodu kopyalandı'); } catch (e) { app.toast('Kopyalanamadı; kodu elle yazın', 'warn'); }
  };
  const paylas = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Şebeke-M cihaz kodu', text: 'Şebeke-M Hakediş cihaz kodu: ' + cihaz.kod }); else await kopyala(); } catch (e) { /* vazgeçildi */ }
  };
  const dosya = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => dene(String(r.result || '')); r.readAsText(f); };
  const b = d.bilgi;
  return html`${kilit ? html`<div class="row" style="gap:10px;margin:4px 0 2px"><${Icon} n="lock" s=${26} c=${renk} /><b class="grow" style="font-size:20px">Şebeke-M Hakediş · Lisans</b></div>`
      : html`<${Title} title="Lisans" sub="Durum, bu cihazın kodu, lisans girme" />`}
    <div class="card stack" style=${'border-color:' + renk}>
      <div class="row"><${Badge} k=${rozet}>${tur}</${Badge}></div>
      <b style="font-size:17px;line-height:1.35">${d.mesaj}</b>
      ${d.tur === 'lisansli' && b ? html`<div class="kv" style="font-size:13px"><b>Lisans no</b><span>${b.no || '—'}</span><b>Ürün</b><span>${b.urun === 'hepsi' ? 'AutoCAD + telefon' : b.urun}</span><b>Verildiği gün</b><span>${tarihTr(b.verildi)}</span><b>Bitiş</b><span>${b.bitis ? tarihTr(b.bitis) : 'süresiz'}</span></div>`
        : html`<div class="note" style="font-size:13px">${kilit ? 'Uygulamayı kullanmaya devam etmek için lisans girin. ' : ''}Lisans için aşağıdaki cihaz kodunu lisans verene gönderin; gelen lisansı yapıştırıp kaydedin.</div>`}
      ${d.saatGeri ? html`<div class="alert warn">Telefonun tarihi geri alınmış görünüyor; tarih ve saati düzeltin.</div>` : null}
    </div>
    <div class="sect">Bu cihazın kodu</div>
    <div class="card stack">
      <div class="mono" style="font-size:21px;font-weight:800;letter-spacing:.03em;user-select:all;-webkit-user-select:all;word-break:break-all">${cihaz.kod}</div>
      <div class="grid2"><button class="btn" onClick=${kopyala}><${Icon} n="check" s=${18} />Kopyala</button><button class="btn" onClick=${paylas}><${Icon} n="share" s=${18} />Gönder</button></div>
    </div>
    <div class="sect">Lisans</div>
    <div class="card stack">
      <textarea class="inp mono" rows="5" style="height:auto;min-height:110px;font-size:12px;word-break:break-all;resize:vertical" placeholder="SHL1.… ile başlayan lisans metnini yapıştırın" value=${metin} onInput=${(e) => dene(e.target.value)}></textarea>
      <label class="btn"><${Icon} n="folder" s=${18} />Lisans dosyasından aç<input type="file" accept=".lisans,.txt,text/plain" style="display:none" onChange=${(e) => { dosya(e.target.files[0]); e.target.value = ''; }} /></label>
      ${sonuc ? html`<div class=${'alert ' + (sonuc.iyi ? 'ok' : 'warn')} style="font-size:13px">${sonuc.iyi || sonuc.hata}</div>` : null}
      <button class="btn pri huge" disabled=${!(sonuc && sonuc.iyi)} onClick=${kaydet}><${Icon} n="check" s=${22} c="#0b1326" />LİSANSI KAYDET</button>
    </div>`;
}
