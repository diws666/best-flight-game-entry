// Keyboard and mouse input. Held keys steer; one-shot presses (start, pause,
// restart, throttle) are queued as bit flags and taken once by the loop.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

const THROTTLE_UP = new Set(['KeyW', 'ArrowUp', 'PageUp']);
const THROTTLE_DOWN = new Set(['KeyS', 'ArrowDown', 'PageDown']);
const PITCH_UP = new Set(['ArrowUp', 'KeyW']); // also pitch (nose up)
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['KeyA', 'ArrowLeft']);
const ROLL_RIGHT = new Set(['KeyD', 'ArrowRight']);
const YAW_LEFT = new Set(['KeyQ']);
const YAW_RIGHT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  let pitch = 0;
  let roll = 0;
  let yaw = 0;
  let throttleDelta = 0;
  let actions = 0;
  let pointerX = 0; // -1..1 mouse steering (x offset from centre)

  const onKey = (code, down, repeat) => {
    if (THROTTLE_UP.has(code)) { throttleDelta = down ? 1 : 0; return true; }
    if (THROTTLE_DOWN.has(code)) { throttleDelta = down ? -1 : 0; return true; }
    if (PITCH_UP.has(code)) { pitch = down ? -1 : 0; return true; }
    if (PITCH_DOWN.has(code)) { pitch = down ? 1 : 0; return true; }
    if (ROLL_LEFT.has(code)) { roll = down ? -1 : 0; return true; }
    if (ROLL_RIGHT.has(code)) { roll = down ? 1 : 0; return true; }
    if (YAW_LEFT.has(code)) { yaw = down ? -1 : 0; return true; }
    if (YAW_RIGHT.has(code)) { yaw = down ? 1 : 0; return true; }
    if (CONFIRM.has(code)) { if (down && !repeat) actions |= ACTION_CONFIRM; return true; }
    if (PAUSE.has(code)) { if (down && !repeat) actions |= ACTION_PAUSE; return true; }
    if (RESTART.has(code)) { if (down && !repeat) actions |= ACTION_RESTART; return true; }
    return false;
  };

  window.addEventListener('keydown', (event) => {
    if (onKey(event.code, true, event.repeat)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (THROTTLE_UP.has(event.code)) throttleDelta = 0;
    else if (THROTTLE_DOWN.has(event.code)) throttleDelta = 0;
    else if (PITCH_UP.has(event.code)) pitch = 0;
    else if (PITCH_DOWN.has(event.code)) pitch = 0;
    else if (ROLL_LEFT.has(event.code)) roll = 0;
    else if (ROLL_RIGHT.has(event.code)) roll = 0;
    else if (YAW_LEFT.has(event.code)) yaw = 0;
    else if (YAW_RIGHT.has(event.code)) yaw = 0;
  });
  window.addEventListener('blur', () => { pitch = roll = yaw = 0; throttleDelta = 0; });

  // Mouse steering: horizontal pointer offset from the viewport centre steers roll/yaw.
  target.addEventListener('pointermove', (event) => {
    const cx = window.innerWidth / 2;
    pointerX = clamp((event.clientX - cx) / cx, -1, 1);
  });

  return {
    clamp: clamp,
    /** Steering in -1..1: pitch (nose up positive), roll, yaw. */
    steering() {
      return { pitch, roll, yaw, pointerX };
    },
    /** Throttle delta since last take: -1 down, 0 none, 1 up. */
    throttle() { return throttleDelta; },
    /** One-shot presses since last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
