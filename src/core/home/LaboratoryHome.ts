import { HEX_DIAMETER_METERS } from '../geo/HexCell';

// Verbatim from TZ.md §5.
export interface LaboratoryHome {
  id: string;
  playerId: string;
  hexCellId: string;
  position: { lat: number; lng: number };
  claimedAt: string;
  diameterMeters: 50;
  level: number;
}

// Free transfer with a cooldown (TZ §21). `claimedAt` doubles as "last
// (re)claimed at" so the interface doesn't need an extra field beyond what
// TZ.md specifies verbatim.
export const HOME_TRANSFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function canClaim(existingHomeAtHex: LaboratoryHome | undefined, playerAlreadyHasHome: boolean): boolean {
  return !existingHomeAtHex && !playerAlreadyHasHome;
}

export function canTransfer(
  currentHome: LaboratoryHome,
  destinationHomeAtHex: LaboratoryHome | undefined,
  now: Date = new Date()
): boolean {
  if (destinationHomeAtHex) return false;
  const elapsedMs = now.getTime() - new Date(currentHome.claimedAt).getTime();
  return elapsedMs >= HOME_TRANSFER_COOLDOWN_MS;
}

export function isPlayerInOwnHome(home: LaboratoryHome, playerHexCellId: string): boolean {
  return home.hexCellId === playerHexCellId;
}

export function createHome(
  id: string,
  playerId: string,
  hexCellId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome {
  return {
    id,
    playerId,
    hexCellId,
    position,
    claimedAt: now.toISOString(),
    diameterMeters: HEX_DIAMETER_METERS,
    level: 1,
  };
}
