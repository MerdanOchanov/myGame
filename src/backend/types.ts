import { HexCell } from '../core/geo/HexCell';
import { Biome } from '../core/biome/Biome';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { Material, MaterialSummary } from '../core/materials/Material';
import { Medicine } from '../core/medicine/Medicine';
import { LabRat } from '../core/lab/LabRat';
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

export interface MapLayers {
  playerHexCell: HexCell;
  /** Biome at the player's current block, if any. */
  biome?: Biome;
  /** All biomes intersecting the requested viewport. */
  biomes: Biome[];
  nearbyHomes: LaboratoryHome[];
}

export interface MaterialCollectionResult {
  material: MaterialSummary;
  quantity: number;
  poolSize: number;
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
}
