import { claimHome as claimHomeService, transferHome as transferHomeService, HomeClaimError } from '../core/home/HomeClaimService';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { blockIdOf, blockCenter } from '../core/geo/HexGrid';
import { haversineDistanceMeters } from '../core/geo/GeoDistance';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { MapLayers, ViewBounds } from './types';
import { db, homeRepository } from './db';
import { resolveHex, GeoError } from './geo';

const NEARBY_HOME_RADIUS_METERS = 1000; // ARCHITECTURE §3/§12

export async function claimHome(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;
  const blockId = blockIdOf(cell.id);
  return claimHomeService(homeRepository, playerId, blockId, blockCenter(blockId));
}

export async function transferHome(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;
  const blockId = blockIdOf(cell.id);
  return transferHomeService(homeRepository, playerId, blockId, blockCenter(blockId));
}

export async function getMapLayers(
  playerId: string,
  proofWithMode: GeoProofWithMode,
  viewBounds?: ViewBounds
): Promise<MapLayers | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  const blockId = blockIdOf(cell.id);
  const biome = db.biomesByBlockId.get(blockId);

  let biomes = [...db.biomesById.values()];
  if (viewBounds) {
    biomes = biomes.filter((b) =>
      b.blockIds.some((id) => {
        const c = blockCenter(id);
        return c.lat >= viewBounds.minLat && c.lat <= viewBounds.maxLat &&
          c.lng >= viewBounds.minLng && c.lng <= viewBounds.maxLng;
      })
    );
  }

  const nearbyHomes = [...db.homesByPlayerId.values()].filter(
    (home) => haversineDistanceMeters(home.position, cell.center) <= NEARBY_HOME_RADIUS_METERS
  );

  return {
    playerHexCell: { ...cell, blockId, biomeId: biome?.id },
    biome,
    biomes,
    nearbyHomes,
  };
}
