import { createPlayer } from '../core/player/Player';
import { createInitialPlayerState } from '../core/player/PlayerState';
import { startSurvivalRun } from '../core/player/SurvivalRun';
import { createStarterRats, MIN_RATS } from '../core/lab/RatStateService';
import { db, getOrCreateInventory } from './db';
import { PlayerSession } from './types';

// Stands in for Supabase Auth (email+OAuth) this session — trivial
// deviceId-keyed identity, per the mock-backend scope decision.
export async function createOrResumeSession(deviceId: string, now: Date = new Date()): Promise<PlayerSession> {
  let playerId = db.devices.get(deviceId);

  if (!playerId) {
    const player = createPlayer(`player_${deviceId}`, now);
    playerId = player.id;
    db.devices.set(deviceId, playerId);
    db.players.set(playerId, player);
    db.playerStates.set(playerId, createInitialPlayerState(playerId));
    db.survivalRuns.set(playerId, startSurvivalRun(playerId, now));
    getOrCreateInventory(playerId);

    // Минимум 3 крысы на старте (TZ §21: минимально выдаваемое количество).
    const starterRats = createStarterRats(playerId, MIN_RATS, 1, now);
    db.ratsByPlayerId.set(playerId, starterRats);
    for (const rat of starterRats) db.ratsById.set(rat.id, rat);
    db.lastFreeRatGrantByPlayerId.set(playerId, now.toISOString());
  }

  const playerState = db.playerStates.get(playerId)!;
  const survivalRun = db.survivalRuns.get(playerId)!;
  const home = db.homesByPlayerId.get(playerId);

  return { playerId, playerState, survivalRun, home };
}
