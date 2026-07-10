import { ActiveEffect, applyEffectToState, PlayerState } from '../player/PlayerState';
import { createLabRat, LabRat } from './LabRat';

export const FREE_RAT_DRIP_INTERVAL_MS = 24 * 60 * 60 * 1000; // TZ §21: free periodic drip
export const MIN_RATS = 3; // минимально выдаваемое количество крыс

// Создаёт `count` крыс с последовательными именами «Крыса N» (N — от startIndex).
export function createStarterRats(playerId: string, count: number, startIndex = 1, now: Date = new Date()): LabRat[] {
  const rats: LabRat[] = [];
  for (let i = 0; i < count; i++) {
    const n = startIndex + i;
    rats.push(createLabRat(`rat_${playerId}_${now.getTime()}_${n}`, playerId, `Крыса ${n}`, now));
  }
  return rats;
}

export function createStarterRat(playerId: string, name: string, now: Date = new Date()): LabRat {
  return createLabRat(`rat_${playerId}_${now.getTime()}`, playerId, name, now);
}

export function isFreeRatDue(lastGrantedAt: string | undefined, now: Date = new Date()): boolean {
  if (!lastGrantedAt) return true;
  return now.getTime() - new Date(lastGrantedAt).getTime() >= FREE_RAT_DRIP_INTERVAL_MS;
}

/** Applies a medicine effect to a rat's biological state and rolls a death chance (live, non-reproducible event). */
export function applyEffectToRat(rat: LabRat, effect: ActiveEffect): LabRat {
  if (!rat.alive) return rat;

  // Reuse the same state-application math as PlayerState — LabRat.state
  // shares the BiologicalState shape.
  const asPlayerState: PlayerState = { playerId: rat.ownerPlayerId, states: rat.state, activeEffects: rat.activeEffects };
  const updated = applyEffectToState(asPlayerState, effect);

  const health = updated.states.find((s) => s.key === 'health');
  const poison = updated.states.find((s) => s.key === 'poison');
  const dead = (health !== undefined && health.value <= 0) || (poison !== undefined && poison.value >= 100 && Math.random() < 0.5);

  return { ...rat, state: updated.states, activeEffects: updated.activeEffects, alive: !dead };
}
