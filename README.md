[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/adiznth/nova-harvest/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard)
[![reward](https://make.fun/badge/best-game-01/adiznth/nova-harvest/reward.svg)](https://make.fun/bounty/best-game-01)

# NOVA HARVEST

A neon arena harvester for the make.fun **best-game-01** bounty
("Make the best game", $1,000). Pilot the last harvester ship, break the
drone swarm, harvest their cores, and destroy the MOTHERCORE on wave 10 to
win the run — then keep flying in endless mode.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No install, no network: every file the game loads
lives under `game/`, and all art and sound are drawn and synthesised in
code.

| Input | Does |
| --- | --- |
| WASD / arrows | Fly the harvester |
| Mouse + hold click (or hold Space) | Aim and fire the lance |
| Shift / right click | Dash — briefly untouchable |
| E (when NOVA is full) | Detonate a nova blast: clears bullets, heavy damage to everything |
| P / Esc | Pause |
| M | Mute |
| 1 / 2 / 3 or click a card | Pick an upgrade between waves |
| R | Restart from a game-over or victory screen |

## The loop

- **Waves 1–9:** drones spawn from the edges — chasers that hunt you,
  weavers that strafe in sine waves, spitters that shoot back, splitters
  that break into minis. Destroyed drones drop cores.
- **Cores** are score and fuel: collect them to charge your nova, and
  magnet range pulls them in. Rare drops: hull cells, overdrive (fast
  fire), shields (absorb one hit).
- **Between waves** you draft one of three upgrades: faster fire, twin
  lance, reinforced hull, magnet coil, ion thrusters, overcharge rounds,
  nova capacitor, velocity coils.
- **Wave 10 — MOTHERCORE:** a three-phase boss with radial bursts, spiral
  streams, aimed spreads and minion spawns. Beat it to win; the run then
  continues in endless mode with ever-harder waves.
- **Lose** when your hull reaches zero. Combo multiplier (up to x5) rewards
  chained kills; your best score and best wave are kept in the browser.

## Structure

```
main.ts            entry program: copies game/ + screenshots/ to /output,
                   writes dossier.json with vendor/makefun-game.ts
serve.ts           tiny static server for local play (localhost:8080)
vendor/            make.fun's library, copied from the kit unchanged
game/
  index.html       the page: one canvas, one module script
  src/
    config.js      every tuning number and colour
    random.js      seeded RNG (mulberry32) — a seed replays the same run
    input.js       keyboard + mouse, one-shot actions handed out once
    audio.js       all sound: Web Audio synth SFX + a bass/arp music loop
    world.js       the simulation: ship, drones, boss, waves, upgrades
    render.js      every pixel: glow sprites, HUD, title/upgrade/end screens
    shots.js       deterministic screenshot scenes (?shot=start|play|boss|end)
    main.js        boot, fixed-step loop, screens, ?shot= staging
screenshots/      1-play.jpg (cover) · 2-start.jpg · 3-boss.jpg · 4-end.jpg
shots.json         the four screenshot scenes and their ?shot= queries
```

## Screenshots

The four shots are real renders of the game's own code, staged with
`?shot=<scene>&seed=1` and taken in desktop Chrome at 1280×720:

- `1-play.jpg` — mid-combat on wave 2, HUD, combo and nova charge
- `2-start.jpg` — title screen over the living starfield backdrop
- `3-boss.jpg` — the MOTHERCORE fight on wave 10
- `4-end.jpg` — game-over screen with final score and restart

## Notes

- Original game: its own idea, art, sounds, music and names. No assets
  are borrowed from anywhere; nothing is copied from a commercial game.
- `?seed=N` fixes the run's random pattern; the same seed replays the
  same spawns and the same screenshots.
