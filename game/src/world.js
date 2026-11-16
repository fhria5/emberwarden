// Emberwarden — the simulation: player, enemies, bullets, shards, waves.
// One clear job: advance the world one fixed step at a time and report what
// happened as event bits. It knows nothing about the canvas or the DOM.

import {
  ARENA, FINAL_WAVE, WAVE_BREATHER, HURT_IFRAMES, PLAYER,
  ENEMIES, UPGRADES, baseStats, waveBoss, waveComposition, xpForLevel,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_LEVELUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_VICTORY = 16;
export const EVENT_BOSS = 32;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    player: null,
    stats: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    gems: [],
    particles: [],
    floaters: [],
    decor: { trees: [], rocks: [], tufts: [] },
    wave: 0,
    waveState: 'breather',
    waveTimer: WAVE_BREATHER,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    kills: 0,
    time: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevelUps: 0,
    choices: [],
    taken: {},
    boss: null,
    shake: 0,
    banner: '',
    bannerTimer: 0,
    auraTimer: 0,
    gameOver: false,
    victory: false,
  };

  function makeDecor() {
    const decor = { trees: [], rocks: [], tufts: [], fireflies: [] };
    for (let i = 0; i < 130; i += 1) {
      decor.trees.push({ x: random.range(0, ARENA.width), y: random.range(0, ARENA.height), s: random.range(0.7, 1.5) });
    }
    for (let i = 0; i < 40; i += 1) {
      decor.rocks.push({ x: random.range(0, ARENA.width), y: random.range(0, ARENA.height), s: random.range(0.6, 1.4) });
    }
    for (let i = 0; i < 420; i += 1) {
      decor.tufts.push({ x: random.range(0, ARENA.width), y: random.range(0, ARENA.height), s: random.range(0.6, 1.3) });
    }
    for (let i = 0; i < 46; i += 1) {
      decor.fireflies.push({ x: random.range(0, ARENA.width), y: random.range(0, ARENA.height), phase: random.range(0, Math.PI * 2), speed: random.range(0.4, 1.1) });
    }
    return decor;
  }

  function reset() {
    state.player = {
      x: ARENA.width / 2, y: ARENA.height / 2,
      vx: 0, vy: 0, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, aim: 0,
      fireTimer: 0, dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0,
      iframes: 0, hurtFlash: 0, walkPhase: 0,
    };
    state.stats = baseStats();
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.gems = [];
    state.particles = [];
    state.floaters = [];
    state.decor = makeDecor();
    state.wave = 0;
    state.waveState = 'breather';
    state.waveTimer = WAVE_BREATHER;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.score = 0;
    state.kills = 0;
    state.time = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpForLevel(1);
    state.pendingLevelUps = 0;
    state.choices = [];
    state.taken = {};
    state.boss = null;
    state.shake = 0;
    state.banner = 'The lantern is lit. Hold the clearing.';
    state.bannerTimer = 2.5;
    state.auraTimer = 0;
    state.gameOver = false;
    state.victory = false;
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      const a = random.angle();
      const sp = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: random.range(life * 0.5, life), maxLife: life,
        size: random.range(size * 0.5, size * 1.4), color,
      });
    }
    if (state.particles.length > 500) state.particles.splice(0, state.particles.length - 500);
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 0.8, color });
    if (state.floaters.length > 40) state.floaters.shift();
  }

  function spawnPosition() {
    const p = state.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const x = random.range(60, ARENA.width - 60);
      const y = random.range(60, ARENA.height - 60);
      if (dist2(x, y, p.x, p.y) > 520 * 520) return { x, y };
    }
    return { x: 60, y: 60 };
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const pos = spawnPosition();
    const hpScale = 1 + (state.wave - 1) * 0.10;
    const enemy = {
      kind, def,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp: Math.round(def.hp * hpScale), maxHp: Math.round(def.hp * hpScale),
      radius: def.radius, speed: def.speed * random.range(0.9, 1.1),
      damage: def.damage, score: def.score, xp: def.xp,
      t: random.range(0, 2), shootTimer: random.range(1.2, 2.4),
      flash: 0, kx: 0, ky: 0, charge: 0, chargeX: 0, chargeY: 0,
    };
    state.enemies.push(enemy);
    if (def.behaviour === 'boss') state.boss = enemy;
    return enemy;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveState = 'fighting';
    state.spawnQueue = [];
    for (const [kind, count] of waveComposition(wave)) {
      for (let i = 0; i < count; i += 1) state.spawnQueue.push(kind);
    }
    // Shuffle the queue so the wave arrives mixed, not kind by kind.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    const boss = waveBoss(wave);
    if (boss) {
      state.spawnQueue.unshift(boss);
      state.banner = wave === FINAL_WAVE ? 'THE HOLLOW KING AWAKENS' : 'THE HOLLOW STAG APPROACHES';
    } else {
      state.banner = `WAVE ${wave}`;
    }
    state.bannerTimer = 2.2;
    state.spawnTimer = 0.4;
    return boss ? EVENT_BOSS : EVENT_NONE;
  }

  function rollChoices() {
    const available = UPGRADES.filter((u) => (state.taken[u.id] ?? 0) < u.max);
    const picks = [];
    while (picks.length < 3 && available.length > 0) {
      const index = Math.floor(random.next() * available.length);
      picks.push(available.splice(index, 1)[0]);
    }
    // If everything is maxed, offer healing instead.
    while (picks.length < 3) {
      picks.push({ id: 'heal', name: 'Ember Feast', desc: 'Restore 40 HP', max: 99, apply: () => {} });
    }
    state.choices = picks;
  }

  function applyChoice(index) {
    const choice = state.choices[index];
    if (!choice) return;
    if (choice.id === 'heal') {
      state.player.hp = Math.min(state.stats.maxHp, state.player.hp + 40);
    } else {
      state.taken[choice.id] = (state.taken[choice.id] ?? 0) + 1;
      choice.apply(state.stats);
      if (choice.id === 'vitality') {
        state.player.maxHp = state.stats.maxHp;
        state.player.hp = Math.min(state.stats.maxHp, state.player.hp + 25);
      }
    }
    state.pendingLevelUps -= 1;
    state.choices = [];
    if (state.pendingLevelUps > 0) rollChoices();
  }

  function gainXp(amount) {
    state.xp += amount;
    let events = EVENT_NONE;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = xpForLevel(state.level);
      state.pendingLevelUps += 1;
      events |= EVENT_LEVELUP;
    }
    if (events & EVENT_LEVELUP) rollChoices();
    return events;
  }

  function damageEnemy(enemy, amount, crit, kx, ky) {
    enemy.hp -= amount;
    enemy.flash = 0.09;
    enemy.kx += kx;
    enemy.ky += ky;
    floater(enemy.x + random.range(-8, 8), enemy.y - enemy.radius - 6, String(Math.round(amount)), crit ? '#ffd54f' : '#fff8e1');
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    state.kills += 1;
    state.score += enemy.score;
    burst(enemy.x, enemy.y, enemy.def.glow, enemy.def.behaviour === 'boss' ? 60 : 14, 260, 4, 0.6);
    burst(enemy.x, enemy.y, '#ffca28', 8, 180, 3, 0.5);
    for (let i = 0; i < enemy.xp; i += 1) {
      state.gems.push({
        x: enemy.x + random.range(-14, 14), y: enemy.y + random.range(-14, 14),
        vx: random.range(-40, 40), vy: random.range(-40, 40), value: 1, t: random.next() * TAU,
      });
    }
    if (enemy.def.behaviour === 'boss') {
      state.shake = Math.max(state.shake, 18);
      state.boss = null;
      state.score += 200;
    }
  }

  function hurtPlayer(amount, fromX, fromY) {
    const p = state.player;
    if (p.iframes > 0 || state.gameOver) return EVENT_NONE;
    p.hp -= amount;
    p.iframes = HURT_IFRAMES;
    p.hurtFlash = 0.25;
    state.shake = Math.max(state.shake, 10);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * 320;
    p.vy += (dy / d) * 320;
    burst(p.x, p.y, '#ff5252', 10, 220, 4, 0.5);
    if (p.hp <= 0) {
      p.hp = 0;
      state.gameOver = true;
      burst(p.x, p.y, '#ffca28', 50, 320, 5, 1.0);
      burst(p.x, p.y, '#ff5252', 30, 240, 4, 0.9);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBullets() {
    const p = state.player;
    const s = state.stats;
    const count = s.projectiles;
    const spread = 0.14;
    const base = p.aim - (count - 1) * spread / 2;
    for (let i = 0; i < count; i += 1) {
      const angle = base + i * spread;
      const crit = random.next() < s.critChance;
      state.bullets.push({
        x: p.x + Math.cos(angle) * (PLAYER.radius + 8),
        y: p.y + Math.sin(angle) * (PLAYER.radius + 8),
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        damage: PLAYER.bulletDamage * s.damageMul * (crit ? 2 : 1),
        pierce: s.pierce, radius: PLAYER.bulletRadius,
        crit, life: 1.1, hitSet: new Set(),
      });
    }
    state.particles.push({
      x: p.x + Math.cos(p.aim) * (PLAYER.radius + 10),
      y: p.y + Math.sin(p.aim) * (PLAYER.radius + 10),
      vx: Math.cos(p.aim) * 60, vy: Math.sin(p.aim) * 60,
      life: 0.12, maxLife: 0.12, size: 7, color: '#ffd54f',
    });
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    const s = state.stats;
    p.aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);

    const moving = input.moveX !== 0 || input.moveY !== 0;
    if (input.dash && p.dashCooldown <= 0 && moving) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = PLAYER.dashCooldown * s.dashCooldownMul;
      p.dashX = input.moveX;
      p.dashY = input.moveY;
      p.iframes = Math.max(p.iframes, 0.28);
      burst(p.x, p.y, '#ffca28', 12, 160, 4, 0.4);
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
      state.particles.push({
        x: p.x, y: p.y, vx: 0, vy: 0,
        life: 0.3, maxLife: 0.3, size: 10, color: '#ff9800',
      });
    } else {
      const targetVx = input.moveX * PLAYER.speed * s.speedMul;
      const targetVy = input.moveY * PLAYER.speed * s.speedMul;
      const k = Math.min(1, dt * 14);
      p.vx += (targetVx - p.vx) * k;
      p.vy += (targetVy - p.vy) * k;
    }
    p.x = Math.max(PLAYER.radius, Math.min(ARENA.width - PLAYER.radius, p.x + p.vx * dt));
    p.y = Math.max(PLAYER.radius, Math.min(ARENA.height - PLAYER.radius, p.y + p.vy * dt));
    p.walkPhase += Math.hypot(p.vx, p.vy) * dt * 0.05;

    // Lantern auto-fires at the nearest foe; the mouse only steers the aim.
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireInterval * s.fireIntervalMul;
      fireBullets();
    }
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.t += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;

      if (e.def.behaviour === 'boss') {
        // Charge telegraph, then a fast lunge; the King also fires radial bursts.
        if (e.charge > 0) {
          e.charge -= dt;
          e.vx = e.chargeX * e.speed * 4.2;
          e.vy = e.chargeY * e.speed * 4.2;
          if (e.charge <= 0) e.t = 0;
        } else if (e.t > 3.2 && d < 560) {
          e.charge = 0.55;
          e.chargeX = ux;
          e.chargeY = uy;
          e.t = 0;
        } else {
          e.vx = ux * e.speed;
          e.vy = uy * e.speed;
          if (e.kind === 'king') {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              e.shootTimer = 2.6;
              for (let i = 0; i < 10; i += 1) {
                const a = (i / 10) * TAU + e.t;
                state.enemyBullets.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
                  damage: 12, radius: 7, life: 4,
                });
              }
            }
          }
          if (e.kind === 'stag' && e.t > 4) {
            e.t = 0;
            spawnEnemy('wisp');
            spawnEnemy('wisp');
          }
        }
      } else if (e.def.behaviour === 'weave') {
        const px = -uy * Math.sin(e.t * 5) * 0.8;
        const py = ux * Math.sin(e.t * 5) * 0.8;
        e.vx = (ux + px) * e.speed;
        e.vy = (uy + py) * e.speed;
      } else if (e.def.behaviour === 'ranged') {
        if (d > 340) {
          e.vx = ux * e.speed;
          e.vy = uy * e.speed;
        } else if (d < 220) {
          e.vx = -ux * e.speed;
          e.vy = -uy * e.speed;
        } else {
          e.vx = -uy * e.speed * 0.5;
          e.vy = ux * e.speed * 0.5;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = 2.2;
          state.enemyBullets.push({
            x: e.x, y: e.y,
            vx: ux * 230, vy: uy * 230,
            damage: e.damage, radius: 6, life: 3,
          });
        }
      } else {
        e.vx = ux * e.speed;
        e.vy = uy * e.speed;
      }

      // Knockback decays; movement plus knockback is the real velocity.
      e.kx *= Math.max(0, 1 - dt * 8);
      e.ky *= Math.max(0, 1 - dt * 8);
      e.x = Math.max(e.radius, Math.min(ARENA.width - e.radius, e.x + (e.vx + e.kx) * dt));
      e.y = Math.max(e.radius, Math.min(ARENA.height - e.radius, e.y + (e.vy + e.ky) * dt));

      // Touch damage.
      if (d < e.radius + PLAYER.radius - 2) {
        const ev = hurtPlayer(e.damage, e.x, e.y);
        if (ev & EVENT_OVER) return ev;
        if (ev & EVENT_HIT) {
          // Push the enemy back a little so it does not sit on the player.
          e.x -= ux * 30;
          e.y -= uy * 30;
        }
      }
    }
    return EVENT_NONE;
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x < 0 || b.x > ARENA.width || b.y < 0 || b.y > ARENA.height) b.life = 0;
      for (const e of state.enemies) {
        if (e.dead || b.hitSet.has(e)) continue;
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.hitSet.add(e);
          const kb = 140;
          const d = Math.hypot(b.vx, b.vy) || 1;
          damageEnemy(e, b.damage, b.crit, (b.vx / d) * kb, (b.vy / d) * kb);
          burst(b.x, b.y, '#ffd54f', 4, 140, 3, 0.3);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.life = 0;
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    for (const b of state.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const p = state.player;
      const rr = PLAYER.radius + b.radius - 4;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.life = 0;
        const ev = hurtPlayer(b.damage, b.x - b.vx * 0.1, b.y - b.vy * 0.1);
        if (ev & EVENT_OVER) return ev;
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);
    return EVENT_NONE;
  }

  function stepGems(dt) {
    const p = state.player;
    const s = state.stats;
    const pickupR = PLAYER.pickupRadius * s.pickupMul;
    let events = EVENT_NONE;
    for (const g of state.gems) {
      g.t += dt;
      const d = Math.hypot(p.x - g.x, p.y - g.y) || 1;
      if (d < pickupR) {
        const pull = 620 * (1 - d / (pickupR + 40));
        g.vx += ((p.x - g.x) / d) * pull * dt * 4;
        g.vy += ((p.y - g.y) / d) * pull * dt * 4;
      } else if (d < pickupR * 2.4) {
        // A gentle long-range drift so shards do not strand out of reach.
        g.vx += ((p.x - g.x) / d) * 26 * dt;
        g.vy += ((p.y - g.y) / d) * 26 * dt;
      }
      g.vx *= Math.max(0, 1 - dt * 3);
      g.vy *= Math.max(0, 1 - dt * 3);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < PLAYER.radius + 12) {
        g.dead = true;
        events |= gainXp(g.value);
        burst(g.x, g.y, '#ffca28', 3, 90, 3, 0.3);
      }
    }
    state.gems = state.gems.filter((g) => !g.dead);
    return events;
  }

  function stepAura(dt) {
    const s = state.stats;
    if (s.auraLevel <= 0) return;
    state.auraTimer -= dt;
    if (state.auraTimer > 0) return;
    state.auraTimer = 0.5;
    const p = state.player;
    const radius = PLAYER.lanternRadius + s.auraLevel * 28;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < radius + e.radius) {
        damageEnemy(e, 6 + s.auraLevel * 6, false, 0, 0);
        burst(e.x, e.y, '#ff9800', 3, 100, 3, 0.3);
      }
    }
  }

  function stepFx(dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - dt * 2.5);
      pt.vy *= Math.max(0, 1 - dt * 2.5);
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const f of state.floaters) {
      f.y -= 42 * dt;
      f.life -= dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    state.shake = Math.max(0, state.shake - dt * 34);
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  }

  /**
   * Advance the world one fixed step. `input` carries the move vector
   * (moveX/moveY, normalised), the aim point in world coordinates
   * (aimX/aimY) and whether dash was pressed this frame. Returns event bits.
   * When `attract` is true the world idles behind the title screen: the
   * player stands still and no waves spawn.
   */
  function step(dt, input, attract) {
    if (state.gameOver || state.victory) {
      stepFx(dt);
      return EVENT_NONE;
    }
    state.time += dt;
    let events = EVENT_NONE;

    if (attract) {
      // Drifting embers keep the title screen alive.
      if (random.next() < 0.25) {
        const p = state.player;
        state.particles.push({
          x: p.x + random.range(-320, 320), y: p.y + random.range(-220, 220),
          vx: random.range(-8, 8), vy: random.range(-34, -12),
          life: random.range(1.5, 3), maxLife: 3,
          size: random.range(1.5, 3.5), color: random.pick(['#ffca28', '#ff9800', '#ff7043']),
        });
      }
      stepFx(dt);
      return EVENT_NONE;
    }

    stepPlayer(dt, input);
    const evEnemies = stepEnemies(dt);
    if (evEnemies & EVENT_OVER) return evEnemies | EVENT_HIT;
    const evBullets = stepBullets(dt);
    if (evBullets & EVENT_OVER) return evBullets;
    events |= stepGems(dt);
    stepAura(dt);
    stepFx(dt);

    // Wave flow.
    if (state.waveState === 'breather') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        events |= startWave(state.wave + 1);
      }
    } else {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.enemies.filter((e) => !e.dead).length < 55) {
          state.spawnTimer = 0.45;
          spawnEnemy(state.spawnQueue.shift());
        }
      } else if (state.enemies.filter((e) => !e.dead).length === 0) {
        // Wave cleared.
        state.score += 100 * state.wave;
        state.player.hp = Math.min(state.stats.maxHp, state.player.hp + 12);
        if (state.wave >= FINAL_WAVE) {
          state.victory = true;
          return events | EVENT_VICTORY;
        }
        state.waveState = 'breather';
        state.waveTimer = WAVE_BREATHER;
        state.banner = `WAVE ${state.wave} CLEARED  ·  +${100 * state.wave} SCORE`;
        state.bannerTimer = 2.2;
        events |= EVENT_WAVE_CLEAR;
      }
    }

    state.enemies = state.enemies.filter((e) => !e.dead);
    return events;
  }

  reset();
  return { state, reset, step, rollChoices, applyChoice, spawnEnemy };
}
