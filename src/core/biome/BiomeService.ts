import { Biome, RGB, MIN_BIOME_BLOCKS, MAX_BIOME_BLOCKS, DEFAULT_COLLECT_INTERVAL_SEC } from './Biome';
import { createAdminBiome } from './BiomeGenerator';
import { isBlockId } from '../geo/HexGrid';

// Backend-agnostic repository shape (ARCHITECTURE §6).
export interface BiomeRepository {
  getByBlockId(blockId: string): Biome | undefined;
  /** Must index the returned biome under every id in biome.blockIds. */
  save(biome: Biome): void;
}

export type AdminBiomeError = 'too_few_blocks' | 'too_many_blocks' | 'bad_block_ids' | 'blocks_taken';

// Admin-only biome creation (TZ §6): 1..1111 blocks (7..7777 cells), none
// already claimed by another biome, typed by the dominant map color of the
// biome's area. Usually invoked in batch by the scatter generator.
export function createBiomeOnBlocks(
  repo: BiomeRepository,
  blockIds: string[],
  dominantColor: RGB,
  collectIntervalSec: number = DEFAULT_COLLECT_INTERVAL_SEC,
  now: Date = new Date()
): Biome | AdminBiomeError {
  const unique = [...new Set(blockIds)];
  if (unique.length < MIN_BIOME_BLOCKS) return 'too_few_blocks';
  if (unique.length > MAX_BIOME_BLOCKS) return 'too_many_blocks';
  if (!unique.every(isBlockId)) return 'bad_block_ids';
  if (unique.some((blockId) => repo.getByBlockId(blockId))) return 'blocks_taken';

  const biome = createAdminBiome(unique, dominantColor, collectIntervalSec, now);
  repo.save(biome);
  return biome;
}

export function biomeAtBlock(repo: BiomeRepository, blockId: string): Biome | undefined {
  return repo.getByBlockId(blockId);
}
