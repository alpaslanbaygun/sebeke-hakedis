// Kayıtlı NTRIP profilleri (v2.4): TUSAGA-Aktif, kendi sabit istasyonunuz vb. adıyla saklanır, tek dokunuşla seçilir.
// Ayar: 'ntripProfiles' = { active, list:[{ id, name, host, port, mount, user, pass, version, sendGGA, ggaSec }] }
const BOS = () => ({ name: 'TUSAGA-Aktif', host: '', port: 2101, mount: '', user: '', pass: '', version: 2, sendGGA: true, ggaSec: 1 });
let seq = 0;
const yeniId = () => 'ntrip-' + Date.now().toString(36) + '-' + (seq++).toString(36);

// Kayıtlı ayardan (ya da eski tek profilli 'ntrip' ayarından) profil listesi
export function loadProfiles(saved, legacy) {
  if (saved && Array.isArray(saved.list) && saved.list.length) {
    const list = saved.list.map((p) => Object.assign(BOS(), p, { id: p.id || yeniId() }));
    return { active: list.some((p) => p.id === saved.active) ? saved.active : list[0].id, list };
  }
  const p = Object.assign(BOS(), legacy || {}, { id: yeniId() });
  return { active: p.id, list: [p] };
}
export const activeProfile = (st) => st.list.find((p) => p.id === st.active) || st.list[0];
export function updateActive(st, patch) { return { active: st.active, list: st.list.map((p) => (p.id === st.active ? Object.assign({}, p, patch) : p)) }; }
export function selectProfile(st, id) { return st.list.some((p) => p.id === id) ? { active: id, list: st.list } : st; }
export function addProfile(st, name) {
  const n = String(name || '').trim();
  if (!n) throw new Error('Profil adı gerekli');
  if (st.list.some((p) => p.name.toLocaleLowerCase('tr-TR') === n.toLocaleLowerCase('tr-TR'))) throw new Error('Bu adla profil var');
  const p = Object.assign(BOS(), { id: yeniId(), name: n });
  return { active: p.id, list: [...st.list, p] };
}
export function removeProfile(st, id) {
  if (st.list.length < 2) throw new Error('En az bir profil kalmalı');
  const list = st.list.filter((p) => p.id !== id);
  return { active: st.active === id ? list[0].id : st.active, list };
}
