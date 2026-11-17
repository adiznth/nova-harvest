// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade draft, paused, game over and victory.
//
// ?seed=N fixes the run's random pattern. ?shot=start|play|boss|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, BEST_WAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_NOVA, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE,
  ACTION_RESTART, ACTION_UPGRADE_1, ACTION_UPGRADE_2, ACTION_UPGRADE_3,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY,
  createRenderer, upgradeCardRects,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readNumber(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readNumber(BEST_KEY);
  let bestWave = readNumber(BEST_WAVE_KEY);
  let accumulator = 0;
  let last = performance.now();

  // Audio starts only after a gesture; every later gesture is a no-op here.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function recordBest() {
    if (world.state.score > best) {
      best = world.state.score;
      saveNumber(BEST_KEY, best);
    }
    if (world.state.wave > bestWave) {
      bestWave = world.state.wave;
      saveNumber(BEST_WAVE_KEY, bestWave);
    }
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Wave 1. ${world.state.player.hull} hull.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    recordBest();
    audio.gameOver();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_VICTORY;
    recordBest();
    audio.victory();
    announce(`Victory. The MOTHERCORE is down. Score ${world.state.score}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) {
        world.continueEndless();
        screen = SCREEN_PLAY;
        announce('Endless mode. The swarm keeps coming.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      const rects = upgradeCardRects();
      const click = input.takeClick();
      let pick = -1;
      if (actions & ACTION_UPGRADE_1) pick = 0;
      else if (actions & ACTION_UPGRADE_2) pick = 1;
      else if (actions & ACTION_UPGRADE_3) pick = 2;
      else if (click) {
        const field = renderer.toField(click.x, click.y);
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (field.x >= r.x && field.x <= r.x + r.w && field.y >= r.y && field.y <= r.y + r.h) pick = i;
        }
      }
      if (pick >= 0 && world.state.upgradeChoices[pick]) {
        const name = world.state.upgradeChoices[pick].name;
        world.applyUpgrade(world.state.upgradeChoices[pick].id);
        audio.upgrade();
        screen = SCREEN_PLAY;
        announce(`${name} installed. Wave ${world.state.wave}.`);
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function worldInput(actions) {
    const move = input.move();
    const aimCss = input.aimCss();
    let aimX = world.state.player.x;
    let aimY = world.state.player.y - 100;
    if (aimCss.seen) {
      const field = renderer.toField(aimCss.x, aimCss.y);
      aimX = field.x;
      aimY = field.y;
    } else {
      // Keyboard-only play: aim at the nearest drone, else straight ahead.
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of world.state.enemies) {
        const d = Math.hypot(e.x - world.state.player.x, e.y - world.state.player.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (nearest) {
        aimX = nearest.x;
        aimY = nearest.y;
      }
    }
    return {
      move,
      aimX,
      aimY,
      firing: input.firing(),
      dash: Boolean(actions & ACTION_DASH),
      nova: Boolean(actions & ACTION_NOVA),
    };
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, worldInput(actions), false);
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(`Hit. ${world.state.player.hull} hull left.`);
    }
    if (events & EVENT_VICTORY) winGame();
    else if (events & EVENT_OVER) endGame();
    else if (world.state.waveState === 'upgrade') {
      screen = SCREEN_UPGRADE;
      announce('Wave cleared. Choose an upgrade.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One read of the action queue per frame: handleActions spends the menu
    // keys, step() spends the same frame's dash and nova presses.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting drones close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nova Harvest. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
