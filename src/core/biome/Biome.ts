// Verbatim from TZ.md §6, BiomeType per the §6 examples table.
export type BiomeType = 'desert' | 'steppe' | 'oasis' | 'mountain' | 'urban_fringe' | 'coast';

export interface Biome {
  id: string;
  type: BiomeType;
  hexCellIds: string[];
  generatedAt: string;
  seed: string;
}

export type MaterialCategory = 'plant' | 'fruit' | 'berry' | 'insect';

export const BIOME_MATERIAL_WEIGHTS: Record<BiomeType, Partial<Record<MaterialCategory, number>>> = {
  desert: { plant: 2, insect: 2 },
  steppe: { plant: 3, berry: 2, insect: 1 },
  oasis: { fruit: 3, berry: 2, plant: 1 },
  mountain: { plant: 2, insect: 1 },
  urban_fringe: { plant: 1, insect: 2 },
  coast: { plant: 2, berry: 1 },
};

export const BIOME_TYPES: readonly BiomeType[] = ['desert', 'steppe', 'oasis', 'mountain', 'urban_fringe', 'coast'];
