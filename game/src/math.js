// Seeded random and deterministic terrain height.
// Everything in the world derives from one seed so the same seed always
// produces the same terrain, rings, trees and buildings.

import { TERRAIN } from './config.js';

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Build a deterministic height function for the terrain.
 * Layered sinusoids seeded by `seed`: smooth rolling hills with no stored
 * heightmap, so the same seed always gives the same surface and collision
 * can sample it anywhere at any time.
 */
export function createTerrainHeight(seed) {
  const r = createRandom(seed);
  const octaves = [];
  for (let o = 0; o < TERRAIN.octaves; o += 1) {
    octaves.push({
      amp: 0.5 + r() * 0.9,
      freq: 0.0014 + r() * 0.0032,
      phaseX: r() * Math.PI * 2,
      phaseZ: r() * Math.PI * 2,
    });
  }
  return function height(x, z) {
    let h = 0;
    for (const o of octaves) {
      h += o.amp * Math.sin(o.freq * x + o.phaseX) * Math.cos(o.freq * z + o.phaseZ);
    }
    return h * TERRAIN.heightScale;
  };
}
