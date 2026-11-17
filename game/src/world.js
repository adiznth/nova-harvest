// NOVA HARVEST — the simulation. One fixed-step world: the harvester ship, its
// bullets, five drone types, the MOTHERCORE boss, pickups, particles, waves and
// the between-wave upgrade draft. It knows nothing about the DOM or the canvas;
// it only reads an input object and returns event flags. Everything random
// comes from the seeded generator, so a seed replays the same run.

import {
  BOSS_WAVE, COMBO, ENEMY, FIELD, NOVA, PICKUP, PLAYER, STEP, UPGRADES, WAVE,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;
export const EVENT_NOVA = 16;
export const EVENT_BOSS = 32;

export const KIND_CHASER = 'chaser';
export const KIND_WEAVER = 'weaver';
export const KIND_SPITTER = 'spitter';
export const KIND_SPLITTER = 'splitter';
export const KIND_MINI = 'mini';
export const KIND_BOSS = 'boss';

/** Spawn weights per wave: new drone types join the mix as waves climb. */
function composition(wave) {
  const table = [[KIND_CHASER, 10]];
  if (wave >= 2) table.push([KIND_WEAVER, 6]);
  if (wave >= 3) table.push([KIND_SPITTER, 5]);
  if (wave >= 4) table.push([KIND_SPLITTER, 4]);
  return table;
}

function pickKind(random, wave) {
  const table = composition(wave);
  let total = 0;
  for (const [, weight] of table) total += weight;
  let roll = random.next() * total;
  for (const [kind, weight] of table) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return KIND_CHASER;
}

export function createWorld(random) {
  const state = {
    time: 0,
    wave: 1,
    waveState: 'banner',
    bannerTimer: WAVE.bannerSeconds,
    bannerText: 'WAVE 1',
    clearTimer: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    coresCollected: 0,
    novasUsed: 0,
    dashesUsed: 0,
    shotsFired: 0,
    shotsHit: 0,
    victory: false,
    endless: false,
    over: false,
    shake: 0,
    flash: 0,
    novaBlast: 0,
    upgradeChoices: [],
    boss: null,
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    pickups: [],
    particles: [],
    texts: [],
    stars: [],
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      angle: -Math.PI / 2,
      hull: PLAYER.hull,
      maxHull: PLAYER.maxHull,
      fireTimer: 0,
      invuln: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashCooldownMax: PLAYER.dashCooldown,
      shieldTimer: 0,
      overdriveTimer: 0,
      shots: 1,
      fireInterval: PLAYER.fireInterval,
      bulletSpeed: PLAYER.bulletSpeed,
      bulletDamage: PLAYER.bulletDamage,
      speed: PLAYER.speed,
      pickupRadius: PLAYER.pickupRadius,
      nova: 0,
      novaGain: 1,
      alive: true,
    };
  }

  function makeStars() {
    const stars = [];
    for (let i = 0; i < 130; i += 1) {
      stars.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        layer: random.int(1, 3),
        size: random.range(0.6, 2.2),
        twinkle: random.range(0, Math.PI * 2),
      });
    }
    return stars;
  }

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.angle();
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(life * 0.5, life),
        maxLife: life,
        size: random.range(size * 0.6, size * 1.4),
        color,
        drag: 3,
      });
    }
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  }

  function addText(x, y, text, color, size) {
    state.texts.push({ x, y, text, color, size: size || 15, life: 0.9, maxLife: 0.9 });
  }

  function edgeSpawn() {
    const margin = 40;
    const side = random.int(0, 3);
    const p = state.player;
    let x = 0;
    let y = 0;
    if (side === 0) { x = random.range(0, FIELD.width); y = -margin; }
    else if (side === 1) { x = FIELD.width + margin; y = random.range(0, FIELD.height); }
    else if (side === 2) { x = random.range(0, FIELD.width); y = FIELD.height + margin; }
    else { x = -margin; y = random.range(0, FIELD.height); }
    // Never spawn on top of the player.
    if (Math.hypot(x - p.x, y - p.y) < 220) { x = FIELD.width - x; y = FIELD.height - y; }
    return { x, y };
  }

  function spawnEnemy(kind) {
    const def = ENEMY[kind];
    const hpScale = 1 + (state.wave - 1) * WAVE.hpPerWave;
    const speedScale = Math.min(1.5, 1 + (state.wave - 1) * WAVE.speedPerWave);
    const at = edgeSpawn();
    const enemy = {
      kind,
      x: at.x, y: at.y,
      vx: 0, vy: 0,
      radius: def.radius,
      hp: Math.round(def.hp * hpScale),
      maxHp: Math.round(def.hp * hpScale),
      speed: def.speed * speedScale,
      score: def.score,
      cores: def.cores,
      color: def.color,
      touch: def.touch,
      angle: random.angle(),
      phase: random.range(0, Math.PI * 2),
      fireTimer: random.range(1.2, 2.4),
      spawnTimer: 0,
      hitFlash: 0,
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function spawnBoss() {
    const def = ENEMY.boss;
    const boss = {
      kind: KIND_BOSS,
      x: FIELD.width / 2, y: -90,
      vx: 0, vy: 0,
      radius: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      score: def.score,
      cores: def.cores,
      color: def.color,
      touch: def.touch,
      angle: Math.PI / 2,
      phase: 0,
      fireTimer: 2,
      spawnTimer: 4,
      hitFlash: 0,
      entering: true,
    };
    state.enemies.push(boss);
    state.boss = boss;
    return boss;
  }

  function buildQueue() {
    const queue = [];
    if (state.wave === BOSS_WAVE) return queue;
    const budget = WAVE.budgetBase + state.wave * WAVE.budgetPerWave;
    for (let i = 0; i < budget; i += 1) queue.push(pickKind(random, state.wave));
    return queue;
  }

  function dropPickups(enemy) {
    for (let i = 0; i < enemy.cores; i += 1) {
      const angle = random.angle();
      state.pickups.push({
        kind: 'core',
        x: enemy.x + Math.cos(angle) * 12,
        y: enemy.y + Math.sin(angle) * 12,
        vx: Math.cos(angle) * random.range(40, 130),
        vy: Math.sin(angle) * random.range(40, 130),
        radius: PICKUP.core.radius,
        life: 12,
      });
    }
    const roll = random.next();
    const p = state.player;
    if (roll < 0.08 && p.hull < p.maxHull) {
      state.pickups.push({ kind: 'hull', x: enemy.x, y: enemy.y, vx: 0, vy: -30, radius: PICKUP.hull.radius, life: 10 });
    } else if (roll < 0.11) {
      state.pickups.push({ kind: 'overdrive', x: enemy.x, y: enemy.y, vx: 0, vy: -30, radius: PICKUP.overdrive.radius, life: 10 });
    } else if (roll < 0.16) {
      state.pickups.push({ kind: 'shield', x: enemy.x, y: enemy.y, vx: 0, vy: -30, radius: PICKUP.shield.radius, life: 10 });
    }
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.multiplier = Math.min(COMBO.cap, 1 + Math.min(state.combo, 40) * COMBO.step);
    const gained = Math.round(enemy.score * state.multiplier);
    state.score += gained;
    addText(enemy.x, enemy.y - 10, `+${gained}`, '#ffffff', enemy.kind === KIND_BOSS ? 26 : 15);
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === KIND_BOSS ? 90 : 22, enemy.kind === KIND_BOSS ? 420 : 260, 0.7, enemy.kind === KIND_BOSS ? 5 : 3);
    state.shake = Math.min(14, state.shake + (enemy.kind === KIND_BOSS ? 14 : 3));
    dropPickups(enemy);
    if (enemy.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) {
        const mini = {
          kind: KIND_MINI, x: enemy.x + (i === 0 ? -14 : 14), y: enemy.y,
          vx: 0, vy: 0, radius: ENEMY.mini.radius,
          hp: ENEMY.mini.hp, maxHp: ENEMY.mini.hp,
          speed: ENEMY.mini.speed, score: ENEMY.mini.score, cores: ENEMY.mini.cores,
          color: ENEMY.mini.color, touch: ENEMY.mini.touch,
          angle: random.angle(), phase: random.range(0, Math.PI * 2),
          fireTimer: 0, spawnTimer: 0, hitFlash: 0,
        };
        state.enemies.push(mini);
      }
    }
    if (enemy.kind === KIND_BOSS) {
      state.boss = null;
      state.flash = 1;
      return 'boss';
    }
    return 'drone';
  }

  function hurtPlayer(damage) {
    const p = state.player;
    if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return false;
    if (p.shieldTimer > 0) {
      p.shieldTimer = 0;
      addText(p.x, p.y - 26, 'SHIELD DOWN', '#7ab8ff', 16);
      burst(p.x, p.y, '#7ab8ff', 18, 240, 0.5, 3);
      p.invuln = 0.8;
      return true;
    }
    p.hull -= damage;
    p.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.multiplier = 1;
    state.shake = Math.min(18, state.shake + 8);
    state.flash = 0.55;
    burst(p.x, p.y, '#ff2e63', 26, 320, 0.6, 4);
    if (p.hull <= 0) {
      p.alive = false;
      burst(p.x, p.y, '#35f1ff', 80, 420, 1.1, 5);
      burst(p.x, p.y, '#ffffff', 30, 200, 0.8, 3);
      state.shake = 20;
      state.over = true;
      return 'dead';
    }
    return true;
  }

  function fireNova() {
    const p = state.player;
    if (!p.alive || p.nova < NOVA.cost) return false;
    p.nova -= NOVA.cost;
    state.novasUsed += 1;
    state.novaBlast = NOVA.blastSeconds;
    state.flash = 1;
    state.shake = 16;
    state.ebullets.length = 0;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.hp -= NOVA.damage;
      enemy.hitFlash = 0.3;
      if (enemy.hp <= 0) killEnemy(enemy, i);
    }
    return true;
  }

  function rollUpgrades() {
    const pool = [...UPGRADES];
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const index = Math.floor(random.next() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    state.upgradeChoices = choices;
  }

  function startWave() {
    state.waveState = 'banner';
    state.bannerTimer = WAVE.bannerSeconds;
    if (state.wave === BOSS_WAVE) {
      state.bannerText = 'WARNING — MOTHERCORE';
    } else {
      state.bannerText = `WAVE ${state.wave}`;
    }
    state.spawnQueue = buildQueue();
    state.spawnTimer = 0;
  }

  function reset() {
    state.time = 0;
    state.wave = 1;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.kills = 0;
    state.coresCollected = 0;
    state.novasUsed = 0;
    state.dashesUsed = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.victory = false;
    state.endless = false;
    state.over = false;
    state.shake = 0;
    state.flash = 0;
    state.novaBlast = 0;
    state.upgradeChoices = [];
    state.boss = null;
    state.enemies = [];
    state.bullets = [];
    state.ebullets = [];
    state.pickups = [];
    state.particles = [];
    state.texts = [];
    state.stars = makeStars();
    state.player = freshPlayer();
    startWave();
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (!p.alive) return;
    const move = input ? input.move : { x: 0, y: 0 };
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const drag = Math.exp(-PLAYER.friction * dt);
    p.vx *= drag;
    p.vy *= drag;
    const speed = Math.hypot(p.vx, p.vy);
    const max = p.speed * (p.dashTimer > 0 ? 2.9 : 1);
    if (speed > max) {
      p.vx = (p.vx / speed) * max;
      p.vy = (p.vy / speed) * max;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y));
    if (input) {
      p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.shieldTimer > 0) p.shieldTimer -= dt;
    if (p.overdriveTimer > 0) p.overdriveTimer -= dt;
    if (input && input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = p.dashCooldownMax;
      state.dashesUsed += 1;
      const dx = move.x !== 0 || move.y !== 0 ? move.x : Math.cos(p.angle);
      const dy = move.x !== 0 || move.y !== 0 ? move.y : Math.sin(p.angle);
      p.vx = dx * PLAYER.dashSpeed;
      p.vy = dy * PLAYER.dashSpeed;
      burst(p.x, p.y, '#35f1ff', 10, 180, 0.35, 3);
    }
    if (p.dashTimer > 0) p.dashTimer -= dt;
    // Thruster trail while moving.
    if (speed > 120 && random.next() < 0.5) {
      state.particles.push({
        x: p.x - Math.cos(p.angle) * 18 + random.range(-4, 4),
        y: p.y - Math.sin(p.angle) * 18 + random.range(-4, 4),
        vx: -p.vx * 0.15, vy: -p.vy * 0.15,
        life: 0.3, maxLife: 0.3, size: random.range(2, 4), color: '#35f1ff', drag: 2,
      });
    }
    // Firing.
    p.fireTimer -= dt;
    const firing = input ? input.firing : false;
    if (firing && p.fireTimer <= 0) {
      const interval = p.fireInterval * (p.overdriveTimer > 0 ? 0.55 : 1);
      p.fireTimer = interval;
      const count = p.shots;
      for (let i = 0; i < count; i += 1) {
        const spread = (i - (count - 1) / 2) * 0.11;
        const a = p.angle + spread;
        state.bullets.push({
          x: p.x + Math.cos(a) * 22,
          y: p.y + Math.sin(a) * 22,
          vx: Math.cos(a) * p.bulletSpeed,
          vy: Math.sin(a) * p.bulletSpeed,
          radius: PLAYER.bulletRadius,
          damage: p.bulletDamage,
          life: 1.1,
        });
      }
      state.shotsFired += count;
    }
  }

  function stepEnemy(enemy, dt) {
    const p = state.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.phase += dt;
    if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
    if (enemy.kind === KIND_CHASER || enemy.kind === KIND_MINI) {
      enemy.vx += (dx / dist) * enemy.speed * 3 * dt;
      enemy.vy += (dy / dist) * enemy.speed * 3 * dt;
      const v = Math.hypot(enemy.vx, enemy.vy);
      const max = enemy.speed;
      if (v > max) { enemy.vx = (enemy.vx / v) * max; enemy.vy = (enemy.vy / v) * max; }
      enemy.angle = Math.atan2(enemy.vy, enemy.vx);
    } else if (enemy.kind === KIND_WEAVER) {
      const nx = -dy / dist;
      const ny = dx / dist;
      const weave = Math.sin(enemy.phase * 3.2) * 0.9;
      enemy.vx = (dx / dist) * enemy.speed + nx * weave * enemy.speed;
      enemy.vy = (dy / dist) * enemy.speed + ny * weave * enemy.speed;
      enemy.angle = Math.atan2(dy, dx);
    } else if (enemy.kind === KIND_SPITTER) {
      const want = 270;
      const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      enemy.vx = (dx / dist) * enemy.speed * toward * 0.8;
      enemy.vy = (dy / dist) * enemy.speed * toward * 0.8;
      enemy.angle = Math.atan2(dy, dx);
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist < 560 && p.alive) {
        enemy.fireTimer = random.range(2.4, 3.0);
        const a = Math.atan2(dy, dx);
        state.ebullets.push({
          x: enemy.x + Math.cos(a) * (enemy.radius + 6),
          y: enemy.y + Math.sin(a) * (enemy.radius + 6),
          vx: Math.cos(a) * 185, vy: Math.sin(a) * 185,
          radius: 6, life: 5,
        });
      }
    } else if (enemy.kind === KIND_SPLITTER) {
      enemy.vx += (dx / dist) * enemy.speed * 2 * dt;
      enemy.vy += (dy / dist) * enemy.speed * 2 * dt;
      const v = Math.hypot(enemy.vx, enemy.vy);
      if (v > enemy.speed) { enemy.vx = (enemy.vx / v) * enemy.speed; enemy.vy = (enemy.vy / v) * enemy.speed; }
      enemy.angle += dt * 1.5;
    } else if (enemy.kind === KIND_BOSS) {
      stepBoss(enemy, dt, dx, dy, dist);
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    if (enemy.kind !== KIND_BOSS) {
      enemy.x = Math.max(-60, Math.min(FIELD.width + 60, enemy.x));
      enemy.y = Math.max(-60, Math.min(FIELD.height + 60, enemy.y));
    }
  }

  function stepBoss(boss, dt, dx, dy, dist) {
    const p = state.player;
    if (boss.entering) {
      boss.y += 60 * dt;
      if (boss.y >= 130) { boss.entering = false; boss.y = 130; }
      return;
    }
    const hpFrac = boss.hp / boss.maxHp;
    const phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    // Slow drift toward the player, keeping some distance.
    const toward = dist > 240 ? 1 : dist < 150 ? -0.6 : 0;
    boss.vx = (dx / dist) * boss.speed * toward;
    boss.vy = (dy / dist) * boss.speed * toward;
    boss.fireTimer -= dt;
    if (boss.fireTimer <= 0 && p.alive) {
      if (phase === 1) {
        boss.fireTimer = 2.4;
        const n = 12;
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * Math.PI * 2 + boss.phase;
          state.ebullets.push({
            x: boss.x + Math.cos(a) * (boss.radius + 4),
            y: boss.y + Math.sin(a) * (boss.radius + 4),
            vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
            radius: 7, life: 7,
          });
        }
      } else if (phase === 2) {
        boss.fireTimer = 0.16;
        const a = boss.phase * 2.4;
        for (const off of [0, Math.PI]) {
          state.ebullets.push({
            x: boss.x + Math.cos(a + off) * (boss.radius + 4),
            y: boss.y + Math.sin(a + off) * (boss.radius + 4),
            vx: Math.cos(a + off) * 185, vy: Math.sin(a + off) * 185,
            radius: 6, life: 6,
          });
        }
        if (boss.fireTimer < 0) boss.fireTimer = 0.16;
      } else {
        boss.fireTimer = 1.1;
        const base = Math.atan2(dy, dx);
        for (const off of [-0.22, 0, 0.22]) {
          state.ebullets.push({
            x: boss.x + Math.cos(base + off) * (boss.radius + 4),
            y: boss.y + Math.sin(base + off) * (boss.radius + 4),
            vx: Math.cos(base + off) * 260, vy: Math.sin(base + off) * 260,
            radius: 6, life: 5,
          });
        }
      }
    }
    boss.spawnTimer -= dt;
    if (boss.spawnTimer <= 0 && state.enemies.length < 9) {
      boss.spawnTimer = phase === 1 ? 8 : 5;
      for (let i = 0; i < 2; i += 1) {
        const mini = {
          kind: KIND_MINI,
          x: boss.x + (i === 0 ? -boss.radius : boss.radius), y: boss.y + boss.radius * 0.6,
          vx: 0, vy: 0, radius: ENEMY.mini.radius,
          hp: ENEMY.mini.hp, maxHp: ENEMY.mini.hp,
          speed: ENEMY.mini.speed, score: ENEMY.mini.score, cores: ENEMY.mini.cores,
          color: ENEMY.mini.color, touch: ENEMY.mini.touch,
          angle: random.angle(), phase: random.range(0, Math.PI * 2),
          fireTimer: 0, spawnTimer: 0, hitFlash: 0,
        };
        state.enemies.push(mini);
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = b.radius + e.radius;
        if (Math.abs(b.x - e.x) < rr && Math.abs(b.y - e.y) < rr && Math.hypot(b.x - e.x, b.y - e.y) < rr) {
          state.shotsHit += 1;
          e.hp -= b.damage;
          e.hitFlash = 0.12;
          burst(b.x, b.y, '#8ef6ff', 3, 140, 0.25, 2);
          state.bullets.splice(i, 1);
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.ebullets.splice(i, 1);
      }
    }
  }

  function stepPickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= Math.exp(-2 * dt);
      pk.vy *= Math.exp(-2 * dt);
      if (pk.life <= 0) { state.pickups.splice(i, 1); continue; }
      if (!p.alive) continue;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);
      if (pk.kind === 'core' && dist < p.pickupRadius) {
        pk.vx += (dx / (dist || 1)) * PICKUP.core.magnetSpeed * dt * 6;
        pk.vy += (dy / (dist || 1)) * PICKUP.core.magnetSpeed * dt * 6;
      }
      if (dist < p.radius + pk.radius + 4) {
        if (pk.kind === 'core') {
          state.score += PICKUP.core.value;
          state.coresCollected += 1;
          p.nova = Math.min(PLAYER.novaMax, p.nova + PICKUP.core.nova * p.novaGain);
          burst(pk.x, pk.y, '#ffd34d', 5, 160, 0.3, 2);
        } else if (pk.kind === 'hull') {
          p.hull = Math.min(p.maxHull, p.hull + PICKUP.hull.value);
          addText(p.x, p.y - 26, '+1 HULL', '#7dff8a', 16);
        } else if (pk.kind === 'overdrive') {
          p.overdriveTimer = PICKUP.overdrive.seconds;
          addText(p.x, p.y - 26, 'OVERDRIVE!', '#ff9f43', 16);
        } else if (pk.kind === 'shield') {
          p.shieldTimer = PICKUP.shield.seconds;
          addText(p.x, p.y - 26, 'SHIELD UP', '#7ab8ff', 16);
        }
        state.pickups.splice(i, 1);
      }
    }
  }

  function stepCollisions() {
    const p = state.player;
    if (!p.alive) return null;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const rr = p.radius + e.radius - 4;
      if (Math.hypot(p.x - e.x, p.y - e.y) < rr) {
        const result = hurtPlayer(e.touch);
        if (result) {
          e.hp -= 1;
          e.hitFlash = 0.15;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          e.vx += (dx / d) * 260;
          e.vy += (dy / d) * 260;
          if (e.hp <= 0) killEnemy(e, i);
          if (result === 'dead') return EVENT_OVER;
          return EVENT_HIT;
        }
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      const rr = p.radius + b.radius - 4;
      if (Math.hypot(p.x - b.x, p.y - b.y) < rr) {
        state.ebullets.splice(i, 1);
        const result = hurtPlayer(1);
        if (result === 'dead') return EVENT_OVER;
        if (result) return EVENT_HIT;
      }
    }
    return null;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const drag = Math.exp(-pt.drag * dt);
      pt.vx *= drag;
      pt.vy *= drag;
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 40 * dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - 2.2 * dt);
    if (state.novaBlast > 0) {
      state.novaBlast -= dt;
      if (random.next() < 0.6) {
        const a = random.angle();
        const r = random.range(40, 300);
        burst(state.player.x + Math.cos(a) * r, state.player.y + Math.sin(a) * r, '#8ef6ff', 2, 120, 0.4, 3);
      }
    }
  }

  function stepWaves(dt) {
    if (state.waveState === 'banner') {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        state.waveState = 'fight';
        if (state.wave === BOSS_WAVE) spawnBoss();
      }
      return 0;
    }
    if (state.waveState === 'fight') {
      if (state.spawnQueue && state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval * Math.pow(0.96, state.wave - 1));
        if (state.spawnTimer <= 0) {
          state.spawnTimer = interval;
          spawnEnemy(state.spawnQueue.shift());
        }
      }
      const queueEmpty = !state.spawnQueue || state.spawnQueue.length === 0;
      if (queueEmpty && state.enemies.length === 0) {
        state.waveState = 'clear';
        state.clearTimer = WAVE.clearPause;
        return EVENT_WAVE_CLEAR;
      }
      return 0;
    }
    if (state.waveState === 'clear') {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        if (state.victory) return 0;
        rollUpgrades();
        state.waveState = 'upgrade';
      }
      return 0;
    }
    return 0;
  }

  /** Advance the world one fixed step. `input` is null in attract (title) mode. */
  function step(dt, input, attract) {
    state.time += dt;
    let events = 0;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
    // The title screen's living backdrop: drones drift by, nothing can hurt you.
    if (attract) {
      if (state.enemies.length < 7 && random.next() < 0.02) {
        const kinds = [KIND_CHASER, KIND_WEAVER, KIND_SPITTER];
        const kind = kinds[Math.floor(random.next() * kinds.length)];
        const e = spawnEnemy(kind);
        e.x = random.range(0, FIELD.width);
        e.y = -30;
      }
      for (const e of state.enemies) {
        e.y += 40 * dt;
        e.phase += dt;
        e.x += Math.sin(e.phase * 2) * 20 * dt;
      }
      state.enemies = state.enemies.filter((e) => e.y < FIELD.height + 60);
      stepParticles(dt);
      return 0;
    }
    if (state.over || state.victory) {
      stepParticles(dt);
      return 0;
    }
    if (state.waveState === 'upgrade') {
      stepParticles(dt);
      return 0;
    }
    if (input && input.nova) {
      if (fireNova()) events |= EVENT_NOVA;
    }
    stepPlayer(dt, input);
    for (const e of state.enemies) stepEnemy(e, dt);
    stepBullets(dt);
    stepPickups(dt);
    const hit = stepCollisions();
    if (hit === EVENT_OVER) events |= EVENT_OVER;
    else if (hit === EVENT_HIT) events |= EVENT_HIT;
    // The boss going down wins the run: check before the wave logic below can
    // move the wave to 'clear', or the victory would be missed for a step.
    if (state.boss === null && state.wave === BOSS_WAVE && state.waveState === 'fight' && !state.victory) {
      state.victory = true;
      events |= EVENT_VICTORY;
    }
    events |= stepWaves(dt);
    stepParticles(dt);
    return events;
  }

  /** Apply one drafted upgrade, then open the next wave. */
  function applyUpgrade(id) {
    const choice = state.upgradeChoices.find((u) => u.id === id) || state.upgradeChoices[0];
    if (!choice) return;
    choice.apply(state.player);
    state.upgradeChoices = [];
    state.wave += 1;
    startWave();
  }

  /** After victory, keep playing: waves keep coming, harder, forever. */
  function continueEndless() {
    state.victory = false;
    state.endless = true;
    state.wave = BOSS_WAVE + 1;
    state.player.hull = Math.min(state.player.maxHull, state.player.hull + 2);
    startWave();
  }

  /** Jump straight to a wave (the screenshot scenes use it to stage the boss). */
  function skipToWave(wave) {
    state.wave = wave;
    state.enemies = [];
    state.bullets = [];
    state.ebullets = [];
    state.pickups = [];
    state.boss = null;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height - 170;
    state.player.hull = state.player.maxHull;
    startWave();
  }

  reset();

  return {
    state,
    step,
    reset,
    applyUpgrade,
    continueEndless,
    rollUpgrades,
    skipToWave,
  };
}
