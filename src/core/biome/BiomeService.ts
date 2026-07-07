import { Biome } from './Biome';
import { generateBiome } from './BiomeGenerator';

// Backend-agnostic repository shape (ARCHITECTURE §6).
export interface BiomeRepository {
  getByHexCellId(hexCellId: string): Biome | undefined;
  /** Must index the returned biome under every id in biome.hexCellIds. */
  save(biome: Biome): void;
}

const WORLD_SEED = 'scientists-world-v1';

// Hex cells aren't pre-hydrated for the whole world (ARCHITECTURE §8.5) —
// biomes are generated lazily on first lookup and then fixed via the repo.
export function getOrGenerateBiome(repo: BiomeRepository, hexCellId: string): Biome {
  const existing = repo.getByHexCellId(hexCellId);
  if (existing) return existing;

  const biome = generateBiome(hexCellId, WORLD_SEED);
  repo.save(biome);
  return biome;
}
