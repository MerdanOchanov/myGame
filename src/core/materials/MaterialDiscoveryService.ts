import { Material, MaterialTrait } from './Material';

// Backend-agnostic repositories (ARCHITECTURE §6).
export interface MaterialRepository {
  getPoolByBiomeId(biomeId: string): Material[];
  save(material: Material): void;
}

export interface KnowledgeProfileRepository {
  getRevealedTraitKeys(playerId: string, materialId: string): Set<string>;
  revealTrait(playerId: string, materialId: string, effectKey: string): void;
}

/** Random pick from the biome's fixed material pool (TZ §7: 1..10 distinct materials per biome). */
export function rollMaterialFromPool(pool: Material[], rand: () => number = Math.random): Material | undefined {
  if (pool.length === 0) return undefined;
  return pool[Math.floor(rand() * pool.length)];
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
