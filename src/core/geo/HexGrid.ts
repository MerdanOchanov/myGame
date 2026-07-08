import {
  latLngToCell, cellToLatLng, cellToBoundary, gridDisk, gridDistance,
  cellToParent, cellToChildren, getResolution, polygonToCells,
} from 'h3-js';
import { HexCell, HEX_RESOLUTION, BLOCK_RESOLUTION } from './HexCell';

export function resolveHexCell(lat: number, lng: number): HexCell {
  const id = latLngToCell(lat, lng, HEX_RESOLUTION);
  const [centerLat, centerLng] = cellToLatLng(id);
  return {
    id,
    center: { lat: centerLat, lng: centerLng },
    blockId: blockIdOf(id),
  };
}

export function hexCellById(id: string): HexCell {
  const [centerLat, centerLng] = cellToLatLng(id);
  return {
    id,
    center: { lat: centerLat, lng: centerLng },
    blockId: blockIdOf(id),
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

// ------------------------------------------------------------------ blocks

/** The 7-cell block (H3 res-11 parent) a game cell belongs to. */
export function blockIdOf(cellId: string): string {
  return cellToParent(cellId, BLOCK_RESOLUTION);
}

/** The 7 res-12 game cells of a block — the honeycomb. */
export function blockCells(blockId: string): string[] {
  return cellToChildren(blockId, HEX_RESOLUTION);
}

export function blockCenter(blockId: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(blockId);
  return { lat, lng };
}

export function isBlockId(id: string): boolean {
  try {
    return getResolution(id) === BLOCK_RESOLUTION;
  } catch {
    return false;
  }
}

/** Соседние блоки (6 смежных res-11 сот). */
export function blockNeighbors(blockId: string): string[] {
  return gridDisk(blockId, 1).filter((b) => b !== blockId);
}

/** Ограничивающий прямоугольник по центрам блоков (+небольшой отступ). */
export function blocksBoundingBox(
  blockIds: string[],
  marginDeg = 0.0004
): { minLat: number; minLng: number; maxLat: number; maxLng: number } | null {
  if (blockIds.length === 0) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const blockId of blockIds) {
    const { lat, lng } = blockCenter(blockId);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return {
    minLat: minLat - marginDeg,
    minLng: minLng - marginDeg,
    maxLat: maxLat + marginDeg,
    maxLng: maxLng + marginDeg,
  };
}

/** All blocks whose center falls inside the lat/lng rectangle. */
export function blocksInRectangle(bounds: {
  minLat: number; minLng: number; maxLat: number; maxLng: number;
}): string[] {
  const polygon: [number, number][] = [
    [bounds.minLat, bounds.minLng],
    [bounds.minLat, bounds.maxLng],
    [bounds.maxLat, bounds.maxLng],
    [bounds.maxLat, bounds.minLng],
  ];
  return polygonToCells(polygon, BLOCK_RESOLUTION);
}
