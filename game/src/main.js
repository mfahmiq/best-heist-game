// main.js — "The Gilded Vault": boot, game loop, input and the state machine.
// A top-down stealth heist: steal the Star of Meridia from the vault, grab
// gold on the way, and slip out the front door before the alarm hits 100%.
import { TILE, findAll, tileCenter, findPath, nearestWalkable } from './level.js';
import {
  makePlayer, movePlayer, followPath,
  makeGuard, updateGuard,
  makeCamera, updateCamera,
} from './entities.js';
import { render, W, H } from './render.js';
import { stageShot } from './shots.js';
import {
  initAudio, playPickup, playGem, playDoor, playCaught, playWin,
  playStep, setAlarmSound, stopAllSound, setMuted, isMuted,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

// --- world setup --------------------------------------------------------------
const playerStart = tileCenter(findAll('P')[0].tx, findAll('P')[0].ty);
const gemTile = findAll('L')[0];
const exitTiles = findAll('E').map(({ tx, ty }) => tileCenter(tx, ty));

const game = {
  state: 'title', // title | playing | paused | won | lost
  frozen: false, // staged ?shot= moments do not simulate: the frame is the shot
  time: 0, // wall-clock time for animation, always advancing
  elapsed: 0, // in-game timer, only while playing
  alarm: 0,
  score: 0,
  gemTaken: false,
  goldTaken: 0,
  exitOpen: false,
  best: Number(localStorage.getItem('gilded-vault-best') || 0),
  player: makePlayer(playerStart),
  guards: [
    makeGuard([[3, 11], [26, 11], [26, 13], [3, 13]], 58),
    makeGuard([[3, 16], [26, 16], [26, 17], [3, 17]], 50),
    makeGuard([[19, 3], [27, 3], [27, 6], [19, 6]], 62),
  ],
  cameras: [
    makeCamera(17, 2, 0, 0.5, 200), // vault camera on the vault's west wall
    makeCamera(8, 10, 0.6, 0.5, 180), // gallery camera on a pillar
    makeCamera(0, 15, 0, 0.5, 170), // exit camera on the west wall
  ],
  gold: findAll('g').map(({ tx, ty }) => ({ ...tileCenter(tx, ty), tx, ty, taken: false })),
  gem: tileCenter(gemTile.tx, gemTile.ty),
  exitTiles,
};

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

Object.defineProperty(game, 'timeStr', { get: () => fmtTime(game.elapsed) });

function resetGame() {
  game.state = 'playing';
  game.elapsed = 0;
  game.alarm = 0;
  game.score = 0;
  game.gemTaken = false;
  game.goldTaken = 0;
  game.exitOpen = false;
  game.player = makePlayer(playerStart);
  game.guards = [
    makeGuard([[3, 11], [26, 11], [26, 13], [3, 13]], 58),
    makeGuard([[3, 16], [26, 16], [26, 17], [3, 17]], 50),
    makeGuard([[19, 3], [27, 3], [27, 6], [19, 6]], 62),
  ];
  game.cameras.forEach((c) => { c.seesPlayer = false; });
  game.gold.forEach((g) => { g.taken = false; });
  stopAllSound();
}

function startGame() {
  initAudio();
  resetGame();
}

function endGame(won) {
  game.state = won ? 'won' : 'lost';
  stopAllSound();
  if (won) {
    game.score += Math.max(0, Math.round((240 - game.elapsed)) * 5) + 500;
    playWin();
  } else {
    playCaught();
  }
  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem('gilded-vault-best', String(game.best));
  }
}

// --- input ----------------------------------------------------------------------
const keys = new Set();
let stepTimer = 0;

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === 'Enter' && game.state === 'title') startGame();
  if ((e.key === 'r' || e.key === 'R') && (game.state === 'won' || game.state === 'lost')) startGame();
  if (e.key === 'm' || e.key === 'M') setMuted(!isMuted());
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.state === 'playing') game.state = 'paused';
  else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.state === 'paused') game.state = 'playing';
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('click', (e) => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);
  if (game.state === 'title') {
    if (x >= W / 2 - 130 && x <= W / 2 + 130 && y >= 440 && y <= 488) startGame();
    return;
  }
  if (game.state === 'won' || game.state === 'lost') { startGame(); return; }
  if (game.state !== 'playing') return;
  // Click to walk: BFS a path across the floor and follow it. A click on a
  // wall walks to the nearest floor beside it.
  const dest = nearestWalkable(Math.floor(x / TILE), Math.floor(y / TILE));
  if (!dest) return;
  const path = findPath(Math.floor(game.player.x / TILE), Math.floor(game.player.y / TILE), dest.tx, dest.ty);
  if (path && path.length > 1) {
    game.player.path = path;
    game.player.pathIndex = 1;
  }
});

// --- update ---------------------------------------------------------------------
function update(dt) {
  if (game.state !== 'playing') return;
  game.elapsed += dt;

  // Movement: keys win over a click-to-move path.
  let vx = 0;
  let vy = 0;
  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;
  game.player.sneaking = keys.has('shift');
  if (vx !== 0 || vy !== 0) {
    game.player.path = null;
    movePlayer(game.player, vx, vy, dt);
  } else {
    const dir = followPath(game.player, dt);
    if (dir) movePlayer(game.player, dir.vx, dir.vy, dt);
    else game.player.moving = false;
  }
  if (game.player.moving) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      stepTimer = game.player.sneaking ? 0.5 : 0.34;
      playStep();
    }
  }

  // Guards and cameras.
  let anyoneSees = false;
  let guardChasing = false;
  for (const guard of game.guards) {
    const result = updateGuard(guard, game.player, dt);
    if (result === 'caught') {
      game.alarm = 100;
      endGame(false);
      return;
    }
    if (guard.state === 'chase') { anyoneSees = true; guardChasing = true; }
    else if (guard.state === 'suspicious') anyoneSees = true;
  }
  let cameraSees = false;
  for (const camera of game.cameras) {
    if (updateCamera(camera, game.player, dt, game.time)) cameraSees = true;
  }

  // The alarm climbs while the thief is seen, and bleeds off while hidden.
  if (guardChasing) game.alarm += 40 * dt;
  else if (anyoneSees) game.alarm += 12 * dt;
  if (cameraSees) game.alarm += 28 * dt;
  if (!anyoneSees && !cameraSees) game.alarm -= 6 * dt;
  game.alarm = Math.max(0, Math.min(100, game.alarm));
  setAlarmSound(game.alarm);
  if (game.alarm >= 100) { endGame(false); return; }

  // Pickups.
  for (const gold of game.gold) {
    if (!gold.taken && Math.hypot(gold.x - game.player.x, gold.y - game.player.y) < 22) {
      gold.taken = true;
      game.goldTaken++;
      game.score += 100;
      playPickup();
    }
  }
  if (!game.gemTaken && Math.hypot(game.gem.x - game.player.x, game.gem.y - game.player.y) < 24) {
    game.gemTaken = true;
    game.exitOpen = true;
    game.score += 500;
    playGem();
    playDoor();
  }

  // The exit: step onto it once it is open and the heist is done.
  if (game.exitOpen) {
    const tx = Math.floor(game.player.x / TILE);
    const ty = Math.floor(game.player.y / TILE);
    if (game.exitTiles.some((e) => Math.floor(e.x / TILE) === tx && Math.floor(e.y / TILE) === ty)) {
      endGame(true);
    }
  }
}

// --- main loop ------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  if (!game.frozen) update(dt);
  render(ctx, game);
  requestAnimationFrame(loop);
}

// A ?shot= query stages a fixed moment for the screenshots.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) stageShot(game, shot);
// Debug handle for automated playtests (harmless in the shipped game).
window.__game = game;
requestAnimationFrame(loop);
