import { Material } from '../materials/Material';
import { createSeededRandom, fnv1aHash } from '../shared/Random';
import { Medicine } from './Medicine';
import { resolveMedicineEffects } from './MedicineEffectResolver';

export const MIN_CRAFT_MATERIALS = 3;

export type CraftError = 'insufficient_materials';

// Recipe (which effects result, stability) is fully deterministic from the
// sorted material ids + a rules version, per TZ §10.6's reproducibility
// requirement. The success/fail roll for a given *attempt* stays randomized
// — otherwise successChance as a displayed stat would be meaningless
// (flagged judgment call: the docs don't disambiguate this split).
const RULES_VERSION = 'v1';

export function craftMedicine(
  materials: Material[],
  playerId: string,
  homeLevel: number,
  now: Date = new Date()
): Medicine | CraftError {
  if (materials.length < MIN_CRAFT_MATERIALS) return 'insufficient_materials';

  const sortedIds = [...materials.map((m) => m.id)].sort();
  const generationSeed = `${sortedIds.join(',')}|${RULES_VERSION}`;
  const recipeRandom = createSeededRandom(generationSeed);

  const allEffects = resolveMedicineEffects(materials);
  const stabilityPercent = Math.round(recipeRandom() * 40 + 40); // 40-80%, deterministic per recipe

  const seedHash = fnv1aHash(generationSeed);
  return {
    id: `medicine_${seedHash}`,
    name: `Unknown Compound #${seedHash.toString(36).slice(0, 5)}`,
    creatorPlayerId: playerId,
    inputMaterialIds: sortedIds,
    generationSeed,
    knownEffects: [],
    hiddenEffects: allEffects,
    successChance: computeSuccessChance(materials.length, homeLevel),
    stabilityPercent,
    createdAt: now.toISOString(),
  };
}

function computeSuccessChance(materialCount: number, homeLevel: number): number {
  const chance = 0.5 + 0.05 * materialCount + 0.05 * (homeLevel - 1);
  return Math.min(0.95, Math.max(0.1, chance));
}
