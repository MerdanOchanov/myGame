import { createPlayer } from '../core/player/Player';
import { createInitialPlayerState } from '../core/player/PlayerState';
import { startSurvivalRun } from '../core/player/SurvivalRun';
import { createStarterRat } from '../core/lab/RatStateService';
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

    // Starter rat auto-granted at bootstrap (flagged: TZ §16 step 12 never
    // states how the player's first rat appears).
    const starterRat = createStarterRat(playerId, now);
    db.ratsByPlayerId.set(playerId, [starterRat]);
    db.ratsById.set(starterRat.id, starterRat);
    db.lastFreeRatGrantByPlayerId.set(playerId, now.toISOString());
  }

  const playerState = db.playerStates.get(playerId)!;
  const survivalRun = db.survivalRuns.get(playerId)!;
  const home = db.homesByPlayerId.get(playerId);

  return { playerId, playerState, survivalRun, home };
}
