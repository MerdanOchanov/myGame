import { Biome, RGB, BiomeType, clampCollectInterval } from '../core/biome/Biome';
import { createBiomeOnBlocks, AdminBiomeError } from '../core/biome/BiomeService';
import { generateMaterialPool } from '../core/materials/MaterialGenerator';
import { db, biomeRepository, materialRepository } from './db';

const WORLD_SEED = 'scientists-world-v1';

export type AdminError = AdminBiomeError | 'admin_forbidden' | 'unknown_biome' | 'no_biomes';

export interface AdminBiomeSpec {
  blockIds: string[];
  dominantColor: RGB;
}

export interface AdminBatchResult {
  biomesCreated: number;
  blocksCovered: number;
  materialsTotal: number;
  typeCounts: Partial<Record<BiomeType, number>>;
}

// Mock stand-in for the Edge Function's ADMIN_PASSWORD secret: any
// non-empty password is accepted in local/mock mode.
//
// Создаёт пачку биомов, разбросанных клиентом по выбранному участку.
// Каждый биом — связная группа блоков со своим преобладающим цветом.
export async function adminGenerateBiomes(
  _playerId: string,
  payload: { biomes: AdminBiomeSpec[]; collectIntervalSec: number; password: string }
): Promise<AdminBatchResult | AdminError> {
  if (!payload.password) return 'admin_forbidden';
  if (!payload.biomes?.length) return 'no_biomes';

  // Блоки не должны пересекаться между биомами в пачке.
  const seen = new Set<string>();
  for (const spec of payload.biomes) {
    for (const blockId of spec.blockIds) {
      if (seen.has(blockId)) return 'blocks_taken';
      seen.add(blockId);
    }
  }

  const result: AdminBatchResult = { biomesCreated: 0, blocksCovered: 0, materialsTotal: 0, typeCounts: {} };
  for (const spec of payload.biomes) {
    const biome = createBiomeOnBlocks(biomeRepository, spec.blockIds, spec.dominantColor, payload.collectIntervalSec);
    if (typeof biome === 'string') return biome;

    const pool = generateMaterialPool(biome.id, biome.type, WORLD_SEED);
    for (const material of pool) materialRepository.save(material);

    result.biomesCreated++;
    result.blocksCovered += biome.blockIds.length;
    result.materialsTotal += pool.length;
    result.typeCounts[biome.type] = (result.typeCounts[biome.type] ?? 0) + 1;
  }

  return result;
}

export async function adminSetCollectInterval(
  _playerId: string,
  payload: { biomeId: string; collectIntervalSec: number; password: string }
): Promise<Biome | AdminError> {
  if (!payload.password) return 'admin_forbidden';

  const biome = db.biomesById.get(payload.biomeId);
  if (!biome) return 'unknown_biome';

  biome.collectIntervalSec = clampCollectInterval(payload.collectIntervalSec);
  return biome;
}
