// Emberwarden — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between six screens: title, play,
// level-up, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|levelup|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR, EVENT_BOSS } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
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

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let lastEvents = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive 10 waves.');
  }

  function endGame(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (won) audio.victory();
    else audio.gameOver();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function applyLevelUp(index) {
    audio.unlock();
    audio.click();
    world.applyChoice(index);
    if (world.state.pendingLevelUps > 0) {
      screen = SCREEN_LEVELUP;
    } else {
      screen = SCREEN_PLAY;
      announce(`Level ${world.state.level}. Wave ${world.state.wave}.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      for (let i = 0; i < 3; i += 1) {
        if (actions & (16 << i)) applyLevelUp(i);
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

  function handleClick(event) {
    audio.unlock();
    if (screen === SCREEN_LEVELUP) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      for (const card of renderer.cardRects) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          applyLevelUp(card.index);
          return;
        }
      }
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  canvas.addEventListener('click', handleClick);

  function playEventSounds(events) {
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_LEVELUP) audio.levelUp();
    if (events & EVENT_WAVE_CLEAR) audio.waveStart();
    if (events & EVENT_BOSS) audio.bossRoar();
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, dash: false }, true);
      return;
    }
    const move = input.moveVector();
    const aimScreen = input.aim();
    const aim = renderer.toWorld(aimScreen.x, aimScreen.y, world.state);
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      dash: Boolean(actions & ACTION_DASH),
    }, false);
    lastEvents = events;
    playEventSounds(events);
    if (events & EVENT_VICTORY) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.level}. Choose a boon.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
        if (screen === SCREEN_LEVELUP || screen === SCREEN_OVER || screen === SCREEN_WIN) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting the Hollow
  // feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Keep the last events visible to tests and the console.
  window.__emberwarden = { world, get screen() { return screen; }, get events() { return lastEvents; } };

  announce('Emberwarden. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
