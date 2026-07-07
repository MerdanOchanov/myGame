import { BiomeType, BIOME_MATERIAL_WEIGHTS, MaterialCategory } from '../biome/Biome';
import { createSeededRandom, intInRange } from '../shared/Random';
import { MATERIAL_TRAIT_CATALOG } from './MaterialTraitCatalog';
import { Material, MaterialTrait } from './Material';

const NAME_PREFIXES: Record<MaterialCategory, string[]> = {
  plant: ['Sagebrush', 'Bitterroot', 'Dune Grass', 'Silverleaf'],
  fruit: ['Sunfruit', 'Amberberry Pod', 'Wild Fig', 'Honeydrop'],
  berry: ['Redberry', 'Frostberry', 'Cloudberry', 'Thornberry'],
  insect: ['Sand Beetle', 'Glass Wing', 'Rock Ant', 'Mist Moth'],
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

// Generates a fixed Material for a given hex cell + biome (TZ §7: generated
// once, then fixed forever — the caller is responsible for persisting it via
// MaterialDiscoveryService so it's never regenerated).
export function generateMaterial(
  originHexCellId: string,
  biomeType: BiomeType,
  worldSeed: string,
  now: Date = new Date()
): Material {
  const generationSeed = `${originHexCellId}|${worldSeed}`;
  const rand = createSeededRandom(generationSeed);

  const category = pickWeightedCategory(rand, biomeType);
  const namePrefix = NAME_PREFIXES[category][Math.floor(rand() * NAME_PREFIXES[category].length)];
  const name = `${namePrefix} #${originHexCellId.slice(-4)}`;

  return {
    id: `material_${originHexCellId}`,
    name,
    category,
    biomeType,
    originHexCellId,
    generationSeed,
    primaryTraits: generateTraits(rand, intInRange(rand, 2, 3), 'hidden'),
    secondaryTraits: generateTraits(rand, intInRange(rand, 1, 2), 'hidden'),
    discoveredAt: now.toISOString(),
  };
}
