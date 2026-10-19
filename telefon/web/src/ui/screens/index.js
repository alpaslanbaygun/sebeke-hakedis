// Ekran kayıt defteri
import { MapScreen } from './map.js';
import { StakeoutScreen } from './stakeout.js';
import { EquipmentScreen } from './equipment.js';
import { PointScreen, LineScreen, PhotoScreen } from './records.js';
import { CalcScreen, EnhScreen, MetrajScreen, HakedisScreen, ChecksScreen } from './calc.js';
import { ExportScreen } from './export.js';
import { SettingsScreen, UserScreen } from './settings.js';
import { PozScreen, LayersScreen, DefinitionsScreen } from './catalog.js';
import { ProjectsScreen, HubScreen, ProjectEditScreen, AuditScreen, SyncScreen } from './project.js';
import { ExcelScreen, ObjectsScreen, BaseRoverScreen } from './field.js';
import { CabinScreen } from './cabin.js';
import { TepeScreen } from './tepe.js';
import { TeamScreen } from './team.js';
import { HesapMerkeziScreen, HesapScreen } from './hesap.js';

export const SCREENS = {
  map: MapScreen, stake: StakeoutScreen, calc: CalcScreen, export: ExportScreen, settings: SettingsScreen,
  equipment: EquipmentScreen, point: PointScreen, line: LineScreen, photo: PhotoScreen,
  enh: EnhScreen, metraj: MetrajScreen, hakedis: HakedisScreen, checks: ChecksScreen,
  poz: PozScreen, layers: LayersScreen, definitions: DefinitionsScreen,
  projects: ProjectsScreen, hub: HubScreen, projectEdit: ProjectEditScreen, audit: AuditScreen, sync: SyncScreen, user: UserScreen,
  excel: ExcelScreen, objects: ObjectsScreen, baseRover: BaseRoverScreen, cabin: CabinScreen, tepe: TepeScreen, team: TeamScreen,
  hesapMerkezi: HesapMerkeziScreen, hesap: HesapScreen
};
