import { getOrGenerateBiome } from '../core/biome/BiomeService';
import { getOrGenerateMaterial, getPersonalMaterialView } from '../core/materials/MaterialDiscoveryService';
import { toMaterialSummary } from '../core/materials/Material';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { db, biomeRepository, materialRepository, knowledgeProfileRepository, addMaterialToInventory } from './db';
import { resolveHex, GeoError } from './geo';
import { InventoryView, MaterialCollectionResult } from './types';

const COLLECT_COOLDOWN_MS = 2000; // basic rate-limit per player (ARCHITECTURE §13)

export type CollectError = GeoError | 'rate_limited';

export async function collectMaterial(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<MaterialCollectionResult | CollectError> {
  const lastCollectAt = db.lastCollectAtByPlayerId.get(playerId);
  const now = Date.now();
  if (proofWithMode.mode !== 'debug' && lastCollectAt && now - lastCollectAt < COLLECT_COOLDOWN_MS) {
    return 'rate_limited';
  }

  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  const biome = getOrGenerateBiome(biomeRepository, cell.id);
  const material = getOrGenerateMaterial(materialRepository, cell.id, biome.type, playerId);

  db.lastCollectAtByPlayerId.set(playerId, now);
  addMaterialToInventory(playerId, material.id, 1);

  const inventory = db.inventories.get(playerId);
  const quantity = inventory?.materials.find((s) => s.itemId === material.id)?.quantity ?? 1;

  return { material: toMaterialSummary(material), quantity };
}

export async function getInventory(playerId: string): Promise<InventoryView> {
  const inventory = db.inventories.get(playerId);
  if (!inventory) return { playerId, materials: [], medicines: [] };

  const materials = inventory.materials.map((stack) => {
    const material = db.materialsById.get(stack.itemId)!;
    const revealedKeys = knowledgeProfileRepository.getRevealedTraitKeys(playerId, material.id);
    return { material: getPersonalMaterialView(material, revealedKeys), quantity: stack.quantity };
  });

  const medicines = inventory.medicines.map((stack) => ({
    medicine: db.medicinesById.get(stack.itemId)!,
    quantity: stack.quantity,
  }));

  return { playerId, materials, medicines };
}
