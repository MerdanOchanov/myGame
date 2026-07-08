// Server-side port of the client's src/core domain rules for the game-api
// Edge Function (Deno). Kept as a controlled copy because Deno needs npm:
// specifiers and the Vite client can't share them; if you change a rule
// here, mirror it in src/core (and vice versa).
import { latLngToCell, cellToLatLng, gridDisk } from 'npm:h3-js@4.5.0';

export const HEX_RESOLUTION = 12;
export const WORLD_SEED = 'scientists-world-v1';
export const RULES_VERSION = 'v1';
export const MIN_CRAFT_MATERIALS = 3;
export const HOME_TRANSFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const FREE_RAT_DRIP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const COLLECT_COOLDOWN_MS = 2000;
export const NEARBY_HOME_RADIUS_METERS = 1000;

// ------------------------------------------------------------------ types
export interface GeoProof {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: string;
}

export interface ActiveEffect {
  key: string;
  power: number;
  durationSec: number;
  source: 'event' | 'medicine' | 'disease' | 'biome';
}

export interface BiologicalState {
  key: string;
  value: number;
  min: number;
  max: number;
}

export interface MaterialTrait {
  effectKey: string;
  percent: number;
  visibility: 'hidden' | 'partially_known' | 'known';
}

// ---------------------------------------------------------------- seeding
export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(...seedParts: string[]): () => number {
  return mulberry32(fnv1aHash(seedParts.join('|')));
}

function intInRange(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// -------------------------------------------------------------------- geo
export function resolveHexCellId(lat: number, lng: number): string {
  return latLngToCell(lat, lng, HEX_RESOLUTION);
}

export function hexCellCenter(id: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(id);
  return { lat, lng };
}

const EARTH_RADIUS_METERS = 6371e3;

export function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dPhi / 2);
  const s2 = Math.sin(dLambda / 2);
  const h = s1 * s1 + Math.cos(phi1) * Math.cos(phi2) * s2 * s2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;
// Fresher than the client's 30s to tolerate client/server clock skew.
export const MAX_FIX_AGE_SECONDS = 120;
export const MAX_PLAUSIBLE_SPEED_MPS = 15;

export type GeoRejection = 'accuracy' | 'stale_timestamp' | 'implausible_speed';

export function validateProductionProof(
  proof: GeoProof,
  previous: { lat: number; lng: number; capturedAt: string } | null,
  now: Date
): GeoRejection | null {
  if (proof.accuracyMeters > MAX_ACCEPTABLE_ACCURACY_METERS) return 'accuracy';
  const ageSeconds = (now.getTime() - new Date(proof.capturedAt).getTime()) / 1000;
  if (ageSeconds > MAX_FIX_AGE_SECONDS || ageSeconds < -MAX_FIX_AGE_SECONDS) return 'stale_timestamp';
  if (previous) {
    const meters = haversineDistanceMeters(previous, proof);
    const seconds = (new Date(proof.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1000;
    if (seconds > 0 && meters / seconds > MAX_PLAUSIBLE_SPEED_MPS) return 'implausible_speed';
  }
  return null;
}

// ----------------------------------------------------------------- biomes
export type BiomeType = 'desert' | 'steppe' | 'oasis' | 'mountain' | 'urban_fringe' | 'coast';
export const BIOME_TYPES: readonly BiomeType[] = ['desert', 'steppe', 'oasis', 'mountain', 'urban_fringe', 'coast'];

export type MaterialCategory = 'plant' | 'fruit' | 'berry' | 'insect';

export const BIOME_MATERIAL_WEIGHTS: Record<BiomeType, Partial<Record<MaterialCategory, number>>> = {
  desert: { plant: 2, insect: 2 },
  steppe: { plant: 3, berry: 2, insect: 1 },
  oasis: { fruit: 3, berry: 2, plant: 1 },
  mountain: { plant: 2, insect: 1 },
  urban_fringe: { plant: 1, insect: 2 },
  coast: { plant: 2, berry: 1 },
};

export interface GeneratedBiome {
  id: string;
  type: BiomeType;
  hexCellIds: string[];
  seed: string;
}

export function generateBiome(hexCellId: string, worldSeed: string = WORLD_SEED): GeneratedBiome {
  const rand = createSeededRandom(hexCellId, worldSeed);
  const type = BIOME_TYPES[Math.floor(rand() * BIOME_TYPES.length)];
  const clusterSize = intInRange(rand, 3, 6);

  const ring = gridDisk(hexCellId, 1).filter((c: string) => c !== hexCellId);
  for (let i = ring.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ring[i], ring[j]] = [ring[j], ring[i]];
  }
  return {
    id: `biome_${hexCellId}`,
    type,
    hexCellIds: [hexCellId, ...ring.slice(0, clusterSize - 1)],
    seed: worldSeed,
  };
}

// -------------------------------------------------------------- materials
export const MATERIAL_TRAIT_CATALOG = [
  'anti_fever', 'toxic', 'sedative', 'stimulant',
  'anti_infection', 'hydration', 'pain_relief', 'mutation_risk',
] as const;

const NAME_PREFIXES: Record<MaterialCategory, string[]> = {
  plant: ['Sagebrush', 'Bitterroot', 'Dune Grass', 'Silverleaf'],
  fruit: ['Sunfruit', 'Amberberry Pod', 'Wild Fig', 'Honeydrop'],
  berry: ['Redberry', 'Frostberry', 'Cloudberry', 'Thornberry'],
  insect: ['Sand Beetle', 'Glass Wing', 'Rock Ant', 'Mist Moth'],
};

export interface GeneratedMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  biomeType: BiomeType;
  originHexCellId: string;
  generationSeed: string;
  primaryTraits: MaterialTrait[];
  secondaryTraits: MaterialTrait[];
}

function pickWeightedCategory(rand: () => number, biomeType: BiomeType): MaterialCategory {
  const entries = Object.entries(BIOME_MATERIAL_WEIGHTS[biomeType]) as [MaterialCategory, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [category, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return category;
  }
  return entries[0][0];
}

function generateTraits(rand: () => number, count: number): MaterialTrait[] {
  const pool = [...MATERIAL_TRAIT_CATALOG];
  const traits: MaterialTrait[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    const [effectKey] = pool.splice(idx, 1);
    traits.push({ effectKey, percent: intInRange(rand, 5, 95), visibility: 'hidden' });
  }
  return traits;
}

export function generateMaterial(originHexCellId: string, biomeType: BiomeType): GeneratedMaterial {
  const generationSeed = `${originHexCellId}|${WORLD_SEED}`;
  const rand = createSeededRandom(generationSeed);

  const category = pickWeightedCategory(rand, biomeType);
  const prefix = NAME_PREFIXES[category][Math.floor(rand() * NAME_PREFIXES[category].length)];

  return {
    id: `material_${originHexCellId}`,
    name: `${prefix} #${originHexCellId.slice(-4)}`,
    category,
    biomeType,
    originHexCellId,
    generationSeed,
    primaryTraits: generateTraits(rand, intInRange(rand, 2, 3)),
    secondaryTraits: generateTraits(rand, intInRange(rand, 1, 2)),
  };
}

// --------------------------------------------------------------- medicine
const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.5;
const EFFECT_DURATION_SEC = 300;

export function resolveMedicineEffects(
  materials: { primaryTraits: MaterialTrait[]; secondaryTraits: MaterialTrait[] }[]
): ActiveEffect[] {
  const totals = new Map<string, number>();
  for (const material of materials) {
    for (const t of material.primaryTraits) totals.set(t.effectKey, (totals.get(t.effectKey) ?? 0) + t.percent * PRIMARY_WEIGHT);
    for (const t of material.secondaryTraits) totals.set(t.effectKey, (totals.get(t.effectKey) ?? 0) + t.percent * SECONDARY_WEIGHT);
  }
  return [...totals.entries()].map(([key, total]) => ({
    key,
    power: Math.round(Math.min(100, total / materials.length)),
    durationSec: EFFECT_DURATION_SEC,
    source: 'medicine' as const,
  }));
}

export interface CraftedMedicine {
  id: string;
  name: string;
  generationSeed: string;
  inputMaterialIds: string[];
  hiddenEffects: ActiveEffect[];
  successChance: number;
  stabilityPercent: number;
}

export function craftMedicineRecipe(
  materials: { id: string; primaryTraits: MaterialTrait[]; secondaryTraits: MaterialTrait[] }[],
  homeLevel: number
): CraftedMedicine {
  const sortedIds = materials.map((m) => m.id).sort();
  const generationSeed = `${sortedIds.join(',')}|${RULES_VERSION}`;
  const recipeRandom = createSeededRandom(generationSeed);
  const seedHash = fnv1aHash(generationSeed);

  const chance = Math.min(0.95, Math.max(0.1, 0.5 + 0.05 * materials.length + 0.05 * (homeLevel - 1)));

  return {
    id: `medicine_${seedHash}`,
    name: `Unknown Compound #${seedHash.toString(36).slice(0, 5)}`,
    generationSeed,
    inputMaterialIds: sortedIds,
    hiddenEffects: resolveMedicineEffects(materials),
    successChance: chance,
    stabilityPercent: Math.round(recipeRandom() * 40 + 40),
  };
}

// ------------------------------------------------------- biological state
interface StateTemplate {
  key: string;
  min: number;
  max: number;
  initial: number;
}

export const BIOLOGICAL_STATE_TEMPLATES: StateTemplate[] = [
  { key: 'health', min: 0, max: 100, initial: 100 },
  { key: 'infection', min: 0, max: 100, initial: 0 },
  { key: 'stress', min: 0, max: 100, initial: 0 },
  { key: 'poison', min: 0, max: 100, initial: 0 },
  { key: 'immunity', min: 0, max: 100, initial: 50 },
  { key: 'fatigue', min: 0, max: 100, initial: 0 },
  { key: 'vision', min: 0, max: 100, initial: 100 },
  { key: 'mutation', min: 0, max: 100, initial: 0 },
];

export function createInitialStates(): BiologicalState[] {
  return BIOLOGICAL_STATE_TEMPLATES.map((t) => ({ key: t.key, value: t.initial, min: t.min, max: t.max }));
}

const EFFECT_STATE_MAP: Record<string, { stateKey: string; sign: 1 | -1 }> = {
  anti_fever: { stateKey: 'infection', sign: -1 },
  toxic: { stateKey: 'poison', sign: 1 },
  sedative: { stateKey: 'stress', sign: -1 },
  stimulant: { stateKey: 'fatigue', sign: -1 },
  anti_infection: { stateKey: 'infection', sign: -1 },
  hydration: { stateKey: 'health', sign: 1 },
  pain_relief: { stateKey: 'stress', sign: -1 },
  mutation_risk: { stateKey: 'mutation', sign: 1 },
};

export function applyEffectToStates(states: BiologicalState[], effect: ActiveEffect): BiologicalState[] {
  const mapping = EFFECT_STATE_MAP[effect.key];
  const targetKey = mapping?.stateKey ?? effect.key;
  const signedPower = mapping ? effect.power * mapping.sign : effect.power;
  return states.map((s) =>
    s.key === targetKey ? { ...s, value: Math.max(s.min, Math.min(s.max, s.value + signedPower)) } : s
  );
}

export function isRatDead(states: BiologicalState[]): boolean {
  const health = states.find((s) => s.key === 'health');
  const poison = states.find((s) => s.key === 'poison');
  return (health !== undefined && health.value <= 0) ||
    (poison !== undefined && poison.value >= 100 && Math.random() < 0.5);
}
