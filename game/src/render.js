// render.js — every pixel of "The Gilded Vault": the museum floor, the
// raycast-clipped vision cones, the thief, the guards, the cameras, the
// loot, the exit and the HUD. All drawing is on one 960 x 640 canvas.
import { TILE, COLS, ROWS, MAP, tileAt } from './level.js';
import { GUARD_RANGE, GUARD_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE } from './entities.js';

export const W = COLS * TILE; // 960
export const H = ROWS * TILE; // 640

// Deterministic per-tile shade so the floor never looks flat.
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function floorColor(tx, ty) {
  const ch = tileAt(tx, ty);
  if (ch === '#') return null;
  const v = hash(tx, ty);
  // The vault room (top right) has a red carpet; the store room (top left)
  // wooden boards; the middle gallery pale marble; the hall dark slate.
  if (tx >= 18 && ty <= 7) return `rgb(${86 + v * 14},${26 + v * 8},${34 + v * 8})`;
  if (tx <= 6 && ty <= 7) return `rgb(${66 + v * 12},${50 + v * 10},${30 + v * 8})`;
  if (tx >= 8 && tx <= 16 && ty <= 7) return `rgb(${52 + v * 12},${60 + v * 12},${76 + v * 12})`;
  return `rgb(${26 + v * 8},${32 + v * 8},${46 + v * 10})`;
}

// Cast rays across a vision cone and return the polygon of where the seer
// can actually see: each ray stops at the first wall it hits.
function conePolygon(x, y, dir, halfAngle, range, rays = 26) {
  const pts = [[x, y]];
  for (let i = 0; i <= rays; i++) {
    const a = dir - halfAngle + (2 * halfAngle * i) / rays;
    let d = range;
    for (let s = 6; s <= range; s += 6) {
      const px = x + Math.cos(a) * s;
      const py = y + Math.sin(a) * s;
      if (tileAt(Math.floor(px / TILE), Math.floor(py / TILE)) === '#') {
        d = s - 6;
        break;
      }
    }
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

function fillPolygon(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawFloor(ctx) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#232c42';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#3d4c6e';
        ctx.fillRect(px, py, TILE, 5);
        ctx.fillStyle = '#1a2133';
        ctx.fillRect(px, py + TILE - 3, TILE, 3);
      } else {
        ctx.fillStyle = floorColor(tx, ty);
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      }
      if (ch === 'D') {
        // Doorway: a brass threshold and a darker frame.
        ctx.fillStyle = '#8a6d2f';
        ctx.fillRect(px, py + TILE / 2 - 3, TILE, 6);
        ctx.fillStyle = '#5a4520';
        ctx.fillRect(px, py, 3, TILE);
        ctx.fillRect(px + TILE - 3, py, 3, TILE);
      }
      if (ch === 'E') {
        ctx.fillStyle = '#123a24';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
}

function drawGold(ctx, gold, time) {
  const bob = Math.sin(time * 3 + gold.tx) * 1.5;
  ctx.save();
  ctx.translate(gold.x, gold.y + bob);
  ctx.fillStyle = '#f5c542';
  ctx.fillRect(-8, -4, 16, 8);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(-8, -4, 16, 3);
  ctx.strokeStyle = '#a87f14';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-8, -4, 16, 8);
  ctx.restore();
}

function drawGem(ctx, gem, time) {
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const glow = ctx.createRadialGradient(gem.x, gem.y, 2, gem.x, gem.y, 34);
  glow.addColorStop(0, 'rgba(111,242,255,0.55)');
  glow.addColorStop(1, 'rgba(111,242,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(gem.x, gem.y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.scale(pulse, pulse);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#6ff2ff';
  ctx.fillRect(-9, -9, 18, 18);
  ctx.fillStyle = '#d8fbff';
  ctx.fillRect(-9, -9, 18, 7);
  ctx.strokeStyle = '#1e7f96';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();
}

function drawPlayer(ctx, player) {
  const bob = player.moving ? Math.sin(player.stepPhase) * 2 : 0;
  const crouch = player.sneaking ? 0.82 : 1;
  // A soft teal pool of light under the thief so the dark cloak never melts
  // into the dark floor.
  const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 26);
  glow.addColorStop(0, 'rgba(47,174,158,0.30)');
  glow.addColorStop(1, 'rgba(47,174,158,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.scale(1, crouch);
  // Cloak with a bright teal rim.
  ctx.fillStyle = '#1d1a26';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(10, -4, 9, 10);
  ctx.quadraticCurveTo(0, 13, -9, 10);
  ctx.quadraticCurveTo(-10, -4, 0, -11);
  ctx.fill();
  ctx.strokeStyle = '#2fae9e';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Teal hood and face.
  ctx.fillStyle = '#3ec9b5';
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2d8b3';
  ctx.beginPath();
  ctx.arc(Math.cos(player.dir) * 2, -8 + Math.sin(player.dir) * 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Eyes in the facing direction.
  ctx.fillStyle = '#111';
  ctx.fillRect(Math.cos(player.dir) * 3 - 1, -9 + Math.sin(player.dir) * 2, 2, 2);
  ctx.restore();
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', player.x, player.y - 20);
  }
}

function drawGuard(ctx, guard, time) {
  // Vision cone: amber while patrolling, orange while suspicious, red while
  // chasing. The cone is clipped by walls, so it never leaks through them.
  const coneColor =
    guard.state === 'chase' ? 'rgba(255,64,48,0.30)' :
    guard.state === 'suspicious' ? 'rgba(255,160,40,0.24)' :
    'rgba(255,214,80,0.16)';
  fillPolygon(ctx, conePolygon(guard.x, guard.y, guard.dir, GUARD_HALF_ANGLE, GUARD_RANGE), coneColor);
  const bob = Math.sin(guard.bobPhase) * 1.5;
  ctx.save();
  ctx.translate(guard.x, guard.y + bob);
  // Navy uniform.
  ctx.fillStyle = '#2c4a86';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3560';
  ctx.fillRect(-12, 2, 24, 8);
  // Cap.
  ctx.fillStyle = '#16233d';
  ctx.beginPath();
  ctx.arc(0, -3, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-8, -4, 16, 3);
  // Face and torch.
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(Math.cos(guard.dir) * 4, -3 + Math.sin(guard.dir) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(Math.cos(guard.dir) * 11, Math.sin(guard.dir) * 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // "?" while suspicious, "!" while chasing.
  if (guard.state !== 'patrol') {
    ctx.fillStyle = guard.state === 'chase' ? '#ff5040' : '#ffb020';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 20);
  }
}

function drawCamera(ctx, camera, time) {
  const coneColor = camera.seesPlayer ? 'rgba(255,64,48,0.32)' : 'rgba(255,80,80,0.20)';
  fillPolygon(ctx, conePolygon(camera.x, camera.y, camera.dir, CAMERA_HALF_ANGLE, camera.range), coneColor);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.rotate(camera.dir);
  ctx.fillStyle = '#5a6478';
  ctx.fillRect(-7, -5, 14, 10);
  ctx.fillStyle = '#222a3a';
  ctx.fillRect(5, -3, 5, 6);
  ctx.restore();
  // Blinking recording light.
  ctx.fillStyle = camera.seesPlayer || Math.sin(time * 6) > 0 ? '#ff4040' : '#7a2020';
  ctx.beginPath();
  ctx.arc(camera.x, camera.y - 9, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawExit(ctx, exitOpen, time) {
  for (const e of exitOpen.tiles) {
    const glow = exitOpen.open
      ? `rgba(80,255,140,${0.25 + Math.sin(time * 5) * 0.1})`
      : 'rgba(255,70,60,0.2)';
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
    ctx.fillStyle = exitOpen.open ? '#39d97a' : '#c0392b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(exitOpen.open ? 'EXIT' : 'LOCKED', e.x, e.y + 3);
  }
}

function drawHud(ctx, hud) {
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', 10, 22);
  // Alarm meter: green -> amber -> red.
  const mw = 220;
  ctx.fillStyle = '#20283a';
  ctx.fillRect(62, 10, mw, 14);
  const frac = hud.alarm / 100;
  const grad = ctx.createLinearGradient(62, 0, 62 + mw, 0);
  grad.addColorStop(0, '#39d97a');
  grad.addColorStop(0.55, '#f5c542');
  grad.addColorStop(1, '#ff5040');
  ctx.fillStyle = grad;
  ctx.fillRect(62, 10, mw * frac, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(62.5, 10.5, mw, 14);
  if (hud.alarm >= 70) {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('!', 62 + mw + 8, 22);
  }
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LOOT  ◆ ${hud.gem ? 1 : 0}/1    gold ${hud.gold}/${hud.goldTotal}`, 310, 22);
  ctx.textAlign = 'right';
  ctx.fillText(`TIME ${hud.timeStr}    SCORE ${hud.score}`, W - 10, 22);
  // Bottom hint line.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = '#9aa7c2';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hud.hint, W / 2, H - 9);
  // Red edge pulse when the alarm is critical.
  if (hud.alarm >= 70) {
    const a = 0.12 + Math.sin(hud.time * 8) * 0.06;
    ctx.strokeStyle = `rgba(255,60,40,${a})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
  }
}

function centerText(ctx, text, y, font, color) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(6,8,14,0.86)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f5c542';
  centerText(ctx, 'THE GILDED VAULT', 170, 'bold 54px Georgia, serif', '#f5c542');
  centerText(ctx, 'a midnight heist at the Meridian Museum', 205, 'italic 18px Georgia, serif', '#c9d4ea');
  centerText(ctx, 'Steal the Star of Meridia, then slip out the front door.', 268, '16px sans-serif', '#e8ecf4');
  centerText(ctx, 'Guards and cameras raise the alarm when they see you.', 294, '16px sans-serif', '#e8ecf4');
  centerText(ctx, 'Alarm at 100% — or a guard’s hand on your shoulder — and you are busted.', 320, '16px sans-serif', '#e8ecf4');
  centerText(ctx, 'WASD / arrows — move      Shift — sneak      Click — walk there', 372, '15px sans-serif', '#9aa7c2');
  centerText(ctx, 'Grab gold for score. The exit opens once you hold the gem.', 398, '15px sans-serif', '#9aa7c2');
  ctx.fillStyle = '#2fae9e';
  ctx.fillRect(W / 2 - 130, 440, 260, 48);
  ctx.fillStyle = '#06231f';
  centerText(ctx, '▶  BEGIN THE HEIST', 470, 'bold 18px sans-serif', '#06231f');
  if (best > 0) centerText(ctx, `Best score: ${best}`, 530, '14px sans-serif', '#9aa7c2');
}

function drawEnd(ctx, won, stats) {
  ctx.fillStyle = won ? 'rgba(6,26,14,0.82)' : 'rgba(30,6,8,0.86)';
  ctx.fillRect(0, 0, W, H);
  centerText(ctx, won ? 'CLEAN GETAWAY!' : 'BUSTED!', 220, 'bold 52px Georgia, serif', won ? '#39d97a' : '#ff5040');
  centerText(
    ctx,
    won ? 'The Star of Meridia is yours. The museum never knew you were there.'
      : 'The guards closed in. The Meridian keeps its gem — this time.',
    262, '16px sans-serif', '#e8ecf4',
  );
  centerText(ctx, `Time ${stats.timeStr}      Gold ${stats.gold}/${stats.goldTotal}      Score ${stats.score}`, 330, '17px sans-serif', '#f5c542');
  if (won && stats.best) centerText(ctx, `Best score: ${stats.best}`, 366, '14px sans-serif', '#9aa7c2');
  centerText(ctx, 'Press R or click to play again', 430, '15px sans-serif', '#9aa7c2');
}

export function render(ctx, game) {
  const { time } = game;
  drawFloor(ctx);
  // Vision cones sit above the floor and below the actors.
  for (const guard of game.guards) drawGuard(ctx, guard, time);
  for (const camera of game.cameras) drawCamera(ctx, camera, time);
  for (const gold of game.gold) if (!gold.taken) drawGold(ctx, gold, time);
  if (!game.gemTaken) drawGem(ctx, game.gem, time);
  drawExit(ctx, { tiles: game.exitTiles, open: game.exitOpen }, time);
  if (game.state === 'playing' || game.state === 'paused') drawPlayer(ctx, game.player);
  if (game.state === 'playing' || game.state === 'paused') {
    drawHud(ctx, {
      alarm: game.alarm,
      gem: game.gemTaken,
      gold: game.goldTaken,
      goldTotal: game.gold.length,
      timeStr: game.timeStr,
      score: game.score,
      time,
      hint: game.exitOpen
        ? 'The exit is open — get out of the museum!'
        : 'WASD / arrows move · Shift sneak · Click to walk · P pause · M mute',
    });
    if (game.state === 'paused') {
      ctx.fillStyle = 'rgba(6,8,14,0.6)';
      ctx.fillRect(0, 0, W, H);
      centerText(ctx, 'PAUSED', H / 2 - 10, 'bold 40px Georgia, serif', '#e8ecf4');
      centerText(ctx, 'Press P to resume', H / 2 + 24, '15px sans-serif', '#9aa7c2');
    }
  } else if (game.state === 'title') {
    drawTitle(ctx, game.best);
  } else if (game.state === 'won' || game.state === 'lost') {
    drawEnd(ctx, game.state === 'won', {
      timeStr: game.timeStr,
      gold: game.goldTaken,
      goldTotal: game.gold.length,
      score: game.score,
      best: game.best,
    });
  }
}
