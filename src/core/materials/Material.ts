import { MaterialCategory } from '../biome/Biome';

export type { MaterialCategory };

// Verbatim from TZ.md §7.
export interface MaterialTrait {
  effectKey: string;
  percent: number;
  visibility: 'hidden' | 'partially_known' | 'known';
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  biomeType: string;
  originHexCellId: string;
  generationSeed: string;
  primaryTraits: MaterialTrait[];
  secondaryTraits: MaterialTrait[];
  discoveredAt: string;
  discoveredByPlayerId?: string;
}

/** Category + name only (TZ §21 disclosure decision) — traits stay hidden until revealed via experiments. */
export interface MaterialSummary {
  id: string;
  name: string;
  category: MaterialCategory;
}

export function toMaterialSummary(material: Material): MaterialSummary {
  return { id: material.id, name: material.name, category: material.category };
}
