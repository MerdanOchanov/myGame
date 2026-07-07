// Hand-rolled deterministic RNG (mulberry32) + string hash (FNV-1a) — avoids
// adding a seeded-rng npm dependency for this MVP session.
export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(...seedParts: string[]): () => number {
  return mulberry32(fnv1aHash(seedParts.join('|')));
}

export function pickFrom<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

export function intInRange(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
