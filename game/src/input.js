// Emberwarden — keyboard and mouse input.
// One clear job: turn raw DOM events into the small set of actions the
// game loop reads each frame (move vector, aim point, dash, confirm, pause).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === 'Enter' || event.key === ' ') actions |= ACTION_CONFIRM;
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') actions |= ACTION_PAUSE;
    if (event.key === 'Shift' || event.key === ' ') actions |= ACTION_DASH;
    if (event.key.toLowerCase() === 'm') actions |= ACTION_MUTE;
    if (event.key === '1' || event.key === '2' || event.key === '3') {
      actions |= (16 << (Number(event.key) - 1));
    }
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouseDown = true;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Normalised movement vector from WASD / arrow keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Aim point in canvas pixels (mouse position). */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** Whether the fire button (left mouse) is held. Firing is automatic too. */
    firing() {
      return mouseDown;
    },
    /** Actions queued since the last read; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
