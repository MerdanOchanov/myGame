import { claimHome as claimHomeService, transferHome as transferHomeService, HomeClaimError } from '../core/home/HomeClaimService';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { getOrGenerateBiome } from '../core/biome/BiomeService';
import { haversineDistanceMeters } from '../core/geo/GeoDistance';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { MapLayers } from './types';
import { db, homeRepository, biomeRepository } from './db';
import { resolveHex, GeoError } from './geo';

const NEARBY_HOME_RADIUS_METERS = 1000; // ARCHITECTURE §3/§12

export async function claimHome(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;
  return claimHomeService(homeRepository, playerId, cell.id, cell.center);
}

export async function transferHome(
  playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;
  return transferHomeService(homeRepository, playerId, cell.id, cell.center);
}

export async function getMapLayers(playerId: string, proofWithMode: GeoProofWithMode): Promise<MapLayers | GeoError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  const biome = getOrGenerateBiome(biomeRepository, cell.id);
  const nearbyHomes = [...db.homesByPlayerId.values()].filter(
    (home) => haversineDistanceMeters(home.position, cell.center) <= NEARBY_HOME_RADIUS_METERS
  );

  return { playerHexCell: { ...cell, biomeId: biome.id }, biome, nearbyHomes };
}
