// The aircraft model and its visual state. Built from plain three.js
// primitives so nothing external is loaded. The fuselage, wings, tail and a
// glowing instrument panel are separate meshes; the instrument panel is
// emissive so it reads as "lit" in the chase view.

import * as THREE from '../vendor/three.min.js';
import { AIRCRAFT, PALETTE } from './config.js';

export function createAircraft() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.aircraft, roughness: 0.45, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.aircraftAccent, roughness: 0.3, metalness: 0.6 });
  const instrumentMat = new THREE.MeshBasicMaterial({ color: PALETTE.instrument }); // emissive-like, unlit

  // Fuselage.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 14, 12), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 12), accentMat);
  nose.rotation.z = Math.PI / 2;
  nose.position.x = 7;
  group.add(nose);
  // Wings.
  const wings = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 5.5), bodyMat);
  wings.position.y = 0.4;
  group.add(wings);
  // Tail.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 4.5), accentMat);
  tail.position.x = -6;
  tail.position.y = 0.9;
  group.add(tail);
  // Vertical stabiliser.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 5), bodyMat);
  stabiliser.position.x = -6.2;
  stabiliser.position.y = 2.6;
  stabiliser.position.z = 1;
  group.add(stabiliser);
  // Glowing instrument panel (cockpit), lit regardless of scene lighting.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 0.35), instrumentMat);
  panel.position.set(1.6, 0.5, -0.9);
  group.add(panel);
  const panelGlow = new THREE.Mesh(new THREE.BoxGeometry(4.9, 2.6, 0.2), new THREE.MeshBasicMaterial({ color: PALETTE.instrument, transparent: true, opacity: 0.35 }));
  panelGlow.position.set(1.6, 0.5, -0.88);
  group.add(panelGlow);

  // Propeller (spun in the render loop).
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 7), accentMat);
  prop.position.x = 9.1;
  group.add(prop);

  return {
    group,
    fuselage,
    wings,
    tail,
    stabiliser,
    panel,
    prop,
    /** Apply the simulation state to the mesh transform and propeller spin. */
    update(state, dt) {
      const g = group;
      g.position.set(state.position.x, state.position.y, state.position.z);
      g.rotation.set(state.pitch, state.yaw, state.roll); // X=pitch, Y=yaw, Z=roll
      prop.rotation.x += speedProp(state.velocity) * dt;
    },
  };
}

function speedProp(velocity) {
  return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * 2.6;
}
