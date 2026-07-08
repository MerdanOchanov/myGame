import { fnv1aHash } from '../shared/Random';
import { Biome, RGB, colorToBiomeType, clampCollectInterval, DEFAULT_COLLECT_INTERVAL_SEC } from './Biome';

// Biomes are no longer auto-generated per cell — the admin tool creates
// them on a selected map area, typed by the area's dominant map color
// (TZ §6). This factory is shared by the mock backend; the Edge Function
// has its own mirror in gameRules.ts.
export function createAdminBiome(
  blockIds: string[],
  dominantColor: RGB,
  collectIntervalSec: number = DEFAULT_COLLECT_INTERVAL_SEC,
  now: Date = new Date()
): Biome {
  const id = `biome_${fnv1aHash(blockIds.slice().sort().join(',')).toString(36)}`;
  return {
    id,
    type: colorToBiomeType(dominantColor),
    blockIds,
    dominantColor,
    createdAt: now.toISOString(),
    seed: `${id}|admin`,
    collectIntervalSec: clampCollectInterval(collectIntervalSec),
  };
}
