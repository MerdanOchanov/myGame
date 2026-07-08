import { Biome, RGB, clampCollectInterval } from '../core/biome/Biome';
import { createBiomeOnBlocks, AdminBiomeError } from '../core/biome/BiomeService';
import { generateMaterialPool } from '../core/materials/MaterialGenerator';
import { db, biomeRepository, materialRepository } from './db';

const WORLD_SEED = 'scientists-world-v1';

export type AdminError = AdminBiomeError | 'admin_forbidden' | 'unknown_biome';

export interface AdminBiomeResult {
  biome: Biome;
  materialCount: number;
}

// Mock stand-in for the Edge Function's ADMIN_PASSWORD secret: any
// non-empty password is accepted in local/mock mode.
export async function adminGenerateBiome(
  _playerId: string,
  payload: { blockIds: string[]; dominantColor: RGB; collectIntervalSec: number; password: string }
): Promise<AdminBiomeResult | AdminError> {
  if (!payload.password) return 'admin_forbidden';

  const result = createBiomeOnBlocks(
    biomeRepository,
    payload.blockIds,
    payload.dominantColor,
    payload.collectIntervalSec
  );
  if (typeof result === 'string') return result;

  const pool = generateMaterialPool(result.id, result.type, WORLD_SEED);
  for (const material of pool) materialRepository.save(material);

  return { biome: db.biomesById.get(result.id)!, materialCount: pool.length };
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
