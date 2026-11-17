// Keyboard and mouse, read every frame. Movement and aim are live values; the
// one-shot actions (confirm, pause, dash, nova, mute, upgrade picks) are queued
// and handed out once by takeActions(), so a held key never double-fires.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_NOVA = 8;
export const ACTION_MUTE = 16;
export const ACTION_UPGRADE_1 = 32;
export const ACTION_UPGRADE_2 = 64;
export const ACTION_UPGRADE_3 = 128;
export const ACTION_RESTART = 256;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let firing = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;
  let lastClick = null;

  function queue(action) {
    queued |= action;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      queue(ACTION_CONFIRM);
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      queue(ACTION_PAUSE);
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      queue(ACTION_DASH);
    } else if (event.code === 'KeyE' || event.code === 'KeyQ') {
      queue(ACTION_NOVA);
    } else if (event.code === 'KeyM') {
      queue(ACTION_MUTE);
    } else if (event.code === 'Digit1' || event.code === 'Numpad1') {
      queue(ACTION_UPGRADE_1);
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      queue(ACTION_UPGRADE_2);
    } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
      queue(ACTION_UPGRADE_3);
    } else if (event.code === 'KeyR') {
      queue(ACTION_RESTART);
    }
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    if (event.button === 0) firing = true;
    else if (event.button === 2) queue(ACTION_DASH);
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    lastClick = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    queue(ACTION_CONFIRM);
  });

  return {
    /** Normalised movement vector from WASD / arrow keys. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Mouse position in canvas CSS pixels (the renderer maps it to the field). */
    aimCss() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** Holding the left button or Space fires. */
    firing() {
      return firing || keys.has('Space');
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** The last click's canvas CSS position, once (for upgrade-card picks). */
    takeClick() {
      const click = lastClick;
      lastClick = null;
      return click;
    },
  };
}
