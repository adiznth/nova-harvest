// NOVA HARVEST — every pixel the player sees. Canvas 2D with pre-rendered
// glow sprites (a radial gradient drawn once per colour, then stamped with
// 'lighter' blending), so the neon look stays fast. The playfield is the
// fixed 1280x720 logical area; the renderer letterboxes it into the window.
// Shake uses the world's clock, never Math.random, so a staged screenshot is
// the same frame every time it is taken.

import { BOSS_WAVE, FIELD, FONT, FONT_DISPLAY, PALETTE } from './config.js';
import { KIND_BOSS, KIND_MINI } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

/** The three upgrade cards, in field coordinates: main.js hit-tests clicks here. */
export function upgradeCardRects() {
  const w = 300;
  const h = 250;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 236;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

const GLOW_COLORS = ['#35f1ff', '#ff5d7a', '#ff9f43', '#b388ff', '#4dd0e1', '#ff2e63', '#ffd34d', '#7dff8a', '#7ab8ff', '#ff7ad9', '#ffffff'];

function makeGlowSprites() {
  const sprites = new Map();
  for (const color of GLOW_COLORS) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
  }
  return sprites;
}

function drawGlow(ctx, sprites, color, x, y, radius, alpha) {
  const sprite = sprites.get(color) || sprites.get('#ffffff');
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function poly(ctx, x, y, radius, points, rotation) {
  ctx.beginPath();
  for (let i = 0; i < points; i += 1) {
    const a = rotation + (i / points) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function heart(ctx, x, y, size, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.2, y, x - size * 0.6, y - size, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.6, y - size, x + size * 1.2, y, x, y + size * 0.9);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = makeGlowSprites();
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / FIELD.width, cssH / FIELD.height);
    offsetX = (cssW - FIELD.width * scale) / 2;
    offsetY = (cssH - FIELD.height * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  resize();

  function toField(cssX, cssY) {
    return { x: (cssX - offsetX) / scale, y: (cssY - offsetY) / scale };
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.space);
    g.addColorStop(0.55, PALETTE.nebulaA);
    g.addColorStop(1, PALETTE.nebulaB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Nebula blobs.
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sprites, '#b388ff', 220, 160, 260, 0.10);
    drawGlow(ctx, sprites, '#35f1ff', 1080, 560, 300, 0.08);
    drawGlow(ctx, sprites, '#ff2e63', 1060, 120, 200, 0.06);
    ctx.globalCompositeOperation = 'source-over';
    // Stars, twinkling on the world's clock.
    for (const s of state.stars) {
      const a = 0.35 + 0.3 * Math.sin(state.time * 1.5 + s.twinkle) + (s.layer - 1) * 0.12;
      ctx.globalAlpha = Math.max(0.1, Math.min(1, a));
      ctx.fillStyle = '#dfeaff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    // Faint grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 0; y <= FIELD.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const blink = pk.life < 3 ? (Math.sin(state.time * 12) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = blink;
      if (pk.kind === 'core') {
        drawGlow(ctx, sprites, '#ffd34d', pk.x, pk.y, 22, 0.8);
        ctx.fillStyle = PALETTE.core;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, pk.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath();
        ctx.arc(pk.x - 2, pk.y - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (pk.kind === 'hull') {
        drawGlow(ctx, sprites, '#7dff8a', pk.x, pk.y, 26, 0.8);
        heart(ctx, pk.x, pk.y + 2, 8, '#7dff8a');
      } else if (pk.kind === 'overdrive') {
        drawGlow(ctx, sprites, '#ff9f43', pk.x, pk.y, 26, 0.8);
        ctx.fillStyle = '#ff9f43';
        poly(ctx, pk.x, pk.y, 11, 3, -Math.PI / 2);
        ctx.fill();
      } else {
        drawGlow(ctx, sprites, '#7ab8ff', pk.x, pk.y, 26, 0.8);
        ctx.strokeStyle = '#7ab8ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e, state) {
    const flash = e.hitFlash > 0;
    const body = flash ? '#ffffff' : e.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    drawGlow(ctx, sprites, e.color, 0, 0, e.radius * 2.6, 0.55);
    ctx.rotate(e.angle || 0);
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5;
    if (e.kind === 'chaser') {
      ctx.beginPath();
      ctx.moveTo(e.radius + 6, 0);
      ctx.lineTo(-e.radius * 0.8, e.radius * 0.75);
      ctx.lineTo(-e.radius * 0.35, 0);
      ctx.lineTo(-e.radius * 0.8, -e.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === 'weaver') {
      poly(ctx, 0, 0, e.radius, 4, state.time * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      poly(ctx, 0, 0, e.radius, 5, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1245';
      ctx.beginPath();
      ctx.arc(e.radius * 0.45, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'splitter' || e.kind === KIND_MINI) {
      poly(ctx, 0, 0, e.radius, 6, e.angle);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      poly(ctx, 0, 0, e.radius * 0.45, 6, -e.angle);
      ctx.fill();
    }
    ctx.restore();
    if (e.hp < e.maxHp && e.kind !== KIND_BOSS) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawBoss(e, state) {
    const flash = e.hitFlash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    drawGlow(ctx, sprites, '#ff2e63', 0, 0, e.radius * 3.2, 0.7);
    // Rotating outer ring.
    ctx.strokeStyle = flash ? '#ffffff' : '#ff5d7a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const a = state.time * 0.7 + (i / 12) * Math.PI * 2;
      const x1 = Math.cos(a) * (e.radius + 12);
      const y1 = Math.sin(a) * (e.radius + 12);
      const x2 = Math.cos(a + 0.3) * (e.radius + 12);
      const y2 = Math.sin(a + 0.3) * (e.radius + 12);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    // Hex core.
    ctx.rotate(state.time * 0.25);
    ctx.fillStyle = flash ? '#ffffff' : '#ff2e63';
    poly(ctx, 0, 0, e.radius, 6, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(-state.time * 0.25);
    // Eye.
    ctx.fillStyle = '#1a0510';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 5);
    drawGlow(ctx, sprites, '#ff7ad9', 0, 0, e.radius * 0.5, pulse);
    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return; // blink while invulnerable
    ctx.save();
    ctx.translate(p.x, p.y);
    drawGlow(ctx, sprites, '#35f1ff', 0, 0, 54, 0.6);
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(122, 184, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + Math.sin(state.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(p.angle);
    // Hull: a swept arrow-ship.
    ctx.fillStyle = '#0e2a3a';
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-14, 13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(6, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Engine flame.
    const flame = 10 + Math.sin(state.time * 31) * 4 + (p.dashTimer > 0 ? 12 : 0);
    ctx.fillStyle = p.dashTimer > 0 ? '#ffffff' : '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-14 - flame, 0);
    ctx.lineTo(-14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      drawGlow(ctx, sprites, '#8ef6ff', b.x, b.y, 14, 0.9);
      ctx.strokeStyle = 'rgba(180, 250, 255, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const b of state.ebullets) {
      drawGlow(ctx, sprites, '#ff7ad9', b.x, b.y, 18, 0.9);
      ctx.fillStyle = '#ff7ad9';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawParticles(state) {
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      drawGlow(ctx, sprites, pt.color, pt.x, pt.y, pt.size * 3, a * 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const t of state.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.font = `700 ${t.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawNovaBlast(state) {
    if (state.novaBlast <= 0) return;
    const p = state.player;
    const progress = 1 - state.novaBlast / 0.9;
    const radius = 60 + progress * 700;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(140, 240, 255, ${0.9 * (1 - progress)})`;
    ctx.lineWidth = 10 * (1 - progress) + 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - progress)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function bar(x, y, w, h, frac, color, back) {
    ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHud(state, best) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Hull hearts.
    for (let i = 0; i < p.maxHull; i += 1) {
      heart(ctx, 34 + i * 30, 36, 10, i < p.hull ? '#ff5d7a' : 'rgba(255,255,255,0.14)');
    }
    // Active timers.
    let ty = 62;
    ctx.font = `700 13px ${FONT}`;
    if (p.shieldTimer > 0) { ctx.fillStyle = '#7ab8ff'; ctx.fillText(`SHIELD ${Math.ceil(p.shieldTimer)}s`, 24, ty); ty += 18; }
    if (p.overdriveTimer > 0) { ctx.fillStyle = '#ff9f43'; ctx.fillText(`OVERDRIVE ${Math.ceil(p.overdriveTimer)}s`, 24, ty); ty += 18; }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 20px ${FONT_DISPLAY}`;
    ctx.fillText(state.endless ? `WAVE ${state.wave} — ENDLESS` : `WAVE ${state.wave}`, FIELD.width / 2, 34);
    const remaining = state.enemies.length + (state.spawnQueue ? state.spawnQueue.length : 0);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    if (state.waveState === 'banner') ctx.fillText('GET READY', FIELD.width / 2, 56);
    else if (state.boss) ctx.fillText('MOTHERCORE', FIELD.width / 2, 56);
    else ctx.fillText(`${remaining} HOSTILE${remaining === 1 ? '' : 'S'} LEFT`, FIELD.width / 2, 56);
    // Boss bar.
    if (state.boss) {
      bar(FIELD.width / 2 - 220, 66, 440, 10, state.boss.hp / state.boss.maxHp, '#ff2e63');
      ctx.fillStyle = '#ff8fb0';
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText('MOTHERCORE', FIELD.width / 2, 92);
    }
    // Score, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 26px ${FONT_DISPLAY}`;
    ctx.fillText(String(state.score).padStart(6, '0'), FIELD.width - 24, 36);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width - 24, 56);
    // Combo badge.
    if (state.multiplier > 1) {
      ctx.fillStyle = '#ffd34d';
      ctx.font = `800 20px ${FONT_DISPLAY}`;
      ctx.fillText(`x${state.multiplier.toFixed(1)} COMBO`, FIELD.width - 24, 84);
      bar(FIELD.width - 144, 92, 120, 5, state.comboTimer / 3, '#ffd34d');
    }
    // Nova charge, bottom left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 13px ${FONT}`;
    const ready = p.nova >= 100;
    ctx.fillStyle = ready ? '#ffd34d' : PALETTE.muted;
    ctx.fillText(ready ? 'NOVA READY — PRESS E' : 'NOVA', 24, FIELD.height - 44);
    bar(24, FIELD.height - 36, 220, 12, p.nova / 100, ready ? '#ffd34d' : '#8a6d1f');
    // Dash, bottom right.
    ctx.textAlign = 'right';
    const dashFrac = 1 - Math.max(0, p.dashCooldown) / p.dashCooldownMax;
    ctx.fillStyle = dashFrac >= 1 ? PALETTE.player : PALETTE.muted;
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(dashFrac >= 1 ? 'DASH READY — SHIFT / RIGHT CLICK' : 'DASH CHARGING', FIELD.width - 24, FIELD.height - 44);
    bar(FIELD.width - 164, FIELD.height - 36, 140, 12, dashFrac, dashFrac >= 1 ? '#35f1ff' : '#2a6a7a');
    // Wave banner.
    if (state.waveState === 'banner') {
      const a = Math.min(1, state.bannerTimer * 2);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = state.wave === BOSS_WAVE ? '#ff2e63' : PALETTE.text;
      ctx.font = `900 ${state.wave === BOSS_WAVE ? 54 : 64}px ${FONT_DISPLAY}`;
      ctx.fillText(state.bannerText, FIELD.width / 2, FIELD.height / 2 - 10);
      ctx.font = `600 18px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(state.wave === BOSS_WAVE ? 'Destroy the core to win the run' : 'Harvest cores. Survive. Spend them on upgrades.', FIELD.width / 2, FIELD.height / 2 + 28);
      ctx.globalAlpha = 1;
    }
    // Low hull warning.
    if (p.alive && p.hull === 1) {
      const a = 0.25 + 0.2 * Math.sin(state.time * 6);
      ctx.fillStyle = `rgba(255, 46, 99, ${Math.max(0, a)})`;
      ctx.font = `800 18px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('HULL CRITICAL', FIELD.width / 2, FIELD.height - 70);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(3, 5, 14, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    const pulse = 1 + Math.sin(state.time * 2.2) * 0.02;
    ctx.save();
    ctx.translate(FIELD.width / 2, 218);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#35f1ff';
    ctx.font = `900 92px ${FONT_DISPLAY}`;
    ctx.shadowColor = '#35f1ff';
    ctx.shadowBlur = 34;
    ctx.fillText('NOVA', 0, 0);
    ctx.fillStyle = '#ffd34d';
    ctx.shadowColor = '#ffd34d';
    ctx.fillText('HARVEST', 0, 88);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Pilot the last harvester. Break the drone swarm.', FIELD.width / 2, 348);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Destroy drones, harvest their cores, and beat the MOTHERCORE on wave 10 to win.', FIELD.width / 2, 376);
    // Controls.
    const cx = FIELD.width / 2;
    panel(cx - 330, 404, 660, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    const rows = [
      ['WASD / ARROWS', 'Fly the harvester'],
      ['MOUSE + HOLD CLICK', 'Aim and fire the lance'],
      ['SHIFT / RIGHT CLICK', 'Dash (briefly untouchable)'],
      ['E — when NOVA is full', 'Detonate a nova blast'],
      ['P pause · M mute · 1/2/3 pick upgrades', ''],
    ];
    rows.forEach((row, i) => {
      ctx.fillStyle = '#35f1ff';
      ctx.fillText(row[0], cx - 306, 432 + i * 22);
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(row[1], cx - 40, 432 + i * 22);
    });
    if (best > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd34d';
      ctx.font = `800 18px ${FONT}`;
      ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 566);
    }
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 22px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('CLICK OR PRESS SPACE TO LAUNCH', FIELD.width / 2, 612);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('A complete original game — no downloads, no network, your best score stays in this browser.', FIELD.width / 2, 690);
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(3, 5, 14, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 44px ${FONT_DISPLAY}`;
    ctx.fillText(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 150);
    ctx.fillStyle = '#ffd34d';
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText('Choose one upgrade — click it or press 1, 2 or 3', FIELD.width / 2, 186);
    const rects = upgradeCardRects();
    state.upgradeChoices.forEach((up, i) => {
      const r = rects[i];
      panel(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#35f1ff';
      ctx.font = `900 30px ${FONT_DISPLAY}`;
      ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + 52);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 21px ${FONT}`;
      ctx.fillText(up.name, r.x + r.w / 2, r.y + 96);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 16px ${FONT}`;
      const words = up.desc.split(' ');
      let line = '';
      let ly = r.y + 132;
      for (const word of words) {
        if ((line + word).length > 22) {
          ctx.fillText(line.trim(), r.x + r.w / 2, ly);
          ly += 22;
          line = '';
        }
        line += `${word} `;
      }
      ctx.fillText(line.trim(), r.x + r.w / 2, ly);
      ctx.fillStyle = 'rgba(53, 241, 255, 0.16)';
      ctx.fillRect(r.x, r.y + r.h - 10, r.w, 10);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`Score ${state.score} · Hull ${state.player.hull}/${state.player.maxHull} · Next: wave ${state.wave + 1}`, FIELD.width / 2, 540);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(3, 5, 14, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 56px ${FONT_DISPLAY}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('Press P or click to keep flying', FIELD.width / 2, FIELD.height / 2 + 30);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(20, 3, 10, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e63';
    ctx.font = `900 72px ${FONT_DISPLAY}`;
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 30;
    ctx.fillText('HARVESTER DOWN', FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`The swarm takes wave ${state.wave}. The cores scatter into the dark.`, FIELD.width / 2, 300);
    panel(FIELD.width / 2 - 230, 340, 460, 150);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('FINAL SCORE', FIELD.width / 2 - 200, 376);
    ctx.fillText('BEST SCORE', FIELD.width / 2 - 200, 408);
    ctx.fillText('WAVE REACHED', FIELD.width / 2 - 200, 440);
    ctx.fillText('DRONES DESTROYED', FIELD.width / 2 - 200, 472);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(String(state.score), FIELD.width / 2 + 200, 376);
    ctx.fillText(String(Math.max(best, state.score)), FIELD.width / 2 + 200, 408);
    ctx.fillText(String(state.wave), FIELD.width / 2 + 200, 440);
    ctx.fillText(String(state.kills), FIELD.width / 2 + 200, 472);
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 22px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', FIELD.width / 2, 560);
    }
  }

  function drawVictory(state, best) {
    ctx.fillStyle = 'rgba(3, 12, 6, 0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = `900 76px ${FONT_DISPLAY}`;
    ctx.shadowColor = '#ffd34d';
    ctx.shadowBlur = 32;
    ctx.fillText('MOTHERCORE DOWN', FIELD.width / 2, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('Wave 10 is yours. The swarm breaks. You win the run.', FIELD.width / 2, 258);
    panel(FIELD.width / 2 - 230, 300, 460, 150);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('FINAL SCORE', FIELD.width / 2 - 200, 336);
    ctx.fillText('BEST SCORE', FIELD.width / 2 - 200, 368);
    ctx.fillText('DRONES DESTROYED', FIELD.width / 2 - 200, 400);
    ctx.fillText('CORES HARVESTED', FIELD.width / 2 - 200, 432);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(String(state.score), FIELD.width / 2 + 200, 336);
    ctx.fillText(String(Math.max(best, state.score)), FIELD.width / 2 + 200, 368);
    ctx.fillText(String(state.kills), FIELD.width / 2 + 200, 400);
    ctx.fillText(String(state.coresCollected), FIELD.width / 2 + 200, 432);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 20px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('CLICK — KEEP FLYING IN ENDLESS MODE', FIELD.width / 2, 516);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('or press R to start a fresh run', FIELD.width / 2, 548);
  }

  function draw(state, screen, best) {
    resize();
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = PALETTE.space;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    // Screen shake, driven by the world's clock so staged frames are stable.
    if (state.shake > 0.2) {
      const s = state.shake;
      ctx.translate(Math.sin(state.time * 91) * s * 0.5, Math.cos(state.time * 113) * s * 0.5);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();
    drawBackground(state);
    drawPickups(state);
    for (const e of state.enemies) {
      if (e.kind === KIND_BOSS) drawBoss(e, state);
      else drawEnemy(e, state);
    }
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    drawNovaBlast(state);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_VICTORY) drawVictory(state, best);
    ctx.restore();
    ctx.restore();
  }

  return { draw, resize, toField };
}
