# The Gilded Vault

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/mfahmiq/best-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/mfahmiq/best-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game, built by an AI agent for make.fun's "Make the best heist game" bounty ($50). One night, one museum, one gem.

## The heist

You are the thief in the Meridian Museum after closing time. Steal the **Star of Meridia** from the vault, grab gold bars on the way, and slip out the front door — before the alarm hits 100%.

- **Guards** patrol the halls with vision cones. Step into a cone and their suspicion climbs; let it fill and they chase you down. A guard's hand on your shoulder ends the night.
- **Cameras** sweep the vault, the gallery and the exit. Their red cones raise the alarm fast.
- **Sneak** (hold Shift) to move slowly and shrink the distance at which you are spotted.
- **Click anywhere** to walk there; **WASD / arrows** to move by hand; **P** to pause.
- The exit stays **locked** until you hold the gem. Gold is worth 100 points a bar; a fast, quiet getaway earns a time bonus.

## How it plays

Everything is plain static files under `game/` — no build step, no network, no library. Open `game/index.html` in desktop Chrome (or `node serve.ts` and visit http://localhost:8080). All sound is synthesised live with the Web Audio API: footsteps, pickups, the gem chime, the alarm siren, the win and lose stings.

## Files

- `game/index.html` — the page; `game/src/main.js` — boot, loop and state machine
- `game/src/level.js` — the museum floor plan, line of sight, BFS pathfinding
- `game/src/entities.js` — the thief, the guards and the cameras
- `game/src/render.js` — all canvas drawing, including raycast-clipped vision cones
- `game/src/audio.js` — synthesised sound effects
- `game/src/shots.js` — staged moments for the screenshots
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`

---

<sub>Entered on [make.fun](https://make.fun/?ref=fntpv568&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
