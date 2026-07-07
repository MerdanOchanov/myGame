import { LaboratoryHome, canClaim, canTransfer, createHome } from './LaboratoryHome';

// Kept backend-agnostic (ARCHITECTURE §6): operates against a small
// repository shape rather than a concrete database, so the mock backend and
// a future real backend can both implement it.
export interface HomeRepository {
  getByHexCellId(hexCellId: string): LaboratoryHome | undefined;
  getByPlayerId(playerId: string): LaboratoryHome | undefined;
  save(home: LaboratoryHome): void;
  remove(hexCellId: string): void;
}

export type HomeClaimError = 'hex_occupied' | 'player_already_has_home' | 'no_existing_home' | 'transfer_cooldown';

export function claimHome(
  repo: HomeRepository,
  playerId: string,
  hexCellId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome | HomeClaimError {
  const existingAtHex = repo.getByHexCellId(hexCellId);
  const playerHome = repo.getByPlayerId(playerId);
  if (!canClaim(existingAtHex, !!playerHome)) {
    return existingAtHex ? 'hex_occupied' : 'player_already_has_home';
  }

  const home = createHome(`home_${playerId}`, playerId, hexCellId, position, now);
  repo.save(home);
  return home;
}

export function transferHome(
  repo: HomeRepository,
  playerId: string,
  destinationHexCellId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome | HomeClaimError {
  const currentHome = repo.getByPlayerId(playerId);
  if (!currentHome) return 'no_existing_home';

  const destination = repo.getByHexCellId(destinationHexCellId);
  if (!canTransfer(currentHome, destination, now)) {
    return destination ? 'hex_occupied' : 'transfer_cooldown';
  }

  const moved: LaboratoryHome = { ...currentHome, hexCellId: destinationHexCellId, position, claimedAt: now.toISOString() };
  repo.save(moved);
  return moved;
}

/** Called by event resolution (TZ §21: only global/regional events reset homes). Frees the hex cell. */
export function resetHome(repo: HomeRepository, home: LaboratoryHome): void {
  repo.remove(home.hexCellId);
}
