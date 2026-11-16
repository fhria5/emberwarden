// Emberwarden — the screenshot scenes behind ?shot=start|play|levelup|end.
// One clear job: stage a real frame of the game for a screenshot. Each scene
// plays the real rules forward from a fresh world for a fixed time, steered
// by a simple autopilot (kite away from the nearest foe, chase shards, aim
// at the closest enemy), so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 42;
const LEVELUP_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/**
 * The autopilot's input for one step. `skill` 1 plays properly (kites,
 * dashes, chases shards); skill 0 wanders into danger and never dashes,
 * so the end scene is caught out the way a careless player is.
 */
function autopilot(state, skill) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }

  let mx = 0;
  let my = 0;
  if (skill > 0) {
    // Flee the closest foe when it is near, drift toward shards otherwise.
    if (nearest && nearestD < 240) {
      mx = (p.x - nearest.x) / nearestD;
      my = (p.y - nearest.y) / nearestD;
    }
    let gem = null;
    let gemD = Infinity;
    for (const g of state.gems) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < gemD) {
        gemD = d;
        gem = g;
      }
    }
    if (gem && gemD < 430 && (!nearest || nearestD > 120)) {
      mx += ((gem.x - p.x) / gemD) * 1.0;
      my += ((gem.y - p.y) / gemD) * 1.0;
    }
    // Keep out of the arena walls.
    if (p.x < 140) mx += 1;
    if (p.x > 2060) mx -= 1;
    if (p.y < 140) my += 1;
    if (p.y > 1460) my -= 1;
  } else {
    // The careless pilot chases the nearest shard and ignores everything.
    let gem = null;
    let gemD = Infinity;
    for (const g of state.gems) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < gemD) {
        gemD = d;
        gem = g;
      }
    }
    if (gem) {
      mx = (gem.x - p.x) / gemD;
      my = (gem.y - p.y) / gemD;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const dash = skill > 0 && nearest !== null && nearestD < 90 && p.dashCooldown <= 0;
  return {
    moveX: mx,
    moveY: my,
    aimX: nearest ? nearest.x : p.x + 100,
    aimY: nearest ? nearest.y : p.y,
    dash,
  };
}

/**
 * Set `world` to the named scene (start, play, levelup or end; any other
 * name is start) and return the screen to draw over it and the best score
 * to show. Level-ups the play scene earns are spent on the first choice so
 * the fight keeps going; the levelup scene stops on the first one instead.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'levelup' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) {
      world.step(SAMPLE, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'levelup' ? LEVELUP_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 0 : 1;
  for (let index = 0; index < limit / SAMPLE; index += 1) {
    if (world.state.gameOver || world.state.victory) break;
    if (name === 'levelup' && world.state.pendingLevelUps > 0) break;
    const input = autopilot(world.state, skill);
    world.step(SAMPLE, input, false);
    if (name === 'play') {
      while (world.state.pendingLevelUps > 0) world.applyChoice(0);
    }
  }
  if (name === 'levelup' && world.state.pendingLevelUps > 0) {
    return { screen: SCREEN_LEVELUP, best: world.state.score };
  }
  const over = world.state.gameOver;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
