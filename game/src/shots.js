// shots.js — deterministic staged states for the screenshots in shots.json.
// A shot is a query (?shot=play etc.) that puts the game into a fixed,
// representative moment: the title screen, a tense mid-heist frame, the
// alarm about to blow, or the win screen. The game itself renders these
// states; nothing is composited or faked.
import { tileCenter } from './level.js';

function setGuardPose(guard, tx, ty, dir) {
  const c = tileCenter(tx, ty);
  guard.x = c.x;
  guard.y = c.y;
  guard.dir = dir;
  guard.alert = 0;
  guard.state = 'patrol';
  guard.wait = 0;
  guard.lastSeen = null;
}

export function stageShot(game, name) {
  game.frozen = true; // a staged shot is a fixed frame, not a simulation
  if (name === 'start') {
    game.state = 'title';
    return;
  }
  if (name === 'win') {
    game.state = 'won';
    game.elapsed = 96;
    game.goldTaken = 4;
    game.score = 1450;
    game.gemTaken = true;
    return;
  }
  if (name === 'play') {
    // Mid-heist: the thief slips along the gallery toward the vault door,
    // one guard's cone sweeping just ahead of them, the alarm already warm.
    game.state = 'playing';
    const p = tileCenter(21, 10);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.dir = Math.PI / 2; // facing down the gallery
    game.alarm = 38;
    setGuardPose(game.guards[0], 10, 11, 0); // gallery guard, cone to the right
    setGuardPose(game.guards[1], 20, 16, Math.PI); // lower hall guard, cone left
    setGuardPose(game.guards[2], 24, 3, Math.PI / 2); // vault guard, cone down
    game.cameras[0].dir = 0.25; // vault camera, sweeping right into the vault
    game.cameras[1].dir = 0.6; // pillar camera, cone down the gallery
    game.cameras[2].dir = 0.2; // exit camera, cone across the hall
    return;
  }
  if (name === 'alarm') {
    // The vault guard has the thief in its sights, the alarm nearly blown.
    game.state = 'playing';
    const p = tileCenter(23, 4);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.dir = Math.PI / 2;
    game.alarm = 82;
    setGuardPose(game.guards[2], 23, 6, -Math.PI / 2); // vault guard facing up at the thief
    game.guards[2].alert = 1;
    game.guards[2].state = 'chase';
    game.guards[2].lastSeen = { x: p.x, y: p.y };
    setGuardPose(game.guards[0], 12, 11, Math.PI / 2);
    setGuardPose(game.guards[1], 18, 16, 0);
    game.cameras[0].dir = 0; // vault camera staring straight at the thief
    game.cameras[0].seesPlayer = true;
    return;
  }
}
