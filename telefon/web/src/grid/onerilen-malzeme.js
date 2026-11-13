// Önerilen malzeme (otomatik reçete) kurallarının ortak dosyası: ortak/katalog/onerilen-malzeme.json.
// Türkçe anahtarlı ortak kural → motorun (recipe.js) kural biçimi. Tohumu üreten tools/build_seed.mjs ve ortak deneme
// (araclar/onerilen-beklenen-uret.mjs, tests/onerilen-malzeme.test.mjs) aynı çeviriyi kullanır; AutoCAD eklentisi ortak
// dosyayı doğrudan okur (Cekirdek/OnerilenMalzeme.cs). Kural anlamı ortak dosyanın "aciklama" alanında.
const KOSUL = { grup: 'group', rol: 'role', iletkenBuyuk: 'clsBig', iletkenCift: 'clsDbl', agCiplak: 'agCiplak', tip: 'type', tesis: 'install', faz: 'phase' };
const NESNE = { direk: 'pole', trafo: 'trafo', sdk: 'sdk', abone: 'abone' };
const KAYNAK = { kendisi: 'self', 'kendisi:direk': 'self:pole', 'kendisi:kosk': 'self:kiosk', 'ara:trafo': 'lookup:trafo', 'ara:panoH': 'lookup:panoH', 'ara:panoD': 'lookup:panoD' };
const ROLN = { T: 'Taşıyıcı', D: 'Durdurucu', N: 'Nihayet', Z: 'Köşe' };

/** Ortak dosya → { rules, params } (standart tohumundaki recipeRules / params biçimi; std: standart kimliği). */
export function kurallariCevir(oneri, std = 'TEDAS-2026-GR02') {
  const rules = (oneri.kurallar || []).map((k) => {
    const when = {};
    for (const [a, v] of Object.entries(k.kosul || {})) { if (!KOSUL[a]) throw new Error('onerilen-malzeme.json: bilinmeyen koşul ' + a); when[KOSUL[a]] = v; }
    const items = (k.kalemler || []).map((it) => {
      const o = {};
      if (it.servis) o.servis = it.servis;
      if (it.kaynak) { if (!KAYNAK[it.kaynak]) throw new Error('onerilen-malzeme.json: bilinmeyen kaynak ' + it.kaynak); o.src = KAYNAK[it.kaynak]; }
      o.qty = it.miktar === '$uzunluk' ? '$length' : it.miktar;
      o.why = it.neden || '';
      if (it.grup) o.grp = it.grup;
      o.tag = it.etiket || '';
      return o;
    });
    if (!NESNE[k.nesne]) throw new Error('onerilen-malzeme.json: bilinmeyen nesne ' + k.nesne);
    return { id: std + ':R' + String(k.no).padStart(3, '0'), stdId: std, eq: NESNE[k.nesne], when, items, note: k.not || '' };
  });
  const params = (oneri.parametreler || []).map((p) => ({ id: std + ':P:' + p.anahtar, stdId: std, key: p.anahtar, label: p.ad, value: p.deger, unit: p.birim }));
  return { rules, params };
}

/** Deneme kataloğu: yalnız kural ve parametre (poz tablosu yok); applyRules'un kullandığı üç işlev. */
export function denemeKatalogu(rules, params) {
  const pm = new Map(params.map((p) => [p.key, p]));
  return {
    rules: (eq) => rules.filter((r) => r.eq === eq),
    param: (key, overrides) => (overrides && overrides[key] !== undefined ? overrides[key] : (pm.get(key) || { value: 0 }).value),
    poz: () => null
  };
}

/** Ortak denemenin direk bağlamı (durumlar.json › baglam) → recipeContext'in ürettiği bağlam. */
export function direkBaglami(b) {
  const role = b.rol || 'T';
  return { eq: 'pole', group: b.grup || '', kgGroup: '', tip: b.tip || '', self: null, kg: 0, selfName: '', role, rol: ROLN[role] || role, cls: '', clsBig: !!b.iletkenBuyuk, clsDbl: !!b.iletkenCift, agCiplak: !!b.agCiplak };
}
