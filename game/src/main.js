// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints. Screens: title, play, paused,
// game over, mission complete. ?seed=N fixes the world; ?shot=start|play|end
// (with &seed=N) stages a deterministic screenshot scene instead of the loop.

import { STEP } from './config.js';
import { createWorld, EVENT_CRASH, EVENT_LAND, EVENT_RING } from './world.js';
import { createInput } from './input.js';
import { createAircraft } from './aircraft.js';
import { createCamera } from './camera.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const world = createWorld(seed);
const input = createInput(canvas);
const aircraft = createAircraft();
const chase = createCamera();
const renderer = createRenderer(canvas);
const hud = createHud(document.body);

renderer.initScenery(world);

let screen = 'title';
let best = 0;
let accumulator = 0;
let last = performance.now();

function startGame() {
  world.reset();
  screen = 'play';
  hud.hide();
}

function endGame(score) {
  screen = 'over';
  if (score > best) best = score;
  hud.over(score, best);
}

function completeGame(score) {
  screen = 'complete';
  if (score > best) best = score;
  hud.complete(score);
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & 1 /* CONFIRM */) {
    if (screen === 'title' || screen === 'over' || screen === 'complete') startGame();
    else if (screen === 'paused') screen = 'play';
  } else if (actions & 2 /* PAUSE */) {
    if (screen === 'play') { screen = 'paused'; }
    else if (screen === 'paused') { screen = 'play'; }
  } else if (actions & 4 /* RESTART */) {
    if (screen === 'play' || screen === 'paused' || screen === 'over' || screen === 'complete') startGame();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  const frameDt = (now - last) / 1000;
  last = now;
  if (screen === 'title') {
    world.step(STEP, { pitch: 0, roll: 0, yaw: 0.15 * Math.sin(now * 0.001), throttleDelta: 0 });
    accumulator = 0;
  } else {
    handleActions();
    if (screen === 'play') {
      const steering = input.steering();
      const stepInput = {
        pitch: steering.pitch,
        roll: steering.roll + steering.pointerX * 0.7,
        yaw: steering.yaw + steering.pointerX * 0.4,
        throttleDelta: 0,
      };
      while (accumulator >= STEP && screen === 'play') {
        const events = world.step(STEP, stepInput);
        accumulator -= STEP;
        if (events & EVENT_CRASH) { endGame(world.state.score); break; }
        else if (events & EVENT_LAND) { completeGame(world.state.score); break; }
        else if (events & EVENT_RING) { /* score added in world */ }
      }
    } else {
      accumulator = 0;
    }
  }
  // Visuals.
  aircraft.update(world.state, frameDt);
  chase.targetFrom(world.state);
  if (screen === 'play' || screen === 'paused') chase.update(frameDt);
  renderer.render(world.state, aircraft, chase, world.state.time);
  if (screen === 'play') {
    const speed = Math.hypot(world.state.velocity.x, world.state.velocity.z) * 3.6;
    hud.update(world.state, speed);
  }
  if (screen === 'title') hud.title();
  else if (screen === 'paused') hud.paused();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') { screen = 'paused'; }
});

if (shot) {
  const { screen: shotScreen, state } = stageShot(shot, world);
  screen = shotScreen;
  aircraft.update(state, 0);
  chase.targetFrom(state);
  chase.snap();
  renderer.render(state, aircraft, chase, state.time);
  const speed = Math.hypot(state.velocity.x, state.velocity.z) * 3.6;
  hud.update(state, speed);
  if (shotScreen === 'title') hud.title();
  else if (shotScreen === 'over') hud.over(state.score, best);
  else if (shotScreen === 'complete') hud.complete(state.score);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
