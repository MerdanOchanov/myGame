import { craftMedicine as craftMedicineService, CraftError } from '../core/medicine/MedicineCraftingService';
import { isPlayerInOwnHome } from '../core/home/LaboratoryHome';
import { applyEffectToState } from '../core/player/PlayerState';
import { Material } from '../core/materials/Material';
import { GeoProofWithMode } from '../core/geo/GeoPosition';
import { db, removeMaterialsFromInventory, addMedicineToInventory, removeMedicineFromInventory } from './db';
import { resolveHex, GeoError } from './geo';
import { ApplyMedicineResult } from './types';
import { Medicine } from '../core/medicine/Medicine';

export type MedicineCraftError = GeoError | CraftError | 'no_home' | 'not_in_own_home' | 'unknown_material';
export type ApplyMedicineError = 'not_owned';

export async function craftMedicine(
  playerId: string,
  materialIds: string[],
  proofWithMode: GeoProofWithMode
): Promise<Medicine | MedicineCraftError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  const home = db.homesByPlayerId.get(playerId);
  if (!home) return 'no_home';
  if (!isPlayerInOwnHome(home, cell.id)) return 'not_in_own_home';

  const materials: Material[] = [];
  for (const id of materialIds) {
    const material = db.materialsById.get(id);
    if (!material) return 'unknown_material';
    materials.push(material);
  }

  const result = craftMedicineService(materials, playerId, home.level);
  if (typeof result === 'string') return result;

  if (!removeMaterialsFromInventory(playerId, materialIds)) return 'insufficient_materials';

  db.medicinesById.set(result.id, result);
  addMedicineToInventory(playerId, result.id, 1);
  return result;
}

export async function applyMedicine(playerId: string, medicineId: string): Promise<ApplyMedicineResult | ApplyMedicineError> {
  const medicine = db.medicinesById.get(medicineId);
  const inventory = db.inventories.get(playerId);
  const owns = inventory?.medicines.some((s) => s.itemId === medicineId && s.quantity > 0);
  if (!medicine || !owns) return 'not_owned';

  const allEffects = [...medicine.knownEffects, ...medicine.hiddenEffects];
  let playerState = db.playerStates.get(playerId)!;
  for (const effect of allEffects) {
    playerState = applyEffectToState(playerState, effect);
  }
  db.playerStates.set(playerId, playerState);
  removeMedicineFromInventory(playerId, medicineId, 1);

  return { appliedEffects: allEffects, playerState };
}
