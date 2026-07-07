import { Material } from '../materials/Material';
import { ActiveEffect } from '../player/PlayerState';

const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.5;
const EFFECT_DURATION_SEC = 300;

// Aggregates N materials' traits into the medicine's resulting effects (TZ
// §10: "итоговые эффекты зависят от процентных характеристик материалов").
// Uses all traits regardless of the collecting player's personal reveal
// state — crafting math operates on the material's true fixed values.
export function resolveMedicineEffects(materials: Material[]): ActiveEffect[] {
  const totals = new Map<string, number>();

  for (const material of materials) {
    for (const trait of material.primaryTraits) {
      totals.set(trait.effectKey, (totals.get(trait.effectKey) ?? 0) + trait.percent * PRIMARY_WEIGHT);
    }
    for (const trait of material.secondaryTraits) {
      totals.set(trait.effectKey, (totals.get(trait.effectKey) ?? 0) + trait.percent * SECONDARY_WEIGHT);
    }
  }

  return [...totals.entries()].map(([key, totalWeight]) => ({
    key,
    power: Math.round(Math.min(100, totalWeight / materials.length)),
    durationSec: EFFECT_DURATION_SEC,
    source: 'medicine' as const,
  }));
}
