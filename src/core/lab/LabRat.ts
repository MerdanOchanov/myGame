import { BiologicalState, ActiveEffect, BIOLOGICAL_STATE_TEMPLATES } from '../player/PlayerState';

// Verbatim from TZ.md §9.
export interface LabRat {
  id: string;
  ownerPlayerId: string;
  state: BiologicalState[];
  activeEffects: ActiveEffect[];
  alive: boolean;
  createdAt: string;
}

export function createLabRat(id: string, ownerPlayerId: string, now: Date = new Date()): LabRat {
  return {
    id,
    ownerPlayerId,
    state: BIOLOGICAL_STATE_TEMPLATES.map((t) => ({ key: t.key, value: t.initial, min: t.min, max: t.max })),
    activeEffects: [],
    alive: true,
    createdAt: now.toISOString(),
  };
}
