// entities.js — the actors of "The Gilded Vault": the thief, the patrolling
// guards with their vision cones, and the wall cameras that sweep the rooms.
import { TILE, tileCenter, isWall, hasLineOfSight, findPath } from './level.js';

export const GUARD_SPEED = 58;
export const GUARD_CHASE_SPEED = 105;
export const GUARD_RANGE = 155;
export const GUARD_HALF_ANGLE = 0.61; // ~35 degrees
export const CAMERA_RANGE = 195;
export const CAMERA_HALF_ANGLE = 0.52; // ~30 degrees

// --- the thief ---------------------------------------------------------------
export function makePlayer(start) {
  return {
    x: start.x, y: start.y, r: 11,
    speed: 142, sneakSpeed: 72,
    dir: -Math.PI / 2, // facing up at the start
    sneaking: false,
    moving: false,
    stepPhase: 0,
    path: null, // click-to-move: list of pixel waypoints, or null
    pathIndex: 0,
  };
}

// Move the player by a velocity for dt seconds, sliding along walls. Returns
// true when the player actually moved.
export function movePlayer(player, vx, vy, dt) {
  const len = Math.hypot(vx, vy);
  if (len < 0.001) { player.moving = false; return false; }
  const nx = player.x + (vx / len) * player.speed * dt * (player.sneaking ? 0.5 : 1);
  const ny = player.y + (vy / len) * player.speed * dt * (player.sneaking ? 0.5 : 1);
  player.dir = Math.atan2(vy, vx);
  player.moving = true;
  player.stepPhase += dt * (player.sneaking ? 6 : 11);
  // Axis-separated collision: slide along a wall instead of sticking to it.
  if (!circleHitsWall(nx, player.y, player.r)) player.x = nx;
  if (!circleHitsWall(player.x, ny, player.r)) player.y = ny;
  return true;
}

export function circleHitsWall(x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isWall(tx, ty)) {
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    }
  }
  return false;
}

// Follow a click-to-move path (list of pixel waypoints). Returns the velocity
// to apply this frame, or null when the path is finished.
export function followPath(player, dt) {
  if (!player.path || player.pathIndex >= player.path.length) {
    player.path = null;
    return null;
  }
  const target = player.path[player.pathIndex];
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    player.pathIndex++;
    return followPath(player, dt);
  }
  return { vx: dx / dist, vy: dy / dist };
}

// --- guards ------------------------------------------------------------------
export function makeGuard(waypoints, speed = GUARD_SPEED) {
  const first = tileCenter(waypoints[0][0], waypoints[0][1]);
  return {
    x: first.x, y: first.y, r: 12,
    waypoints: waypoints.map(([tx, ty]) => tileCenter(tx, ty)),
    wpIndex: 1,
    wait: 0,
    speed,
    dir: Math.PI / 2,
    alert: 0, // 0 calm .. 1 fully alerted and chasing
    state: 'patrol', // patrol | suspicious | chase
    lastSeen: null,
    loseTimer: 0,
    repathTimer: 0,
    chasePath: null,
    chaseIndex: 0,
    returnPath: null, // BFS route back to the patrol loop after a chase
    returnIndex: 0,
    prevState: 'patrol',
    bobPhase: Math.random() * Math.PI * 2,
  };
}

// Can this seer (guard or camera) currently see the player? Range, cone
// angle and an unobstructed line of sight must all hold. A sneaking thief
// is harder to spot: the effective range shrinks by 35%.
export function canSee(seer, range, halfAngle, player) {
  const dx = player.x - seer.x;
  const dy = player.y - seer.y;
  const dist = Math.hypot(dx, dy);
  const effectiveRange = range * (player.sneaking ? 0.65 : 1);
  if (dist > effectiveRange) return false;
  let angle = Math.atan2(dy, dx) - seer.dir;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  if (Math.abs(angle) > halfAngle) return false;
  return hasLineOfSight(seer.x, seer.y, player.x, player.y);
}

export function updateGuard(guard, player, dt) {
  const sees = canSee(guard, GUARD_RANGE, GUARD_HALF_ANGLE, player);
  if (sees) {
    guard.alert = Math.min(1, guard.alert + dt * 1.15);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseTimer = 0;
  } else {
    guard.alert = Math.max(0, guard.alert - dt * 0.35);
    guard.loseTimer += dt;
  }
  guard.state = guard.alert >= 1 ? 'chase' : guard.alert > 0.3 ? 'suspicious' : 'patrol';

  if (guard.state === 'chase') {
    // Chase the thief along the floor, re-pathing twice a second.
    guard.repathTimer -= dt;
    if (guard.repathTimer <= 0) {
      guard.repathTimer = 0.45;
      const sx = Math.floor(guard.x / TILE);
      const sy = Math.floor(guard.y / TILE);
      const tx = Math.floor(player.x / TILE);
      const ty = Math.floor(player.y / TILE);
      guard.chasePath = findPath(sx, sy, tx, ty);
      guard.chaseIndex = 0;
    }
    const target = guard.chasePath && guard.chaseIndex < guard.chasePath.length
      ? guard.chasePath[guard.chaseIndex]
      : { x: player.x, y: player.y };
    stepToward(guard, target, GUARD_CHASE_SPEED, dt);
    if (guard.chasePath && guard.chaseIndex < guard.chasePath.length) {
      const d = Math.hypot(guard.chasePath[guard.chaseIndex].x - guard.x, guard.chasePath[guard.chaseIndex].y - guard.y);
      if (d < 5) guard.chaseIndex++;
    }
    // Caught: the guard lays a hand on the thief.
    if (Math.hypot(player.x - guard.x, player.y - guard.y) < guard.r + player.r + 2) {
      return 'caught';
    }
  } else if (guard.state === 'suspicious' && guard.lastSeen) {
    // Walk over to where the thief was glimpsed, then look around.
    stepToward(guard, guard.lastSeen, guard.speed * 1.15, dt);
    if (Math.hypot(guard.lastSeen.x - guard.x, guard.lastSeen.y - guard.y) < 8) {
      guard.lastSeen = null;
      guard.dir += dt * 2.2; // scan the room
    }
  } else {
    // Patrol: walk the loop, pausing at each waypoint to look around.
    // After a chase the guard may be far from its loop with a wall in the
    // way, so it first follows a BFS route back to its next waypoint
    // instead of walking straight into the wall.
    if (guard.prevState !== 'patrol' && guard.state === 'patrol') {
      const target = guard.waypoints[guard.wpIndex];
      if (!hasLineOfSight(guard.x, guard.y, target.x, target.y)) {
        guard.returnPath = findPath(
          Math.floor(guard.x / TILE), Math.floor(guard.y / TILE),
          Math.floor(target.x / TILE), Math.floor(target.y / TILE),
        );
        guard.returnIndex = 0;
      }
    }
    if (guard.returnPath && guard.returnIndex < guard.returnPath.length) {
      const target = guard.returnPath[guard.returnIndex];
      const arrived = stepToward(guard, target, guard.speed, dt);
      if (arrived) guard.returnIndex++;
      if (guard.returnIndex >= guard.returnPath.length) guard.returnPath = null;
    } else if (guard.wait > 0) {
      guard.wait -= dt;
      guard.dir += dt * 0.9;
    } else {
      const target = guard.waypoints[guard.wpIndex];
      const arrived = stepToward(guard, target, guard.speed, dt);
      if (arrived) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        guard.wait = 1.1;
      }
    }
  }
  guard.prevState = guard.state;
  guard.bobPhase += dt * 8;
  return null;
}

function stepToward(guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.dir = Math.atan2(dy, dx);
  return false;
}

// --- cameras -----------------------------------------------------------------
export function makeCamera(tx, ty, baseDir, sweep, range = CAMERA_RANGE) {
  const c = tileCenter(tx, ty);
  return {
    x: c.x, y: c.y, r: 8,
    baseDir, sweep, range,
    dir: baseDir,
    phase: Math.random() * Math.PI * 2,
    seesPlayer: false,
  };
}

export function updateCamera(camera, player, dt, time) {
  camera.dir = camera.baseDir + Math.sin(time * 0.55 + camera.phase) * camera.sweep;
  camera.seesPlayer = canSee(camera, camera.range, CAMERA_HALF_ANGLE, player);
  return camera.seesPlayer;
}
