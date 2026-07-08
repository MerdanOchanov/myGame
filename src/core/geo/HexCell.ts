// Canonical HexCell — reconciles TZ.md §4 and ARCHITECTURE.md §8's slightly
// different shapes. `id` is an h3-js index string at HEX_RESOLUTION; q/r cube
// coordinates from ARCHITECTURE §8 are dropped since h3-js has no native cube
// coordinate and gridDisk/gridDistance already cover neighbor/ring math.
export const HEX_RESOLUTION = 12 as const;

// A block is the H3 res-11 parent of a game cell: exactly 7 res-12 cells
// (aperture-7 honeycomb). Homes claim a whole block; biomes are built from
// blocks (5..40 per biome).
export const BLOCK_RESOLUTION = 11 as const;
export const CELLS_PER_BLOCK = 7 as const;

// Declared game-design diameter (TZ §4/§8). Kept as a display/rules constant,
// decoupled from h3's actual resolution-12 geometry (~18.8m diameter) per the
// locked decision in TZ §21 / ARCHITECTURE §3 to accept H3 as an approximation.
export const HEX_DIAMETER_METERS = 50 as const;

export interface HexCell {
  id: string;
  center: { lat: number; lng: number };
  /** H3 res-11 parent — the 7-cell block this cell belongs to. */
  blockId?: string;
  /** Hydration-only: populated on lookup, not stored on the cell itself. */
  biomeId?: string;
  /** Hydration-only: owner of the home occupying this cell's block. */
  ownerPlayerId?: string;
}
