// HUD and screen overlays, drawn as HTML/CSS over the canvas so they are
// legible in screenshots and update without touching the renderer.

import { MISSION, RING } from './config.js';

export function createHud(root) {
  const els = {
    alt: root.querySelector('#hud-alt'),
    spd: root.querySelector('#hud-spd'),
    hdg: root.querySelector('#hud-hdg'),
    fuel: root.querySelector('#hud-fuel'),
    score: root.querySelector('#hud-score'),
    rings: root.querySelector('#hud-rings'),
  };
  const title = root.querySelector('#screen-title');
  const paused = root.querySelector('#screen-paused');
  const over = root.querySelector('#screen-over');
  const complete = root.querySelector('#screen-complete');
  const overFinal = over.querySelector('#over-final');
  const overBest = over.querySelector('#over-best');
  const completeScore = complete.querySelector('#complete-score');

  let last = {};
  function set(key, value) {
    if (value === last[key]) return;
    last[key] = value;
    els[key].textContent = value;
  }

  function show(node) {
    [title, paused, over, complete].forEach((n) => { if (n) n.style.display = 'none'; });
    if (node) node.style.display = 'flex';
  }

  return {
    /** Called every frame while playing; only changed values touch the DOM. */
    update(state, speedKmh) {
      const alt = Math.max(0, Math.round(state.position.y));
      const hdg = Math.round(((state.yaw * 180 / Math.PI) + 360) % 360);
      const fuel = Math.round((state.fuel / MISSION.fuelMax) * 100);
      set('alt', String(alt));
      set('spd', String(Math.round(speedKmh)));
      set('hdg', String(hdg));
      set('fuel', String(fuel));
      set('score', String(state.score));
      set('rings', `${state.rings}/${RING.count}`);
    },
    title() { show(title); },
    paused() { show(paused); },
    over(finalScore, best) { overFinal.textContent = String(finalScore); overBest.textContent = String(best); show(over); },
    complete(score) { completeScore.textContent = String(score); show(complete); },
    hide() { show(null); },
  };
}
