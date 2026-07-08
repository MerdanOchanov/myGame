// Biomes are created by the admin tool on a selected map area and typed by
// the dominant map color of that area (TZ §6). A biome is 5..40 blocks of
// 7 cells each.
export type BiomeType = 'water' | 'desert' | 'steppe' | 'forest' | 'urban_jungle' | 'mountain';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Biome {
  id: string;
  type: BiomeType;
  blockIds: string[];
  dominantColor: RGB;
  createdAt: string;
  seed: string;
  /** Пауза между сборами материалов в этом биоме; задаётся админом. */
  collectIntervalSec: number;
}

export const MIN_BIOME_BLOCKS = 5;
export const MAX_BIOME_BLOCKS = 40;

export const DEFAULT_COLLECT_INTERVAL_SEC = 10;
export const MIN_COLLECT_INTERVAL_SEC = 1;
export const MAX_COLLECT_INTERVAL_SEC = 3600;

export function clampCollectInterval(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_COLLECT_INTERVAL_SEC;
  return Math.max(MIN_COLLECT_INTERVAL_SEC, Math.min(MAX_COLLECT_INTERVAL_SEC, n));
}

export type MaterialCategory = 'plant' | 'fruit' | 'berry' | 'insect';

export const BIOME_MATERIAL_WEIGHTS: Record<BiomeType, Partial<Record<MaterialCategory, number>>> = {
  water: { plant: 3, berry: 1 },
  desert: { plant: 2, insect: 2 },
  steppe: { plant: 3, berry: 2, insect: 1 },
  forest: { plant: 2, berry: 2, fruit: 1, insect: 1 },
  urban_jungle: { plant: 1, insect: 3 },
  mountain: { plant: 2, insect: 1 },
};

export const BIOME_LABELS_RU: Record<BiomeType, string> = {
  water: 'Вода',
  desert: 'Пустыня',
  steppe: 'Степь',
  forest: 'Лес',
  urban_jungle: 'Каменные джунгли',
  mountain: 'Горы',
};

export const BIOME_COLORS: Record<BiomeType, string> = {
  water: '#2e86de',
  desert: '#d4a95a',
  steppe: '#9acd5a',
  forest: '#2e7d32',
  urban_jungle: '#8d6e63',
  mountain: '#b0bec5',
};

// Canonical dominant-color -> biome type classification (mirrored in the
// Edge Function's gameRules.ts — keep in sync). Blue -> water, beige ->
// desert, built-up gray -> concrete jungle, greens by darkness,
// near-white -> mountain; fallback steppe.
export function colorToBiomeType({ r, g, b }: RGB): BiomeType {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (delta > 0) {
    if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
    else hue = 60 * ((rn - gn) / delta + 4);
  }
  if (hue < 0) hue += 360;

  if (lightness > 0.96) return 'mountain';
  if (saturation >= 0.12 && hue >= 180 && hue <= 260) return 'water';
  if (saturation >= 0.12 && hue >= 65 && hue < 180) return lightness < 0.45 ? 'forest' : 'steppe';
  if (hue >= 30 && hue < 65 && lightness >= 0.55) return 'desert';
  if (saturation < 0.12) return 'urban_jungle';
  return 'steppe';
}
