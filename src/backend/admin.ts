import { Biome, RGB, BiomeType, clampCollectInterval } from '../core/biome/Biome';
import { createBiomeOnBlocks, AdminBiomeError } from '../core/biome/BiomeService';
import { generateMaterialPool } from '../core/materials/MaterialGenerator';
import {
  GameEvent, clampEventRadiusKm, clampEventSeverity,
} from '../core/events/GameEvent';
import { fnv1aHash } from '../core/shared/Random';
import { db, biomeRepository, materialRepository } from './db';
import { AdminPlayerSummary, AdminMedicineSummary, AdminMaterialSummary } from './types';

const WORLD_SEED = 'scientists-world-v1';

export type AdminError =
  | AdminBiomeError | 'admin_forbidden' | 'unknown_biome' | 'no_biomes' | 'unknown_event';

function ok(password: string): boolean {
  return Boolean(password);
}

export interface AdminBiomeSpec {
  blockIds: string[];
  dominantColor: RGB;
}

export interface AdminBatchResult {
  biomesCreated: number;
  blocksCovered: number;
  materialsTotal: number;
  typeCounts: Partial<Record<BiomeType, number>>;
}

// Mock stand-in for the Edge Function's ADMIN_PASSWORD secret: any
// non-empty password is accepted in local/mock mode.
//
// Создаёт пачку биомов, разбросанных клиентом по выбранному участку.
// Каждый биом — связная группа блоков со своим преобладающим цветом.
export async function adminGenerateBiomes(
  _playerId: string,
  payload: { biomes: AdminBiomeSpec[]; collectIntervalSec: number; password: string }
): Promise<AdminBatchResult | AdminError> {
  if (!payload.password) return 'admin_forbidden';
  if (!payload.biomes?.length) return 'no_biomes';

  // Блоки не должны пересекаться между биомами в пачке.
  const seen = new Set<string>();
  for (const spec of payload.biomes) {
    for (const blockId of spec.blockIds) {
      if (seen.has(blockId)) return 'blocks_taken';
      seen.add(blockId);
    }
  }

  const result: AdminBatchResult = { biomesCreated: 0, blocksCovered: 0, materialsTotal: 0, typeCounts: {} };
  for (const spec of payload.biomes) {
    const biome = createBiomeOnBlocks(biomeRepository, spec.blockIds, spec.dominantColor, payload.collectIntervalSec);
    if (typeof biome === 'string') return biome;

    const pool = generateMaterialPool(biome.id, biome.type, WORLD_SEED);
    for (const material of pool) materialRepository.save(material);

    result.biomesCreated++;
    result.blocksCovered += biome.blockIds.length;
    result.materialsTotal += pool.length;
    result.typeCounts[biome.type] = (result.typeCounts[biome.type] ?? 0) + 1;
  }

  return result;
}

export async function adminSetCollectInterval(
  _playerId: string,
  payload: { biomeId: string; collectIntervalSec: number; password: string }
): Promise<Biome | AdminError> {
  if (!payload.password) return 'admin_forbidden';

  const biome = db.biomesById.get(payload.biomeId);
  if (!biome) return 'unknown_biome';

  biome.collectIntervalSec = clampCollectInterval(payload.collectIntervalSec);
  return biome;
}

// ---------------------------------------------------------- rat-test timeout
export async function adminSetRatTestInterval(
  _playerId: string,
  payload: { intervalSec: number; password: string }
): Promise<{ ratTestIntervalSec: number } | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  db.ratTestIntervalSec = clampCollectInterval(payload.intervalSec); // тот же диапазон 1..3600
  return { ratTestIntervalSec: db.ratTestIntervalSec };
}

export async function adminClearBiomes(
  _playerId: string,
  payload: { password: string }
): Promise<{ deletedBiomes: number } | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  const count = db.biomesById.size;
  db.biomesById.clear();
  db.biomesByBlockId.clear();
  db.materialPoolsByBiomeId.clear();
  db.materialsById.clear();
  // Материалы удалены — убираем их стеки из инвентарей (лекарства остаются).
  for (const inv of db.inventories.values()) {
    inv.materials = inv.materials.filter((s) => db.materialsById.has(s.itemId));
  }
  return { deletedBiomes: count };
}

// ------------------------------------------------------------------- events
export async function adminCreateEvent(
  playerId: string,
  payload: { lat: number; lng: number; radiusKm: number; severity: number; password: string }
): Promise<GameEvent | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  const now = new Date();
  const seed = `event_${fnv1aHash(`${payload.lat},${payload.lng},${now.getTime()}`).toString(36)}`;
  const event: GameEvent = {
    id: seed,
    basePosition: { lat: payload.lat, lng: payload.lng },
    radiusKm: clampEventRadiusKm(payload.radiusKm),
    seed,
    severity: clampEventSeverity(payload.severity),
    createdAt: now.toISOString(),
  };
  db.eventsById.set(event.id, event);
  void playerId;
  return event;
}

export async function adminDeleteEvent(
  _playerId: string,
  payload: { eventId: string; password: string }
): Promise<{ deleted: string } | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  if (!db.eventsById.has(payload.eventId)) return 'unknown_event';
  db.eventsById.delete(payload.eventId);
  return { deleted: payload.eventId };
}

// ------------------------------------------------------------- read panels
export async function adminListPlayers(
  _playerId: string,
  payload: { password: string }
): Promise<AdminPlayerSummary[] | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  const now = Date.now();
  return [...db.players.values()].map((p) => {
    const run = db.survivalRuns.get(p.id);
    const state = db.playerStates.get(p.id);
    const health = state?.states.find((s) => s.key === 'health')?.value ?? 0;
    const startedAt = run ? new Date(run.startedAt).getTime() : now;
    return {
      playerId: p.id,
      survivedDays: Math.floor((now - startedAt) / 86400000),
      hasHome: db.homesByPlayerId.has(p.id),
      health: Math.round(health),
      alive: run?.alive ?? true,
    };
  });
}

export async function adminListMedicines(
  _playerId: string,
  payload: { password: string }
): Promise<AdminMedicineSummary[] | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  return [...db.medicinesById.values()].map((m) => ({
    id: m.id,
    name: m.name,
    creatorPlayerId: m.creatorPlayerId,
    knownEffects: m.knownEffects.length,
    hiddenEffects: m.hiddenEffects.length,
    createdAt: m.createdAt,
  }));
}

export async function adminListMaterials(
  _playerId: string,
  payload: { password: string }
): Promise<AdminMaterialSummary[] | AdminError> {
  if (!ok(payload.password)) return 'admin_forbidden';
  return [...db.materialsById.values()].map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    biomeType: m.biomeType,
  }));
}
