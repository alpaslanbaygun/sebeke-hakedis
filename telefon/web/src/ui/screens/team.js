// Kullanıcılar, roller ve hakediş onayı (v2.3)
// Ortak parçalar: HakRow (durum düğmeleri, yetkiye göre), HakHistory (onay geçmişi), loginDialog, TeamScreen
import { html, useState, useBus, Icon, Sel, Seg, Toggle, Badge, Title, fmt } from '../kit.js';
import { app } from '../ctx.js';
import { HAK_STATUSES, HAK_ORDER, EQUIPMENT_KINDS, hakOf } from '../../core/schema.js';
import { ROLES, ROLE_ORDER, PENDING, REJECT_TO, validPin, actionRoles } from '../../core/roles.js';

const pinInput = (ph, onInput, auto) => html`<input class="inp mono" type="password" inputmode="numeric" autocomplete="off" maxlength="8" autofocus=${!!auto} placeholder=${ph} style="letter-spacing:6px;font-size:20px;text-align:center" onInput=${(e) => { e.target.value = e.target.value.replace(/\D/g, ''); onInput(e.target.value); }} />`;

// Oturum aç: kullanıcı seç → şifre
export async function loginDialog(preId) {
  const ps = app.ps;
  const list = ps.approval().members.filter((m) => m.active !== false);
  if (!list.length) return null;
  function Form({ close }) {
    const [id, setId] = useState(preId || (list.length === 1 ? list[0].id : null));
    const [pin, setPin] = useState('');
    const [err, setErr] = useState(null);
    const go = () => { try { close(ps.login(id, pin)); } catch (e) { setErr(e.message); } };
    return html`<div class="mh"><h3>Oturum aç</h3></div><div class="mb">
      <div class="lbl">Kullanıcı</div>
      <div class="card tight list" style="max-height:220px;overflow:auto">${list.map((m) => html`<button class="li" style=${id === m.id ? 'box-shadow:inset 3px 0 0 #10b981;background:#0f2a22' : ''} onClick=${() => { setId(m.id); setErr(null); }}><div class="grow"><div class="t" style="font-size:14px">${m.name}</div><div class="s" style=${'color:' + ROLES[m.role].color}>${ROLES[m.role].label}</div></div>${id === m.id ? html`<${Icon} n="check" s=${16} c="#10b981" w=${3} />` : null}</button>`)}</div>
      ${id ? html`<div class="fld"><label>Şifre (rakam)</label>${pinInput('••••', (v) => { setPin(v); setErr(null); }, true)}</div>` : null}
      ${err ? html`<div class="alert err" style="font-size:13px">${err}</div>` : null}
    </div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" disabled=${!id || pin.length < 4} onClick=${go}>Giriş</button></div>`;
  }
  const m = await app.modal((close) => html`<${Form} close=${close} />`);
  if (m) app.toast(m.name + ' · ' + ROLES[m.role].label, 'ok');
  return m;
}

// Durum değiştir: gerekirse oturum ve gerekçe ister. true dönerse değişti.
export async function changeHak(type, rec, to) {
  const ps = app.ps;
  const from = hakOf(rec);
  if (!from || from === to) return false;
  let ck = ps.canHak(from, to);
  if (!ck.ok && ps.approval().on && !ps.member) { if (!(await loginDialog())) return false; ck = ps.canHak(from, to); }
  if (!ck.ok) { app.toast(ck.why, 'err', 6000); return false; }
  let reason = null;
  if (ck.needReason) { reason = await app.prompt('Geri alma / ret', 'Gerekçe', { required: true, ok: 'Geri al', note: (rec.no || rec.lineNo) + ' · ' + HAK_STATUSES[from].label + ' → ' + HAK_STATUSES[to].label }); if (!reason) return false; }
  try { await ps.setHak(type, rec.id, to, reason); app.toast((rec.no || rec.lineNo) + ' · ' + HAK_STATUSES[to].label, 'ok'); return true; } catch (e) { app.toast(e.message, 'err', 6000); return false; }
}

// Hakediş durumu düğmeleri. Onay mekanizması açıksa yetki dışı adımlar soluk görünür.
export function HakRow({ type, rec, onDone, noLabel }) {
  useBus(['auth:change']);
  const ps = app.ps;
  const cur = hakOf(rec);
  if (!cur) return html`<div class="note">Hakediş: — (mevcut / ileride durumundaki objenin iş kalemi yok)</div>`;
  const ap = ps.approval();
  const me = ap.member;
  const setH = async (k) => { if (await changeHak(type, rec, k)) onDone && onDone(type === 'line' ? ps.lineById(rec.id) : ps.eqById(rec.id)); };
  return html`<div>${noLabel ? null : html`<div class="lbl" style="margin-bottom:4px">Hakediş durumu · <span style=${'color:' + HAK_STATUSES[cur].color}>${HAK_STATUSES[cur].label}</span></div>`}
    <div class="hakrow">${HAK_ORDER.map((k) => { const ok = k === cur || !ap.on || (me && ps.canHak(cur, k).ok); return html`<button class=${k === cur ? 'on' : ''} style=${'--c:' + HAK_STATUSES[k].color + (ok ? '' : ';opacity:.38')} aria-label=${HAK_STATUSES[k].label} onClick=${() => setH(k)}><i></i>${HAK_STATUSES[k].short}</button>`; })}</div>
    ${ap.on ? html`<div class="note" style="margin-top:4px">${me ? html`<span style=${'color:' + ROLES[me.role].color}>${me.name} · ${ROLES[me.role].label}</span> · soluk adımlar bu rolün yetkisinde değil` : html`Durumu değiştirmek için <button class="btn xs" onClick=${() => loginDialog()}>oturum açın</button>`}</div>` : null}</div>`;
}
export function HakHistory({ rec, max = 4 }) {
  const log = (rec.hakLog || []).slice().reverse();
  if (!log.length) return null;
  return html`<div class="stack" style="gap:3px"><div class="lbl">Onay geçmişi</div>${log.slice(0, max).map((x) => html`<div class="note" style="font-size:12px"><span class="mono">${new Date(x.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> · <b>${x.by}</b>${x.role ? ' (' + ROLES[x.role].label + ')' : ''} · ${HAK_STATUSES[x.from] ? HAK_STATUSES[x.from].short : '—'} → <span style=${'color:' + (HAK_STATUSES[x.to] || {}).color}>${HAK_STATUSES[x.to] ? HAK_STATUSES[x.to].short : x.to}</span>${x.note ? ' · ' + x.note : ''}</div>`)}${log.length > max ? html`<div class="note" style="font-size:11px">+${log.length - max} eski kayıt (Denetim kaydında)</div>` : null}</div>`;
}
// Üst bilgi rozeti: oturum durumu (proje ana ekranı)
export function AuthChip() {
  useBus(['auth:change']);
  const ap = app.ps.approval();
  if (!ap.on) return null;
  const me = ap.member;
  return html`<button class="btn sm" style=${me ? 'border-color:' + ROLES[me.role].color + ';color:' + ROLES[me.role].color : ''} onClick=${() => app.nav.go('team')}>${me ? me.name + ' · ' + ROLES[me.role].short : 'Oturum aç'}</button>`;
}

// ---------------- Onay bekleyenler ----------------
function PendingCard({ role }) {
  const ps = app.ps;
  const [from, to] = PENDING[role];
  const rows = ps.pending(from);
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const picked = rows.filter((r) => sel.has(r.id));
  const tog = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = async (status, needReason) => {
    const items = picked.length ? picked : rows;
    let reason = null;
    if (needReason) { reason = await app.prompt('Geri çevir', 'Gerekçe (kayıtlara yazılır)', { required: true, ok: 'Geri çevir', note: items.length + ' obje "' + HAK_STATUSES[status].label + '" durumuna dönecek' }); if (!reason) return; }
    else if (!(await app.confirm('Onay', items.length + ' obje "' + HAK_STATUSES[status].label + '" yapılsın mı?', { ok: 'Onayla' }))) return;
    setBusy(true);
    try { const r = await ps.setHakMany(items, status, reason); app.toast(r.changed + ' obje · ' + HAK_STATUSES[status].label + (r.errors.length ? ' · ' + r.errors.length + ' atlandı' : ''), r.errors.length ? 'warn' : 'ok'); setSel(new Set()); } catch (e) { app.toast(e.message, 'err', 6000); }
    setBusy(false);
  };
  const sub = (r) => r.type === 'line' ? r.rec.lineType + ' hat' : (EQUIPMENT_KINDS[r.rec.kind] || {}).label || r.rec.kind;
  const show = (r) => { app.state.sel = r.type === 'line' ? { type: 'line', id: r.id, seg: 0 } : { type: 'point', id: r.rec.pointId }; app.state.follow = false; const p = ps.pointById(r.type === 'line' ? r.rec.nodes[0] : r.rec.pointId); if (p && p.E != null) app.state.view = { cE: p.E, cN: p.N, res: Math.min((app.state.view || {}).res || 0.3, 0.3) }; app.nav.tab('map'); };
  const back = REJECT_TO[role] || (role === 'hakedis' ? null : null);
  return html`<div class="card stack"><div class="row"><b class="grow">Onayınızı bekleyenler</b><${Badge} k=${rows.length ? 'warn' : 'ok'}>${rows.length}</${Badge}></div>
    <div class="note">Durumu "${HAK_STATUSES[from].label}" olan objeler. Onaylayınca "${HAK_STATUSES[to].label}" olur.</div>
    ${rows.length ? html`<div class="row" style="gap:6px"><button class="btn xs" onClick=${() => setSel(new Set(rows.map((r) => r.id)))}>Tümünü seç</button><button class="btn xs" onClick=${() => setSel(new Set())}>Seçimi kaldır</button><span class="grow"></span><span class="note">${picked.length ? picked.length + ' seçili' : 'seçim yok = tümü'}</span></div>
      <div class="card tight list" style="max-height:300px;overflow:auto">${rows.slice(0, 400).map((r) => html`<div class="li" style="min-height:44px;padding:6px 10px">
        <button style="background:none;border:0;color:inherit;display:flex;gap:10px;align-items:center;text-align:left;padding:0" class="grow" onClick=${() => tog(r.id)}><span style=${'width:20px;height:20px;border-radius:5px;border:2px solid ' + (sel.has(r.id) ? '#10b981' : '#475569') + ';background:' + (sel.has(r.id) ? '#10b981' : 'transparent') + ';display:grid;place-items:center;flex:none'}>${sel.has(r.id) ? html`<${Icon} n="check" s=${13} c="#0b1326" w=${3} />` : null}</span><span><b style="font-size:14px">${r.no}</b> <span class="note">${sub(r)}${r.rec.workDate ? ' · ' + r.rec.workDate : ''}</span></span></button>
        <button class="btn xs" aria-label="Haritada göster" onClick=${() => show(r)}><${Icon} n="pin" s=${15} /></button></div>`)}</div>
      <div class="grid2"><button class="btn pri" disabled=${busy} onClick=${() => run(to, false)}><${Icon} n="check" s=${18} c="#0b1326" w=${3} />${picked.length ? 'Seçilenleri onayla' : 'Tümünü onayla'}</button>
        ${back ? html`<button class="btn dang" disabled=${busy} onClick=${() => run(back, true)}>Geri çevir</button>` : html`<span></span>`}</div>` : html`<div class="alert ok">Bekleyen iş yok.</div>`}</div>`;
}

// ---------------- Kullanıcılar ve onay ekranı ----------------
export function TeamScreen() {
  useBus(['auth:change', 'project:computed']);
  const ps = app.ps;
  const ap = ps.approval();
  const me = ap.member;
  const admin = me && me.role === 'yonetici';
  const [, force] = useState(0);
  const counts = ps.hakCounts();

  const memberForm = async (m0) => {
    const first = !ap.on;
    const d = { name: m0 ? m0.name : '', role: m0 ? m0.role : first ? 'yonetici' : 'saha', pin: '', pin2: '' };
    function Form({ close }) {
      const [, f] = useState(0);
      const [err, setErr] = useState(null);
      const ok = () => {
        if (!d.name.trim()) return setErr('Ad gerekli');
        if (!m0 || d.pin) { if (!validPin(d.pin)) return setErr('Şifre 4–8 rakam olmalı'); if (d.pin !== d.pin2) return setErr('Şifreler aynı değil'); }
        close(d);
      };
      return html`<div class="mh"><h3>${m0 ? 'Kullanıcıyı düzenle' : first ? 'İlk yöneticiyi tanımla' : 'Kullanıcı ekle'}</h3></div><div class="mb">
        ${first ? html`<div class="note">İlk kullanıcı Yönetici olur ve onay mekanizması bu projede açılır. Şifreyi unutmayın: başka yönetici yoksa şifre geri alınamaz.</div>` : null}
        <div class="fld"><label>Ad soyad</label><input class="inp" value=${d.name} onInput=${(e) => { d.name = e.target.value; }} /></div>
        <div class="fld"><label>Rol</label>${first ? html`<div class="inp" style="display:flex;align-items:center">Yönetici</div>` : html`<${Sel} value=${d.role} options=${ROLE_ORDER.map((r) => [r, ROLES[r].label])} onChange=${(v) => { d.role = v; f((x) => x + 1); }} />`}<span class="note">${ROLES[d.role].does}</span></div>
        <div class="grid2"><div class="fld"><label>${m0 ? 'Yeni şifre (boş = aynı)' : 'Şifre (4–8 rakam)'}</label>${pinInput('••••', (v) => { d.pin = v; })}</div><div class="fld"><label>Şifre tekrar</label>${pinInput('••••', (v) => { d.pin2 = v; })}</div></div>
        ${err ? html`<div class="alert err" style="font-size:13px">${err}</div>` : null}
      </div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" onClick=${ok}>Kaydet</button></div>`;
    }
    const r = await app.modal((close) => html`<${Form} close=${close} />`);
    if (!r) return;
    try {
      if (m0) { const patch = { name: r.name, role: r.role }; if (r.pin) patch.pin = r.pin; await ps.updateMember(m0.id, patch); app.toast(r.name + ' güncellendi', 'ok'); }
      else { await ps.addMember({ name: r.name, role: r.role, pin: r.pin }); app.toast(r.name + ' eklendi · ' + ROLES[r.role].label, 'ok'); }
    } catch (e) { app.toast(e.message, 'err', 6000); }
    force((x) => x + 1);
  };
  const myPin = async () => {
    const d = { pin: '', pin2: '' };
    const r = await app.modal((close) => html`<div class="mh"><h3>Şifremi değiştir</h3></div><div class="mb"><div class="grid2"><div class="fld"><label>Yeni şifre</label>${pinInput('••••', (v) => { d.pin = v; }, true)}</div><div class="fld"><label>Tekrar</label>${pinInput('••••', (v) => { d.pin2 = v; })}</div></div></div><div class="mf"><button class="btn grow" onClick=${() => close(null)}>Vazgeç</button><button class="btn pri grow" onClick=${() => close(d)}>Kaydet</button></div>`);
    if (!r) return;
    if (!validPin(r.pin) || r.pin !== r.pin2) return app.toast('Şifre 4–8 rakam olmalı ve iki alan aynı olmalı', 'warn');
    try { await ps.updateMember(me.id, { pin: r.pin }); app.toast('Şifre değişti', 'ok'); } catch (e) { app.toast(e.message, 'err'); }
  };
  const setActive = async (m, on) => { if (!on && !(await app.confirm('Kullanıcıyı kapat', m.name + ' artık oturum açamayacak. Geçmiş kayıtları saklanır.', { danger: true, ok: 'Kapat' }))) return; try { await ps.updateMember(m.id, { active: on }); } catch (e) { app.toast(e.message, 'err', 6000); } force((x) => x + 1); };
  const closeAll = async () => { const why = await app.prompt('Onay mekanizmasını kapat', 'Gerekçe', { required: true, note: 'Tüm kullanıcılar kapatılır; herkes hakediş durumunu yeniden serbestçe değiştirebilir. Geçmiş kayıtlar saklanır.' }); if (!why) return; try { await ps.closeApproval(why); app.toast('Onay mekanizması kapatıldı'); } catch (e) { app.toast(e.message, 'err'); } };
  const setOpt = async (p) => { try { await ps.setApproval(p); } catch (e) { app.toast(e.message, 'err'); } force((x) => x + 1); };
  // Hakediş yetkisi: AutoCAD hakediş numaraları (1…12 ve kullanılan büyükler); kapalı olana yazılamaz
  const kapali = new Set(ap.closed);
  const hakSon = Math.max(12, ap.activeHakedis, ...ap.closed);
  const togHak = async (n) => { const k = new Set(kapali); if (k.has(n)) k.delete(n); else k.add(n); try { await ps.setClosedHakedis([...k]); app.toast(n + '. hakediş ' + (k.has(n) ? 'yazmaya kapatıldı' : 'yazmaya açıldı'), 'ok'); } catch (e) { app.toast(e.message, 'err', 6000); } force((x) => x + 1); };
  const yetki = html`<div class="sect">Hakediş yetkisi</div><div class="card stack" style="gap:8px">
    <div class="note">Yazmaya kapalı hakedişteki obje değiştirilemez, o hakedişe yeni obje eklenemez (Yönetici hariç). AutoCAD eklentisinde de aynıdır; ayar proje dosyasıyla taşınır. Aktif hakediş: <b>${ap.activeHakedis}.</b></div>
    <div class="row wrap" style="gap:6px">${Array.from({ length: hakSon }, (_, i) => i + 1).map((n) => html`<button class=${'btn xs' + (kapali.has(n) ? ' dang' : '')} disabled=${!admin} aria-pressed=${kapali.has(n)} aria-label=${n + '. hakediş ' + (kapali.has(n) ? 'yazmaya kapalı' : 'açık')} onClick=${() => togHak(n)} style="min-width:46px">${kapali.has(n) ? html`<${Icon} n="lock" s=${12} /> ` : null}${n}</button>`)}</div>
    <div class="note">${kapali.size ? 'Yazmaya kapalı: ' + [...kapali].sort((a, b) => a - b).map((n) => n + '.').join(', ') + ' hakediş' : 'Bütün hakedişler yazmaya açık.'}${admin ? ' Değiştirmek için numaraya dokunun.' : ' Yalnız Yönetici değiştirebilir.'}</div></div>`;

  const flow = html`<div class="card stack" style="gap:8px"><div class="lbl">Onay akışı · kim hangi adımı atar</div>
    ${[['saha', ['YAPILACAK', 'BASLANDI', 'TAMAMLANDI']], ['kontrol', ['TAMAMLANDI', 'KONTROL']], ['hakedis', ['KONTROL', 'HAKEDISTE']], ['onay', ['HAKEDISTE', 'ONAYLI']]].map(([r, st]) => html`<div class="row" style="gap:8px;align-items:flex-start"><span style=${'flex:0 0 118px;font-weight:800;font-size:12.5px;color:' + ROLES[r].color}>${ROLES[r].label}</span><span class="grow" style="font-size:12.5px">${st.map((k, i) => html`${i ? ' → ' : ''}<span style=${'color:' + HAK_STATUSES[k].color}>${HAK_STATUSES[k].label}</span>`)}<div class="note">${ROLES[r].does}</div></span></div>`)}
    <div class="row" style="gap:8px;align-items:flex-start"><span style=${'flex:0 0 118px;font-weight:800;font-size:12.5px;color:' + ROLES.yonetici.color}>Yönetici</span><span class="grow note">${ROLES.yonetici.does}</span></div>
    <div class="row" style="gap:8px;align-items:flex-start"><span style="flex:0 0 118px;font-weight:800;font-size:12.5px">AutoCAD onayı</span><span class="grow note">Aynı kullanıcılar AutoCAD eklentisinde de geçerlidir: hakedişin Kontrol onayını ${actionRoles('autocad.kontrol').map((r) => ROLES[r].label).join(' ya da ')}, Hakediş onayını ${actionRoles('autocad.hakedis').map((r) => ROLES[r].label).join(' ya da ')}, GIS onayını ${actionRoles('autocad.gis').map((r) => ROLES[r].label).join(' ya da ')} verir.</span></div>
    <div class="note">Geri çevirme (ret) her zaman gerekçe ister; kim, ne zaman, hangi adımı attı objenin "Onay geçmişi"nde ve Denetim kaydında görünür.</div></div>`;

  if (!ap.on) {
    const old = ap.members.length;
    return html`<${Title} title="Kullanıcılar ve onay" sub="Hakediş onay mekanizması · kapalı" />
      <div class="alert info"><${Icon} n="info" s=${16} /><span>Bu projede onay mekanizması kapalı: hakediş durumunu herkes değiştirebilir (önceki sürümlerdeki gibi). Açmak için ilk Yöneticiyi tanımlayın.</span></div>
      <button class="btn pri blk" style="height:54px" onClick=${() => memberForm(null)}><${Icon} n="plus" s=${18} c="#0b1326" />İlk yöneticiyi tanımla · onayı aç</button>
      ${old ? html`<div class="note">${old} eski kullanıcı kaydı saklanıyor (kapalı).</div>` : null}
      ${flow}`;
  }
  const act = ap.members.filter((m) => m.active !== false), off = ap.members.filter((m) => m.active === false);
  return html`<${Title} title="Kullanıcılar ve onay" sub=${'Hakediş onay mekanizması · açık · ' + act.length + ' kullanıcı'} />
    <div class="card stack"><div class="row"><div class="grow"><div class="lbl">Oturum</div>${me ? html`<b style="font-size:16px">${me.name}</b><div style=${'font-size:13px;color:' + ROLES[me.role].color}>${ROLES[me.role].label}</div>` : html`<b style="font-size:15px">Oturum açık değil</b><div class="note">Hakediş durumunu değiştirmek için oturum açın.</div>`}</div>
      ${me ? html`<div class="stack" style="gap:6px"><button class="btn sm" onClick=${() => { ps.logout(); app.toast('Oturum kapatıldı'); }}>Oturumu kapat</button><button class="btn xs" onClick=${myPin}>Şifremi değiştir</button></div>` : html`<button class="btn pri" onClick=${() => loginDialog()}>Oturum aç</button>`}</div></div>
    ${me && PENDING[me.role] ? html`<${PendingCard} key=${me.id} role=${me.role} />` : null}
    ${admin ? html`${['kontrol', 'hakedis', 'onay'].map((r) => { const n = counts[PENDING[r][0]] || 0; return n ? html`<div class="row card" style="padding:10px 12px"><span class="grow" style="font-size:13px"><b style=${'color:' + ROLES[r].color}>${ROLES[r].label}</b> onayı bekleyen</span><${Badge} k="warn">${n}</${Badge}></div>` : null; })}` : null}
    <div class="sect">Kullanıcılar ${admin ? html`<span class="r"><button class="btn xs pri" onClick=${() => memberForm(null)}>+ Kullanıcı ekle</button></span>` : null}</div>
    <div class="card tight list">${act.map((m) => html`<div class="li"><div class="grow"><div class="t" style="font-size:14px">${m.name}${me && me.id === m.id ? html` <span class="note">(siz)</span>` : null}</div><div class="s" style=${'color:' + ROLES[m.role].color}>${ROLES[m.role].label}</div></div>
      ${admin ? html`<button class="btn xs" onClick=${() => memberForm(m)}>Düzenle</button>${me.id !== m.id ? html`<button class="btn xs dang" onClick=${() => setActive(m, false)}>Kapat</button>` : null}` : !me ? html`<button class="btn xs" onClick=${() => loginDialog(m.id)}>Giriş</button>` : null}</div>`)}</div>
    ${off.length && admin ? html`<div class="note">Kapalı kullanıcılar: ${off.map((m) => html`<button class="btn xs" style="margin:2px" onClick=${() => setActive(m, true)}>${m.name} · aç</button>`)}</div>` : null}
    ${!admin ? html`<div class="note">Kullanıcı eklemek ve rol vermek için Yönetici oturumu gerekir.</div>` : null}
    ${admin ? html`<div class="sect">Kurallar</div><div class="card stack">
      <div class="row"><div class="grow"><b style="font-size:14px">Hakedişe yalnız kontrol edilmiş işler girsin</b><div class="note">Açıkken "Tamamlandı" durumundaki iş, Kontrol mühendisi onaylayana kadar metraj ve hakediş toplamına girmez.</div></div><${Toggle} on=${ap.strict} onChange=${(v) => setOpt({ strict: v })} label="Yalnız kontrol edilmiş" /></div>
      <div class="row"><div class="grow"><b style="font-size:14px">Kontrol edilmiş kaydı kilitle</b><div class="note">Açıkken "Kontrol Edildi" ve sonrası durumdaki objenin tipi, malzemesi, hattı değiştirilemez; önce geri çevrilmesi gerekir (Yönetici hariç).</div></div><${Toggle} on=${ap.lock} onChange=${(v) => setOpt({ lock: v })} label="Kilitle" /></div></div>` : null}
    ${yetki}
    ${flow}
    ${admin ? html`<button class="btn dang blk" onClick=${closeAll}>Onay mekanizmasını kapat</button>` : null}`;
}
