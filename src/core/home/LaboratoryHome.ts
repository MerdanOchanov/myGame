// A home occupies one whole block: an H3 res-11 cell = 7 res-12 game cells
// (the honeycomb, TZ §5).
export interface LaboratoryHome {
  id: string;
  playerId: string;
  blockId: string;
  position: { lat: number; lng: number };
  claimedAt: string;
  level: number;
}

// Free transfer with a cooldown (TZ §21). `claimedAt` doubles as "last
// (re)claimed at".
export const HOME_TRANSFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function canClaim(existingHomeAtBlock: LaboratoryHome | undefined, playerAlreadyHasHome: boolean): boolean {
  return !existingHomeAtBlock && !playerAlreadyHasHome;
}

export function canTransfer(
  currentHome: LaboratoryHome,
  destinationHomeAtBlock: LaboratoryHome | undefined,
  now: Date = new Date()
): boolean {
  if (destinationHomeAtBlock) return false;
  const elapsedMs = now.getTime() - new Date(currentHome.claimedAt).getTime();
  return elapsedMs >= HOME_TRANSFER_COOLDOWN_MS;
}

export function isPlayerInOwnHome(home: LaboratoryHome, playerBlockId: string): boolean {
  return home.blockId === playerBlockId;
}

export function createHome(
  id: string,
  playerId: string,
  blockId: string,
  position: { lat: number; lng: number },
  now: Date = new Date()
): LaboratoryHome {
  return {
    id,
    playerId,
    blockId,
    position,
    claimedAt: now.toISOString(),
    level: 1,
  };
}
