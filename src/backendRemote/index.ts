// Remote backend adapter: same API surface as src/backend (the in-memory
// mock), but every call goes to the `game-api` Supabase Edge Function where
// the actual game rules run. GameClient picks this implementation when
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are configured.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { HexCell } from '../core/geo/HexCell';
import { LaboratoryHome } from '../core/home/LaboratoryHome';
import { Medicine } from '../core/medicine/Medicine';
import { LabRat } from '../core/lab/LabRat';
import {
  PlayerSession, MapLayers, MaterialCollectionResult, InventoryView, ApplyMedicineResult, RatTestResult,
  RatsView, ViewBounds, AdminPlayerSummary, AdminMedicineSummary, AdminMaterialSummary,
} from '../backend/types';
import type { GeoError } from '../backend/geo';
import type { CollectError } from '../backend/materials';
import type { MedicineCraftError, ApplyMedicineError } from '../backend/medicine';
import type { LabTestError, RenameRatError } from '../backend/lab';
import type { AdminError, AdminBiomeSpec, AdminBatchResult } from '../backend/admin';
import type { HomeClaimError } from '../core/home/HomeClaimService';
import type { Biome } from '../core/biome/Biome';
import type { GameEvent } from '../core/events/GameEvent';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) throw new Error('Supabase env vars are not configured');
    client = createClient(url, anonKey);
  }
  return client;
}

async function ensureSignedIn(): Promise<string> {
  const sb = supabase();
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session) return sessionData.session.user.id;

  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Anonymous sign-in failed: ${error?.message ?? 'no user'}. ` +
      'Enable "Allow anonymous sign-ins" in Supabase Dashboard -> Authentication -> Settings.'
    );
  }
  return data.user.id;
}

async function invoke<T>(action: string, payload?: unknown): Promise<T | string> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke('game-api', { body: { action, payload } });
  if (error) throw new Error(`game-api ${action} failed: ${error.message}`);
  const response = data as { ok: boolean; data?: T; error?: string };
  if (!response.ok) return response.error ?? 'internal_error';
  return response.data as T;
}

// ------------------------------------------------------------- API surface

export async function createOrResumeSession(_deviceId: string): Promise<PlayerSession> {
  await ensureSignedIn();
  const result = await invoke<PlayerSession>('session');
  if (typeof result === 'string') throw new Error(`Session bootstrap failed: ${result}`);
  return result;
}

export async function resolveHex(_playerId: string, proofWithMode: GeoProofWithMode): Promise<HexCell | GeoError> {
  return invoke<HexCell>('resolveHex', proofWithMode) as Promise<HexCell | GeoError>;
}

export async function claimHome(
  _playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  return invoke<LaboratoryHome>('claimHome', proofWithMode) as Promise<LaboratoryHome | HomeClaimError | GeoError>;
}

export async function transferHome(
  _playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<LaboratoryHome | HomeClaimError | GeoError> {
  return invoke<LaboratoryHome>('transferHome', proofWithMode) as Promise<LaboratoryHome | HomeClaimError | GeoError>;
}

export async function getMapLayers(
  _playerId: string,
  proofWithMode: GeoProofWithMode,
  viewBounds?: ViewBounds
): Promise<MapLayers | GeoError> {
  return invoke<MapLayers>('mapLayers', { proofWithMode, viewBounds }) as Promise<MapLayers | GeoError>;
}

export async function adminGenerateBiomes(
  _playerId: string,
  payload: { biomes: AdminBiomeSpec[]; collectIntervalSec: number; password: string }
): Promise<AdminBatchResult | AdminError> {
  return invoke<AdminBatchResult>('adminGenerateBiomes', {
    ...payload,
    debug: false,
  }) as Promise<AdminBatchResult | AdminError>;
}

export async function adminSetCollectInterval(
  _playerId: string,
  payload: { biomeId: string; collectIntervalSec: number; password: string }
): Promise<Biome | AdminError> {
  return invoke<Biome>('adminSetCollectInterval', payload) as Promise<Biome | AdminError>;
}

export async function adminSetRatTestInterval(
  _playerId: string,
  payload: { intervalSec: number; password: string }
): Promise<{ ratTestIntervalSec: number } | AdminError> {
  return invoke<{ ratTestIntervalSec: number }>('adminSetRatTestInterval', payload) as Promise<{ ratTestIntervalSec: number } | AdminError>;
}

export async function adminCreateEvent(
  _playerId: string,
  payload: { lat: number; lng: number; radiusKm: number; severity: number; password: string }
): Promise<GameEvent | AdminError> {
  return invoke<GameEvent>('adminCreateEvent', payload) as Promise<GameEvent | AdminError>;
}

export async function adminDeleteEvent(
  _playerId: string,
  payload: { eventId: string; password: string }
): Promise<{ deleted: string } | AdminError> {
  return invoke<{ deleted: string }>('adminDeleteEvent', payload) as Promise<{ deleted: string } | AdminError>;
}

export async function adminListPlayers(
  _playerId: string,
  payload: { password: string }
): Promise<AdminPlayerSummary[] | AdminError> {
  return invoke<AdminPlayerSummary[]>('adminListPlayers', payload) as Promise<AdminPlayerSummary[] | AdminError>;
}

export async function adminListMedicines(
  _playerId: string,
  payload: { password: string }
): Promise<AdminMedicineSummary[] | AdminError> {
  return invoke<AdminMedicineSummary[]>('adminListMedicines', payload) as Promise<AdminMedicineSummary[] | AdminError>;
}

export async function adminListMaterials(
  _playerId: string,
  payload: { password: string }
): Promise<AdminMaterialSummary[] | AdminError> {
  return invoke<AdminMaterialSummary[]>('adminListMaterials', payload) as Promise<AdminMaterialSummary[] | AdminError>;
}

export async function collectMaterial(
  _playerId: string,
  proofWithMode: GeoProofWithMode
): Promise<MaterialCollectionResult | CollectError> {
  return invoke<MaterialCollectionResult>('collectMaterial', proofWithMode) as Promise<MaterialCollectionResult | CollectError>;
}

export async function getInventory(_playerId: string): Promise<InventoryView> {
  const result = await invoke<InventoryView>('getInventory');
  if (typeof result === 'string') throw new Error(`Inventory fetch failed: ${result}`);
  return result;
}

export async function craftMedicine(
  _playerId: string,
  materialIds: string[],
  proofWithMode: GeoProofWithMode,
  desiredName?: string
): Promise<Medicine | MedicineCraftError> {
  return invoke<Medicine>('craftMedicine', { materialIds, proofWithMode, desiredName }) as Promise<Medicine | MedicineCraftError>;
}

export async function applyMedicine(
  _playerId: string,
  medicineId: string
): Promise<ApplyMedicineResult | ApplyMedicineError> {
  return invoke<ApplyMedicineResult>('applyMedicine', { medicineId }) as Promise<ApplyMedicineResult | ApplyMedicineError>;
}

export async function getRats(_playerId: string): Promise<RatsView> {
  const result = await invoke<RatsView>('getRats');
  if (typeof result === 'string') throw new Error(`Rats fetch failed: ${result}`);
  return result;
}

export async function renameRat(
  _playerId: string,
  ratId: string,
  name: string
): Promise<LabRat | RenameRatError> {
  return invoke<LabRat>('renameRat', { ratId, name }) as Promise<LabRat | RenameRatError>;
}

export async function testMedicineOnRat(
  _playerId: string,
  medicineId: string,
  ratId: string
): Promise<RatTestResult | LabTestError> {
  return invoke<RatTestResult>('testRat', { medicineId, ratId }) as Promise<RatTestResult | LabTestError>;
}
