const EARTH_RADIUS_METERS = 6371e3;

export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const deltaPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const sinPhi = Math.sin(deltaPhi / 2);
  const sinLambda = Math.sin(deltaLambda / 2);
  const h = sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Speed in meters/second implied by two geo fixes. */
export function speedBetweenFixes(
  from: { lat: number; lng: number; capturedAt: string },
  to: { lat: number; lng: number; capturedAt: string }
): number {
  const distanceMeters = haversineDistanceMeters(from, to);
  const deltaSeconds = (new Date(to.capturedAt).getTime() - new Date(from.capturedAt).getTime()) / 1000;
  if (deltaSeconds <= 0) return Infinity;
  return distanceMeters / deltaSeconds;
}
