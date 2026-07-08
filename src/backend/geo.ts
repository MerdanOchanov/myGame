import { resolveHexCell, blockIdOf } from '../core/geo/HexGrid';
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
  const blockId = blockIdOf(cell.id);
  const home = db.homesByBlockId.get(blockId);
  const biome = db.biomesByBlockId.get(blockId);
  return { ...cell, blockId, ownerPlayerId: home?.playerId, biomeId: biome?.id };
}
