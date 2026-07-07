// The 8 effectKeys already named in TZ.md §7's example table — a
// representative catalog, smaller than the documented "20+ characteristics",
// per the trimming allowance used elsewhere in this MVP session.
export const MATERIAL_TRAIT_CATALOG = [
  'anti_fever',
  'toxic',
  'sedative',
  'stimulant',
  'anti_infection',
  'hydration',
  'pain_relief',
  'mutation_risk',
] as const;

export type MaterialTraitKey = (typeof MATERIAL_TRAIT_CATALOG)[number];
