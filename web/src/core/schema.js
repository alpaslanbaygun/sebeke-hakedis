// Merkezi proje veri modeli — tek kaynak.
// Her proje kaydı ortak alanları taşır (BASE); tablo tanımları IndexedDB şemasını ve
// kayıt öncesi zorunlu alan kontrollerini besler.

export const DB_NAME = 'volt-edas-saha';
export const DB_VERSION = 3;

// Tüm proje kayıtlarında bulunan ortak alanlar
export const BASE_FIELDS = {
  id: 'Benzersiz kimlik (ULID)',
  projectId: 'Proje kimliği',
  createdAt: 'Oluşturma zamanı (ISO)',
  updatedAt: 'Son değişiklik zamanı (ISO)',
  createdBy: 'Oluşturan kullanıcı',
  updatedBy: 'Son değiştiren kullanıcı',
  coord: 'Koordinat {E,N,H,h,lat,lon,crs} (konumlu kayıtlarda)',
  source: 'Veri kaynağı (dahili): GNSS_RTK · PHONE · MANUAL · EXCEL · MAP · DESIGN · SIM → core/source.js ile GNSS_RTK | GNSS_FLOAT | TELEFON_GPS | MANUEL | EXCEL | HARITADAN_SECILDI',
  status: 'Kayıt durumu: active · deleted',
  rev: 'Kayıt revizyon numarası (her değişiklikte +1)',
  accuracy: 'Doğruluk bilgisi {fix, sigmaH, sigmaV, class}'
};

// Proje kapsamlı tablolar (projectId indeksli)
export const PROJECT_STORES = {
  surveySessions: { entity: 'SurveySession', label: 'Ölçüm oturumu' },
  gnssReceivers: { entity: 'GNSSReceiver', label: 'GNSS alıcı', global: true },
  gnssObservations: { entity: 'GNSSObservation', label: 'GNSS ölçümü' },
  points: { entity: 'Point', label: 'Nokta', indexes: ['pointNo'] },
  lines: { entity: 'Line', label: 'Hat' },
  spans: { entity: 'Span', label: 'Açıklık', derived: true, indexes: ['lineId'] },
  equipment: { entity: 'Equipment (Pole · Transformer · SDK · LightingPole · Kiosk · Substation · Manhole)', label: 'Ekipman', indexes: ['kind', 'pointId'] },
  cables: { entity: 'Cable (yeraltı kablo / kanal)', label: 'Yeraltı kablo', indexes: ['lineId'] },
  crossings: { entity: 'Crossing (v2.2: kaldırıldı · yalnız eski kayıtların arşivi)', label: 'Geçiş (arşiv)' },
  materials: { entity: 'Material (ekipman malzeme satırı)', label: 'Malzeme', indexes: ['ownerId'] },
  quantities: { entity: 'Quantity', label: 'Metraj', derived: true },
  workPrograms: { entity: 'WorkProgram', label: 'İş programı' },
  periods: { entity: 'ProgressPayment (hakediş dönemi)', label: 'Hakediş dönemi' },
  photos: { entity: 'Photo', label: 'Fotoğraf', indexes: ['ownerId'] },
  documents: { entity: 'Document', label: 'Doküman' },
  inspections: { entity: 'Inspection', label: 'Kontrol' },
  stakeouts: { entity: 'Aplikasyon', label: 'Aplikasyon' },
  revisions: { entity: 'Revision', label: 'Revizyon' },
  audit: { entity: 'AuditLog', label: 'Denetim kaydı', indexes: ['entityId'] },
  exportJobs: { entity: 'ExportJob', label: 'Dışa aktarım işi' },
  rawLogs: { entity: 'Ham GNSS günlüğü (NMEA)', label: 'Ham GNSS', indexes: ['sessionId'] }
};

// Standart (katalog) tabloları: stdId indeksli, sürümlü
export const STD_STORES = {
  standards: { entity: 'StandardVersion', label: 'Standart sürümü', noStd: true },
  poz: { entity: 'Poz (Yeşil Defter)', label: 'Poz', indexes: ['servis'] },
  poleGroups: { entity: 'Direk grubu', label: 'Direk grubu' },
  poleTypes: { entity: 'Direk tipi', label: 'Direk tipi', indexes: ['group'] },
  conductors: { entity: 'Conductor', label: 'İletken / kablo' },
  lineTypes: { entity: 'Hat tipi (iletken kombinasyonu)', label: 'Hat tipi' },
  transformers: { entity: 'Trafo kataloğu', label: 'Trafo' },
  panels: { entity: 'Pano kataloğu', label: 'Pano' },
  kiosks: { entity: 'Köşk kataloğu', label: 'Köşk' },
  trafoPostTypes: { entity: 'Trafo postası tipi', label: 'Trafo postası' },
  sdkTypes: { entity: 'SDK tipi', label: 'SDK tipi' },
  recipeRules: { entity: 'MaterialRecipe (kural)', label: 'Reçete kuralı' },
  params: { entity: 'Reçete parametresi', label: 'Parametre' },
  stdTables: { entity: 'Standart tabloları (ENH, açıklık, lejant, eşik)', label: 'Standart tablosu' }
};

// Genel tablolar
export const GLOBAL_STORES = {
  projects: { entity: 'Project', label: 'Proje' },
  users: { entity: 'User', label: 'Kullanıcı' },
  settings: { entity: 'Ayar', label: 'Ayar' },
  outbox: { entity: 'Senkron kuyruğu', label: 'Senkron kuyruğu' },
  syncState: { entity: 'Senkron durumu', label: 'Senkron' },
  blobs: { entity: 'İkili veri (fotoğraf)', label: 'Blob' },
  tiles: { entity: 'Offline harita karosu', label: 'Karo' }
};

export const ALL_STORES = Object.assign({}, GLOBAL_STORES, PROJECT_STORES, STD_STORES);

// Varlık türüne göre alan sözlüğü (plan dokümanı ve form doğrulaması için)
export const ENTITY_FIELDS = {
  Project: ['name', 'code', 'client', 'contractor', 'stdId (değiştirilemez)', 'crs {datum, projection, zone, cm, epsg}', 'heightSystem (elipsoidal/ortometrik)', 'geoid {model, N}', 'enhZone', 'status', 'startDate', 'endDate'],
  SurveySession: ['receiverId', 'operator', 'startedAt', 'endedAt', 'antennaHeight', 'antennaMeasure (dikey/eğik)', 'ntrip {host, port, mount, format}', 'crs', 'rawLogCount'],
  GNSSReceiver: ['name', 'model', 'serial', 'firmware', 'antennaType', 'antennaRadius', 'phaseCenterOffset', 'link {type: spp|ble, address}'],
  GNSSObservation: ['pointId', 'sessionId', 'lat', 'lon', 'h (elipsoidal)', 'H (ortometrik)', 'E', 'N', 'datum', 'crs', 'zone', 'geoid', 'antennaHeight', 'receiver', 'receiverSerial', 'fixType', 'pdop', 'sats', 'rtcmAge', 'sigmaH', 'sigmaV', 'epochs', 'duration', 'timestamp', 'mountpoint', 'correctionSource', 'operator', 'accepted', 'rejectReasons'],
  Point: ['pointNo', 'class (DIREK/TRAFO/SDK/HAT/DETAY/KONTROL)', 'critical', 'E', 'N', 'h', 'H', 'lat', 'lon', 'source', 'quality', 'observationId', 'history[] (yeniden ölçüm revizyonları)'],
  Line: ['lineNo', 'name', 'lineType (AG/OG/AYD/ENH/ABONE)', 'install (havai/yeraltı)', 'voltageKV', 'nodes[] (ekipman/nokta sırası)', 'circuits[] {role, lineTypeKey, count}', 'phaseConfig', 'status (MEVCUT/YENI/DEMONTAJ/DMM/ILERIDE)', 'workDate', 'note', 'musterek', 'ring'],
  Span: ['lineId', 'fromId', 'toId', 'length2D', 'length3D', 'dH', 'bearing', 'conductor', 'tension', 'temp', 'sag (hesap)', 'clearance (hesap)'],
  Equipment: ['kind (pole/transformer/sdk/lighting/kiosk/substation/manhole)', 'no', 'pointId', 'status', 'job (montaj/demontaj/dmm)', 'group', 'typeId', 'role / roleManual', 'angle', 'heightM', 'attrs {...türe özgü}', 'workDate', 'note'],
  Cable: ['lineId', 'channel {type, width, depth, pipeDia, pipeCount, sand, fill, warningTape, protectionPlate, concrete}', 'manholes', 'joints (muf)', 'reserve', 'allowances {riser, exit, trafo, sdk, joint}', 'cableKey', 'circuits', 'installMethod'],
  Crossing: ['kind (karayolu/yol/dere/bina/telekom/enerji/demiryolu/ağaç/arazi)', 'spanId', 'E', 'N', 'objectH', 'distanceFromStart', 'requiredV', 'measuredV', 'result'],
  Material: ['ownerId', 'ownerType', 'servis', 'qty', 'unit', 'origin (OTO/MANUEL/SAHADA_ILAVE)', 'ruleId', 'reason', 'approved'],
  Quantity: ['servis (iş önekli)', 'baseServis', 'job', 'qty', 'unit', 'kg', 'sources {GNSS, GIS, OTO, MANUEL, FOTO, PROJE, REVIZYON}', 'refs[]'],
  Poz: ['servis', 'pozNo', 'name', 'unit', 'kgPerUnit', 'montaj', 'demontaj', 'dmm', 'priceMaterial', 'priceLabor', 'stdId', 'validFrom', 'validTo'],
  MaterialRecipe: ['eq', 'when {group, role, clsBig, clsDbl, agCiplak, type}', 'items[] {servis|src, qty|param, why, grp, tag}'],
  ProgressPayment: ['no', 'start', 'end', 'status (taslak/onaylı)', 'lines[] {servis, job, contract, previous, current, cumulative, remaining, sources}', 'approvedAt', 'approvedBy'],
  WorkProgram: ['items[] {servis, job, contractQty, unitPrice}', 'basis (keşif / proje)'],
  Photo: ['ownerId', 'ownerType', 'pointId', 'timestamp', 'user', 'lat', 'lon', 'E', 'N', 'heading', 'note', 'blobId', 'width', 'height'],
  Inspection: ['runAt', 'results[] {code, severity, entityId, message}'],
  Aplikasyon: ['targetId', 'targetNo', 'designE/N/H', 'measuredE/N/H', 'dE', 'dN', 'dH', 'dist', 'axisOffset', 'mark', 'fix', 'accepted'],
  Revision: ['label', 'reason', 'snapshotBlobId', 'counts', 'hash'],
  User: ['name', 'role (operatör/mühendis/yönetici)', 'deviceId'],
  AuditLog: ['ts', 'user', 'store', 'entityId', 'action', 'changes[] {field, old, new}', 'reason'],
  ExportJob: ['formats[]', 'crs', 'createdAt', 'dataHash', 'files[] {name, size, sha256}', 'stale'],
  StandardVersion: ['code', 'name', 'book', 'validFrom', 'validTo', 'status', 'unverifiedTables']
};

export const EQUIPMENT_KINDS = {
  pole: { label: 'Direk', prefix: 'D' },
  transformer: { label: 'Trafo', prefix: 'TR' },
  sdk: { label: 'SDK / Box', prefix: 'SDK' },
  lighting: { label: 'Aydınlatma direği', prefix: 'AY' },
  kiosk: { label: 'Köşk', prefix: 'K' },
  substation: { label: 'İndirici / dağıtım merkezi', prefix: 'DM' },
  manhole: { label: 'Menhol', prefix: 'MH' },
  subscriber: { label: 'Abone', prefix: 'AB' },
  panel: { label: 'Pano', prefix: 'PN' },
  luminaire: { label: 'Armatür / sokak lambası', prefix: 'AR' },
  other: { label: 'Diğer', prefix: 'X' }
};
// Otomatik reçetesi olan türler (reçete boşsa hata); diğerlerinde malzeme katalogdan seçilir
export const RECIPE_KINDS = ['pole', 'lighting', 'transformer', 'kiosk', 'substation', 'sdk'];
// Fotoğraf / proje klasör adları (PROJE/DIREKLER/D001/D001_01.jpg)
export const KIND_FOLDER = { pole: 'DIREKLER', lighting: 'DIREKLER', transformer: 'TRAFOLAR', kiosk: 'TRAFOLAR', substation: 'TRAFOLAR', sdk: 'SDK', panel: 'PANOLAR', luminaire: 'ARMATURLER', manhole: 'MENHOLLER', subscriber: 'ABONELER', other: 'DIGER', line: 'KANALLAR', point: 'NOKTALAR' };

// Obje bazlı hakediş durumu (ekipman ve hat). done: metraj/hakediş kümülatifine girer.
export const HAK_STATUSES = {
  YAPILACAK: { label: 'Yapılacak', short: 'YAPILACAK', color: '#94a3b8', done: false },
  BASLANDI: { label: 'Başlandı', short: 'BAŞLANDI', color: '#38bdf8', done: false },
  TAMAMLANDI: { label: 'Tamamlandı', short: 'TAMAMLANDI', color: '#fbbf24', done: true },
  KONTROL: { label: 'Kontrol Edildi', short: 'KONTROL', color: '#c084fc', done: true },
  HAKEDISTE: { label: 'Hakedişe Girdi', short: 'HAKEDİŞTE', color: '#fb923c', done: true },
  ONAYLI: { label: 'Hakediş Onaylandı', short: 'ONAYLI', color: '#22c55e', done: true }
};
export const HAK_ORDER = ['YAPILACAK', 'BASLANDI', 'TAMAMLANDI', 'KONTROL', 'HAKEDISTE', 'ONAYLI'];

export const LINE_TYPES = ['AG', 'OG', 'AYD', 'ENH', 'ABONE'];
export const STATUSES = {
  MEVCUT: { label: 'Mevcut', job: null },
  YENI: { label: 'Yeni · montaj', job: 'montaj' },
  DEMONTAJ: { label: 'Demontaj', job: 'demontaj' },
  DMM: { label: 'DMM · BYSK (sökülüp tekrar dikilen)', job: 'dmm' },
  ILERIDE: { label: 'İleride', job: null }
};
export const TRAFO_STATUSES = {
  mevcut: { label: 'Mevcut', job: null },
  yeni: { label: 'Yeni · montaj', job: 'montaj' },
  guc: { label: 'Gücü yükseltilen', job: 'montaj', only: ['trafo', 'pano'], removeOld: true },
  ger: { label: 'Gerilimi değişen', job: 'montaj', only: ['trafo', 'pano'], removeOld: true },
  gucger: { label: 'Güç + gerilim değişen', job: 'montaj', only: ['trafo', 'pano'], removeOld: true },
  tasinan: { label: 'Taşınan (DMM)', job: 'dmm' },
  tadil: { label: 'Tadil edilen', job: 'montaj', only: ['kosk', 'hucre'] },
  modul: { label: 'Modülere dönüşen', job: 'montaj', only: ['kosk', 'hucre'] },
  demontaj: { label: 'Demonte', job: 'demontaj' },
  ileride: { label: 'İleride', job: null }
};
export const JOB_PREFIX = { montaj: '0', demontaj: '1', dmm: '2' };
export const JOB_LABEL = { montaj: 'Montaj', demontaj: 'Demontaj', dmm: 'DMM' };
export const SOURCES = ['GNSS', 'TEST', 'SIM', 'GIS', 'OTO', 'MANUEL', 'FOTO', 'PROJE', 'EXCEL', 'REVIZYON'];
export const SOURCE_LABEL = { GNSS: 'GNSS', TEST: 'Telefon GPS (test)', SIM: 'Simülatör', GIS: 'GIS', OTO: 'Otomatik metraj', MANUEL: 'Manuel', FOTO: 'Fotoğraf', PROJE: 'Proje', EXCEL: 'Excel', REVIZYON: 'Revizyon' };

// Kayıttaki hakediş durumu; eski kayıtlarda (alan yokken) ilerleme bilgisinden türetilir. İş kalemi olmayan (mevcut/ileride) objelerde null.
export function hakOf(rec, isTrafo) {
  const st = isTrafo || (rec && (rec.kind === 'transformer' || rec.kind === 'kiosk' || rec.kind === 'substation')) ? TRAFO_STATUSES[rec.state] : STATUSES[rec.state];
  if (!st || !st.job) return null;
  if (rec.hak && HAK_STATUSES[rec.hak]) return rec.hak;
  return rec.progress === 'done' ? 'TAMAMLANDI' : 'YAPILACAK';
}
