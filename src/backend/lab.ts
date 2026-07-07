import { testMedicineOnRat as testMedicineOnRatService } from '../core/lab/ExperimentService';
import { createStarterRat, isFreeRatDue } from '../core/lab/RatStateService';
import { LabRat } from '../core/lab/LabRat';
import { db } from './db';
import { RatTestResult } from './types';

export type LabTestError = 'not_owned_medicine' | 'not_owned_rat';

export async function getRats(playerId: string, now: Date = new Date()): Promise<LabRat[]> {
  const lastGrant = db.lastFreeRatGrantByPlayerId.get(playerId);
  if (isFreeRatDue(lastGrant, now)) {
    const rat = createStarterRat(playerId, now);
    const rats = db.ratsByPlayerId.get(playerId) ?? [];
    rats.push(rat);
    db.ratsByPlayerId.set(playerId, rats);
    db.ratsById.set(rat.id, rat);
    db.lastFreeRatGrantByPlayerId.set(playerId, now.toISOString());
  }
  return db.ratsByPlayerId.get(playerId) ?? [];
}

export async function testMedicineOnRat(
  playerId: string,
  medicineId: string,
  ratId: string
): Promise<RatTestResult | LabTestError> {
  const medicine = db.medicinesById.get(medicineId);
  const inventory = db.inventories.get(playerId);
  const ownsMedicine = inventory?.medicines.some((s) => s.itemId === medicineId && s.quantity > 0);
  if (!medicine || !ownsMedicine) return 'not_owned_medicine';

  const rat = db.ratsById.get(ratId);
  if (!rat || rat.ownerPlayerId !== playerId) return 'not_owned_rat';

  const result = testMedicineOnRatService(playerId, medicine, rat);

  db.medicinesById.set(result.medicine.id, result.medicine);
  db.ratsById.set(result.rat.id, result.rat);
  const rats = db.ratsByPlayerId.get(playerId) ?? [];
  db.ratsByPlayerId.set(
    playerId,
    rats.map((r) => (r.id === result.rat.id ? result.rat : r))
  );
  db.experiments.push(result.experiment);

  return { revealedEffect: result.revealedEffect, ratAlive: result.rat.alive, rat: result.rat };
}
