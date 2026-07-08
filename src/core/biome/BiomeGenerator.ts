import { fnv1aHash } from '../shared/Random';
import { Biome, RGB, colorToBiomeType } from './Biome';

// Biomes are no longer auto-generated per cell — the admin tool creates
// them on a selected map area, typed by the area's dominant map color
// (TZ §6). This factory is shared by the mock backend; the Edge Function
// has its own mirror in gameRules.ts.
export function createAdminBiome(
  blockIds: string[],
  dominantColor: RGB,
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
  };
}
