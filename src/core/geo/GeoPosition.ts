import { speedBetweenFixes } from './GeoDistance';

// Verbatim from ARCHITECTURE.md §13.
export interface GeoProof {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: string;
}

export type PositionMode = 'production' | 'debug';

// Carries debug/production mode alongside GeoProof without mutating the
// documented wire shape (gap-fill, flagged in the implementation plan).
export interface GeoProofWithMode {
  proof: GeoProof;
  mode: PositionMode;
}

// "Basic checks" per TZ.md §21's fake-GPS decision: speed, timestamp, accuracy.
export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;
export const MAX_FIX_AGE_SECONDS = 30;
export const MAX_PLAUSIBLE_SPEED_MPS = 15; // ~54 km/h, generous margin over running/cycling

export function isAccuracyAcceptable(proof: GeoProof): boolean {
  return proof.accuracyMeters <= MAX_ACCEPTABLE_ACCURACY_METERS;
}

export function isTimestampFresh(proof: GeoProof, now: Date = new Date()): boolean {
  const ageSeconds = (now.getTime() - new Date(proof.capturedAt).getTime()) / 1000;
  return ageSeconds >= 0 && ageSeconds <= MAX_FIX_AGE_SECONDS;
}

export function isSpeedPlausible(previous: GeoProof | undefined, current: GeoProof): boolean {
  if (!previous) return true;
  return speedBetweenFixes(
    { lat: previous.lat, lng: previous.lng, capturedAt: previous.capturedAt },
    { lat: current.lat, lng: current.lng, capturedAt: current.capturedAt }
  ) <= MAX_PLAUSIBLE_SPEED_MPS;
}

export interface GeoValidationResult {
  valid: boolean;
  reason?: 'accuracy' | 'stale_timestamp' | 'implausible_speed';
}

/** Basic anti-cheat checks (TZ §21). Always valid in debug mode — synthetic fixes aren't GPS. */
export function validateGeoProof(
  proofWithMode: GeoProofWithMode,
  previousProof: GeoProof | undefined,
  now: Date = new Date()
): GeoValidationResult {
  if (proofWithMode.mode === 'debug') return { valid: true };

  const { proof } = proofWithMode;
  if (!isAccuracyAcceptable(proof)) return { valid: false, reason: 'accuracy' };
  if (!isTimestampFresh(proof, now)) return { valid: false, reason: 'stale_timestamp' };
  if (!isSpeedPlausible(previousProof, proof)) return { valid: false, reason: 'implausible_speed' };
  return { valid: true };
}
