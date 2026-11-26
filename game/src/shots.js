// Deterministic screenshot staging. Given a fresh world and a seed, each shot
// plays the real simulation forward (steered by an autopilot) for a fixed time
// or until a terminal event, so the same seed always yields the same frame.
import { RUNWAY, RING, MISSION, AIRCRAFT } from './config.js';
import { clamp } from './math.js';

const PLAY_SECONDS = 20;
const END_LIMIT_SECONDS = 120;
const SAMPLE = 1 / 60;

// Glide path: cruise height at z=-1100 down to 45 m at the strip threshold
// (z=-1900), then a gentle 45 -> 32 m float to the runway centre.
const CRUISE_HEIGHT = 145; // barometric height held while chasing rings
const FLARE_HEIGHT = 58;   // begin round-out above the runway
const TOUCH_HEIGHT = RUNWAY.y + 4; // just inside gear clearance: touchdown triggers here
const STALL_SPEED = 44;    // below this, nose down and full power
const TERRAIN_MARGIN = 75; // never fly lower than this above the hills
const LOOKAHEAD = 2.5;     // seconds ahead at which terrain is sampled

export function wrap(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Autopilot input: hold cruise height and speed through the ring chain, then
 *  line up with the runway, descend in two gentle stages, flare and touch down.
 *  Deterministic for the seed. */
export function autopilot(state, world, dt) {
  const input = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0 };
  let target = null;
  for (const ring of state.ringsRef) {
    if (ring.active && !ring.collected && ring.z <= state.position.z + 40) { target = ring; break; }
  }
  const landing = !target;

  // Thrust hint by phase (used in the throttle section below).
  let desiredThrottleHint = 0.64;

  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  const stalling = speed < STALL_SPEED;

  // Where the plane will be in a few seconds: terrain backstop uses this so
  // the autopilot starts climbing before it reaches a hill, not after.
  const lx = state.position.x + state.velocity.x * LOOKAHEAD;
  const lz = state.position.z + state.velocity.z * LOOKAHEAD;
  const onRunwayStrip = Math.abs(state.position.x - RUNWAY.x) < RUNWAY.width / 2 &&
    Math.abs(state.position.z - RUNWAY.z) < RUNWAY.length / 2;
  const floor = onRunwayStrip ? RUNWAY.y + AIRCRAFT.gearClearance : world.terrainHeight(lx, lz) + TERRAIN_MARGIN;
  const needClimb = state.position.y < floor;

  let targetX = 0, targetY = CRUISE_HEIGHT, targetZ = RUNWAY.z;
  if (target) {
    targetX = target.x; targetY = target.y; targetZ = target.z;
    if (targetY < floor) targetY = floor; // never dive into a hill for a ring
  } else if (landing) {
    // Always aim at the runway centreline (ahead); the glide path sets height.
    targetX = 0;
  }

  let dx = targetX - state.position.x;
  let dz = targetZ - state.position.z;
  if (dz > -40) dz = -40; // aim at least 40 m ahead, never behind the aircraft
  let desiredYaw = Math.atan2(-dx, -dz);
  let yawDiff = wrap(desiredYaw - state.yaw);

  // In the landing phases, also aim upwind of lateral drift so the aircraft
  // holds the centreline instead of sliding past it into rising ground.
  if (landing) {
    const drift = clamp(state.position.x * 3.0, -150, 150);
    desiredYaw = Math.atan2(-(dx - drift), -dz);
    yawDiff = wrap(desiredYaw - state.yaw);
  }

  // --- pitch: stall recovery first, then terrain, then the phase command ---
  let pitchCmd;
  if (stalling) {
    pitchCmd = -0.9;
    yawDiff *= 0.3;
  } else if (needClimb) {
    pitchCmd = 0.6;
    yawDiff *= 0.3;
  } else if (landing) {
    // Glide path: cruise height at z=-1100 down to 45 m at the strip threshold
    // (z=-1900), then a gentle 45 -> 32 m float to the runway centre.
    const pathY = state.position.z > -1900
      ? clamp(145 + 0.125 * (state.position.z + 1100), 45, 145)
      : clamp(45 + 0.04333 * (state.position.z + 1900), 32, 45);
    const pathSlope = state.position.z > -1900 ? 0.125 : 0.04333; // d(targetY)/dz
    const pathSink = -pathSlope * state.velocity.z; // positive = descending
    const sink = -state.velocity.y;
    if (state.position.y <= FLARE_HEIGHT) {
      // Round out: arrest the sink to a gentle touchdown rate, then idle.
      pitchCmd = clamp((sink - 1.2) * 0.12 - state.pitch * 0.9, -0.08, 0.16);
      desiredThrottleHint = 0.50;
    } else {
      // Hold the glide path: sink error plus height error, pitch-damped.
      pitchCmd = clamp((sink - pathSink) * 0.1 - (state.position.y - pathY) * 0.02 - state.pitch * 0.9, -0.14, 0.14);
      desiredThrottleHint = 0.72;
    }
  } else {
    // Hold cruise height above the terrain, damped by current pitch attitude.
    const ringNudge = target ? clamp((targetY - state.position.y) * 0.006, -0.08, 0.08) : 0;
    pitchCmd = clamp((CRUISE_HEIGHT - state.position.y) * 0.006 - state.pitch * 0.9 + ringNudge, -0.16, 0.16);
  }
  input.pitch = pitchCmd;

  // --- roll / yaw: gentle bank, never yaw past the desired heading ---
  const targetRoll = clamp(yawDiff * (landing ? 1.3 : 0.9), -0.55, 0.55);
  let yawCmd = clamp(yawDiff * (landing ? 1.5 : 0.9), -1, 1);
  if (Math.abs(state.yaw) > Math.abs(desiredYaw) && Math.sign(state.yaw) === Math.sign(desiredYaw) && desiredYaw !== 0) {
    yawCmd = -Math.sign(state.yaw) * 0.25; // ease back toward the desired heading
  }
  input.yaw = yawCmd;
  input.roll = clamp((targetRoll - state.roll) * 1.6, -1, 1);

  // --- throttle ---
  let desiredThrottle;
  if (stalling) desiredThrottle = 1.0;
  else if (speed < 54) desiredThrottle = 0.9;
  else if (speed > 66) desiredThrottle = 0.5;
  else desiredThrottle = desiredThrottleHint;
  if (state.throttle < desiredThrottle - 0.05) input.throttleDelta = 1;
  else if (state.throttle > desiredThrottle + 0.05) input.throttleDelta = -1;
  return input;
}

/** Stage the named scene on a fresh world. Returns {screen, state}. */
export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    // A few seconds of real flight from the fresh start: aircraft in frame,
    // terrain rolling beneath, runway ahead, HUD lit.
    for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) {
      const input = autopilot(world.state, world, SAMPLE);
      const events = world.step(SAMPLE, input);
      if (events & 4) break;
      if (events & 2) break;
    }
    return { screen: 'play', state: world.state };
  }
  if (name !== 'play' && name !== 'end') {
    return { screen: 'title', state: world.state };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let screen = 'play';
  for (let i = 0; i < limit / SAMPLE; i += 1) {
    const input = autopilot(world.state, world, SAMPLE);
    const events = world.step(SAMPLE, input);
    if (events & 4) { screen = 'over'; break; }
    if (events & 2) { screen = 'complete'; break; }
  }
  if (screen === 'play' && !world.state.alive) screen = 'over';
  return { screen, state: world.state };
}

// START_SECONDS is referenced above; zero seconds of preflight for the start shot.
const START_SECONDS = 0;
