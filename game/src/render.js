// Emberwarden — everything the player sees, drawn on one canvas.
// One clear job: paint the world, the HUD and the menu screens. It never
// changes game state; it only reads it.

import { ARENA, FINAL_WAVE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TITLE_FONT = "Georgia, 'Times New Roman', serif";
const UI_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, fraction, fill, back) {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * clamp(fraction, 0, 1)), h, h / 2);
    ctx.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  /** Last drawn level-up card rectangles, in canvas pixels, for clicks. */
  const cardRects = [];

  function camera(state) {
    const p = state.player;
    const viewW = width;
    const viewH = height;
    let x = p.x - viewW / 2;
    let y = p.y - viewH / 2;
    x = ARENA.width <= viewW ? (ARENA.width - viewW) / 2 : clamp(x, 0, ARENA.width - viewW);
    y = ARENA.height <= viewH ? (ARENA.height - viewH) / 2 : clamp(y, 0, ARENA.height - viewH);
    return { x, y };
  }

  /** Convert a screen point to world coordinates (for aiming). */
  function toWorld(sx, sy, state) {
    const cam = camera(state);
    return { x: sx + cam.x, y: sy + cam.y };
  }

  function drawBackground(cam) {
    const g = ctx.createRadialGradient(
      width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height) * 0.75,
    );
    g.addColorStop(0, '#223626');
    g.addColorStop(0.6, '#131f18');
    g.addColorStop(1, '#070b0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // Arena ground, slightly lighter than the void outside it.
    ctx.fillStyle = '#1a2b1f';
    ctx.fillRect(-cam.x, -cam.y, ARENA.width, ARENA.height);
    ctx.strokeStyle = 'rgba(255, 202, 40, 0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-cam.x, -cam.y, ARENA.width, ARENA.height);
  }

  function drawDecor(state, cam) {
    // Grass tufts.
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.35)';
    ctx.lineWidth = 1.5;
    for (const t of state.decor.tufts) {
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3 * t.s, y - 7 * t.s);
      ctx.moveTo(x + 2 * t.s, y);
      ctx.lineTo(x + 4 * t.s, y - 6 * t.s);
      ctx.stroke();
    }
    // Rocks.
    for (const r of state.decor.rocks) {
      const x = r.x - cam.x;
      const y = r.y - cam.y;
      if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
      ctx.fillStyle = '#37474f';
      ctx.beginPath();
      ctx.ellipse(x, y, 12 * r.s, 8 * r.s, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.ellipse(x - 3 * r.s, y - 3 * r.s, 6 * r.s, 3 * r.s, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pine silhouettes.
    for (const t of state.decor.trees) {
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      if (x < -50 || x > width + 50 || y < -60 || y > height + 60) continue;
      const s = t.s;
      ctx.fillStyle = '#0d1f14';
      ctx.beginPath();
      ctx.moveTo(x, y - 46 * s);
      ctx.lineTo(x - 20 * s, y + 6 * s);
      ctx.lineTo(x + 20 * s, y + 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0a1810';
      ctx.beginPath();
      ctx.moveTo(x, y - 30 * s);
      ctx.lineTo(x - 15 * s, y + 14 * s);
      ctx.lineTo(x + 15 * s, y + 14 * s);
      ctx.closePath();
      ctx.fill();
    }
    // Fireflies drift and blink over the clearing.
    ctx.globalCompositeOperation = 'lighter';
    for (const f of state.decor.fireflies) {
      const fx = f.x + Math.sin(state.time * f.speed + f.phase) * 26 - cam.x;
      const fy = f.y + Math.cos(state.time * f.speed * 0.7 + f.phase) * 18 - cam.y;
      if (fx < -20 || fx > width + 20 || fy < -20 || fy > height + 20) continue;
      const twinkle = 0.35 + 0.35 * Math.sin(state.time * 2.2 * f.speed + f.phase * 3);
      glow(fx, fy, 10, '#c6ff00', Math.max(0.05, twinkle));
      ctx.fillStyle = '#e6ff70';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function glow(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGems(state, cam) {
    for (const g of state.gems) {
      const x = g.x - cam.x;
      const y = g.y - cam.y + Math.sin(g.t * 5) * 2;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      glow(x, y, 16, '#ffca28', 0.5);
      ctx.fillStyle = '#ffca28';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  function drawEnemy(e, cam) {
    const x = e.x - cam.x;
    const y = e.y - cam.y;
    if (x < -90 || x > width + 90 || y < -90 || y > height + 90) return;
    const r = e.radius;
    const def = e.def;
    ctx.save();
    ctx.translate(x, y);
    glow(0, 0, r * 2.6, def.glow, e.flash > 0 ? 0.9 : 0.45);

    if (e.kind === 'wisp') {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.4);
      ctx.quadraticCurveTo(0, r * 1.9 + Math.sin(e.t * 9) * 4, r * 0.5, r * 0.4);
      ctx.fill();
    } else if (e.kind === 'bat') {
      const flap = Math.sin(e.t * 16) * 0.7;
      ctx.fillStyle = '#4a148c';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-r * 1.9, -r * (0.4 + flap));
      ctx.lineTo(-r * 0.7, r * 0.5);
      ctx.closePath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 1.9, -r * (0.4 + flap));
      ctx.lineTo(r * 0.7, r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.body;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'golem') {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(0, r * 0.1);
      ctx.lineTo(r * 0.5, -r * 0.4);
      ctx.stroke();
    } else if (e.kind === 'spitter') {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.arc(0, r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Bosses: big horned / crowned silhouette.
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.glow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (e.kind === 'stag') {
        ctx.moveTo(-r * 0.5, -r * 0.7);
        ctx.lineTo(-r * 0.9, -r * 1.5);
        ctx.moveTo(-r * 0.5, -r * 0.7);
        ctx.lineTo(-r * 0.2, -r * 1.4);
        ctx.moveTo(r * 0.5, -r * 0.7);
        ctx.lineTo(r * 0.9, -r * 1.5);
        ctx.moveTo(r * 0.5, -r * 0.7);
        ctx.lineTo(r * 0.2, -r * 1.4);
      } else {
        ctx.moveTo(-r * 0.6, -r * 0.8);
        ctx.lineTo(-r * 0.6, -r * 1.3);
        ctx.lineTo(-r * 0.3, -r * 0.9);
        ctx.lineTo(0, -r * 1.4);
        ctx.lineTo(r * 0.3, -r * 0.9);
        ctx.lineTo(r * 0.6, -r * 1.3);
        ctx.lineTo(r * 0.6, -r * 0.8);
      }
      ctx.stroke();
    }

    // Eyes (all kinds) and the boss health bar.
    const eyeY = -r * 0.15;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.32, eyeY, Math.max(2, r * 0.14), 0, Math.PI * 2);
    ctx.arc(r * 0.32, eyeY, Math.max(2, r * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d50000';
    ctx.beginPath();
    ctx.arc(-r * 0.32, eyeY, Math.max(1, r * 0.07), 0, Math.PI * 2);
    ctx.arc(r * 0.32, eyeY, Math.max(1, r * 0.07), 0, Math.PI * 2);
    ctx.fill();

    if (e.hp < e.maxHp && e.def.behaviour !== 'boss') {
      bar(ctx, -r, -r - 12, r * 2, 4, e.hp / e.maxHp, '#ff5252', 'rgba(0,0,0,0.5)');
    }
    ctx.restore();
  }

  function drawPlayer(state, cam) {
    const p = state.player;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const blink = p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;

    // Lantern light over everything nearby.
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 260, '#ffb300', 0.28);
    glow(x, y, 130, '#ffca28', 0.35);
    ctx.globalCompositeOperation = 'source-over';

    const bob = Math.sin(p.walkPhase) * 2;
    // Cloak.
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.moveTo(x, y - PLAYER.radius - 2 + bob * 0.3);
    ctx.quadraticCurveTo(x + PLAYER.radius + 4, y, x + PLAYER.radius * 0.7, y + PLAYER.radius + 2);
    ctx.quadraticCurveTo(x, y + PLAYER.radius + 6, x - PLAYER.radius * 0.7, y + PLAYER.radius + 2);
    ctx.quadraticCurveTo(x - PLAYER.radius - 4, y, x, y - PLAYER.radius - 2 + bob * 0.3);
    ctx.fill();
    // Hood.
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(x, y - 4 + bob * 0.3, PLAYER.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    // Face shadow with glowing eyes.
    ctx.fillStyle = '#0b0f11';
    ctx.beginPath();
    ctx.arc(x, y - 3 + bob * 0.3, PLAYER.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4 + bob * 0.3, 2, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 4 + bob * 0.3, 2, 0, Math.PI * 2);
    ctx.fill();
    // Ember trim.
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER.radius, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // Lantern, held toward the aim.
    const lx = x + Math.cos(p.aim) * (PLAYER.radius + 10);
    const ly = y + Math.sin(p.aim) * (PLAYER.radius + 10) + bob * 0.3;
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    glow(lx, ly, 26, '#ffca28', 0.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Dash cooldown ring.
    if (p.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / (PLAYER.dashCooldown * state.stats.dashCooldownMul)));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullets(state, cam) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      glow(x, y, 18, b.crit ? '#ffd54f' : '#ffab00', 0.7);
      ctx.fillStyle = b.crit ? '#ffe082' : '#ffca28';
      ctx.beginPath();
      ctx.arc(x, y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBullets) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      glow(x, y, 16, '#ff1744', 0.7);
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.arc(x, y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawParticles(state, cam) {
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of state.particles) {
      const x = pt.x - cam.x;
      const y = pt.y - cam.y;
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(x, y, pt.size * clamp(pt.life / pt.maxLife, 0.3, 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFloaters(state, cam) {
    ctx.textAlign = 'center';
    ctx.font = `bold 13px ${UI_FONT}`;
    for (const f of state.floaters) {
      ctx.globalAlpha = clamp(f.life / 0.8, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawAura(state, cam) {
    const s = state.stats;
    if (s.auraLevel <= 0) return;
    const p = state.player;
    const radius = PLAYER.lanternRadius + s.auraLevel * 28;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, radius, '#ff6d00', 0.12 + 0.04 * Math.sin(state.time * 4));
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawVignette(state) {
    const g = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.42,
      width / 2, height / 2, Math.max(width, height) * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    const p = state.player;
    if (p.hp < p.maxHp * 0.3) {
      const pulse = 0.12 + 0.08 * Math.sin(state.time * 6);
      const rg = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.35,
        width / 2, height / 2, Math.max(width, height) * 0.7,
      );
      rg.addColorStop(0, 'rgba(213,0,0,0)');
      rg.addColorStop(1, `rgba(213,0,0,${pulse})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, width, height);
    }
    if (p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(213,0,0,${p.hurtFlash * 0.9})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawHud(state, best, muted, screen) {
    const p = state.player;
    const pad = 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Top-left: health, XP, level.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, pad - 6, pad - 6, 300, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#eceff1';
    ctx.font = `bold 14px ${UI_FONT}`;
    ctx.fillText(`HP  ${Math.ceil(p.hp)} / ${p.maxHp}`, pad, pad + 16);
    bar(ctx, pad, pad + 24, 200, 12, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#66bb6a' : '#ef5350', 'rgba(255,255,255,0.15)');
    ctx.fillStyle = '#ffca28';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(`LEVEL ${state.level}`, pad + 212, pad + 16);
    bar(ctx, pad, pad + 44, 288, 8, state.xp / state.xpNext, '#ffca28', 'rgba(255,255,255,0.15)');
    ctx.fillStyle = '#b0bec5';
    ctx.fillText(`XP ${state.xp}/${state.xpNext}`, pad, pad + 66);

    // Top-centre: wave and foes left.
    const foesLeft = state.enemies.length + state.spawnQueue.length;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const waveText = state.wave === 0 ? 'GET READY' : `WAVE ${state.wave} / ${FINAL_WAVE}`;
    ctx.font = `bold 20px ${UI_FONT}`;
    const tw = ctx.measureText(waveText).width;
    roundRect(ctx, width / 2 - tw / 2 - 18, pad - 6, tw + 36, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.fillText(waveText, width / 2, pad + 20);
    ctx.fillStyle = '#eceff1';
    ctx.font = `13px ${UI_FONT}`;
    ctx.fillText(state.waveState === 'breather' ? `next wave in ${Math.max(0, state.waveTimer).toFixed(1)}s` : `${foesLeft} foes remain`, width / 2, pad + 42);

    // Top-right: score, kills, time, best.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, width - pad - 206, pad - 6, 212, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#eceff1';
    ctx.font = `bold 16px ${UI_FONT}`;
    ctx.fillText(`SCORE ${state.score}`, width - pad, pad + 18);
    ctx.font = `13px ${UI_FONT}`;
    ctx.fillStyle = '#b0bec5';
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    ctx.fillText(`Kills ${state.kills}   ${mins}:${String(secs).padStart(2, '0')}`, width - pad, pad + 40);
    ctx.fillText(`Best ${Math.max(best, state.score)}`, width - pad, pad + 60);

    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, width / 2 - 220, height - 64, 440, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.font = `bold 13px ${UI_FONT}`;
      ctx.fillText(b.def.name.toUpperCase(), width / 2, height - 44);
      bar(ctx, width / 2 - 200, height - 38, 400, 10, b.hp / b.maxHp, '#d50000', 'rgba(255,255,255,0.15)');
    }

    // Bottom-left hints.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(236,239,241,0.6)';
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText('WASD move · mouse aim · Shift dash · P pause · M mute', pad, height - 14);
    if (muted) ctx.fillText('MUTED', pad, height - 32);

    // Wave banner, only over live play so it never collides with a menu.
    if (screen === SCREEN_PLAY && state.bannerTimer > 0) {
      const alpha = clamp(state.bannerTimer / 0.6, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = `bold 44px ${TITLE_FONT}`;
      ctx.fillStyle = '#ffca28';
      ctx.shadowColor = '#ff6d00';
      ctx.shadowBlur = 24;
      ctx.fillText(state.banner, width / 2, height * 0.3);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4, 8, 10, 0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 52px ${TITLE_FONT}`;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 28;
    ctx.fillText(title, width / 2, height * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eceff1';
    ctx.font = `17px ${UI_FONT}`;
    let y = height * 0.3 + 44;
    for (const line of lines) {
      ctx.fillText(line, width / 2, y);
      y += 28;
    }
    return y;
  }

  function drawTitle(state, best) {
    const y = overlay('EMBERWARDEN', [
      'The last lantern-keeper holds a clearing against the Hollow.',
      'Survive 10 waves. Slay the Hollow King. Keep the light alive.',
      '',
      'WASD / arrows — move      Mouse — aim (the lantern fires on its own)',
      'Shift / Space — dash through danger      P — pause      M — mute',
      '',
      best > 0 ? `Best score: ${best}` : 'No run yet — light the lantern.',
    ], '#ffca28');
    ctx.fillStyle = '#ffca28';
    ctx.font = `bold 20px ${UI_FONT}`;
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', width / 2, y + 40);
    ctx.globalAlpha = 1;
  }

  function drawLevelUp(state) {
    ctx.fillStyle = 'rgba(4, 8, 10, 0.66)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffca28';
    ctx.font = `bold 40px ${TITLE_FONT}`;
    ctx.fillText(`LEVEL ${state.level} — CHOOSE A BOON`, width / 2, height * 0.24);
    ctx.fillStyle = '#b0bec5';
    ctx.font = `15px ${UI_FONT}`;
    ctx.fillText('Click a card or press 1, 2 or 3', width / 2, height * 0.24 + 32);

    const cardW = 250;
    const cardH = 190;
    const gap = 24;
    const totalW = cardW * 3 + gap * 2;
    const startX = (width - totalW) / 2;
    const startY = height * 0.34;
    cardRects.length = 0;
    state.choices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      const y = startY;
      cardRects.push({ x, y, w: cardW, h: cardH, index: i });
      ctx.fillStyle = 'rgba(38, 50, 56, 0.95)';
      roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.stroke();
      ctx.fillStyle = '#ffca28';
      ctx.font = `bold 15px ${UI_FONT}`;
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y + 30);
      ctx.fillStyle = '#eceff1';
      ctx.font = `bold 19px ${UI_FONT}`;
      ctx.fillText(choice.name, x + cardW / 2, y + 62);
      ctx.fillStyle = '#b0bec5';
      ctx.font = `15px ${UI_FONT}`;
      const words = choice.desc.split(' ');
      let line = '';
      let ly = y + 96;
      for (const word of words) {
        if (ctx.measureText(`${line} ${word}`.trim()).width > cardW - 32) {
          ctx.fillText(line.trim(), x + cardW / 2, ly);
          ly += 22;
          line = word;
        } else {
          line += ` ${word}`;
        }
      }
      ctx.fillText(line.trim(), x + cardW / 2, ly);
      const owned = state.taken[choice.id] ?? 0;
      if (owned > 0) {
        ctx.fillStyle = '#ffca28';
        ctx.font = `13px ${UI_FONT}`;
        ctx.fillText(`owned ×${owned}`, x + cardW / 2, y + cardH - 18);
      }
    });
  }

  function drawStats(state, best) {
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    return [
      `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
      `Reached wave ${Math.max(1, state.wave)} of ${FINAL_WAVE}   ·   ${state.kills} foes slain   ·   Level ${state.level}`,
      `Survived ${mins}:${String(secs).padStart(2, '0')}`,
    ];
  }

  function drawOver(state, best) {
    const y = overlay('THE LIGHT GOES OUT', drawStats(state, best), '#ff5252');
    ctx.fillStyle = '#eceff1';
    ctx.font = `bold 20px ${UI_FONT}`;
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('CLICK OR PRESS ENTER TO TRY AGAIN', width / 2, y + 44);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, best) {
    const y = overlay('THE DAWN BREAKS', [
      'The Hollow King is ash. The clearing is yours, Warden.',
      ...drawStats(state, best),
    ], '#ffd54f');
    ctx.fillStyle = '#eceff1';
    ctx.font = `bold 20px ${UI_FONT}`;
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY AGAIN', width / 2, y + 44);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    const y = overlay('PAUSED', ['The Hollow waits. The lantern does not.'], '#eceff1');
    ctx.fillStyle = '#b0bec5';
    ctx.font = `16px ${UI_FONT}`;
    ctx.fillText('Press P or click to resume', width / 2, y + 36);
  }

  function draw(state, screen, best, muted) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const cam = camera(state);
    cam.x += shakeX;
    cam.y += shakeY;

    drawBackground(cam);
    drawDecor(state, cam);
    drawAura(state, cam);
    drawGems(state, cam);
    for (const e of state.enemies) drawEnemy(e, cam);
    if (!state.gameOver) drawPlayer(state, cam);
    drawBullets(state, cam);
    drawParticles(state, cam);
    drawFloaters(state, cam);
    drawVignette(state);

    if (screen === SCREEN_PLAY || screen === SCREEN_LEVELUP || screen === SCREEN_PAUSED) {
      drawHud(state, best, muted, screen);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_LEVELUP) drawLevelUp(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw, toWorld, cardRects, resize };
}
