// Ekran kayıt defteri
import { MapScreen } from './map.js';
import { StakeoutScreen } from './stakeout.js';
import { EquipmentScreen } from './equipment.js';
import { PointScreen, LineScreen, PhotoScreen } from './records.js';
import { CalcScreen, EnhScreen, MetrajScreen, HakedisScreen, ChecksScreen } from './calc.js';
import { ExportScreen } from './export.js';
import { SettingsScreen, UserScreen, OlcumAyarlari, DuzeltmeAyarlari, HassasiyetAyarlari, KoordinatAyarlari, HaritaAyarlari, VeriAyarlari, DenemeAyarlari, HakkindaEkrani } from './settings.js';
import { PozScreen, LayersScreen, DefinitionsScreen } from './catalog.js';
import { ProjectsScreen, HubScreen, ProjectEditScreen, AuditScreen, SyncScreen } from './project.js';
import { ExcelScreen, ObjectsScreen, BaseRoverScreen } from './field.js';
import { CabinScreen } from './cabin.js';
import { TepeScreen } from './tepe.js';
import { TeamScreen } from './team.js';
import { HesapMerkeziScreen, HesapScreen, KaldirilmisHesapKaydi } from './hesap.js';

export const SCREENS = {
  map: MapScreen, stake: StakeoutScreen, calc: CalcScreen, export: ExportScreen, settings: SettingsScreen,
  equipment: EquipmentScreen, point: PointScreen, line: LineScreen, photo: PhotoScreen,
  enh: EnhScreen, metraj: MetrajScreen, hakedis: HakedisScreen, checks: ChecksScreen,
  poz: PozScreen, layers: LayersScreen, definitions: DefinitionsScreen,
  projects: ProjectsScreen, hub: HubScreen, projectEdit: ProjectEditScreen, audit: AuditScreen, sync: SyncScreen, user: UserScreen,
  excel: ExcelScreen, objects: ObjectsScreen, baseRover: BaseRoverScreen, cabin: CabinScreen, tepe: TepeScreen, team: TeamScreen,
  hesapMerkezi: HesapMerkeziScreen, hesap: HesapScreen, hesapKayit: KaldirilmisHesapKaydi,
  ayarOlcum: OlcumAyarlari, ayarDuzeltme: DuzeltmeAyarlari, ayarHassasiyet: HassasiyetAyarlari, ayarKoordinat: KoordinatAyarlari, ayarHarita: HaritaAyarlari, ayarVeri: VeriAyarlari, ayarDeneme: DenemeAyarlari, hakkinda: HakkindaEkrani
};
