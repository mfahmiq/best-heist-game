// level.js — the Meridian Museum floor plan, tile helpers, line of sight and
// grid pathfinding for "The Gilded Vault". One tile is 32 px; the map is
// 30 x 20 tiles. Legend: # wall, . floor, D door (walkable), P player start,
// L the Star of Meridia gem, g gold bar, E exit door.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;

export const MAP = [
  '##############################',
  '#......#.........#...........#',
  '#..gg..#.........#.....L.....#',
  '#......#....g....#...........#',
  '#......#.........#...........#',
  '#......#.........#...........#',
  '#......#.........#...........#',
  '#......#.........#...........#',
  '###D########D#########D#######',
  '#............................#',
  '#.......####...####..........#',
  '#.....g................g.....#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#.....g................g.....#',
  '#............................#',
  '#............................#',
  '#.............P..............#',
  '##############EE##############',
];

export function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return MAP[ty][tx];
}

export function isWall(tx, ty) {
  return tileAt(tx, ty) === '#';
}

export function isWalkable(tx, ty) {
  return !isWall(tx, ty);
}

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Find every tile holding a character (player start, gem, gold, exit doors).
export function findAll(ch) {
  const out = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] === ch) out.push({ tx: x, ty: y });
    }
  }
  return out;
}

// Line of sight between two pixel points: sample the segment every 6 px and
// fail when a sample lands inside a wall tile. Used by guards and cameras.
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (isWall(tx, ty)) return false;
  }
  return true;
}

// Breadth-first search on the tile grid. Returns an array of pixel points
// (tile centres) from the start tile to the goal tile, or null when no path
// exists. The first element is the start tile's centre.
export function findPath(sx, sy, tx, ty) {
  if (!isWalkable(tx, ty) || !isWalkable(sx, sy)) return null;
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) {
      const path = [];
      let cur = key(tx, ty);
      while (cur !== undefined) {
        const px = cur % COLS;
        const py = Math.floor(cur / COLS);
        path.unshift(tileCenter(px, py));
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!isWalkable(nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), key(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// The nearest walkable tile to (tx, ty), searching outward in rings: a
// click on a wall walks the thief to the closest floor beside it instead of
// doing nothing.
export function nearestWalkable(tx, ty) {
  if (isWalkable(tx, ty)) return { tx, ty };
  for (let r = 1; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    }
  }
  return null;
}

// Straight-line check used when placing patrol waypoints: every segment of a
// patrol route must cross only walkable tiles.
export function segmentClear(ax, ay, bx, by) {
  return hasLineOfSight(
    ax * TILE + TILE / 2, ay * TILE + TILE / 2,
    bx * TILE + TILE / 2, by * TILE + TILE / 2,
  );
}
