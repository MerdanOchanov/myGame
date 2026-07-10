// Barrel export — the only module client/render code should import for
// state-changing calls (ARCHITECTURE §2: client is never source of truth).
export * from './types';
export { createOrResumeSession } from './session';
export { resolveHex } from './geo';
export type { GeoError } from './geo';
export { claimHome, transferHome, getMapLayers } from './home';
export { collectMaterial, getInventory } from './materials';
export type { CollectError } from './materials';
export {
  adminGenerateBiomes, adminSetCollectInterval, adminSetRatTestInterval,
  adminCreateEvent, adminDeleteEvent, adminListPlayers, adminListMedicines, adminListMaterials,
} from './admin';
export type { AdminError, AdminBiomeSpec, AdminBatchResult } from './admin';
export { craftMedicine, applyMedicine } from './medicine';
export type { MedicineCraftError, ApplyMedicineError } from './medicine';
export { getRats, testMedicineOnRat, renameRat } from './lab';
export type { LabTestError, RenameRatError } from './lab';
