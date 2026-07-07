import { latLngToCell, cellToLatLng, cellToBoundary, gridDisk, gridDistance } from 'h3-js';
import { HexCell, HEX_RESOLUTION, HEX_DIAMETER_METERS } from './HexCell';

export function resolveHexCell(lat: number, lng: number): HexCell {
  const id = latLngToCell(lat, lng, HEX_RESOLUTION);
  const [centerLat, centerLng] = cellToLatLng(id);
  return {
    id,
    center: { lat: centerLat, lng: centerLng },
    diameterMeters: HEX_DIAMETER_METERS,
  };
}

export function hexCellById(id: string): HexCell {
  const [centerLat, centerLng] = cellToLatLng(id);
  return {
    id,
    center: { lat: centerLat, lng: centerLng },
    diameterMeters: HEX_DIAMETER_METERS,
  };
}

/** Boundary polygon in [lat, lng] pairs, suitable for Leaflet's L.polygon(). */
export function hexCellBoundary(id: string): [number, number][] {
  return cellToBoundary(id) as [number, number][];
}

export function neighbors(id: string, k = 1): string[] {
  return gridDisk(id, k).filter((cell) => cell !== id);
}

export function gridDiskIncludingSelf(id: string, k: number): string[] {
  return gridDisk(id, k);
}

export function hexDistance(a: string, b: string): number {
  return gridDistance(a, b);
}
