import { BiomeType, BIOME_MATERIAL_WEIGHTS, MaterialCategory } from '../biome/Biome';
import { createSeededRandom, intInRange, fnv1aHash } from '../shared/Random';
import { MATERIAL_TRAIT_CATALOG } from './MaterialTraitCatalog';
import { Material, MaterialTrait } from './Material';

export const MIN_BIOME_MATERIALS = 1;
export const MAX_BIOME_MATERIALS = 10;

const NAME_PREFIXES: Record<MaterialCategory, string[]> = {
  plant: ['Полынь', 'Горькокорень', 'Дюнная трава', 'Сребролист', 'Водоросль', 'Мох-камнеед'],
  fruit: ['Солнцеплод', 'Дикий инжир', 'Медовик', 'Янтарный стручок'],
  berry: ['Красника', 'Морозника', 'Облачная ягода', 'Терновая ягода'],
  insect: ['Песчаный жук', 'Стеклокрыл', 'Каменный муравей', 'Туманная моль', 'Бетонный сверчок'],
};

function pickWeightedCategory(rand: () => number, biomeType: BiomeType): MaterialCategory {
  const weights = BIOME_MATERIAL_WEIGHTS[biomeType];
  const entries = Object.entries(weights) as [MaterialCategory, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [category, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return category;
  }
  return entries[0][0];
}

function generateTraits(rand: () => number, count: number, visibility: MaterialTrait['visibility']): MaterialTrait[] {
  const pool = [...MATERIAL_TRAIT_CATALOG];
  const traits: MaterialTrait[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rand() * pool.length);
    const [effectKey] = pool.splice(index, 1);
    traits.push({ effectKey, percent: intInRange(rand, 5, 95), visibility });
  }
  return traits;
}

// Fixed pool of 1..10 distinct materials generated once with the biome
// (TZ §7); collecting rolls a random pool member. Mirrors the Edge
// Function's gameRules.generateMaterialPool — keep in sync.
export function generateMaterialPool(
  biomeId: string,
  biomeType: BiomeType,
  worldSeed: string,
  now: Date = new Date()
): Material[] {
  const poolRand = createSeededRandom(biomeId, worldSeed);
  const poolSize = intInRange(poolRand, MIN_BIOME_MATERIALS, MAX_BIOME_MATERIALS);

  const materials: Material[] = [];
  for (let poolIndex = 0; poolIndex < poolSize; poolIndex++) {
    const generationSeed = `${biomeId}|${poolIndex}|${worldSeed}`;
    const rand = createSeededRandom(generationSeed);
    const category = pickWeightedCategory(rand, biomeType);
    const namePrefix = NAME_PREFIXES[category][Math.floor(rand() * NAME_PREFIXES[category].length)];

    materials.push({
      id: `material_${fnv1aHash(generationSeed).toString(36)}`,
      name: `${namePrefix} №${poolIndex + 1}`,
      category,
      biomeType,
      biomeId,
      poolIndex,
      generationSeed,
      primaryTraits: generateTraits(rand, intInRange(rand, 2, 3), 'hidden'),
      secondaryTraits: generateTraits(rand, intInRange(rand, 1, 2), 'hidden'),
      createdAt: now.toISOString(),
    });
  }
  return materials;
}
