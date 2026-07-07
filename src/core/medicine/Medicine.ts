import { ActiveEffect } from '../player/PlayerState';

// Verbatim from TZ.md §10.
export interface Medicine {
  id: string;
  name: string;
  creatorPlayerId: string;
  inputMaterialIds: string[];
  generationSeed: string;
  knownEffects: ActiveEffect[];
  hiddenEffects: ActiveEffect[];
  successChance: number;
  stabilityPercent: number;
  createdAt: string;
}
