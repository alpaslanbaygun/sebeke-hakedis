// 04 · Hesaplar (açıklık/sehim, köşe açıları, direk tipi kontrolü, Yeşil Defter özeti) + ENH · Metraj · Hakediş · Kontrol
import { html, useState, useBus, Icon, Chip, Seg, Sel, Badge, Title, Stat, Empty, fmt, trn, CODE_KIND } from '../kit.js';
import { app } from '../ctx.js';
import { dms } from '../../geo/geom.js';
import { roleLabel } from '../../grid/checks.js';
import { lineLabelText } from '../../grid/lines.js';
import { greenBookPage } from '../../qty/metraj.js';
import { JOB_LABEL, SOURCE_LABEL } from '../../core/schema.js';
import { hesapKayitlari } from '../../hesap/kayitlar.js';

export function CalcScreen() {
  useBus(['project:computed', 'hesap:kayit']);
  const ps = app.ps, r = ps.result, cat = ps.cat;
  const lines = ps.data.lines.filter((l) => l.install === 'havai');
  const [lid, setLid] = useState(app.state.calcLine || (lines[0] || {}).id);
  const [job, setJob] = useState('montaj');
  const l = ps.lineById(lid) || lines[0];
  const spans = l ? r.spans.filter((s) => s.lineId === l.id).sort((a, b) => a.seq - b.seq) : [];
  const enh = l ? r.enh.get(l.id) : null;
  const sagOf = (s) => enh && !enh.error ? (enh.spans.find((x) => x.spanId === s.id) || {}).sagMax : null;
  const poles = l ? l.nodes.map((n) => ps.eqAt(n).find((e) => e.kind === 'pole' || e.kind === 'lighting')).filter(Boolean) : [];
  const corners = poles.filter((e) => (r.roles.get(e.id) || {}).role === 'Z');
  const tot2 = spans.reduce((s, x) => s + x.length2D, 0), tot3 = spans.reduce((s, x) => s + x.length3D, 0);
  const page = greenBookPage(r.quantities, job);
  const cnt = (j) => r.quantities.filter((q) => q.job === j).length;
  const errs = r.issues.filter((i) => i.severity === 'error').length, warns = r.issues.filter((i) => i.severity === 'warn').length;
  const hesapSayisi = hesapKayitlari(ps).length;
  return html`<div class="title"><div class="grow"><h1>Hesaplar</h1><div class="sub">${l ? l.lineNo + ' hattı · ' + (l.voltageKV || (l.lineType === 'OG' ? 34.5 : 0.4)) + ' kV · ' + (poles[0] ? poles[0].no : '') + ' → ' + (poles[poles.length - 1] ? poles[poles.length - 1].no : '') : 'Havai hat yok'}</div></div></div>
    <button class="card hesapgiris" onClick=${() => app.nav.go('hesapMerkezi', {})}>
      <${Icon} n="calc" s=${26} c="#f59e0b" />
      <span class="grow"><b>Teknik hesaplar</b><span class="note">Direk tepe kuvveti (cer vektörü) · kanal planı</span></span>
      ${hesapSayisi ? html`<span class="badge b-m">${hesapSayisi} kayıt</span>` : html`<${Icon} n="next" s=${18} c="#64748b" />`}
    </button>
    ${l ? html`<button class="btn blk" style="margin:-2px 0 8px" onClick=${() => app.nav.go('hesapMerkezi', { hedef: { tur: 'hat', id: l.id } })}><${Icon} n="calc" s=${16} />${l.lineNo} hattı için uygun hesaplar</button>` : null}
    <div class="grid4">
      <button class="stat" style="text-align:left;color:inherit" onClick=${() => app.nav.go('checks')}><b>Kontrol</b><span style=${'font-size:16px;color:' + (errs ? '#ff8a8a' : '#6ffbbe')}>${errs}/${warns}</span></button>
      <button class="stat" style="text-align:left;color:inherit" onClick=${() => app.nav.go('metraj')}><b>Metraj</b><span style="font-size:16px">${r.quantities.length}</span></button>
      <button class="stat" style="text-align:left;color:inherit" onClick=${() => app.nav.go('hakedis')}><b>Hakediş</b><span style="font-size:16px">${ps.data.periods.length}</span></button>
      <button class="stat" style="text-align:left;color:inherit" disabled=${!l} onClick=${() => app.nav.go('enh', { id: l.id })}><b>ENH</b><span style="font-size:16px">${enh && !enh.error ? 'OK' : '—'}</span></button>
    </div>
    ${lines.length > 1 ? html`<${Sel} value=${l && l.id} options=${lines.map((x) => [x.id, x.lineNo + ' · ' + x.lineType + ' · ' + lineLabelText(x, cat)])} onChange=${(v) => { setLid(v); app.state.calcLine = v; }} />` : null}
    ${l ? html`<div class="grid3" style="margin-top:4px"><${Stat} label="Toplam 2D" value=${trn(tot2, 3)} unit="m" /><${Stat} label="Toplam 3D" value=${trn(tot3, 3)} unit="m" /><${Stat} label="Direk / köşe" value=${poles.length + ' / ' + corners.length} /></div>
    <div class="card tight"><div class="row" style="padding:12px"><span class="lbl grow">Açıklık ve sehim</span><span class="mono note">${enh && !enh.error ? enh.conductor + ' · ' + enh.zone.label + ' · +' + enh.zone.tMax + '°C' : lineLabelText(l, cat)}</span></div>
      <div class="scrollx"><table class="t"><thead><tr><th>Açıklık</th><th class="n">2D m</th><th class="n">3D m</th><th class="n">ΔH m</th><th class="n">Sehim</th></tr></thead><tbody>
      ${spans.map((s) => html`<tr><td class="mono" style="color:#ff8a8a;font-weight:700">${s.fromNo.replace(/^\D+-/, '')} → ${s.toNo.replace(/^\D+-/, '')}</td><td class="n">${fmt(s.length2D)}</td><td class="n">${fmt(s.length3D)}</td><td class="n">${(s.dH >= 0 ? '+' : '') + fmt(s.dH)}</td><td class="n">${sagOf(s) != null ? fmt(sagOf(s)) : '—'}</td></tr>`)}
      <tr><td class="lbl">Toplam</td><td class="n">${fmt(tot2)}</td><td class="n">${fmt(tot3)}</td><td></td><td></td></tr></tbody></table></div>
      ${enh && enh.error ? html`<div class="note" style="padding:0 12px 10px">Sehim: ${enh.error}</div>` : null}</div>
    <div class="card"><div class="row"><span class="lbl grow">Köşe sapma açıları</span><span class="mono note">α = 180° − β</span></div>
      ${corners.length ? html`<div class="grid3" style="margin-top:8px"><span class="lbl">Direk</span><span class="lbl">β iç açı</span><span class="lbl">α sapma</span></div>${corners.map((e) => { const ri = r.roles.get(e.id); return html`<div class="grid3" style="padding:8px 0;border-top:1px solid #2d3449"><b class="mono" style="color:#ff8a8a">${e.no}</b><span class="mono">${dms(ri.beta)}</span><b class="mono" style="font-size:18px">${dms(ri.angle)}</b></div>`; })}` : html`<div class="note" style="margin-top:6px">Köşe direği yok (eşik ${ps.p.cornerThresholdDeg ?? 3}°)</div>`}</div>
    <div class="card tight"><div class="row" style="padding:12px"><span class="lbl grow">Direk tipi kontrolü</span><span class="mono note">T · D · N · Z harfi = rol</span></div>
      <table class="t"><thead><tr><th>Direk</th><th>Tip</th><th>Rol</th><th></th></tr></thead><tbody>${poles.map((e) => { const t = cat.poleType(e.typeId); const ri = r.roles.get(e.id) || {}; const bad = t && t.role && ri.role && t.role !== ri.role; return html`<tr onClick=${() => app.nav.go('equipment', { id: e.id })}><td class="mono" style="color:#ff8a8a;font-weight:700">${e.no}</td><td><div class="mono" style="font-weight:700">${t ? t.name : '—'}</div><div class="note mono">${t ? (t.kg || '') + ' kg · ' + t.servis : ''}</div></td><td>${roleLabel(ri.role)}</td><td>${bad ? html`<${Icon} n="warn" s=${18} c="#f59e0b" />` : html`<${Icon} n="check" s=${18} c="#10b981" />`}</td></tr>`; })}</tbody></table></div>` : html`<${Empty}>Açıklık hesabı için havai hat çizin.</${Empty}>`}
    <div class="card tight"><div class="row" style="padding:12px 12px 8px"><span class="lbl grow">Yeşil Defter özeti</span><span class="mono note">servis poz no · birim · miktar</span></div>
      <div class="grid3" style="padding:0 12px 10px">${['montaj', 'demontaj', 'dmm'].map((j) => html`<${Chip} on=${job === j} onClick=${() => setJob(j)}>${JOB_LABEL[j]} · ${cnt(j)}</${Chip}>`)}</div>
      <div class="list">${page.slice(0, 40).map((x) => html`<div class="li" style=${'min-height:40px;' + (x.sub ? 'padding-left:14px' : '')}><span class="mono" style=${'width:118px;font-size:11px;font-weight:700;color:' + (x.sub ? '#94a3b8' : x.ok ? '#dae2fd' : '#fcd34d')}>${x.code}</span><span class="grow" style=${'font-size:12px;' + (x.sub ? 'color:#94a3b8' : 'font-weight:600')}>${x.name}</span><b class="mono">${trn(x.qty, x.unit === 'Kg' ? 2 : x.unit === 'Ad' ? 0 : 2)}</b><span class="note" style="width:24px">${x.unit}</span></div>`)}${!page.length ? html`<div class="empty">Bu sayfada kalem yok</div>` : null}</div>
      <div class="alert info" style="margin:10px 12px"><${Icon} n="info" s=${16} /><span>Çıplak iletken Kg = hat metresi (3B) × damar × birim ağırlık (${cat.std.name}). Direk/travers Kg grupları alt kalem ağırlıklarından toplanır.</span></div>
      <div style="padding:0 12px 12px"><button class="btn blk" onClick=${() => app.nav.go('metraj')}>Tüm metraj ve kaynaklar →</button></div></div>`;
}

export function EnhScreen({ id }) {
  useBus(['project:computed']);
  const ps = app.ps, r = ps.result;
  const l = ps.lineById(id);
  const res = l ? r.enh.get(l.id) : null;
  const enhT = ps.cat.table('enh');
  const zone = ps.p.enhZone || 'II';
  const [st, setSt] = useState('S4');
  if (!l) return html`<${Title} title="ENH" />`;
  return html`<${Title} title=${'ENH · ' + l.lineNo} sub=${lineLabelText(l, ps.cat)} />
    <div class="fld"><label>Buz / iklim bölgesi (proje)</label><${Seg} value=${zone} options=${enhT.zones.map((z) => [z.id, z.id])} onChange=${(v) => ps.updateProject({ enhZone: v }, 'ENH bölgesi ' + v)} /></div>
    ${enhT.verified ? null : html`<div class="alert warn"><${Icon} n="warn" s=${16} /><span>${enhT.note}</span></div>`}
    ${!res || res.error ? html`<div class="alert err">${res ? res.error : 'Hesap yok'}</div>` : html`
      <div class="grid3"><${Stat} label="İletken" value=${res.conductor} /><${Stat} label="İletken sayısı" value=${res.nCond} /><${Stat} label="Bölge" value=${res.zone.id} /></div>
      <div class="note mono">d ${res.mech.d} mm · A ${res.mech.A} mm² · ${res.kgPerKm} kg/km · RTS ${res.mech.rts} daN · E ${res.mech.E} · α ${res.mech.alpha} · buz k=${res.zone.iceK} · q=${enhT.windQ} daN/m² · σmax %${enhT.maxStressPctRTS} RTS</div>
      ${res.sections.map((s) => html`<div class="card"><div class="row"><b class="grow">Germe bölümü ${s.from} → ${s.to}</b><${Badge} k=${s.edsOk ? 'ok' : 'warn'}>EDS %${s.edsPct.toFixed(1)}</${Badge}></div>
        <div class="kv mono" style="font-size:12px;margin-top:6px"><b>İdeal açıklık</b><span>${fmt(s.ar, 1)} m (${s.spans} açıklık)</span><b>Yönetici durum</b><span>${s.governing}</span><b>σmax</b><span>${fmt(s.sMax, 2)} daN/mm²</span><b>Kritik açıklık</b><span>${Number.isFinite(s.aCrit) ? fmt(s.aCrit, 1) + ' m' : '∞'}</span></div>
        <table class="t" style="margin-top:8px"><thead><tr><th>Durum</th><th class="n">γ</th><th class="n">σ daN/mm²</th><th class="n">T daN</th></tr></thead><tbody>${s.states.map((x) => html`<tr><td>${x.id} · ${x.label}</td><td class="n">${x.g.toFixed(5)}</td><td class="n">${fmt(x.sigma, 2)}</td><td class="n">${fmt(x.T, 0)}</td></tr>`)}</tbody></table></div>`)}
      <div class="sect">Açıklık · sehim · zemin açıklığı</div>
      <div class="card tight scrollx"><table class="t"><thead><tr><th>Açıklık</th><th class="n">a</th><th class="n">f maks</th><th class="n">f buz</th><th class="n">Zemin</th><th class="n">Gerekli</th><th></th></tr></thead><tbody>${res.spans.map((s) => html`<tr><td class="mono">${s.from}→${s.to}</td><td class="n">${fmt(s.a, 1)}</td><td class="n">${fmt(s.sagMax, 2)}</td><td class="n">${fmt(s.sagIce, 2)}</td><td class="n">${s.groundClear != null ? fmt(s.groundClear, 2) : '—'}</td><td class="n">${fmt(s.groundReq, 1)}</td><td>${s.ok == null ? html`<span class="note">boy?</span>` : s.ok ? html`<${Badge} k="ok">UYGUN</${Badge}>` : html`<${Badge} k="err">UYUMSUZ</${Badge}>`}</td></tr>`)}</tbody></table></div>
      <div class="sect">Direk yükleri (tepe kuvveti)</div>
      <div class="card tight scrollx"><table class="t"><thead><tr><th>Direk</th><th>Rol</th><th class="n">Düşey</th><th class="n">Rüzgar</th><th class="n">Açı</th><th class="n">Boyuna</th><th class="n">Tepe</th><th class="n">Kap.</th></tr></thead><tbody>${res.poles.map((p) => html`<tr><td class="mono">${p.no}</td><td>${p.role}${p.angle ? ' ' + p.angle.toFixed(1) + '°' : ''}</td><td class="n">${fmt(p.V, 0)}</td><td class="n">${fmt(p.Hwind, 0)}</td><td class="n">${fmt(p.Hangle, 0)}</td><td class="n">${fmt(p.Hlong, 0)}</td><td class="n" style=${p.ok === false ? 'color:#ff8a8a' : ''}>${fmt(p.Ftop, 0)}</td><td class="n">${p.cap ? fmt(p.cap, 0) : '—'}</td></tr>`)}</tbody></table></div>
      <div class="note">Kuvvetler daN. Direk kapasitesi tanımsız tiplerde kontrol yapılamaz (katalogda BAHH tepe kuvveti yok).</div>`}`;
}

export function MetrajScreen() {
  useBus(['project:computed']);
  const ps = app.ps;
  const [job, setJob] = useState('montaj');
  const [open, setOpen] = useState(null);
  const qs = ps.result.quantities.filter((q) => q.job === job);
  return html`<${Title} title="Metraj · Yeşil Defter" sub=${ps.cat.std.name} />
    <div class="grid3">${['montaj', 'demontaj', 'dmm'].map((j) => html`<${Chip} on=${job === j} onClick=${() => setJob(j)}>${JOB_LABEL[j]} · ${ps.result.quantities.filter((q) => q.job === j).length}</${Chip}>`)}</div>
    <div class="card tight list">${qs.map((q) => html`<div><button class="li" onClick=${() => setOpen(open === q.id ? null : q.id)}><div class="grow"><div class="m" style=${q.noPoz ? 'color:#fcd34d' : !q.available ? 'color:#fcd34d' : ''}>${q.noPoz ? 'POZ TANIMSIZ · ' + (q.material || '') : q.available || job === 'montaj' ? q.code : q.code + ' · sayfada yok'}</div><div style="font-size:13px;font-weight:600">${q.name}</div><div class="row wrap" style="gap:4px;margin-top:4px">${Object.entries(q.sources).map(([k, v]) => html`<${Badge} k=${k === 'MANUEL' ? 'm' : k === 'REVIZYON' || k === 'TEST' || k === 'SIM' ? 'warn' : k === 'GNSS' ? 'ok' : 'mut'}>${SOURCE_LABEL[k] || k} ${trn(v, q.unit === 'Ad' ? 0 : 2)}</${Badge}>`)}${q.overridden ? html`<${Badge} k="warn">MİKTAR DÜZELTİLDİ</${Badge}>` : null}</div></div><b class="mono">${trn(q.qty, q.unit === 'Ad' ? 0 : q.unit === 'Kg' ? 2 : 3)}</b><span class="note">${q.unit}</span></button>
      ${open === q.id ? html`<div style="padding:0 12px 10px">${q.subs.map((s) => html`<div class="row note mono" style="padding:3px 0">└ ${s.servis} ${s.name} × ${s.qty}</div>`)}${q.refs.slice(0, 50).map((rf) => html`<div class="row note" style="padding:3px 0"><span class="mono">${rf.no}</span><span class="grow">${rf.why || rf.kind}</span><span class="mono">${trn(rf.qty, 3)}</span><span>${rf.done ? '✓' : '·'}</span></div>`)}</div>` : null}</div>`)}${!qs.length ? html`<div class="empty">Bu sayfada kalem yok</div>` : null}</div>
    <div class="note">✓ tamamlanan iş (hakedişe girer) · kaynaklar: GNSS (RTK ölçülü konum), GIS (harita geometrisi), Otomatik metraj (reçete), Manuel, Fotoğraf (kanıtlı), Proje, Revizyon.</div>`;
}

export function HakedisScreen() {
  useBus(['project:computed']);
  const ps = app.ps;
  const [pid, setPid] = useState(null);
  const wp = ps.activeProgram();
  const periods = ps.data.periods.slice().sort((a, b) => a.no - b.no);
  const cur = periods.find((p) => p.id === pid) || periods[periods.length - 1];
  const t = cur ? ps.periodTable(cur.id) : null;
  const [job, setJob] = useState('montaj');
  const newProgram = async () => { if (wp && !(await app.confirm('İş programı', 'Mevcut iş programı pasif yapılıp güncel metrajdan yenisi oluşturulsun mu?'))) return; await ps.createWorkProgram(); app.toast('İş programı oluşturuldu'); };
  const newPeriod = async () => {
    const last = periods[periods.length - 1];
    const start = last ? new Date(new Date(last.end).getTime() + 86400000).toISOString().slice(0, 10) : (ps.p.startDate || new Date().toISOString().slice(0, 10));
    const s = await app.prompt('Yeni hakediş dönemi', 'Başlangıç – bitiş (YYYY-AA-GG YYYY-AA-GG)', { value: start + ' ' + new Date().toISOString().slice(0, 10), required: true });
    if (!s) return;
    const [a, b] = s.split(/\s+/);
    try { const p = await ps.createPeriod({ start: a, end: b || a }); setPid(p.id); } catch (e) { app.toast(e.message, 'err'); }
  };
  const approve = async () => { if (!(await app.confirm('Onay', cur.no + '. dönem onaylanıp dondurulsun mu? Sonraki değişiklikler bir sonraki dönemde REVİZYON olarak görünür.', { ok: 'Onayla' }))) return; try { await ps.approvePeriod(cur.id); app.toast(cur.no + '. hakediş onaylandı'); } catch (e) { app.toast(e.message, 'err', 6000); } };
  const lines = t ? t.lines.filter((l) => l.job === job) : [];
  const cadOnay = (ps.p && ps.p.sebeke && Array.isArray(ps.p.sebeke.onaylar)) ? ps.p.sebeke.onaylar : [];
  return html`<${Title} title="Hakediş" sub=${'Proje → İş programı → Dönem → Poz'} right=${html`<button class="btn sm" onClick=${() => app.nav.go('team')}>Kullanıcılar ve onay</button>`} />
    <div class="card row"><div class="grow"><div class="lbl">İş programı</div><div style="font-size:13px">${wp ? wp.basis + ' · ' + wp.items.length + ' kalem · ' + new Date(wp.createdAt).toLocaleDateString('tr-TR') : 'Oluşturulmadı'}</div></div><button class="btn sm" onClick=${newProgram}>${wp ? 'Yenile' : 'Oluştur'}</button></div>
    <div class="row"><div class="grow"><${Sel} value=${cur && cur.id} options=${periods.map((p) => [p.id, p.no + '. dönem · ' + p.start + ' – ' + p.end + ' · ' + (p.status === 'onayli' ? 'ONAYLI' : 'taslak')])} onChange=${setPid} /></div><button class="btn sm" onClick=${newPeriod}>+ Dönem</button></div>
    ${cadOnay.length ? html`<div class="card"><div class="lbl">AutoCAD hakediş onayları</div>${cadOnay.map((o) => html`<div class="row" style="gap:4px;font-size:13px;margin-top:5px"><b class="grow">${o.no}. hakediş${o.hakedis ? ' · kilitli' : ''}</b><${Badge} k=${o.kontrol ? 'ok' : 'mut'}>Kontrol</${Badge}><${Badge} k=${o.hakedis ? 'ok' : 'mut'}>Hakediş</${Badge}><${Badge} k=${o.gis ? 'ok' : 'mut'}>GIS</${Badge}></div>`)}<div class="note">AutoCAD'de onaylanan hakediş orada kilitlidir: o hakedişe dokunan değişiklikler AutoCAD'e aktarılmaz. Telefonda onaylanan dönem, AutoCAD'e kontrol + hakediş onayı olarak gider.</div></div>` : null}
    ${t && t.period ? html`<div class="grid3"><${Stat} label="Kalem" value=${t.totals.lines} /><${Stat} label="Aşım" value=${t.totals.overrun} color=${t.totals.overrun ? '#ff8a8a' : null} /><${Stat} label="Program dışı" value=${t.totals.outOfProgram} color=${t.totals.outOfProgram ? '#fcd34d' : null} /></div>
      ${t.totals.amount ? html`<div class="card row"><span class="lbl grow">Bu dönem tutar (fiyatı bilinen kalemler)${t.frozen ? ' · onay anındaki fiyatlarla' : ''}</span><b class="mono">${trn(t.totals.amount, 2)} TL</b></div>` : null}
      ${t.legacyPrices ? html`<div class="card note">Bu dönem eski sürümle onaylandı: satır fiyatları onay görüntüsünde yok, güncel iş programından gösteriliyor${t.totals.liveAmount !== t.totals.amount ? ' (güncel fiyatla satır toplamı ' + trn(t.totals.liveAmount, 2) + ' TL)' : ''}. Toplam, onay anında kaydedilen tutardır.</div>` : null}
      <div class="grid3">${['montaj', 'demontaj', 'dmm'].map((j) => html`<${Chip} on=${job === j} onClick=${() => setJob(j)}>${JOB_LABEL[j]}</${Chip}>`)}</div>
      <div class="card tight list">${lines.map((l) => html`<div style="padding:10px 12px"><div class="row"><span class="mono grow" style="font-size:11px;font-weight:700">${l.code}</span>${l.overrun ? html`<${Badge} k="err">AŞIM</${Badge}>` : null}${l.outOfProgram ? html`<${Badge} k="warn">PROGRAM DIŞI</${Badge}>` : null}<span class="note">${l.unit}</span></div><div style="font-size:12px;font-weight:600;margin:2px 0 6px">${l.name}</div>
        <div class="grid5 mono" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;font-size:11px">${[['Söz.', l.contract], ['Önceki', l.previous], ['Bu dön.', l.current, '#6ffbbe'], ['Küm.', l.cumulative], ['Kalan', l.remaining, l.remaining < 0 ? '#ff8a8a' : null]].map(([k, v, c]) => html`<div><div class="lbl" style="font-size:9px">${k}</div><b style=${c ? 'color:' + c : ''}>${trn(v, l.unit === 'Ad' ? 0 : 2)}</b></div>`)}</div>
        <div class="row wrap" style="gap:3px;margin-top:5px">${Object.entries(l.sources).filter(([, v]) => Math.abs(v) > 1e-9).map(([k, v]) => html`<${Badge} k=${k === 'REVIZYON' ? 'warn' : k === 'MANUEL' ? 'm' : k === 'GNSS' ? 'ok' : 'mut'}>${SOURCE_LABEL[k] || k} ${trn(v, 1)}</${Badge}>`)}${l.amount != null ? html`<span class="mono note" style="margin-left:auto">${trn(l.amount, 2)} TL</span>` : null}</div></div>`)}${!lines.length ? html`<div class="empty">Kalem yok</div>` : null}</div>
      ${cur.status !== 'onayli' ? html`<button class="btn pri blk huge" onClick=${approve}>${cur.no}. HAKEDİŞİ ONAYLA</button>` : html`<div class="alert ok">Onaylı · ${new Date(cur.approvedAt).toLocaleString('tr-TR')} · ${cur.approvedBy}</div>`}
      <div class="note">Hakedişe yalnız "iş tamamlandı" işaretli ekipman/hatlar, iş tarihine göre girer. Montaj / Demontaj / DMM ayrı sayfalardır.</div>` : html`<${Empty}>Önce iş programı ve bir hakediş dönemi oluşturun.</${Empty}>`}`;
}

export function ChecksScreen() {
  useBus(['project:computed']);
  const ps = app.ps;
  const [f, setF] = useState('all');
  const all = ps.result.issues;
  const codes = ['UYUMSUZ', 'EKSİK VERİ', 'ÖLÇÜ KABUL EDİLMEDİ', 'MALZEME EKSİK', 'UYARI'];
  const list = f === 'all' ? all : all.filter((i) => i.code === f);
  const open = (i) => {
    if (ps.eqById(i.entityId)) app.nav.go('equipment', { id: i.entityId });
    else if (ps.lineById(i.entityId)) app.nav.go('line', { id: i.entityId });
    else if (ps.pointById(i.entityId)) app.nav.go('point', { id: i.entityId });
  };
  return html`<${Title} title="Kontrol" sub=${all.filter((i) => i.severity === 'error').length + ' hata · ' + all.filter((i) => i.severity === 'warn').length + ' uyarı'} right=${html`<button class="btn sm" onClick=${async () => { await ps.runInspection(); app.toast('Kontrol kaydı oluşturuldu'); }}>Kaydet</button>`} />
    <div class="chips"><${Chip} on=${f === 'all'} onClick=${() => setF('all')}>Tümü ${all.length}</${Chip}>${codes.map((c) => html`<${Chip} on=${f === c} onClick=${() => setF(c)}>${c} ${all.filter((i) => i.code === c).length}</${Chip}>`)}</div>
    <div class="card tight list">${list.slice(0, 300).map((i) => html`<button class="li" onClick=${() => open(i)}><${Badge} k=${CODE_KIND[i.code] || 'mut'}>${i.code}</${Badge}><div class="grow"><div class="t" style="font-size:13px">${i.entityNo || ''}</div><div class="s">${i.message}</div></div><${Icon} n="next" s=${16} c="#94a3b8" /></button>`)}${!list.length ? html`<div class="empty">Bulgu yok</div>` : null}</div>`;
}
