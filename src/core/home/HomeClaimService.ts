import { LaboratoryHome, canClaim, canTransfer, createHome } from './LaboratoryHome';

// Kept backend-agnostic (ARCHITECTURE §6): operates against a small
// repository shape rather than a concrete database, so the mock backend and
// a future real backend can both implement it.
export interface HomeRepository {
  getByBlockId(blockId: string): LaboratoryHome | undefined;
  getByPlayerId(playerId: string): LaboratoryHome | undefined;
  save(home: LaboratoryHome): void;
  remove(blockId: string): void;
}

export type HomeClaimError = 'block_occupied' | 'player_already_has_home' | 'no_existing_home' | 'transfer_cooldown';

export function claimHome(
  repo: HomeRepository,
  playerId: string,
  blockId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome | HomeClaimError {
  const existingAtBlock = repo.getByBlockId(blockId);
  const playerHome = repo.getByPlayerId(playerId);
  if (!canClaim(existingAtBlock, !!playerHome)) {
    return existingAtBlock ? 'block_occupied' : 'player_already_has_home';
  }

  const home = createHome(`home_${playerId}`, playerId, blockId, position, now);
  repo.save(home);
  return home;
}

export function transferHome(
  repo: HomeRepository,
  playerId: string,
  destinationBlockId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome | HomeClaimError {
  const currentHome = repo.getByPlayerId(playerId);
  if (!currentHome) return 'no_existing_home';

  const destination = repo.getByBlockId(destinationBlockId);
  if (!canTransfer(currentHome, destination, now)) {
    return destination ? 'block_occupied' : 'transfer_cooldown';
  }

  repo.remove(currentHome.blockId);
  const moved: LaboratoryHome = { ...currentHome, blockId: destinationBlockId, position, claimedAt: now.toISOString() };
  repo.save(moved);
  return moved;
}

/** Called by event resolution (TZ §21: only global/regional events reset homes). Frees the block. */
export function resetHome(repo: HomeRepository, home: LaboratoryHome): void {
  repo.remove(home.blockId);
}
