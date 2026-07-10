import { testMedicineOnRat as testMedicineOnRatService } from '../core/lab/ExperimentService';
import { createStarterRats, isFreeRatDue, MIN_RATS } from '../core/lab/RatStateService';
import { LabRat, sanitizeRatName } from '../core/lab/LabRat';
import { db, removeMedicineFromInventory } from './db';
import { RatTestResult, RatsView } from './types';

export type LabTestError = 'not_owned_medicine' | 'not_owned_rat' | 'rat_dead' | 'rat_test_cooldown';
export type RenameRatError = 'not_owned_rat';

const MEDICINE_CONSUME_CHANCE = 0.3; // испытание с 30% шансом расходует лекарство

export async function getRats(playerId: string, now: Date = new Date()): Promise<RatsView> {
  const rats = db.ratsByPlayerId.get(playerId) ?? [];

  // Free-drip: пополняем до минимума 3, когда наступил срок.
  const lastGrant = db.lastFreeRatGrantByPlayerId.get(playerId);
  if (isFreeRatDue(lastGrant, now) && rats.length < MIN_RATS) {
    const need = MIN_RATS - rats.length;
    const fresh = createStarterRats(playerId, need, rats.length + 1, now);
    for (const rat of fresh) db.ratsById.set(rat.id, rat);
    rats.push(...fresh);
    db.ratsByPlayerId.set(playerId, rats);
    db.lastFreeRatGrantByPlayerId.set(playerId, now.toISOString());
  }

  const lastTest = db.lastRatTestAtByPlayerId.get(playerId);
  const intervalMs = db.ratTestIntervalSec * 1000;
  let nextTestAt: string | undefined;
  if (lastTest) {
    const next = lastTest + intervalMs;
    if (next > now.getTime()) nextTestAt = new Date(next).toISOString();
  }

  return { rats, nextTestAt, testIntervalSec: db.ratTestIntervalSec };
}

export async function renameRat(
  playerId: string,
  ratId: string,
  name: string
): Promise<LabRat | RenameRatError> {
  const rat = db.ratsById.get(ratId);
  if (!rat || rat.ownerPlayerId !== playerId) return 'not_owned_rat';
  rat.name = sanitizeRatName(name, rat.name);
  db.ratsById.set(ratId, rat);
  const rats = db.ratsByPlayerId.get(playerId) ?? [];
  db.ratsByPlayerId.set(playerId, rats.map((r) => (r.id === ratId ? rat : r)));
  return rat;
}

export async function testMedicineOnRat(
  playerId: string,
  medicineId: string,
  ratId: string,
  now: Date = new Date()
): Promise<RatTestResult | LabTestError> {
  const medicine = db.medicinesById.get(medicineId);
  const inventory = db.inventories.get(playerId);
  const ownsMedicine = inventory?.medicines.some((s) => s.itemId === medicineId && s.quantity > 0);
  if (!medicine || !ownsMedicine) return 'not_owned_medicine';

  const rat = db.ratsById.get(ratId);
  if (!rat || rat.ownerPlayerId !== playerId) return 'not_owned_rat';
  if (!rat.alive) return 'rat_dead';

  // Таймаут испытаний (админ-управляемый).
  const lastTest = db.lastRatTestAtByPlayerId.get(playerId);
  const intervalMs = db.ratTestIntervalSec * 1000;
  if (lastTest && now.getTime() - lastTest < intervalMs) return 'rat_test_cooldown';

  const result = testMedicineOnRatService(playerId, medicine, rat, now);

  db.medicinesById.set(result.medicine.id, result.medicine);
  db.ratsById.set(result.rat.id, result.rat);
  const rats = db.ratsByPlayerId.get(playerId) ?? [];
  db.ratsByPlayerId.set(playerId, rats.map((r) => (r.id === result.rat.id ? result.rat : r)));
  db.experiments.push(result.experiment);

  // 30% шанс израсходовать 1 ед. лекарства.
  const medicineConsumed = Math.random() < MEDICINE_CONSUME_CHANCE;
  if (medicineConsumed) removeMedicineFromInventory(playerId, medicineId, 1);

  db.lastRatTestAtByPlayerId.set(playerId, now.getTime());

  return {
    revealedEffect: result.revealedEffect,
    ratAlive: result.rat.alive,
    rat: result.rat,
    medicineConsumed,
    nextTestAt: new Date(now.getTime() + intervalMs).toISOString(),
  };
}
