// Kabin düzenleyici: köşk / trafo binası tipi, içindeki hücreler (ekle · çıkar · sırala), kablo kanalları, 2B yerleşim planı, kontroller ve keşif.
// Model ve kurallar: grid/cabin.js (referans "Beton Köşk Yerleşim Simülatörü"nden taşındı). Keşif: grid/cabin-recipe.js
import { html, useState, Icon, Chip, Seg, Sel, Badge, Title, trn } from '../kit.js';
import { app } from '../ctx.js';
import { varsayilanKabin, kabinTipleri, gucListesi, hucreListesi, hucreRec, HUCRE_SERI, yerlesim, kontroller, agirliklar, planSekilleri, hucreEkle, hucreSil, hucreKopyala, hucreTasi, hucreDegistir, hucreAyar, kabinDegistir, kanalEkle, kanalSil } from '../../grid/cabin.js';
import { govdeSecenekleri, govdeAnahtar, hucrePoz, koskGovdeleri } from '../../grid/cabin-recipe.js';
import { equipmentMaterials, autoRecipeOn } from '../../grid/recipe.js';

// v2.4: Kabin ekranında yalnız köşkler (monoblok / prefabrik). Trafo binası (MOD) kaldırıldı; eski kayıtta varsa düzenlenebilir.
const SINIF = [['mono', 'Monoblok köşk'], ['pref', 'Prefabrik köşk']];
// Posta tipine göre başlangıç sınıfı
export const kabinSinifi = (post) => (['mbk', 'rbk', 'dapt'].includes(post) ? 'pref' : 'mono');
export const KABIN_POSTLARI = ['mono', 'mbk', 'rbk', 'dapt'];
// Yeni kabin: hücresiz başlar (hücreler elle eklenir); trafo gücü kayıttan alınır
function yeniKabin(a0) {
  let c = Object.assign(varsayilanKabin(kabinSinifi(a0.post)), { hucreler: [] });
  if (a0.kva && gucListesi(c).includes(+a0.kva)) { const r = kabinDegistir(c, { trafoKva: +a0.kva }); if (r.ok) c = r.cabin; }
  delete c.sakli;
  return c;
}

const FILL = { duvar: '#64748b', bolme: '#475569', hucre: '#13243d', hucreTasan: '#5b1620', trafo: '#3a2a09', pano: '#2a2150', kanal: 'rgba(34,211,238,.10)', kapak: 'rgba(148,163,184,.18)', rezerv: 'none', kapi: '#0b1326' };
const STROKE = { duvar: '#94a3b8', bolme: '#64748b', hucre: '#38bdf8', hucreTasan: '#ef4444', trafo: '#f59e0b', pano: '#a78bfa', kanal: '#22d3ee', kapak: '#64748b', rezerv: '#64748b', kapi: '#10b981' };
const TXT = { hucre: '#bae6fd', fider: '#94a3b8', trafo: '#fcd34d', pano: '#c4b5fd', kanal: '#67e8f9', bolum: '#94a3b8', kapi: '#6ffbbe' };

export function CabinPlan({ cabin }) {
  const P = planSekilleri(cabin);
  let x0 = 0, y0 = 0, x1 = P.w, y1 = P.h;
  for (const r of P.rects) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
  for (const l of P.lines) { x0 = Math.min(x0, l.x1, l.x2); y0 = Math.min(y0, l.y1, l.y2); x1 = Math.max(x1, l.x1, l.x2); y1 = Math.max(y1, l.y1, l.y2); }
  for (const t of P.labels) { const hw = String(t.text).length * (t.size || 100) * 0.33; x0 = Math.min(x0, t.x - hw); x1 = Math.max(x1, t.x + hw); y0 = Math.min(y0, t.y - (t.size || 100)); y1 = Math.max(y1, t.y + (t.size || 100) * 0.4); }
  const m = 160, vw = x1 - x0 + 2 * m, vh = y1 - y0 + 2 * m;
  const fs = (s) => Math.max(s || 100, vw / 78);
  const order = ['rezerv', 'duvar', 'bolme', 'kapi', 'hucre', 'hucreTasan', 'trafo', 'pano', 'kanal', 'kapak'];
  const rects = P.rects.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return html`<svg viewBox=${(x0 - m) + ' ' + (y0 - m) + ' ' + vw + ' ' + vh} style="width:100%;height:auto;max-height:62vh;background:#0a1122;border:1px solid #334155;border-radius:8px" role="img" aria-label="Kabin yerleşim planı">
    ${rects.map((r) => html`<rect x=${r.x} y=${r.y} width=${Math.max(1, r.w)} height=${Math.max(1, r.h)} fill=${FILL[r.kind] || 'none'} stroke=${STROKE[r.kind] || '#64748b'} stroke-width=${r.kind === 'duvar' || r.kind === 'bolme' ? 6 : 14} stroke-dasharray=${r.kind === 'kanal' || r.kind === 'rezerv' ? '70 50' : null} />`)}
    ${P.lines.map((l) => html`<line x1=${l.x1} y1=${l.y1} x2=${l.x2} y2=${l.y2} stroke=${l.kind === 'kabloOG' ? '#ff6b6b' : l.kind === 'kabloAG' ? '#7ee08a' : '#10b981'} stroke-width=${l.kind === 'kapiKanat' ? 14 : 22} stroke-dasharray=${l.kind && l.kind.startsWith('kablo') ? '90 60' : null} />`)}
    ${P.labels.map((t) => html`<text x=${t.x} y=${t.y} font-size=${fs(t.size)} fill=${TXT[t.kind] || '#cbd5e1'} text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700">${t.text}</text>`)}
  </svg>`;
}

export function CabinScreen({ id }) {
  const ps = app.ps, cat = ps.cat;
  const e0 = ps.eqById(id);
  const a0 = (e0 && e0.attrs) || {};
  const [cabin, setCabinS] = useState(() => (a0.cabin ? JSON.parse(JSON.stringify(a0.cabin)) : yeniKabin(a0)));
  const ilkPB = () => (koskGovdeleri(cat, 'mbk')[0] || {}).servis || 'yok';
  const [govde, setGovde] = useState(() => (a0.govde === undefined ? ((a0.cabin ? a0.cabin.sinif : kabinSinifi(a0.post)) === 'pref' ? ilkPB() : 'oto') : (a0.govde || 'yok')));
  const [dirty, setDirty] = useState(!a0.cabin);
  const [addCode, setAddCode] = useState('');
  const [kn, setKn] = useState({ ad: '', boy: '', gen: 500, der: 700 });
  if (!e0) return html`<${Title} title="Kabin" /><div class="empty">Kayıt bulunamadı</div>`;
  const setCabin = (c) => { setCabinS(c); setDirty(true); };
  const run = (res) => { if (res.ok) setCabin(res.cabin); else app.toast(res.hata, 'warn', 6000); };
  const Y = yerlesim(cabin);
  const K = kontroller(cabin);
  const W = agirliklar(cabin);
  const tipler = kabinTipleri(cabin.sinif);
  const tip = tipler.find((t) => t.kosk === cabin.kosk) || tipler[0];
  const guc = gucListesi(cabin);
  const liste = hucreListesi(cabin.hucreSeri);
  const yal = cabin.yalitim === 'gd' ? 'gd' : 'hd';
  const auto = autoRecipeOn(ps.p);
  // Gövde seçenekleri: prefabrikte PB-1…PB-4, monoblokta TİP-1A/1B/1C; eski kayıttaki başka seçim listede kalır
  const gBase = cabin.sinif === 'bina' ? govdeSecenekleri(cat) : koskGovdeleri(cat, cabin.sinif === 'pref' ? 'mbk' : 'mono');
  const gOpts = govde !== 'oto' && govde !== 'yok' && !gBase.some((g) => g.servis === govde) ? [...gBase, { servis: govde, ad: (cat.poz(govde) || {}).name || govde }] : gBase;
  const gKey = govdeAnahtar(cabin, Y);
  // Keşif önizlemesi: bu kabinle oluşacak kalemler
  const eNew = Object.assign({}, e0, { attrs: Object.assign({}, a0, { cabin, kva: Y.hasT ? cabin.trafoKva : a0.kva }, govde === 'oto' ? {} : { govde: govde === 'yok' ? null : govde }) });
  if (govde === 'oto') delete eNew.attrs.govde;
  let items = []; try { items = equipmentMaterials(eNew, cat, { params: ps.p.paramOverrides, auto }).items.filter((m) => m.origin === 'OTO'); } catch (err) { items = []; }
  const bad = K.filter((k) => k.st === 'bad').length, warn = K.filter((k) => k.st === 'warn').length;
  const save = async () => {
    const attrs = Object.assign({}, a0, { cabin });
    if (Y.hasT) attrs.kva = cabin.trafoKva;
    if (govde === 'oto') delete attrs.govde; else attrs.govde = govde === 'yok' ? null : govde;
    await ps.updateEquipment(id, { attrs }, 'Kabin: ' + cabin.kosk + ' · ' + cabin.hucreler.length + ' hücre');
    setDirty(false); app.toast('Kabin kaydedildi · keşif güncellendi', 'ok', 3000);
  };
  const remove = async () => {
    if (!(await app.confirm('Kabin tanımını kaldır', 'Kabin tanımı (hücreler, kanallar) silinir; kayıt eski toplu keşif kalemlerine döner. Devam edilsin mi?', { danger: true, ok: 'Kaldır' }))) return;
    const attrs = Object.assign({}, a0); delete attrs.cabin; delete attrs.govde;
    await ps.updateEquipment(id, { attrs }, 'Kabin tanımı kaldırıldı'); app.nav.back();
  };
  const st = (k) => (k === 'ok' ? 'ok' : k === 'warn' ? 'warn' : 'err');
  return html`<${Title} title=${'Kabin · ' + e0.no} sub=${Y.tipKodu || cabin.kosk} right=${html`<button class=${'btn sm' + (dirty ? ' pri' : '')} disabled=${!dirty} onClick=${save}>${dirty ? 'KAYDET' : 'Kayıtlı'}</button>`} />
    <div class="card stack">
      <div class="fld"><label>Yapı sınıfı</label><div class="chips">${[...SINIF, ...(cabin.sinif === 'bina' ? [['bina', 'Trafo binası (eski kayıt)']] : [])].map(([k, l]) => html`<${Chip} fill on=${cabin.sinif === k} onClick=${() => { if (k === cabin.sinif) return; run(kabinDegistir(cabin, { sinif: k })); if (govde !== 'yok') setGovde(k === 'pref' ? ilkPB() : 'oto'); }}>${l}</${Chip}>`)}</div></div>
      <div class="grid2"><div class="fld"><label>${cabin.sinif === 'pref' ? 'Yerleşim ölçüsü (tip proje)' : 'Tip'}</label><${Sel} mono value=${cabin.kosk} options=${tipler.map((t) => [t.kosk, t.ad + ' · ' + t.boy + '×' + t.en + ' mm'])} onChange=${(v) => run(kabinDegistir(cabin, { kosk: v }))} /></div>
        <div class="fld"><label>Yerleşim</label><${Sel} value=${cabin.varyant} options=${(tip ? tip.varyantlar : []).map((v) => [v.key, v.ad])} onChange=${(v) => run(kabinDegistir(cabin, { varyant: v }))} /></div></div>
      <div class="grid2">${Y.hasT ? html`<div class="fld"><label>Trafo gücü</label><${Sel} mono value=${cabin.trafoKva} options=${guc.map((g) => [g, g + ' kVA'])} onChange=${(v) => run(kabinDegistir(cabin, { trafoKva: +v }))} /></div>` : html`<div class="fld"><label>Trafo</label><div class="inp" style="display:flex;align-items:center;color:#94a3b8">yok (KÖK)</div></div>`}
        <div class="fld"><label>Hücre yalıtımı</label><${Seg} value=${yal} options=${[['hd', 'Hava (hd)'], ['gd', 'Gaz (gd)']]} onChange=${(v) => setCabin(Object.assign({}, cabin, { yalitim: v }))} /></div></div>
      ${cabin.sinif === 'pref' && cabin.kosk === 'PBK-1B' && cabin.varyant !== 'KOK' ? html`<div class="fld"><label>Trafo adedi</label><${Seg} value=${cabin.trafoAdet || 2} options=${[[1, '1 trafo'], [2, '2 trafo']]} onChange=${(v) => run(kabinDegistir(cabin, { trafoAdet: v }))} /></div>` : null}
    </div>

    <${CabinPlan} cabin=${cabin} />
    <div class="grid3"><div class="stat"><b>Hücre sırası</b><span>${trn(Y.hucreW, 0)}</span><small>mm</small></div><div class="stat"><b>Kalan yer</b><span style=${'color:' + (Y.kalan < 0 ? '#ff8a8a' : '#6ffbbe')}>${trn(Y.kalan, 0)}</span><small>mm</small></div><div class="stat"><b>Koridor</b><span style=${'color:' + (Y.koridor < 800 ? '#fcd34d' : '#dae2fd')}>${trn(Y.koridor, 0)}</span><small>mm</small></div></div>

    <div class="sect">Hücreler <span class="r mono">${cabin.hucreler.length} adet</span></div>
    <div class="card tight list">
      ${cabin.hucreler.map((h, i) => { const r = hucreRec(h.c) || [h.c, '?', 0, 0]; const yh = Y.hucreler.find((x) => x.i === i); const pz = hucrePoz(cat, h.c, yal); return html`<div class="li" style="align-items:flex-start;flex-wrap:wrap;gap:6px">
        <div class="grow" style="min-width:180px"><div class="row" style="gap:6px"><b class="mono" style="font-size:13px">${i + 1}. ${h.c}</b>${yh && yh.sigar === false ? html`<${Badge} k="err">SIĞMIYOR</${Badge}>` : null}${Y.siralar.length > 1 && yh ? html`<${Badge} k="mut">${yh.sira === 'on' ? 'ÖN SIRA' : 'ARKA SIRA'}</${Badge}>` : null}</div>
          <div class="s">${r[1]} · ${r[2]} mm · ${r[3]} kg</div>
          <div class="m" style=${pz ? '' : 'color:#fcd34d'}>${r[3] === 0 && /YEDEK/.test(h.c) ? 'yedek yer · keşfe girmez' : pz ? 'Keşif: ' + ((cat.poz(pz) || {}).pozNo || pz) : 'Keşif: poz eşlenmemiş'}</div>
          <div class="row" style="gap:6px;margin-top:6px"><input class="inp" style="height:36px;font-size:13px" value=${h.f || ''} placeholder="Fider adı" onChange=${(e) => run(hucreAyar(cabin, i, { f: e.target.value }))} />
            <select class="inp" style="height:36px;width:96px;font-size:13px" value=${h.y || 'c'} onChange=${(e) => run(hucreAyar(cabin, i, { y: e.target.value }))}><option value="g">Giriş</option><option value="c">Çıkış</option><option value="x">—</option></select></div>
          <div class="row" style="gap:6px;margin-top:6px"><select class="inp mono" style="height:36px;font-size:12px" value=${h.c} onChange=${(e) => run(hucreDegistir(cabin, i, e.target.value))}>${[...(liste.some((x) => x[0] === h.c) ? [] : [[h.c, r[1]]]), ...liste].map((x) => html`<option value=${x[0]}>${x[0]} · ${x[1]}</option>`)}</select></div></div>
        <div class="row" style="gap:4px"><button class="btn xs" aria-label="Sola taşı" onClick=${() => run(hucreTasi(cabin, i, -1))}><${Icon} n="back" s=${14} /></button><button class="btn xs" aria-label="Sağa taşı" onClick=${() => run(hucreTasi(cabin, i, 1))}><${Icon} n="next" s=${14} /></button><button class="btn xs" aria-label="Kopyala" onClick=${() => run(hucreKopyala(cabin, i))}><${Icon} n="plus" s=${14} /></button><button class="btn xs dang" aria-label="Hücreyi çıkar" onClick=${() => run(hucreSil(cabin, i))}><${Icon} n="trash" s=${14} /></button></div>
      </div>`; })}
      ${!cabin.hucreler.length ? html`<div class="empty">Köşk hücresiz. Hücreleri aşağıdaki listeden seçip "Ekle" ile ekleyin.</div>` : null}
    </div>
    <div class="card stack">
      <div class="fld"><label>Hücre serisi</label><div class="chips">${Object.entries(HUCRE_SERI).map(([k, v]) => html`<${Chip} on=${cabin.hucreSeri === k} onClick=${() => run(kabinDegistir(cabin, { hucreSeri: k }))}>${v.ad}</${Chip}>`)}</div></div>
      <div class="row"><select class="inp mono grow" style="font-size:13px" value=${addCode || (liste[0] || [])[0]} onChange=${(e) => setAddCode(e.target.value)}>${liste.map((x) => html`<option value=${x[0]}>${x[0]} · ${x[1]} · ${x[2]} mm</option>`)}</select><button class="btn pri" onClick=${() => run(hucreEkle(cabin, addCode || (liste[0] || [])[0]))}><${Icon} n="plus" s=${18} c="#0b1326" />Ekle</button></div>
    </div>

    <div class="sect">Kablo kanalları <span class="r mono">${Y.kanallar.length} kanal · ${trn(Y.kanallar.reduce((s, k) => s + (k.boy || 0), 0) / 1000, 2)} m</span></div>
    <div class="card tight list">
      ${Y.kanallar.map((k) => { const ui = k.kaynak === 'kullanici' ? (cabin.kanallar || []).findIndex((x) => x.ad === k.ad && x.boy === k.boy) : -1; return html`<div class="li"><div class="grow"><div class="t" style="font-size:13px">${k.ad}</div><div class="m">${trn((k.boy || 0) / 1000, 2)} m × ${k.gen} mm genişlik × ${k.der} mm derinlik${k.kapakli ? ' · ' + (k.kapakAdet ? k.kapakAdet + ' kapak' : 'kapaklı') : ''}</div></div><${Badge} k=${k.kaynak === 'kullanici' ? 'cy' : 'mut'}>${k.kaynak === 'kullanici' ? 'EKLENEN' : 'TİP PROJE'}</${Badge}>${ui >= 0 ? html`<button class="btn xs dang" aria-label="Kanalı sil" onClick=${() => run(kanalSil(cabin, ui))}><${Icon} n="trash" s=${14} /></button>` : null}</div>`; })}
      ${!Y.kanallar.length ? html`<div class="empty">${cabin.sinif === 'mono' ? 'Monoblok köşkte kablolar tabandaki kablo bodrumundan geçer; tip projede ayrı kanal yok. Sahada kanal yapıldıysa aşağıdan ekleyin.' : 'Kanal yok.'}</div>` : null}
    </div>
    <div class="card stack"><div class="lbl">Kanal ekle</div>
      <div class="grid2"><div class="fld"><label>Ad</label><input class="inp" value=${kn.ad} placeholder="ör. OG giriş kanalı" onInput=${(e) => setKn(Object.assign({}, kn, { ad: e.target.value }))} /></div><div class="fld"><label>Uzunluk (m)</label><input class="inp mono" type="number" step="0.01" value=${kn.boy} onInput=${(e) => setKn(Object.assign({}, kn, { boy: e.target.value }))} /></div></div>
      <div class="grid2"><div class="fld"><label>Genişlik (mm)</label><input class="inp mono" type="number" step="50" value=${kn.gen} onInput=${(e) => setKn(Object.assign({}, kn, { gen: e.target.value }))} /></div><div class="fld"><label>Derinlik (mm)</label><input class="inp mono" type="number" step="50" value=${kn.der} onInput=${(e) => setKn(Object.assign({}, kn, { der: e.target.value }))} /></div></div>
      <button class="btn" onClick=${() => { if (!(+kn.boy > 0)) return app.toast('Uzunluk girin', 'warn'); run(kanalEkle(cabin, { ad: kn.ad.trim() || 'Kanal ' + ((cabin.kanallar || []).length + 1), boy: Math.round(+kn.boy * 1000), gen: +kn.gen || 500, der: +kn.der || 700 })); setKn({ ad: '', boy: '', gen: kn.gen, der: kn.der }); }}><${Icon} n="plus" s=${18} />Kanal ekle</button>
      <div class="note">Kanallar keşfe uzunluğuyla (m) gelir. Yazılacağı kalem: ${(cat.poz((cat.table('cabin') || {}).kanal) || {}).name || 'tanımsız'} · poz numarasını Poz Kataloğu'ndan girebilirsiniz.</div></div>

    <div class="sect">Köşk tipi (keşifte ayrı kalem)</div>
    <div class="card stack"><${Sel} value=${govde} options=${[...(cabin.sinif === 'pref' ? [] : [['oto', 'Otomatik: ' + (gKey ? gKey : 'belirlenemedi')]]), ...gOpts.map((g) => [g.servis, g.ad]), ['yok', 'Köşk kalemi yok (mevcut yapı)']]} onChange=${(v) => { setGovde(v); setDirty(true); }} />
      <div class="note">${cabin.sinif === 'pref' ? 'Prefabrik beton köşkte tip PB-1 … PB-4 arasından seçilir. Yukarıdaki "yerleşim ölçüsü" yalnız plan çizimi ve sığma kontrolü içindir.' : 'Monoblokta "Otomatik" tip dış boydan bulunur (≤5500 TİP-1A · ≤6500 TİP-1B · ≤7500 TİP-1C); isterseniz elle seçin.'}</div></div>

    <div class="sect">Kontroller <span class="r">${bad ? html`<span class="he">${bad} hata</span>` : null}${warn ? html` <span class="hw">${warn} uyarı</span>` : null}${!bad && !warn ? html`<span class="hl">uygun</span>` : null}</span></div>
    <div class="stack" style="gap:6px">${K.filter((k) => k.st !== 'ok').map((k) => html`<div class=${'alert ' + st(k.st)} style="display:block"><b>${k.txt}</b>${k.sub ? html`<div class="note">${k.sub}</div>` : null}</div>`)}
      <details><summary class="note" style="cursor:pointer;padding:6px 0">Uygun bulunan ${K.filter((k) => k.st === 'ok').length} kontrol</summary>${K.filter((k) => k.st === 'ok').map((k) => html`<div class="note" style="padding:4px 0"><b class="hl">✓</b> ${k.txt}${k.sub ? ' · ' + k.sub : ''}</div>`)}</details></div>

    <div class="sect">Keşfe gelecek kalemler <span class="r mono">${items.length} kalem</span></div>
    <div class="card tight scrollx"><table class="t"><thead><tr><th>Kod</th><th>Kalem</th><th class="n">Miktar</th></tr></thead><tbody>
      ${items.map((m) => html`<tr><td class="mono" style=${m.missing ? 'color:#fcd34d' : ''}>${m.servis ? ((cat.poz(m.servis) || {}).pozNo || m.servis) : 'poz yok'}</td><td>${m.name}<div class="note">${m.why}</div></td><td class="n">${trn(m.qty, m.unit === 'm' ? 2 : 0)} ${m.unit}</td></tr>`)}
    </tbody></table></div>

    <div class="sect">Ağırlıklar</div>
    <div class="card tight list">${W.satirlar.map((r) => html`<div class="li"><span class="grow" style="font-size:13px">${r.ad}</span><b class="mono">${trn(r.kg, 0)} kg</b></div>`)}<div class="li"><b class="grow">Toplam taşıma ağırlığı</b><b class="mono hl">${trn(W.toplam, 0)} kg</b></div></div>
    <div class="row" style="margin-top:8px"><button class="btn pri huge grow" disabled=${!dirty} onClick=${save}>${dirty ? 'KABİNİ KAYDET' : 'KAYITLI'}</button>${a0.cabin ? html`<button class="btn dang" style="height:64px" onClick=${remove}>Kaldır</button>` : null}</div>`;
}
