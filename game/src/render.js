// Rendering: three.js scene, lights, terrain, runway, rings, scenery and the
// frame loop. Reads the simulation state each frame and draws it.

import * as THREE from '../vendor/three.min.js';
import { WORLD, RUNWAY, LAKE, RING, PALETTE } from './config.js';

const TERRAIN_SEG = 56;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(PALETTE.sky));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / Math.max(canvas.clientHeight, 1), 0.1, 7000);

  // Lights: sun (directional) + ambient + hemisphere for ground/sky fill.
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.05);
  sunLight.position.set(300, 500, -200);
  sunLight.castShadow = true;
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0x5b7ea0, 0x22323a, 0.55);
  scene.add(hemi);

  // Sun disc (always drawn relative to the camera so it stays visible).
  const sunObj = new THREE.Object3D();
  const sunMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(9, 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun }),
  );
  sunMesh.position.set(450, 320, -300);
  sunObj.add(sunMesh);
  scene.add(sunObj);

  const meshes = {};

  function buildTerrain(terrainHeight) {
    const size = WORLD.halfSize * 2;
    const geo = new THREE.PlaneGeometry(size, size, TERRAIN_SEG, TERRAIN_SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildLake() {
    const geo = new THREE.CircleGeometry(LAKE.radius, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.3, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(LAKE.x, LAKE.waterLevel + 0.15, LAKE.z);
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildRunway() {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(RUNWAY.length, 2.2, RUNWAY.width),
      new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9, metalness: 0.2 }),
    );
    base.position.y = RUNWAY.y + 1.1;
    base.receiveShadow = true;
    group.add(base);
    const edgeMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayEdge });
    const edge = (sx) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.length, 0.6, 1.4), edgeMat);
      e.position.set(sx, RUNWAY.y + 2.4, 0);
      group.add(e);
    };
    edge(-RUNWAY.width / 2 - 0.75);
    edge(RUNWAY.width / 2 + 0.75);
    // centre stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.length, 0.15, 2.2), edgeMat);
    stripe.position.set(0, RUNWAY.y + 2.5, 0);
    group.add(stripe);
    group.position.set(RUNWAY.x, RUNWAY.y, RUNWAY.z);
    return group;
  }

  function buildRing(x, y, z) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(RING.radius, 1.6, 16, 40),
      new THREE.MeshStandardMaterial({ color: PALETTE.ring, emissive: PALETTE.ringGlow, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(RING.radius - 2.6, 0.5, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x114433 }),
    );
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
    group.position.set(x, y, z);
    return group;
  }

  function buildTree(x, y, z, size) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, size * 0.45, 8),
      new THREE.MeshStandardMaterial({ color: '#4a3a2e', roughness: 1, metalness: 0 }),
    );
    trunk.position.y = size * 0.22;
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(size * 0.9, size, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.tree, roughness: 1, metalness: 0 }),
    );
    crown.position.y = size * 0.65;
    group.add(crown);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(size * 0.55, size * 0.55, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.treeLight, roughness: 1, metalness: 0 }),
    );
    top.position.y = size * 0.95;
    group.add(top);
    group.position.set(x, y, z);
    return group;
  }

  function buildBuilding(x, y, z, w, h, d) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: PALETTE.building, roughness: 0.7, metalness: 0.1 }));
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, 1.4, d * 1.12), new THREE.MeshStandardMaterial({ color: PALETTE.buildingRoof, roughness: 0.7, metalness: 0 }));
    roof.position.y = h + 0.7;
    group.add(roof);
    group.position.set(x, y, z);
    return group;
  }

  function buildCloud(x, y, z, size) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 4; i += 1) {
      const s = size * (0.55 + 0.3 * i);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
      m.position.set((i - 1.5) * s * 0.9, (i % 2) * s * 0.25, 0);
      group.add(m);
    }
    group.position.set(x, y, z);
    return group;
  }

  meshes.terrain = null;
  meshes.lake = null;
  meshes.runway = null;
  meshes.rings = [];
  meshes.trees = [];
  meshes.buildings = [];
  meshes.clouds = [];

  function initScenery(world) {
  meshes.terrain = buildTerrain(world.terrainHeight);
    scene.add(meshes.terrain);
    meshes.lake = buildLake();
    scene.add(meshes.lake);
    meshes.runway = buildRunway();
    scene.add(meshes.runway);
    for (const ring of world.rings) {
      const m = buildRing(ring.x, ring.y, ring.z);
      scene.add(m);
      meshes.rings.push({ mesh: m, ring });
    }
    for (const t of world.trees) {
      const m = buildTree(t.x, t.y, t.z, t.size);
      scene.add(m);
      meshes.trees.push(m);
    }
    for (const b of world.buildings) {
      const m = buildBuilding(b.x, b.y, b.z, b.w, b.h, b.d);
      scene.add(m);
      meshes.buildings.push(m);
    }
    for (const c of world.clouds) {
      const m = buildCloud(c.x, c.y, c.z, c.size);
      scene.add(m);
      meshes.clouds.push(m);
    }
  }

  let resized = false;
  function resize() {
    const width = canvas.clientWidth;
    const height = Math.max(canvas.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, sunLight, sunObj, sunMesh, meshes, initScenery, resize,
    /** Draw one frame from the simulation state. */
    render(state, aircraft, chase, time) {
      if (resized) { resize(); resized = false; }
      // Animate rings: bob and spin.
      for (const entry of meshes.rings) {
        if (!entry.ring.active) continue;
        const m = entry.mesh;
        const t = time;
        m.position.y = entry.ring.y + Math.sin(t * 3 + entry.ring.z) * 2;
        m.rotation.y += 0.05;
        m.rotation.z += 0.03;
      }
      // Drift clouds slowly.
      for (const m of meshes.clouds) {
        m.position.z += 0.06;
        if (m.position.z > WORLD.halfSize) m.position.z -= WORLD.halfSize * 2;
      }
      // Propeller handled by aircraft.update; sun stays fixed.
      camera.position.set(chase.position().x, chase.position().y, chase.position().z);
      // look ahead of the aircraft
      const { forward } = chaseVectors(state.yaw, state.pitch, state.roll);
      camera.lookAt(state.position.x + forward.x * 22, state.position.y + forward.y * 10, state.position.z + forward.z * 22);
      renderer.render(scene, camera);
    },
  };
}

function chaseVectors(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const forward = { x: -sy * cp, y: sp, z: -cy * cp };
  return { forward };
}
