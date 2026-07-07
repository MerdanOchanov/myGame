// Verbatim from TZ.md §14.
export interface SurvivalRun {
  playerId: string;
  startedAt: string;
  endedAt?: string;
  alive: boolean;
  survivedRealDays: number;
}

export function startSurvivalRun(playerId: string, now: Date = new Date()): SurvivalRun {
  return { playerId, startedAt: now.toISOString(), alive: true, survivedRealDays: 0 };
}

export function computeSurvivedRealDays(run: SurvivalRun, now: Date = new Date()): number {
  const endMs = run.endedAt ? new Date(run.endedAt).getTime() : now.getTime();
  const startMs = new Date(run.startedAt).getTime();
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
}

export function endSurvivalRun(run: SurvivalRun, now: Date = new Date()): SurvivalRun {
  const endedAt = now.toISOString();
  return {
    ...run,
    endedAt,
    alive: false,
    survivedRealDays: computeSurvivedRealDays({ ...run, endedAt }, now),
  };
}
