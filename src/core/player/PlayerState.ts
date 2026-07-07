// Verbatim from TZ.md §8.
export interface BiologicalState {
  key: string;
  value: number;
  min: number;
  max: number;
}

export interface ActiveEffect {
  key: string;
  power: number;
  durationSec: number;
  source: 'event' | 'medicine' | 'disease' | 'biome';
}

export interface PlayerState {
  playerId: string;
  states: BiologicalState[];
  activeEffects: ActiveEffect[];
}

// Representative catalog (one state per TZ §8 group) — smaller than the
// documented "100+ states/effects", by extension of the same trimming
// allowance already applied to materials/events for this MVP session.
interface StateTemplate {
  key: string;
  group: 'vital' | 'disease' | 'mental' | 'toxicology' | 'immunity' | 'mobility' | 'sensory' | 'experimental';
  min: number;
  max: number;
  initial: number;
}

export const BIOLOGICAL_STATE_TEMPLATES: StateTemplate[] = [
  { key: 'health', group: 'vital', min: 0, max: 100, initial: 100 },
  { key: 'infection', group: 'disease', min: 0, max: 100, initial: 0 },
  { key: 'stress', group: 'mental', min: 0, max: 100, initial: 0 },
  { key: 'poison', group: 'toxicology', min: 0, max: 100, initial: 0 },
  { key: 'immunity', group: 'immunity', min: 0, max: 100, initial: 50 },
  { key: 'fatigue', group: 'mobility', min: 0, max: 100, initial: 0 },
  { key: 'vision', group: 'sensory', min: 0, max: 100, initial: 100 },
  { key: 'mutation', group: 'experimental', min: 0, max: 100, initial: 0 },
];

export function createInitialPlayerState(playerId: string): PlayerState {
  return {
    playerId,
    states: BIOLOGICAL_STATE_TEMPLATES.map((t) => ({ key: t.key, value: t.initial, min: t.min, max: t.max })),
    activeEffects: [],
  };
}

export function clampStateValue(state: BiologicalState, value: number): number {
  return Math.max(state.min, Math.min(state.max, value));
}

// Medicine/material effect keys (MATERIAL_TRAIT_CATALOG: anti_fever, toxic,
// sedative, stimulant, anti_infection, hydration, pain_relief, mutation_risk)
// are a different vocabulary from BIOLOGICAL_STATE_TEMPLATES' keys — this
// maps each effect to the state it influences and in which direction, so
// `applyEffectToState` has something to match against instead of comparing
// effect.key to state.key directly.
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

export function applyEffectToState(playerState: PlayerState, effect: ActiveEffect): PlayerState {
  const mapping = EFFECT_STATE_MAP[effect.key];
  const targetStateKey = mapping?.stateKey ?? effect.key;
  const signedPower = mapping ? effect.power * mapping.sign : effect.power;

  const states = playerState.states.map((state) =>
    state.key === targetStateKey ? { ...state, value: clampStateValue(state, state.value + signedPower) } : state
  );
  return { ...playerState, states, activeEffects: [...playerState.activeEffects, effect] };
}
