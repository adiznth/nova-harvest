// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (keep a mid-range distance from the nearest drone,
// aim at it, fire, dash out of trouble, spend a full nova on a crowd), so
// every frame is what a real game looks like — and the same seed always
// gives the same frame. The end scene's pilot never fires and drifts into
// the swarm, so it is caught out the way a hurried player is.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY } from './world.js';
import {
  SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';

const START_SECONDS = 6;
const BOSS_SECONDS = 15;
const END_LIMIT_SECONDS = 600;

/** Nearest hostile to the player, or null when the field is empty. */
function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best === null ? null : { enemy: best, dist: bestDist };
}

function nearestCore(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const pk of state.pickups) {
    if (pk.kind !== 'core') continue;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = pk;
    }
  }
  return best === null ? null : { core: best, dist: bestDist };
}

/** The competent pilot: hold ~260 px from the nearest drone, vacuum cores when safe. */
function autopilot(state) {
  const p = state.player;
  const near = nearestEnemy(state);
  let tx = p.x;
  let ty = p.y;
  let aimX = p.x;
  let aimY = p.y - 100;
  let firing = false;
  if (near) {
    const e = near.enemy;
    aimX = e.x;
    aimY = e.y;
    firing = near.dist < 620;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = near.dist || 1;
    const want = 260;
    const radial = d < want - 30 ? 1 : d > want + 40 ? -1 : 0;
    tx = p.x + (dx / d) * radial * 120;
    ty = p.y + (dy / d) * radial * 120;
    // Strafe sideways so the flight path is not a straight line.
    const strafe = Math.sin(state.time * 1.7) * 90;
    tx += (-dy / d) * strafe;
    ty += (dx / d) * strafe;
    const core = nearestCore(state);
    if (core && near.dist > 200) {
      tx = core.core.x;
      ty = core.core.y;
    }
  } else {
    const core = nearestCore(state);
    if (core) {
      tx = core.core.x;
      ty = core.core.y;
    } else {
      tx = FIELD.width / 2;
      ty = FIELD.height / 2;
    }
  }
  const mx = tx - p.x;
  const my = ty - p.y;
  const len = Math.hypot(mx, my) || 1;
  const dash = near !== null && near.dist < 95 && p.dashCooldown <= 0;
  const nova = p.nova >= 100 && state.enemies.length >= 5;
  return {
    move: { x: mx / len, y: my / len },
    aimX, aimY, firing, dash, nova,
  };
}

/** The doomed pilot: never fires, drifts toward the nearest drone. */
function doomedPilot(state) {
  const p = state.player;
  const near = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  if (near) {
    const dx = near.enemy.x - p.x;
    const dy = near.enemy.y - p.y;
    const d = near.dist || 1;
    mx = dx / d;
    my = dy / d;
  }
  return {
    move: { x: mx, y: my },
    aimX: p.x, aimY: p.y - 100,
    firing: false, dash: false, nova: false,
  };
}

function runSteps(world, seconds, pilot) {
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    events |= world.step(STEP, pilot(world.state), false);
    if (events & (EVENT_OVER | EVENT_VICTORY)) break;
    // The upgrade draft pauses the world; the pilot takes the first card.
    if (world.state.waveState === 'upgrade') {
      world.applyUpgrade(world.state.upgradeChoices[0].id);
    }
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    // A late-game loadout, so the frame is busy: twin lance, fast cycle, full nova.
    const p = world.state.player;
    p.shots = 2;
    p.fireInterval = 0.12;
    p.nova = 100;
    world.skipToWave(10);
    runSteps(world, BOSS_SECONDS, autopilot);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // A real run first: 18 seconds of competent play, so the results screen
    // shows a run that got somewhere — then the pilot stops firing and the
    // swarm catches up with it.
    runSteps(world, 18, autopilot);
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, doomedPilot(world.state), false);
      if (events & EVENT_OVER) break;
      if (world.state.waveState === 'upgrade') world.applyUpgrade(world.state.upgradeChoices[0].id);
    }
    // Step the (frozen) world forward until the restart prompt's blink is
    // on, so the screenshot shows how to play again.
    for (let i = 0; i < 1 / STEP && Math.sin(world.state.time * 4) <= 0.3; i += 1) {
      world.step(STEP, null, false);
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Play until the fight is busy: wave 2, mid-wave, at least five drones
  // on screen and points on the board — never a just-cleared empty field.
  for (let i = 0; i < 40 / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state), false);
    if (events & (EVENT_OVER | EVENT_VICTORY)) break;
    if (world.state.waveState === 'upgrade') world.applyUpgrade(world.state.upgradeChoices[0].id);
    if (world.state.wave >= 2 && world.state.waveState === 'fight' && world.state.enemies.length >= 5 && world.state.score > 300) break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
