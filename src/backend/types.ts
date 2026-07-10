import { HexCell } from '../core/geo/HexCell';
import { Biome } from '../core/biome/Biome';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { Material, MaterialSummary } from '../core/materials/Material';
import { Medicine } from '../core/medicine/Medicine';
import { LabRat } from '../core/lab/LabRat';
import { GameEvent } from '../core/events/GameEvent';
import { PlayerState, ActiveEffect } from '../core/player/PlayerState';
import { SurvivalRun } from '../core/player/SurvivalRun';

// Verbatim from TZ.md §11.
export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface Inventory {
  playerId: string;
  materials: InventoryStack[];
  medicines: InventoryStack[];
}

export interface PlayerSession {
  playerId: string;
  playerState: PlayerState;
  survivalRun: SurvivalRun;
  home?: LaboratoryHome;
}

export interface ViewBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** Событие с уже вычисленной текущей позицией (для рендера/логики на клиенте). */
export interface EventView {
  event: GameEvent;
  center: { lat: number; lng: number };
  hexagon: [number, number][];
}

export interface MapLayers {
  playerHexCell: HexCell;
  /** Biome at the player's current block, if any. */
  biome?: Biome;
  /** All biomes intersecting the requested viewport. */
  biomes: Biome[];
  nearbyHomes: LaboratoryHome[];
  /** Когда игроку снова можно собирать (ISO), если известен активный таймер. */
  nextCollectAt?: string;
  /** События, пересекающие вьюпорт (позиция уже сдвинута дрейфом). */
  events: EventView[];
  /** Игрок внутри события — эффекты применяются постепенно. */
  insideEventId?: string;
  /** Игрок приближается к событию (за пол-радиуса) — предупредить. */
  approachingEventId?: string;
  /** Обновлённое состояние, если событие нанесло урон на этом тике. */
  playerState?: PlayerState;
}

export interface MaterialCollectionResult {
  material: MaterialSummary;
  quantity: number;
  poolSize: number;
  /** Когда можно собирать снова (ISO) — интервал задаёт админ биома. */
  nextCollectAt: string;
}

export interface InventoryView {
  playerId: string;
  materials: { material: Material; quantity: number }[];
  medicines: { medicine: Medicine; quantity: number }[];
}

export interface ApplyMedicineResult {
  appliedEffects: ActiveEffect[];
  playerState: PlayerState;
}

export interface RatTestResult {
  revealedEffect?: ActiveEffect;
  ratAlive: boolean;
  rat: LabRat;
  /** Испытание с 30% шансом израсходовало 1 ед. лекарства. */
  medicineConsumed: boolean;
  /** Когда снова можно испытывать (ISO) — таймаут задаёт админ. */
  nextTestAt: string;
}

export interface RatsView {
  rats: LabRat[];
  /** Когда снова можно испытывать (ISO), если таймаут активен. */
  nextTestAt?: string;
  testIntervalSec: number;
}

// Сводки для админ-панелей просмотра.
export interface AdminPlayerSummary {
  playerId: string;
  survivedDays: number;
  hasHome: boolean;
  health: number;
  alive: boolean;
}

export interface AdminMedicineSummary {
  id: string;
  name: string;
  creatorPlayerId: string;
  knownEffects: number;
  hiddenEffects: number;
  createdAt: string;
}

export interface AdminMaterialSummary {
  id: string;
  name: string;
  category: string;
  biomeType: string;
}
