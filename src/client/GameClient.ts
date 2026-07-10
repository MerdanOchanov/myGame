import * as mockBackend from '../backend';
import * as remoteBackend from '../backendRemote';
import { GeoProof, GeoProofWithMode, PositionMode } from '../core/geo/GeoPosition';
import { HexCell } from '../core/geo/HexCell';

// When Supabase env vars are present the remote backend (game-api Edge
// Function) is used; otherwise the in-memory mock keeps local dev and the
// no-env Vercel deploy fully playable.
const backend = remoteBackend.isConfigured() ? remoteBackend : mockBackend;
export const usingRemoteBackend = remoteBackend.isConfigured();

const DEVICE_ID_STORAGE_KEY = 'scientists-world:deviceId';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  }
  return id;
}

// Sole seam UI/render code talks to. Turns navigator.geolocation and debug
// map clicks into GeoProofWithMode, and holds the session id.
export class GameClient {
  private playerId: string | null = null;
  private mode: PositionMode = 'debug';
  private debugPosition: { lat: number; lng: number } | null = null;
  private listeners = new Set<() => void>();

  async init(): Promise<mockBackend.PlayerSession> {
    const session = await backend.createOrResumeSession(getOrCreateDeviceId());
    this.playerId = session.playerId;
    return session;
  }

  get currentPlayerId(): string {
    if (!this.playerId) throw new Error('GameClient not initialized — call init() first');
    return this.playerId;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  getMode(): PositionMode {
    return this.mode;
  }

  setMode(mode: PositionMode): void {
    this.mode = mode;
    this.notify();
  }

  setDebugPosition(lat: number, lng: number): void {
    this.debugPosition = { lat, lng };
    this.notify();
  }

  private async getBrowserPosition(): Promise<{ lat: number; lng: number; accuracyMeters: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation API unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyMeters: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  private async currentProof(now: Date = new Date()): Promise<GeoProofWithMode> {
    if (this.mode === 'debug') {
      if (!this.debugPosition) throw new Error('Debug mode is on but no debug position has been set — click the map');
      const proof: GeoProof = { lat: this.debugPosition.lat, lng: this.debugPosition.lng, accuracyMeters: 1, capturedAt: now.toISOString() };
      return { proof, mode: 'debug' };
    }

    const pos = await this.getBrowserPosition();
    const proof: GeoProof = { lat: pos.lat, lng: pos.lng, accuracyMeters: pos.accuracyMeters, capturedAt: now.toISOString() };
    return { proof, mode: 'production' };
  }

  async resolveHex(): Promise<HexCell | mockBackend.GeoError> {
    return backend.resolveHex(this.currentPlayerId, await this.currentProof());
  }

  async claimHome() {
    return backend.claimHome(this.currentPlayerId, await this.currentProof());
  }

  async transferHome() {
    return backend.transferHome(this.currentPlayerId, await this.currentProof());
  }

  async getMapLayers(viewBounds?: mockBackend.ViewBounds) {
    return backend.getMapLayers(this.currentPlayerId, await this.currentProof(), viewBounds);
  }

  async adminGenerateBiomes(
    biomes: { blockIds: string[]; dominantColor: { r: number; g: number; b: number } }[],
    collectIntervalSec: number,
    password: string
  ) {
    return backend.adminGenerateBiomes(this.currentPlayerId, { biomes, collectIntervalSec, password });
  }

  async adminSetCollectInterval(biomeId: string, collectIntervalSec: number, password: string) {
    return backend.adminSetCollectInterval(this.currentPlayerId, { biomeId, collectIntervalSec, password });
  }

  async adminSetRatTestInterval(intervalSec: number, password: string) {
    return backend.adminSetRatTestInterval(this.currentPlayerId, { intervalSec, password });
  }

  async adminCreateEvent(lat: number, lng: number, radiusKm: number, severity: number, password: string) {
    return backend.adminCreateEvent(this.currentPlayerId, { lat, lng, radiusKm, severity, password });
  }

  async adminDeleteEvent(eventId: string, password: string) {
    return backend.adminDeleteEvent(this.currentPlayerId, { eventId, password });
  }

  async adminListPlayers(password: string) {
    return backend.adminListPlayers(this.currentPlayerId, { password });
  }

  async adminListMedicines(password: string) {
    return backend.adminListMedicines(this.currentPlayerId, { password });
  }

  async adminListMaterials(password: string) {
    return backend.adminListMaterials(this.currentPlayerId, { password });
  }

  async collectMaterial() {
    return backend.collectMaterial(this.currentPlayerId, await this.currentProof());
  }

  async getInventory() {
    return backend.getInventory(this.currentPlayerId);
  }

  async craftMedicine(materialIds: string[], desiredName?: string) {
    return backend.craftMedicine(this.currentPlayerId, materialIds, await this.currentProof(), desiredName);
  }

  async applyMedicine(medicineId: string) {
    return backend.applyMedicine(this.currentPlayerId, medicineId);
  }

  async getRats() {
    return backend.getRats(this.currentPlayerId);
  }

  async renameRat(ratId: string, name: string) {
    return backend.renameRat(this.currentPlayerId, ratId, name);
  }

  async testMedicineOnRat(medicineId: string, ratId: string) {
    return backend.testMedicineOnRat(this.currentPlayerId, medicineId, ratId);
  }
}
