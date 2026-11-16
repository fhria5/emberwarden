// Emberwarden — balance, tuning and content tables.
// One clear job: every number the game runs on lives here, so tuning never
// means hunting through the update or render code.

/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;
/** Logical arena size, in world units. The camera follows the player. */
export const ARENA = { width: 2200, height: 1600 };
/** localStorage key for the best score. */
export const BEST_KEY = 'emberwarden.best';
/** How many waves a run lasts; wave 10 ends with the final boss. */
export const FINAL_WAVE = 10;
/** Seconds of quiet between waves. */
export const WAVE_BREATHER = 3;
/** Seconds the player is invulnerable right after being hit. */
export const HURT_IFRAMES = 0.7;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.34,
  bulletSpeed: 620,
  bulletDamage: 16,
  bulletRadius: 6,
  dashSpeed: 760,
  dashTime: 0.16,
  dashCooldown: 2.4,
  pickupRadius: 110,
  lanternRadius: 150,
};

/** XP needed to go from level L to L+1 (L starts at 1). */
export function xpForLevel(level) {
  return Math.round(6 + (level - 1) * 5 + Math.pow(level - 1, 1.7) * 2);
}

/**
 * Enemy kinds. speed in world units/s, hp, radius, damage on touch, score
 * and xp values, plus the colour the renderer uses for body and glow.
 */
export const ENEMIES = {
  wisp:   { name: 'Wisp',      hp: 22,  speed: 118, radius: 13, damage: 9,  score: 10, xp: 1, body: '#b388ff', glow: '#7c4dff', behaviour: 'chase' },
  bat:    { name: 'Ember Bat', hp: 16,  speed: 205, radius: 11, damage: 7,  score: 15, xp: 1, body: '#ff7043', glow: '#ff3d00', behaviour: 'weave' },
  golem:  { name: 'Stone Golem', hp: 130, speed: 52,  radius: 26, damage: 18, score: 30, xp: 3, body: '#90a4ae', glow: '#546e7a', behaviour: 'chase' },
  spitter:{ name: 'Spitter',   hp: 34,  speed: 92,  radius: 14, damage: 8,  score: 25, xp: 2, body: '#69f0ae', glow: '#00c853', behaviour: 'ranged' },
  stag:   { name: 'Hollow Stag', hp: 520, speed: 78, radius: 40, damage: 22, score: 250, xp: 12, body: '#e1bee7', glow: '#ab47bc', behaviour: 'boss' },
  king:   { name: 'The Hollow King', hp: 1400, speed: 66, radius: 52, damage: 28, score: 1000, xp: 30, body: '#ff8a80', glow: '#d50000', behaviour: 'boss' },
};

/**
 * Which enemies a wave may spawn and how many of each, before the wave's
 * size multiplier. Boss waves (5 and 10) add one boss on top.
 */
export function waveComposition(wave) {
  const list = [];
  list.push(['wisp', 6 + wave * 3]);
  if (wave >= 2) list.push(['bat', 3 + wave * 2]);
  if (wave >= 3) list.push(['golem', 1 + Math.floor(wave / 2)]);
  if (wave >= 4) list.push(['spitter', 1 + Math.floor(wave / 2)]);
  return list;
}

export function waveBoss(wave) {
  if (wave === FINAL_WAVE) return 'king';
  if (wave === 5) return 'stag';
  return null;
}

/**
 * Upgrade pool. Each entry: id, name, short description, max stacks, and
 * apply(stats) which mutates the player's derived stats in place.
 */
export const UPGRADES = [
  {
    id: 'damage', name: 'Kindled Rounds', desc: '+25% bullet damage', max: 5,
    apply: (s) => { s.damageMul *= 1.25; },
  },
  {
    id: 'firerate', name: 'Rapid Lantern', desc: '+20% fire rate', max: 5,
    apply: (s) => { s.fireIntervalMul *= 0.83; },
  },
  {
    id: 'multishot', name: 'Twin Flames', desc: '+1 projectile per shot', max: 3,
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Light', desc: 'Bullets pierce +1 enemy', max: 3,
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'speed', name: 'Swift Boots', desc: '+12% move speed', max: 4,
    apply: (s) => { s.speedMul *= 1.12; },
  },
  {
    id: 'aura', name: 'Lantern Aura', desc: 'Burning aura hurts nearby foes', max: 4,
    apply: (s) => { s.auraLevel += 1; },
  },
  {
    id: 'magnet', name: 'Ember Magnet', desc: '+60% shard pickup radius', max: 3,
    apply: (s) => { s.pickupMul *= 1.6; },
  },
  {
    id: 'vitality', name: 'Warm Heart', desc: '+25 max HP and heal 25', max: 5,
    apply: (s) => { s.maxHp += 25; s.healNow += 25; },
  },
  {
    id: 'crit', name: "Hunter's Eye", desc: '+12% critical chance (2x damage)', max: 4,
    apply: (s) => { s.critChance += 0.12; },
  },
  {
    id: 'dash', name: 'Cinder Dash', desc: 'Dash recharges 30% faster', max: 3,
    apply: (s) => { s.dashCooldownMul *= 0.7; },
  },
];

/** Fresh derived-stats object; upgrades mutate a copy of this. */
export function baseStats() {
  return {
    damageMul: 1,
    fireIntervalMul: 1,
    projectiles: 1,
    pierce: 0,
    speedMul: 1,
    auraLevel: 0,
    pickupMul: 1,
    maxHp: PLAYER.maxHp,
    healNow: 0,
    critChance: 0.05,
    dashCooldownMul: 1,
  };
}
