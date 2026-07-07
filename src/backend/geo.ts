import { resolveHexCell } from '../core/geo/HexGrid';
import { GeoProofWithMode, validateGeoProof } from '../core/geo/GeoPosition';
import { HexCell } from '../core/geo/HexCell';
import { db } from './db';

export type GeoError = 'accuracy' | 'stale_timestamp' | 'implausible_speed';

export async function resolveHex(playerId: string, proofWithMode: GeoProofWithMode): Promise<HexCell | GeoError> {
  const previousProof = db.lastGeoProofByPlayerId.get(playerId);
  const validation = validateGeoProof(proofWithMode, previousProof);
  if (!validation.valid) return validation.reason!;

  db.lastGeoProofByPlayerId.set(playerId, proofWithMode.proof);

  const cell = resolveHexCell(proofWithMode.proof.lat, proofWithMode.proof.lng);
  const home = db.homesByHexCellId.get(cell.id);
  const biome = db.biomesByHexCellId.get(cell.id);
  return { ...cell, ownerPlayerId: home?.playerId, biomeId: biome?.id };
}
