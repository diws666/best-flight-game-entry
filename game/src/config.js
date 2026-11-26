// Tuning constants and the world's logical scale.
// Y is up; the aircraft flies over the XZ plane, toward negative Z where the runway lies.

export const STEP = 1 / 60;

/** World bounds, in metres. The play area is a square centred on the origin. */
export const WORLD = { halfSize: 2200 };

export const AIRCRAFT = {
  mass: 1200,
  maxThrust: 18,        // m/s^2 at full throttle
  maxSpeed: 240,
  takeoffSpeed: 58,
  gravity: 10,          // m/s^2
  liftPower: 0.18,      // lift = speed * liftPower (level cruise ~55 m/s)
  drag: 0.20,           // linear drag
  pitchRate: 1.5,
  rollRate: 2.4,
  yawRate: 0.9,
  maxPitch: 1.1,
  gearClearance: 6,
  throttleRate: 3.0,    // throttle change per second at full tilt
};

export const CONTROLS = {
  throttleStep: 0.06,
  throttleIdle: 0.10,
};

export const CAMERA = {
  dist: 24,
  height: 13,
  lookAhead: 18,
  lag: 0.12,
};

export const TERRAIN = {
  heightScale: 60,
  waterLevel: 20,
  octaves: 5,
};

export const RUNWAY = {
  length: 1000,
  width: 60,
  x: 0,
  z: -2200,
  y: 28,
};

export const LAKE = {
  x: 760,
  z: -520,
  radius: 300,
};

export const RING = {
  radius: 11,
  spacing: 200,
  count: 8,
  firstZ: 300,
  glow: 0x22ffbb,
};

export const MISSION = {
  fuelMax: 110,         // seconds of fuel at cruise
  fuelBurnBase: 0.9,
  fuelBurnThrottle: 0.55,
  ringScore: 150,
  landScore: 600,
  landMaxSink: 4.2,     // m/s, vertical speed limit for a clean landing
  landMaxSpeed: 78,     // m/s, speed limit for a clean landing
  landMaxHeadingDiff: 0.55, // rad
  landMaxThrottle: 0.7,     // power must be back for a landing
};

export const PALETTE = {
  sky: '#0e1622',
  grass: '#1f442e',
  grassDark: '#173423',
  water: '#1c5c7f',
  waterDeep: '#0f364b',
  runway: '#323232',
  runwayEdge: '#eef1f5',
  tree: '#14532d',
  treeLight: '#3a8f52',
  building: '#3d3d44',
  buildingRoof: '#7a6a54',
  ring: '#22ffbb',
  ringGlow: '#00c896',
  sun: '#ffd96a',
  aircraft: '#2b3644',
  aircraftAccent: '#4fc3f7',
  instrument: '#00ff88',
  instrumentDim: '#0d7a44',
  hudText: '#eef1f5',
  hudDim: '#8b93a3',
  hudWarn: '#ff5f5f',
};
