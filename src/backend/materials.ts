import { rollMaterialFromPool, getPersonalMaterialView } from '../core/materials/MaterialDiscoveryService';
import { toMaterialSummary } from '../core/materials/Material';
import { blockIdOf } from '../core/geo/HexGrid';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { db, knowledgeProfileRepository, addMaterialToInventory } from './db';
import { resolveHex, GeoError } from './geo';
import { InventoryView, MaterialCollectionResult } from './types';

export type CollectError = GeoError | 'collect_cooldown' | 'no_biome_here';

export async function collectMaterial(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<MaterialCollectionResult | CollectError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  // Collection only works inside admin-created biomes (TZ §6).
  const biome = db.biomesByBlockId.get(blockIdOf(cell.id));
  if (!biome) return 'no_biome_here';

  // Пер-биомный таймер сбора — игровая механика, действует и в debug-режиме.
  const now = Date.now();
  const lastCollectAt = db.lastCollectAtByPlayerId.get(playerId);
  const intervalMs = biome.collectIntervalSec * 1000;
  if (lastCollectAt && now - lastCollectAt < intervalMs) {
    return 'collect_cooldown';
  }

  const pool = db.materialPoolsByBiomeId.get(biome.id) ?? [];
  const material = rollMaterialFromPool(pool);
  if (!material) return 'no_biome_here';

  db.lastCollectAtByPlayerId.set(playerId, now);
  addMaterialToInventory(playerId, material.id, 1);

  const inventory = db.inventories.get(playerId);
  const quantity = inventory?.materials.find((s) => s.itemId === material.id)?.quantity ?? 1;

  return {
    material: toMaterialSummary(material),
    quantity,
    poolSize: pool.length,
    nextCollectAt: new Date(now + intervalMs).toISOString(),
  };
}

export async function getInventory(playerId: string): Promise<InventoryView> {
  const inventory = db.inventories.get(playerId);
  if (!inventory) return { playerId, materials: [], medicines: [] };

  const materials = inventory.materials
    .filter((stack) => stack.quantity > 0)
    .map((stack) => {
      const material = db.materialsById.get(stack.itemId)!;
      const revealedKeys = knowledgeProfileRepository.getRevealedTraitKeys(playerId, material.id);
      return { material: getPersonalMaterialView(material, revealedKeys), quantity: stack.quantity };
    });

  const medicines = inventory.medicines
    .filter((stack) => stack.quantity > 0)
    .map((stack) => ({
      medicine: db.medicinesById.get(stack.itemId)!,
      quantity: stack.quantity,
    }));

  return { playerId, materials, medicines };
}
