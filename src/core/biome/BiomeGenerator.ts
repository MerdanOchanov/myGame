import { neighbors } from '../geo/HexGrid';
import { createSeededRandom, pickFrom, intInRange } from '../shared/Random';
import { Biome, BIOME_TYPES } from './Biome';

// Deterministic by hexCellId + worldSeed (TZ §9): the same seed always
// produces the same biome for a given cell, satisfying "may be deterministic
// by hexCellId + worldSeed".
export function generateBiome(hexCellId: string, worldSeed: string, now: Date = new Date()): Biome {
  const rand = createSeededRandom(hexCellId, worldSeed);
  const type = pickFrom(rand, BIOME_TYPES);
  const clusterSize = intInRange(rand, 3, 6); // TZ §6: biome is 3-6 hex zones

  const candidateNeighbors = shuffle(neighbors(hexCellId, 1), rand);
  const hexCellIds = [hexCellId, ...candidateNeighbors.slice(0, clusterSize - 1)];

  return {
    id: `biome_${hexCellId}`,
    type,
    hexCellIds,
    generatedAt: now.toISOString(),
    seed: worldSeed,
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
