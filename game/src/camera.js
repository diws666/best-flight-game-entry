// Chase camera: follows the aircraft from behind, smoothly, never fighting the
// pilot. Position is derived from the aircraft's attitude so the camera always
// sits behind and above, looking toward where the aircraft is headed.

import { CAMERA } from './config.js';

export function createCamera() {
  const target = { x: 0, y: 0, z: 0 };
  const actual = { x: 0, y: 0, z: 0 };
  const lookAt = { x: 0, y: 0, z: 0 };

  return {
    /** Set the ideal camera target from the aircraft's position and attitude. */
    targetFrom(aircraft) {
      const { forward, up } = aircraftVectors(aircraft.yaw, aircraft.pitch, aircraft.roll);
      target.x = aircraft.position.x - forward.x * CAMERA.dist + up.y * 0;
      target.y = aircraft.position.y + CAMERA.height + up.y * 4;
      target.z = aircraft.position.z - forward.z * CAMERA.dist;
      // pull slightly toward the aircraft's up so banked flight tilts the camera
      target.x += up.x * 6;
      target.z += up.z * 6;
    },
    /** Smoothly interpolate toward the target; call once per frame. */
    update(dt) {
      const k = 1 - Math.exp(-CAMERA.lag * 60 * dt);
      actual.x = lerp(actual.x, target.x, k);
      actual.y = lerp(actual.y, target.y, k);
      actual.z = lerp(actual.z, target.z, k);
      // look ahead of the aircraft, not straight at it
      const { forward } = aircraftVectors(0, 0, 0);
      return actual;
    },
    position() { return actual; },
    /** Snap the smoothed position onto the target (used for shot staging). */
    snap() { actual.x = target.x; actual.y = target.y; actual.z = target.z; },
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }

// shared small vector helper (duplicated from math to keep camera dependency-free)
function aircraftVectors(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const forward = { x: -sy * cp, y: sp, z: -cy * cp };
  const up = {
    x: -cy * sr + sy * sp * cr,
    y: cp * cr,
    z: sy * sr + cy * sp * cr,
  };
  return { forward, up };
}
