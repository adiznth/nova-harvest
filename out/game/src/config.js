// NOVA HARVEST — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves: the MOTHERCORE boss arrives on wave 10; beating it wins the run. */
export const BOSS_WAVE = 10;
export const ENDLESS_AFTER_WIN = true;

export const PLAYER = {
  radius: 16,
  speed: 340,
  accel: 2600,
  friction: 6.5,
  hull: 3,
  maxHull: 5,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletDamage: 1,
  bulletRadius: 5,
  invulnerable: 1.2,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.4,
  pickupRadius: 90,
  novaMax: 100,
};

export const ENEMY = {
  chaser: { radius: 15, hp: 2, speed: 135, score: 50, cores: 2, color: '#ff5d7a', touch: 1 },
  weaver: { radius: 14, hp: 2, speed: 175, score: 70, cores: 2, color: '#ff9f43', touch: 1 },
  spitter: { radius: 17, hp: 3, speed: 105, score: 100, cores: 3, color: '#b388ff', touch: 1 },
  splitter: { radius: 20, hp: 3, speed: 95, score: 120, cores: 3, color: '#4dd0e1', touch: 1 },
  mini: { radius: 9, hp: 1, speed: 230, score: 30, cores: 1, color: '#4dd0e1', touch: 1 },
  boss: { radius: 64, hp: 260, speed: 55, score: 5000, cores: 40, color: '#ff2e63', touch: 2 },
};

export const WAVE = {
  /** Seconds between the wave banner and the first spawn. */
  bannerSeconds: 2.2,
  /** Seconds of breathing room after a wave is cleared, before upgrades show. */
  clearPause: 1.4,
  spawnInterval: 1.0,
  spawnIntervalMin: 0.35,
  /** Extra drones per wave, and how fast the spawn interval shrinks. */
  budgetBase: 5,
  budgetPerWave: 2,
  hpPerWave: 0.22,
  speedPerWave: 0.05,
};

/** Combo: each kill inside the window raises the multiplier; it decays when idle. */
export const COMBO = { window: 3.0, step: 0.1, cap: 5 };

export const PICKUP = {
  core: { radius: 7, value: 10, nova: 4, magnetSpeed: 420 },
  hull: { radius: 11, value: 1 },
  overdrive: { radius: 11, seconds: 8 },
  shield: { radius: 11, seconds: 12 },
};

export const NOVA = {
  cost: 100,
  damage: 60,
  /** Seconds the nova flash and shockwave last. */
  blastSeconds: 0.9,
};

export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Cycler', desc: '+25% fire rate', apply: (p) => { p.fireInterval *= 0.8; } },
  { id: 'twin', name: 'Twin Lance', desc: '+1 projectile per shot', apply: (p) => { p.shots += 1; } },
  { id: 'hull', name: 'Reinforced Hull', desc: '+1 max hull and repair 1', apply: (p) => { p.maxHull = Math.min(6, p.maxHull + 1); p.hull = Math.min(p.maxHull, p.hull + 1); } },
  { id: 'magnet', name: 'Magnet Coil', desc: 'Pickup radius x2', apply: (p) => { p.pickupRadius *= 2; } },
  { id: 'thrusters', name: 'Ion Thrusters', desc: 'Dash recharges 40% faster', apply: (p) => { p.dashCooldown *= 0.6; } },
  { id: 'rounds', name: 'Overcharge Rounds', desc: '+40% bullet damage', apply: (p) => { p.bulletDamage *= 1.4; } },
  { id: 'capacitor', name: 'Nova Capacitor', desc: 'Nova charges twice as fast', apply: (p) => { p.novaGain *= 2; } },
  { id: 'velocity', name: 'Velocity Coils', desc: '+30% bullet speed, +15% move speed', apply: (p) => { p.bulletSpeed *= 1.3; p.speed *= 1.15; } },
];

export const PALETTE = {
  space: '#04060f',
  nebulaA: '#0a1230',
  nebulaB: '#160a2e',
  grid: 'rgba(90, 140, 255, 0.07)',
  player: '#35f1ff',
  playerCore: '#e8feff',
  bullet: '#8ef6ff',
  enemyBullet: '#ff7ad9',
  core: '#ffd34d',
  hull: '#7dff8a',
  overdrive: '#ff9f43',
  shield: '#7ab8ff',
  text: '#eef4ff',
  muted: '#8b98b8',
  danger: '#ff2e63',
  gold: '#ffd34d',
  panel: 'rgba(10, 16, 36, 0.82)',
  panelEdge: 'rgba(120, 180, 255, 0.35)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Segoe UI", system-ui, sans-serif';

/** Where the best score and best wave are kept between visits (this browser only). */
export const BEST_KEY = 'nova-harvest.best';
export const BEST_WAVE_KEY = 'nova-harvest.best-wave';
