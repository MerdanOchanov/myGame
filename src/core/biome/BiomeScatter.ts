import { blockNeighbors } from '../geo/HexGrid';
import { MIN_BIOME_BLOCKS, MAX_BIOME_BLOCKS, MIN_AREA_COVERAGE, MAX_BIOMES_PER_BATCH } from './Biome';

export interface ScatterOptions {
  /** Минимальная доля покрытых блоков (по умолчанию 0.5 — не более 50% свободно). */
  minCoverage?: number;
  minBlocks?: number;
  maxBlocks?: number;
  maxBiomes?: number;
}

// Разбрасывает по набору блоков-кандидатов несколько биомов-кластеров.
// Каждый биом — связная группа блоков случайного размера (minBlocks..maxBlocks);
// биомы не пересекаются; суммарно покрывается не менее minCoverage площади.
// Возвращает список групп блоков (по одному массиву на биом).
export function scatterBiomes(
  candidateBlockIds: string[],
  options: ScatterOptions = {},
  rng: () => number = Math.random
): string[][] {
  const minCoverage = options.minCoverage ?? MIN_AREA_COVERAGE;
  const minBlocks = options.minBlocks ?? MIN_BIOME_BLOCKS;
  const maxBlocks = options.maxBlocks ?? MAX_BIOME_BLOCKS;
  const maxBiomes = options.maxBiomes ?? MAX_BIOMES_PER_BATCH;

  const available = new Set(candidateBlockIds);
  const total = available.size;
  if (total === 0) return [];

  // Заполняем примерно minCoverage (по умолчанию ~50%) участка, оставляя
  // остальное свободным. Биомы должны быть РАЗБРОСАНЫ с промежутками, а не
  // покрывать участок сплошь; поэтому берём фиксированную долю около 50%
  // (лёгкая вариация ±5%), а не диапазон вплоть до 100%.
  const fillRatio = Math.min(0.95, minCoverage + (rng() - 0.5) * 0.1);
  const targetCovered = Math.max(
    minBlocks,
    Math.min(total, Math.round(fillRatio * total))
  );

  const biomes: string[][] = [];
  let covered = 0;

  while (covered < targetCovered && available.size > 0 && biomes.length < maxBiomes) {
    const seed = pickRandom(available, rng);
    const remaining = targetCovered - covered;
    // Размер биома: случайный в пределах [minBlocks..maxBlocks], но не больше
    // остатка до цели и не больше доступного числа блоков.
    const size = clamp(randInt(rng, minBlocks, maxBlocks), minBlocks, Math.min(maxBlocks, available.size, Math.max(minBlocks, remaining)));
    const cluster = growCluster(seed, size, available, rng);
    for (const b of cluster) available.delete(b);
    biomes.push(cluster);
    covered += cluster.length;
  }

  return biomes;
}

// Выращивает связный кластер от блока-семени по свободным соседям.
function growCluster(seed: string, size: number, available: Set<string>, rng: () => number): string[] {
  const cluster = [seed];
  const inCluster = new Set([seed]);
  const frontier = blockNeighbors(seed).filter((b) => available.has(b) && !inCluster.has(b));

  while (cluster.length < size && frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const next = frontier.splice(idx, 1)[0];
    if (inCluster.has(next) || !available.has(next)) continue;
    cluster.push(next);
    inCluster.add(next);
    for (const nb of blockNeighbors(next)) {
      if (available.has(nb) && !inCluster.has(nb)) frontier.push(nb);
    }
  }
  return cluster;
}

function pickRandom(set: Set<string>, rng: () => number): string {
  const idx = Math.floor(rng() * set.size);
  let i = 0;
  for (const value of set) {
    if (i === idx) return value;
    i++;
  }
  return set.values().next().value as string;
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
