import { Player } from '../core/player/Player';
import { PlayerState } from '../core/player/PlayerState';
import { SurvivalRun } from '../core/player/SurvivalRun';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { HomeRepository } from '../core/home/HomeClaimService';
import { Biome } from '../core/biome/Biome';
import { BiomeRepository } from '../core/biome/BiomeService';
import { Material } from '../core/materials/Material';
import { MaterialRepository, KnowledgeProfileRepository } from '../core/materials/MaterialDiscoveryService';
import { Medicine } from '../core/medicine/Medicine';
import { LabRat } from '../core/lab/LabRat';
import { Experiment } from '../core/lab/ExperimentService';
import { GeoProof } from '../core/geo/GeoPosition';
import { Inventory } from './types';

// Single in-memory "Game Data" store standing in for the future Supabase
// backend (ARCHITECTURE §2/§4). Nothing here is persisted across reloads.
class GameDatabase {
  readonly devices = new Map<string, string>(); // deviceId -> playerId
  readonly players = new Map<string, Player>();
  readonly playerStates = new Map<string, PlayerState>();
  readonly survivalRuns = new Map<string, SurvivalRun>();
  readonly lastGeoProofByPlayerId = new Map<string, GeoProof>();
  readonly lastCollectAtByPlayerId = new Map<string, number>();

  readonly homesByPlayerId = new Map<string, LaboratoryHome>();
  readonly homesByBlockId = new Map<string, LaboratoryHome>();

  readonly biomesById = new Map<string, Biome>();
  readonly biomesByBlockId = new Map<string, Biome>();

  readonly materialPoolsByBiomeId = new Map<string, Material[]>();
  readonly materialsById = new Map<string, Material>();
  readonly knowledgeProfiles = new Map<string, Set<string>>(); // `${playerId}|${materialId}` -> revealed effectKeys

  readonly medicinesById = new Map<string, Medicine>();

  readonly ratsByPlayerId = new Map<string, LabRat[]>();
  readonly ratsById = new Map<string, LabRat>();
  readonly lastFreeRatGrantByPlayerId = new Map<string, string>();
  readonly experiments: Experiment[] = [];

  readonly inventories = new Map<string, Inventory>();
}

export const db = new GameDatabase();

export function getOrCreateInventory(playerId: string): Inventory {
  let inventory = db.inventories.get(playerId);
  if (!inventory) {
    inventory = { playerId, materials: [], medicines: [] };
    db.inventories.set(playerId, inventory);
  }
  return inventory;
}

function addToStack(stacks: Inventory['materials'], itemId: string, quantity: number): void {
  const existing = stacks.find((s) => s.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else stacks.push({ itemId, quantity });
}

function removeFromStack(stacks: Inventory['materials'], itemId: string, quantity: number): boolean {
  const existing = stacks.find((s) => s.itemId === itemId);
  if (!existing || existing.quantity < quantity) return false;
  existing.quantity -= quantity;
  return true;
}

export function addMaterialToInventory(playerId: string, materialId: string, quantity = 1): void {
  addToStack(getOrCreateInventory(playerId).materials, materialId, quantity);
}

export function removeMaterialsFromInventory(playerId: string, materialIds: string[]): boolean {
  const inventory = getOrCreateInventory(playerId);
  const counts = new Map<string, number>();
  for (const id of materialIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [itemId, quantity] of counts) {
    const stack = inventory.materials.find((s) => s.itemId === itemId);
    if (!stack || stack.quantity < quantity) return false;
  }
  for (const [itemId, quantity] of counts) removeFromStack(inventory.materials, itemId, quantity);
  return true;
}

export function addMedicineToInventory(playerId: string, medicineId: string, quantity = 1): void {
  addToStack(getOrCreateInventory(playerId).medicines, medicineId, quantity);
}

export function removeMedicineFromInventory(playerId: string, medicineId: string, quantity = 1): boolean {
  return removeFromStack(getOrCreateInventory(playerId).medicines, medicineId, quantity);
}

export function getKnowledgeKey(playerId: string, materialId: string): string {
  return `${playerId}|${materialId}`;
}

export const homeRepository: HomeRepository = {
  getByBlockId: (blockId) => db.homesByBlockId.get(blockId),
  getByPlayerId: (playerId) => db.homesByPlayerId.get(playerId),
  save: (home) => {
    db.homesByPlayerId.set(home.playerId, home);
    db.homesByBlockId.set(home.blockId, home);
  },
  remove: (blockId) => {
    const home = db.homesByBlockId.get(blockId);
    if (!home) return;
    db.homesByBlockId.delete(blockId);
    db.homesByPlayerId.delete(home.playerId);
  },
};

export const biomeRepository: BiomeRepository = {
  getByBlockId: (blockId) => db.biomesByBlockId.get(blockId),
  save: (biome) => {
    db.biomesById.set(biome.id, biome);
    for (const blockId of biome.blockIds) db.biomesByBlockId.set(blockId, biome);
  },
};

export const materialRepository: MaterialRepository = {
  getPoolByBiomeId: (biomeId) => db.materialPoolsByBiomeId.get(biomeId) ?? [],
  save: (material) => {
    const pool = db.materialPoolsByBiomeId.get(material.biomeId) ?? [];
    pool.push(material);
    db.materialPoolsByBiomeId.set(material.biomeId, pool);
    db.materialsById.set(material.id, material);
  },
};

export const knowledgeProfileRepository: KnowledgeProfileRepository = {
  getRevealedTraitKeys: (playerId, materialId) => db.knowledgeProfiles.get(getKnowledgeKey(playerId, materialId)) ?? new Set(),
  revealTrait: (playerId, materialId, effectKey) => {
    const key = getKnowledgeKey(playerId, materialId);
    const set = db.knowledgeProfiles.get(key) ?? new Set<string>();
    set.add(effectKey);
    db.knowledgeProfiles.set(key, set);
  },
};
