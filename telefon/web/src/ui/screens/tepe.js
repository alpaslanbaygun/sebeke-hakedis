// Cer vektör hesabı ve direk tepe kuvveti. Kollar (yön + açıklık) çizimden ya da uygulamadaki hatlardan gelir;
// iletken tertibi katman adından tanınır ya da kol başına seçilir (seçim katmanla eşleştirilip hatırlanır).
// Yöntem: calc/tepe.js ("AG-OG Direk Tepe Kuvveti Simülatörü"nden birebir taşınan tablolar ve varsayımlar).
import { html, useState, useEffect, Icon, Chip, Seg, Sel, Badge, Title, SayiGirdi, trn } from '../kit.js';
import { app } from '../ctx.js';
import { TABLES, tertipler, hesapT, hesapKT, hesapD, hesapKD, hesapN, hesapG, gorevOner } from '../../calc/tepe.js';
import { devreYazisi } from '../../grid/lines.js';

const GOREV = { T: 'Taşıyıcı', KT: 'Köşede taşıyıcı', D: 'Durdurucu', KD: 'Köşede durdurucu', N: 'Nihayet', G: 'Branşman / tevzi' };
const up = (s) => String(s || '').toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
// Katman / iletken adından tertip tahmini (kullanıcının eşleştirme tablosu önceliklidir)
const YG_HINT = [['3x477MCM', /HAWK|477/], ['3x266MCM', /PARTRIDGE|266/], ['3x3/0AWG', /PIGEON|3\/0|3-0AWG/], ['3x1/0AWG', /RAVEN|1\/0|1-0AWG/], ['3x3AWG', /SWALLOW|3 ?AWG|3AWG/]];
export function tertipTahmin(name, agKeys) {
  const u = up(name);
  let yg = '', ag = '';
  for (const [k, re] of YG_HINT) if (re.test(u)) { yg = k; break; }
  const norm = (x) => up(x).replace(/\s+/g, '').replace(/ALP$|AER$/, '');
  const un = u.replace(/\s+/g, '');
  // AER / ALPEK kesiti: "3x70+95", "3x35/16+50" …
  const m = un.match(/(\d)X(\d+)(\/16)?\+(\d+)/);
  if (m) { const want = m[1] + 'X' + m[2] + (m[3] || '') + '+' + m[4]; const hit = agKeys.find((k) => norm(k) === want); if (hit) ag = hit; }
  if (!ag) { const hit = agKeys.filter((k) => !/ALP/.test(k)).sort((a, b) => b.length - a.length).find((k) => un.includes(norm(k))); if (hit) ag = hit; }
  return { yg, ag };
}
// Uygulamadaki hat devrelerinden tertip (OG iletkeni adı / AER kesiti)
export function tertipFromLine(line, agKeys) {
  const names = (line.circuits || []).map((c) => devreYazisi(c) + ' ' + (c.role || '')).join(' | ');
  const og = (line.circuits || []).filter((c) => c.role === 'OG' || c.role === 'ENH').map(devreYazisi).join(' ');
  const ag = (line.circuits || []).filter((c) => c.role !== 'OG' && c.role !== 'ENH').map(devreYazisi).join(' ');
  return { yg: tertipTahmin(og, agKeys).yg, ag: tertipTahmin(ag, agKeys).ag, names };
}

// Uygulamadaki bir direk / nokta için kollar: bağlı hatların komşu düğümlerine yön ve açıklık
export function armsOfPoint(ps, pointId) {
  const p0 = ps.pointById(pointId); if (!p0) return [];
  const agKeys = tertipler(false).map((t) => t.key);
  const out = [];
  for (const l of ps.data.lines) {
    if (l.install === 'yeralti') continue;
    l.nodes.forEach((id, i) => {
      if (id !== pointId) return;
      for (const j of [i - 1, i + 1]) {
        const q = ps.pointById(l.nodes[j]); if (!q || q.E == null) continue;
        const az = ((Math.atan2(q.N - p0.N, q.E - p0.E) * 180) / Math.PI + 360) % 360;
        const t = tertipFromLine(l, agKeys);
        out.push({ az, len: Math.hypot(q.E - p0.E, q.N - p0.N), layer: l.lineNo + ' · ' + l.lineType, hint: t });
      }
    });
  }
  return out.sort((a, b) => a.az - b.az);
}

export function TepeScreen({ E, N, arms, title, pointId }) {
  const ps = app.ps;
  const agList = tertipler(false);
  const agKeys = agList.map((t) => t.key);
  const [map, setMap] = useState({});
  const zone = { I: 0, II: 1, III: 2, IV: 3 }[ps.p.enhZone] ?? 1;
  const [bolge, setBolge] = useState(zone);
  const [rows, setRows] = useState(() => (arms || []).map((a) => Object.assign({ md: 'tam' }, a, a.hint ? { yg: a.hint.yg, ag: a.hint.ag } : tertipTahmin(a.layer, agKeys))));
  const [gorevSec, setGorev] = useState(null);
  const [dMod, setDMod] = useState('fark');
  const [hal, setHal] = useState(null);
  const [wind, setWind] = useState(false);
  const [manuel, setManuel] = useState('');
  const [steps, setSteps] = useState(false);
  // Katman → tertip eşleştirme tablosu (ayar olarak saklanır; kullanıcı seçtikçe öğrenir)
  useEffect(() => { app.ds.setting('tepeLayerMap').then((m) => { if (!m) return; setMap(m); setRows((rs) => rs.map((r) => (m[up(r.layer)] && !r.hint ? Object.assign({}, r, m[up(r.layer)]) : r))); }); }, []);
  const setRow = (i, patch, learn) => {
    setRows((rs) => rs.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)));
    if (learn && rows[i] && rows[i].layer) { const r = Object.assign({}, rows[i], patch); const m = Object.assign({}, map, { [up(r.layer)]: { yg: r.yg || '', ag: r.ag || '' } }); setMap(m); app.ds.setting('tepeLayerMap', m); }
  };
  const addArm = () => setRows((rs) => [...rs, { az: 0, len: 40, layer: '', yg: '', ag: '', md: 'tam' }]);
  const mus = rows.some((r) => r.yg);
  const key = (r) => (mus ? (r.yg || '') + '#' + (r.ag || '') : r.ag || '');
  const kollar = rows.map((r) => ({ ac: +r.az || 0, tp: key(r), len: +r.len || 0, md: r.md || 'tam' }));
  const hazir = rows.length > 0 && rows.every((r) => r.yg || r.ag);
  const oner = gorevOner(kollar.map((k) => ({ ac: k.ac, tp: k.tp })));
  const gorev = gorevSec || oner.gorev;
  let R = null;
  if (hazir && gorev) {
    const k = kollar;
    try {
      if (gorev === 'N') R = hesapN({ mus, bolge, tp: k[0].tp, a: k[0].len, hal: hal || 'mn', manuel });
      else if (gorev === 'T') R = hesapT({ mus, bolge, tp: k[0].tp, a1: k[0].len, a2: (k[1] || k[0]).len, manuel });
      else if (gorev === 'KT') R = hesapKT({ mus, bolge, tp: k[0].tp, alfa: oner.alfa ?? 180, aw: (k[0].len + (k[1] || k[0]).len) / 2, manuel });
      else if (gorev === 'D') R = hesapD({ mus, bolge, mod: dMod, hal: hal || 'tum', t1: k[0].tp, t2: (k[1] || k[0]).tp, a1: k[0].len, a2: (k[1] || k[0]).len, manuel });
      else if (gorev === 'KD') R = hesapKD({ mus, bolge, hal: hal || 'mdk', t1: k[0].tp, t2: (k[1] || k[0]).tp, alfa: oner.alfa ?? 180, aw: Math.max(k[0].len, (k[1] || k[0]).len), manuel });
      else R = hesapG({ mus, bolge, kollar: k.map((x) => ({ tp: x.tp, ac: x.ac, md: x.md })), yontem: 'oto', acikip: 'mut', wind, wdir: 90, wa: Math.max(...k.map((x) => x.len)) > 40 ? 50 : 40, braA: 0, eks: 'auto', manuel });
    } catch (err) { R = { ok: false, hata: err.message || String(err), uyarilar: [], adimlar: [] }; }
  }
  const S = R && R.sonuc ? R.sonuc : {};
  const num = (v) => (v == null || !Number.isFinite(+v) ? '—' : trn(+v, Math.abs(v - Math.round(v)) < 0.005 ? 0 : 1));
  const anaR = R && R.ok ? (gorev === 'T' ? S.Pw : gorev === 'KT' ? S.Rd : gorev === 'D' ? S.Rd : gorev === 'KD' ? S.enD : gorev === 'N' ? (S.RN ?? S.Td) : S.Rdemir) : null;
  const anaB = R && R.ok ? (gorev === 'T' ? S.Pw : gorev === 'KT' ? S.Rb : gorev === 'D' ? S.Rb : gorev === 'KD' ? S.enB : gorev === 'N' ? S.Tb : S.Rbeton) : null;
  const manList = [['', 'Otomatik seç'], ...(mus ? TABLES.MATIP_SIRA : TABLES.ATIP_SIRA).map((k) => ['A:' + k, 'A tipi ' + k]), ...(mus ? TABLES.MKAFES_SIRA : TABLES.KAFES_SIRA).map((k) => ['K:' + k, 'Kafes ' + k]), ...TABLES.BETON_TIP.map((t) => ['B:' + t, 'Beton /' + t])];
  // Daire üzerinde kollar ve bileşke
  const dia = (() => {
    const c = 110, rr = 86;
    const maxT = Math.max(1, ...(S.kollar || []).map((k) => k.Td || 0));
    return html`<svg viewBox="0 0 220 220" style="width:100%;max-width:240px;height:auto" role="img" aria-label="Kol yönleri">
      <circle cx=${c} cy=${c} r=${rr} fill="var(--bg2)" stroke="var(--line)" /><line x1=${c} y1=${c - rr} x2=${c} y2=${c + rr} stroke="var(--panel2)" /><line x1=${c - rr} y1=${c} x2=${c + rr} y2=${c} stroke="var(--panel2)" />
      <text x=${c} y="16" text-anchor="middle" font-size="9" fill="var(--mut)" font-weight="700">KUZEY</text>
      ${rows.map((r, i) => { const a = (+r.az || 0) * Math.PI / 180; const L = S.kollar && S.kollar[i] && S.kollar[i].Td ? 30 + 56 * (S.kollar[i].Td / maxT) : rr; const x = c + L * Math.cos(a), y = c - L * Math.sin(a); return html`<line x1=${c} y1=${c} x2=${x} y2=${y} stroke=${r.yg ? '#ff8a8a' : '#7ee08a'} stroke-width="3" stroke-linecap="round" /><text x=${c + (L + 10) * Math.cos(a)} y=${c - (L + 10) * Math.sin(a) + 3} text-anchor="middle" font-size="10" font-weight="800" fill="var(--tx)">${i + 1}</text>`; })}
      ${R && R.ok && S.yon != null ? (() => { const a = S.yon * Math.PI / 180; return html`<line x1=${c} y1=${c} x2=${c + 70 * Math.cos(a)} y2=${c - 70 * Math.sin(a)} stroke="#fde047" stroke-width="2.5" stroke-dasharray="5 4" /><circle cx=${c + 70 * Math.cos(a)} cy=${c - 70 * Math.sin(a)} r="4" fill="#fde047" />`; })() : null}
      <circle cx=${c} cy=${c} r="6" fill="var(--tx)" stroke="var(--bg)" stroke-width="2" /></svg>`;
  })();
  return html`<${Title} title="Direk tepe kuvveti" sub=${(title || 'Cer vektör hesabı') + (E != null ? ' · Y ' + trn(E, 2) + ' · X ' + trn(N, 2) : '')} />
    <div class="card stack">
      <div class="fld"><label>Buz yükü bölgesi</label><${Seg} value=${bolge} options=${[[0, '1. Bölge'], [1, '2. Bölge'], [2, '3. Bölge'], [3, '4. Bölge']]} onChange=${setBolge} /></div>
      <div class="row"><span class="lbl grow">Şebeke</span><${Badge} k=${mus ? 'err' : 'ok'}>${mus ? 'MÜŞTEREK (OG + AG)' : 'YALNIZ AG'}</${Badge}></div>
    </div>
    <div class="sect">Kollar <span class="r mono">${rows.length} kol</span></div>
    ${rows.map((r, i) => html`<div class="card stack" style="gap:8px">
      <div class="row"><span class="badge b-mut" style="height:24px">${i + 1}</span><b class="grow mono" style="font-size:13px">${r.layer || 'elle eklenen kol'}</b><button class="btn xs dang" aria-label="Kolu sil" onClick=${() => setRows((rs) => rs.filter((_, k) => k !== i))}><${Icon} n="trash" s=${14} /></button></div>
      <div class="grid2"><div class="fld"><label>Yön (° · doğu 0, saat tersi)</label><${SayiGirdi} value=${Math.round((+r.az || 0) * 10) / 10} onSave=${(v) => setRow(i, { az: v ?? 0 })} /></div><div class="fld"><label>Açıklık (m)</label><${SayiGirdi} value=${Math.round((+r.len || 0) * 10) / 10} onSave=${(v) => setRow(i, { len: v ?? 0 })} /></div></div>
      <div class="grid2"><div class="fld"><label style="color:var(--og)">OG iletkeni</label><${Sel} mono value=${r.yg || ''} options=${[['', 'yok'], ...TABLES.YG_SIRA.map((k) => [k, k])]} onChange=${(v) => setRow(i, { yg: v }, true)} /></div>
        <div class="fld"><label style="color:#7ee08a">AG tertibi</label><${Sel} mono value=${r.ag || ''} options=${[['', 'yok'], ...agList.map((t) => [t.key, t.label || t.key])]} onChange=${(v) => setRow(i, { ag: v }, true)} /></div></div>
      ${!(r.yg || r.ag) ? html`<div class="note hw">İletken tanınmadı: OG iletkeni ya da AG tertibini seçin. Seçiminiz "${r.layer || 'bu katman'}" için hatırlanır.</div>` : null}
    </div>`)}
    <button class="btn blk" style="border-style:dashed" onClick=${addArm}><${Icon} n="plus" s=${18} />Kol ekle</button>
    ${!rows.length ? html`<div class="alert warn">Bu noktada birleşen çizgi bulunamadı. Kolları elle ekleyebilir ya da çizimde hatların birleştiği bir uca dokunabilirsiniz.</div>` : null}

    <div class="sect">Direğin görevi</div>
    <div class="card stack">
      <div class="chips">${Object.entries(GOREV).map(([k, l]) => html`<${Chip} on=${gorev === k} onClick=${() => { setGorev(k); setHal(null); }}>${l}${oner.gorev === k ? html`<small>öneri</small>` : null}</${Chip}>`)}</div>
      ${oner.alfa != null && (gorev === 'KT' || gorev === 'KD') ? html`<div class="note mono">Kollar arası açı α = ${trn(oner.alfa, 1)}° (180° = düz hat)</div>` : null}
      ${gorev === 'D' && !mus ? html`<div class="fld"><label>İki taraftaki iletken</label><${Seg} value=${dMod} options=${[['ayni', 'Aynı cins, sayı farklı'], ['fark', 'Cins değişiyor']]} onChange=${setDMod} /></div>` : null}
      ${mus && gorev === 'D' ? html`<div class="fld"><label>Durdurulan</label><${Seg} value=${hal || 'tum'} options=${[['tum', 'OG + AG birlikte'], ['yg', 'Yalnız OG']]} onChange=${setHal} /></div>` : null}
      ${mus && gorev === 'KD' ? html`<div class="fld"><label>Durum</label><${Sel} value=${hal || 'mdk'} options=${[['mdk', 'Müşterek durdurucu köşe'], ['mdkyg', 'Yalnız OG durduruluyor'], ['mn', 'OG devam, AG nihayet']]} onChange=${setHal} /></div>` : null}
      ${mus && gorev === 'N' ? html`<div class="fld"><label>Durum</label><${Seg} value=${hal || 'mn'} options=${[['mn', 'OG devam, AG nihayet'], ['tam', 'OG + AG nihayet']]} onChange=${setHal} /></div>` : null}
      ${gorev === 'G' ? html`<div class="row"><span class="grow">Rüzgâr yükünü de kat (4. varsayım)</span><button type="button" class=${'tog' + (wind ? ' on' : '')} role="switch" aria-checked=${wind ? 'true' : 'false'} aria-label="Rüzgâr" onClick=${() => setWind(!wind)}></button></div>` : null}
      <div class="fld"><label>Direk</label><${Sel} value=${manuel} options=${manList} onChange=${setManuel} /></div>
    </div>

    <div class="sect">Sonuç</div>
    ${!hazir ? html`<div class="alert info">Her kol için iletken seçildiğinde sonuç hesaplanır.</div>`
      : !R ? null
      : !R.ok ? html`<div class="alert err">${R.hata || 'Hesaplanamadı'}</div>`
      : html`<div class="card stack">
        <div class="row" style="align-items:flex-start;gap:12px"><div style="flex:0 0 42%">${dia}</div>
          <div class="grow stack" style="gap:10px">
            <div><div class="lbl">Tepe kuvveti · demir direk</div><div class="row" style="align-items:baseline;gap:4px"><span class="big" style="font-size:32px;line-height:36px">${num(anaR)}</span><span class="num" style="color:var(--mut)">kg</span></div></div>
            <div><div class="lbl">Beton direk için</div><div class="num" style="font-size:18px">${anaB != null ? num(anaB) + ' kg' : 'tablo değeri yok'}</div></div>
            ${S.yon != null ? html`<div><div class="lbl">Bileşke yönü</div><div class="num">${trn(S.yon, 1)}°</div></div>` : null}
          </div></div>
        <div class="grid2"><div class="stat"><b>Demir direk</b><span style="font-size:17px;color:var(--ok2)">${R.demir ? (R.demir.tip === 'K' ? 'Kafes ' : 'A tipi ') + R.demir.ad : '—'}</span>${R.kafesZorunlu ? html`<div class="note">kafes zorunlu</div>` : null}</div>
          <div class="stat"><b>Beton direk</b><span style="font-size:17px;color:var(--ok2)">${R.beton ? R.beton.ad : '—'}</span>${R.beton && R.beton.taban ? html`<div class="note">asgari tip</div>` : null}</div></div>
        ${S.Rk != null && gorev !== 'T' ? html`<div class="kv mono" style="font-size:12px"><b>Kuvvetli eksen</b><span>${num(S.Rk)} kg</span><b>Zayıf eksen</b><span>${num(S.Rz)} kg</span>${S.Pwz != null ? html`<b>Rüzgâr (zayıf eksen)</b><span>${num(S.Pwz)} kg</span>` : null}${S.sinif && S.sinif.ad ? html`<b>Düğüm</b><span>${S.sinif.ad}</span>` : null}</div>` : null}
        ${R.manuel ? html`<div class=${'alert ' + (R.manuel.ok ? 'ok' : 'err')}>${R.manuel.ok ? 'Seçilen direk yeterlidir' : 'Seçilen direk YETERSİZDİR'}${R.manuel.ad ? ' · ' + R.manuel.ad : ''}</div>` : null}
        ${(R.uyarilar || []).map((u) => html`<div class="alert warn" style="font-size:12px">${u}</div>`)}
        ${S.haller && S.haller.length ? html`<div class="card tight scrollx"><table class="t"><thead><tr><th>Yük hâli</th><th class="n">ΣPx</th><th class="n">ΣPy</th><th class="n">R demir</th><th class="n">R beton</th></tr></thead><tbody>${S.haller.map((h) => html`<tr><td>${h.ad}</td><td class="n">${num(h.Px)}</td><td class="n">${num(h.Py)}</td><td class="n">${num(h.sk ?? h.R)}</td><td class="n">${h.Rb != null ? num(h.Rb) : '—'}</td></tr>`)}</tbody></table></div>` : null}
        <button class="btn sm" onClick=${() => setSteps(!steps)}>${steps ? 'Hesap adımlarını gizle' : 'Hesap adımlarını göster'}</button>
        ${steps ? html`<div class="card" style="background:var(--bg2)"><div class="mono" style="font-size:11.5px;line-height:1.6;white-space:pre-wrap">${(R.adimlar || []).join('\n')}</div></div>` : null}
      </div>`}
    <div class="note">Yöntem: tablo değerleriyle cer (Tmax) ve vektör toplamı; kuvvetler kg. AG kuvvetleri müşterek direkte tepeye 0,81 oranıyla indirgenir. Sonuç proje müellifinin kontrolündedir.</div>
    ${Object.keys(map).length ? html`<details class="card"><summary style="cursor:pointer;font-weight:700">Katman → iletken eşleştirmeleri (${Object.keys(map).length})</summary><div class="stack" style="gap:4px;margin-top:8px">${Object.entries(map).map(([k, v]) => html`<div class="row" style="font-size:12px"><span class="mono grow">${k}</span><span class="mono note">${(v.yg || '—') + ' # ' + (v.ag || '—')}</span><button class="btn xs" aria-label="Eşleştirmeyi sil" onClick=${() => { const m = Object.assign({}, map); delete m[k]; setMap(m); app.ds.setting('tepeLayerMap', m); }}><${Icon} n="x" s=${12} /></button></div>`)}</div></details>` : null}`;
}
