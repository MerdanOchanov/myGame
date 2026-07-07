import { BiomeType } from '../biome/Biome';
import { generateMaterial } from './MaterialGenerator';
import { Material, MaterialTrait } from './Material';

const WORLD_SEED = 'scientists-world-v1';

// Backend-agnostic repositories (ARCHITECTURE §6).
export interface MaterialRepository {
  getByHexCellId(hexCellId: string): Material | undefined;
  save(material: Material): void;
}

export interface KnowledgeProfileRepository {
  getRevealedTraitKeys(playerId: string, materialId: string): Set<string>;
  revealTrait(playerId: string, materialId: string, effectKey: string): void;
}

// One Material per hex cell, generated once and fixed forever (TZ §7) —
// every later collector of the same cell gets the identical record. This is
// the smallest reading of `originHexCellId` being a single field rather than
// a list (flagged judgment call in the implementation plan).
export function getOrGenerateMaterial(
  repo: MaterialRepository,
  hexCellId: string,
  biomeType: BiomeType,
  playerId: string,
  now: Date = new Date()
): Material {
  const existing = repo.getByHexCellId(hexCellId);
  if (existing) return existing;

  const material = generateMaterial(hexCellId, biomeType, WORLD_SEED, now);
  material.discoveredByPlayerId = playerId;
  repo.save(material);
  return material;
}

function withPersonalVisibility(trait: MaterialTrait, revealed: Set<string>): MaterialTrait {
  return { ...trait, visibility: revealed.has(trait.effectKey) ? 'known' : 'hidden' };
}

/** Recomputes trait visibility for one specific player — traits are personal knowledge (TZ §21). */
export function getPersonalMaterialView(material: Material, revealedTraitKeys: Set<string>): Material {
  return {
    ...material,
    primaryTraits: material.primaryTraits.map((t) => withPersonalVisibility(t, revealedTraitKeys)),
    secondaryTraits: material.secondaryTraits.map((t) => withPersonalVisibility(t, revealedTraitKeys)),
  };
}
