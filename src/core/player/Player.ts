// Player account (ARCHITECTURE §10 aggregate). Deliberately thin — no game
// state lives here; see PlayerState.ts and SurvivalRun.ts for that.
export interface Player {
  id: string;
  createdAt: string;
}

export function createPlayer(id: string, now: Date = new Date()): Player {
  return { id, createdAt: now.toISOString() };
}
