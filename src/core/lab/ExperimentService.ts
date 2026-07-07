import { Medicine } from '../medicine/Medicine';
import { ActiveEffect } from '../player/PlayerState';
import { LabRat } from './LabRat';
import { applyEffectToRat } from './RatStateService';

// ARCHITECTURE §10 names `Experiment` as an aggregate but neither doc gives
// its exact shape — minimal gap-fill covering what the UI needs to show a
// test result.
export interface Experiment {
  id: string;
  playerId: string;
  medicineId: string;
  ratId: string;
  revealedEffectKey?: string;
  ratSurvived: boolean;
  testedAt: string;
}

export interface ExperimentResult {
  medicine: Medicine;
  rat: LabRat;
  experiment: Experiment;
  revealedEffect?: ActiveEffect;
}

// Reveals exactly 1 new hidden effect per test (TZ §21 decision). Once all
// hidden effects are revealed, further tests report nothing new rather than
// erroring — an explicit edge case called out in the implementation plan.
export function testMedicineOnRat(playerId: string, medicine: Medicine, rat: LabRat, now: Date = new Date()): ExperimentResult {
  if (medicine.hiddenEffects.length === 0) {
    return {
      medicine,
      rat,
      experiment: {
        id: `exp_${medicine.id}_${now.getTime()}`,
        playerId,
        medicineId: medicine.id,
        ratId: rat.id,
        ratSurvived: rat.alive,
        testedAt: now.toISOString(),
      },
    };
  }

  const index = Math.floor(Math.random() * medicine.hiddenEffects.length);
  const revealedEffect = medicine.hiddenEffects[index];
  const remainingHidden = medicine.hiddenEffects.filter((_, i) => i !== index);

  const updatedRat = applyEffectToRat(rat, revealedEffect);
  const updatedMedicine: Medicine = {
    ...medicine,
    hiddenEffects: remainingHidden,
    knownEffects: [...medicine.knownEffects, revealedEffect],
  };

  return {
    medicine: updatedMedicine,
    rat: updatedRat,
    revealedEffect,
    experiment: {
      id: `exp_${medicine.id}_${now.getTime()}`,
      playerId,
      medicineId: medicine.id,
      ratId: rat.id,
      revealedEffectKey: revealedEffect.key,
      ratSurvived: updatedRat.alive,
      testedAt: now.toISOString(),
    },
  };
}
