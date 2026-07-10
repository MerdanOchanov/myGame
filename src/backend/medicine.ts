import { craftMedicine as craftMedicineService, CraftError } from '../core/medicine/MedicineCraftingService';
import { isPlayerInOwnHome } from '../core/home/LaboratoryHome';
import { blockIdOf } from '../core/geo/HexGrid';
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
  proofWithMode: GeoProofWithMode,
  desiredName?: string
): Promise<Medicine | MedicineCraftError> {
  const cell = await resolveHex(playerId, proofWithMode);
  if (typeof cell === 'string') return cell;

  const home = db.homesByPlayerId.get(playerId);
  if (!home) return 'no_home';
  if (!isPlayerInOwnHome(home, blockIdOf(cell.id))) return 'not_in_own_home';

  const materials: Material[] = [];
  for (const id of materialIds) {
    const material = db.materialsById.get(id);
    if (!material) return 'unknown_material';
    materials.push(material);
  }

  const result = craftMedicineService(materials, playerId, home.level, desiredName);
  if (typeof result === 'string') return result;

  if (!removeMaterialsFromInventory(playerId, materialIds)) return 'insufficient_materials';

  // Право первооткрывателя: имя/автор закрепляются только при первом создании
  // рецепта; повторный крафт другими возвращает существующее лекарство.
  const existing = db.medicinesById.get(result.id);
  const medicine = existing ?? result;
  if (!existing) db.medicinesById.set(result.id, result);
  addMedicineToInventory(playerId, medicine.id, 1);
  return medicine;
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
