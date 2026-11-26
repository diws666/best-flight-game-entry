// The simulation: terrain surface, aircraft physics, runway, rings, scenery
// and collision. Pure logic -- no DOM, no renderer. step() advances one fixed
// step and returns event flags the loop reacts to.

import { WORLD, AIRCRAFT, RUNWAY, LAKE, RING, MISSION } from './config.js';
import { createRandom, clamp, createTerrainHeight } from './math.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LAND = 2;
export const EVENT_CRASH = 4;

function vec(x, y, z) { return { x, y, z }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function length(v) { return Math.sqrt(dot(v, v)); }
function normalize(v) { const l = length(v) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }

// Forward (nose) and up (roof) vectors from yaw / pitch / roll.
// yaw=0, pitch=0, roll=0 => faces -Z, wings level.
function aircraftVectors(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const forward = vec(-sy * cp, sp, -cy * cp);
  // up = Ry(yaw) * Rx(pitch) * Rz(roll) * (0,1,0)
  const up = vec(
    -cy * sr + sy * sp * cr,
    cp * cr,
    sy * sr + cy * sp * cr,
  );
  return { forward, up };
}

function surfaceHeight(terrainHeight, x, z) {
  // Runway strip is a hard flat surface.
  if (Math.abs(x - RUNWAY.x) < RUNWAY.width / 2 && Math.abs(z - RUNWAY.z) < RUNWAY.length / 2) {
    return RUNWAY.y;
  }
  // Lake is flat water.
  const dx = x - LAKE.x, dz = z - LAKE.z;
  if (dx * dx + dz * dz < LAKE.radius * LAKE.radius) {
    return LAKE.waterLevel;
  }
  return terrainHeight(x, z);
}

function onRunway(x, z) {
  return Math.abs(x - RUNWAY.x) < RUNWAY.width / 2 && Math.abs(z - RUNWAY.z) < RUNWAY.length / 2;
}

export function createWorld(seed) {
  const terrainHeight = createTerrainHeight(seed);
  const scenery = createRandom(seed * 31 + 7);

  // Ring chain leading from the start toward the runway.
  const rings = [];
  for (let i = 0; i < RING.count; i += 1) {
    const z = RING.firstZ - i * RING.spacing;
    const x = 28 * Math.sin(i * 1.3);
    const y = 150 + 22 * Math.sin(i * 0.9 + 1);
    rings.push({ x, y, z, active: true, collected: false });
  }

  // Scenery scattered by the seeded random: trees and buildings on the hills,
  // clouds above. All deterministic for the seed.
  const trees = [];
  const buildings = [];
  const clouds = [];
  const scatter = 64;
  for (let i = 0; i < scatter; i += 1) {
    const x = (scenery() - 0.5) * WORLD.halfSize * 1.6;
    const z = (scenery() - 0.5) * WORLD.halfSize * 1.6;
    if (onRunway(x, z)) continue; // keep the runway clear
    const h = terrainHeight(x, z);
    if (scenery() < 0.55) {
      trees.push({ x, z, y: h, size: 5 + scenery() * 9 });
    } else {
      buildings.push({ x, z, y: h, w: 7 + scenery() * 10, h: 8 + scenery() * 14, d: 7 + scenery() * 10 });
    }
  }
  for (let i = 0; i < 14; i += 1) {
    clouds.push({
      x: (scenery() - 0.5) * WORLD.halfSize * 1.8,
      y: 420 + scenery() * 260,
      z: (scenery() - 0.5) * WORLD.halfSize * 1.8,
      size: 30 + scenery() * 50,
    });
  }

  const state = {
    position: vec(0, 160, 500),
    velocity: vec(0, 0, -55),
    pitch: 0, roll: 0, yaw: 0,
    throttle: 0.6,
    fuel: MISSION.fuelMax,
    score: 0,
    rings: 0,
    time: 0,
    alive: true,
    landed: false,
    missionComplete: false,
    crashed: false,
    ringsRef: rings,
  };

  function reset() {
    state.position.set = undefined;
    state.position.x = 0; state.position.y = 160; state.position.z = 500;
    state.velocity.x = 0; state.velocity.y = 0; state.velocity.z = -55;
    state.pitch = 0; state.roll = 0; state.yaw = 0;
    state.throttle = 0.6;
    state.fuel = MISSION.fuelMax;
    state.score = 0; state.rings = 0;
    state.time = 0;
    state.alive = true; state.landed = false;
    state.missionComplete = false; state.crashed = false;
    for (const ring of rings) { ring.active = true; ring.collected = false; }
  }

  /** One fixed step. input: {pitch, roll, yaw, throttleDelta} in -1..1. */
  function step(dt, input) {
    let events = EVENT_NONE;
    if (!state.alive || state.missionComplete) return events;

    // --- throttle (held up/down moves it toward 0/1 over seconds) ---
    state.throttle = clamp(state.throttle + input.throttleDelta * AIRCRAFT.throttleRate * dt, 0, 1);

    // --- rotation ---
    state.pitch += input.pitch * AIRCRAFT.pitchRate * dt;
    state.pitch = clamp(state.pitch, -AIRCRAFT.maxPitch, AIRCRAFT.maxPitch);
    state.roll += input.roll * AIRCRAFT.rollRate * dt;
    if (Math.abs(input.roll) < 0.05) state.roll *= (1 - 2.0 * dt); // gentle auto-level
    state.yaw += input.yaw * AIRCRAFT.yawRate * dt;

    // --- forces ---
    const { forward, up } = aircraftVectors(state.yaw, state.pitch, state.roll);
    const speed = length(state.velocity);
    const thrust = scale(forward, state.throttle * AIRCRAFT.maxThrust);
    const lift = scale(up, speed * AIRCRAFT.liftPower);
    const gravity = vec(0, -AIRCRAFT.gravity, 0);
    const drag = scale(state.velocity, -AIRCRAFT.drag);
    const accel = add(add(add(thrust, lift), gravity), drag);

    state.velocity = add(state.velocity, scale(accel, dt));
    state.position = add(state.position, scale(state.velocity, dt));
    state.time += dt;

    // --- fuel ---
    const burn = MISSION.fuelBurnBase + state.throttle * MISSION.fuelBurnThrottle;
    state.fuel -= burn * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      return crash(state);
    }

    // --- collisions ---
    const surf = surfaceHeight(terrainHeight, state.position.x, state.position.z);
    const clearance = AIRCRAFT.gearClearance;
    if (state.position.y < surf + clearance) {
      if (onRunway(state.position.x, state.position.z) && canLand(state)) {
        return land(state);
      }
      return crash(state);
    }
    // Scenery collision: buildings and trees.
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (Math.abs(state.position.x - b.x) < b.w / 2 + 3 &&
          Math.abs(state.position.z - b.z) < b.d / 2 + 3 &&
          state.position.y < b.y + b.h + 2) {
        return crash(state);
      }
    }
    for (let i = 0; i < trees.length; i += 1) {
      const t = trees[i];
      if (Math.hypot(state.position.x - t.x, state.position.z - t.z) < t.size * 0.5 + 2.5 &&
          state.position.y < t.y + t.size + 2) {
        return crash(state);
      }
    }

    // --- rings ---
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      if (!ring.active || ring.collected) continue;
      if (Math.hypot(state.position.x - ring.x, state.position.z - ring.z) < RING.radius + 6 &&
          Math.abs(state.position.y - ring.y) < RING.radius + 6) {
        ring.active = false; ring.collected = true;
        state.rings += 1; state.score += MISSION.ringScore;
        events |= EVENT_RING;
      }
    }

    return events;
  }

  function canLand(state) {
    const speed = length(state.velocity);
    const sink = -state.velocity.y; // positive = descending
    const headingDiff = Math.abs(state.yaw); // runway is aligned with -Z (yaw 0)
    return speed < MISSION.landMaxSpeed &&
           sink < MISSION.landMaxSink &&
           headingDiff < MISSION.landMaxHeadingDiff &&
           state.throttle < MISSION.landMaxThrottle;
           }

  function land(state) {
    state.alive = false; state.landed = true; state.missionComplete = true;
    state.score += MISSION.landScore;
    return EVENT_LAND;
  }

  function crash(state) {
    state.alive = false; state.crashed = true;
    return EVENT_CRASH;
  }

  reset();
  return { state, reset, step, rings, terrainHeight, trees, buildings, clouds };
}
