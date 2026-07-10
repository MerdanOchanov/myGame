import { BiologicalState, ActiveEffect, BIOLOGICAL_STATE_TEMPLATES } from '../player/PlayerState';

// Verbatim from TZ.md §9 (+ player-assignable name).
export interface LabRat {
  id: string;
  ownerPlayerId: string;
  name: string;
  state: BiologicalState[];
  activeEffects: ActiveEffect[];
  alive: boolean;
  createdAt: string;
}

export const MAX_RAT_NAME_LENGTH = 24;

export function sanitizeRatName(name: string, fallback: string): string {
  const trimmed = (name ?? '').trim().slice(0, MAX_RAT_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function createLabRat(id: string, ownerPlayerId: string, name: string, now: Date = new Date()): LabRat {
  return {
    id,
    ownerPlayerId,
    name,
    state: BIOLOGICAL_STATE_TEMPLATES.map((t) => ({ key: t.key, value: t.initial, min: t.min, max: t.max })),
    activeEffects: [],
    alive: true,
    createdAt: now.toISOString(),
  };
}
