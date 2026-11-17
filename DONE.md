# DONE — NOVA HARVEST (make.fun best-game-01)

**Bounty:** best-game-01 "Make the best game" — $1,000, 10 places paid
(1st $400, 2nd $200, 3rd $120, 4th–10th $40).
**Deadline:** Wed 2026-11-18 18:00 UTC = **Thu 2026-11-19 01:00 WIB**.
**Status: GAME SIAP, BELUM SUBMIT.** Entry tidak di-submit (sesuai perintah:
no account, no GitHub push, no wallet, no money).

## Yang dibangun

**NOVA HARVEST** — neon arena harvester, game original (ide, art, suara,
musik, nama semua buatan sendiri; tanpa aset pinjaman, tanpa network).
Pilot kapal harvester terakhir: hancurkan gerombolan drone, panen core-nya,
kalahkan MOTHERCORE di wave 10 untuk menang, lalu lanjut endless mode.

- **Loop lengkap:** goal, rules, skor, menang (boss wave 10) / kalah
  (hull 0), start, restart, pause, HUD (hull, wave, skor, combo x5,
  nova charge, dash cooldown, boss bar).
- **5 tipe drone** (chaser, weaver, spitter, splitter → mini) + **boss
  MOTHERCORE 3 fase** (radial burst, spiral stream, aimed spread, spawn mini).
- **8 upgrade** di-draft 1-dari-3 antar wave (fire rate, twin lance, hull,
  magnet, thruster, damage, nova capacitor, velocity).
- **Mekanik:** WASD/arrows gerak, mouse aim + hold click tembak, Shift/
  klik-kanan dash (i-frame), E nova blast saat charge penuh, P pause,
  M mute, 1/2/3 atau klik kartu upgrade, R restart. Combo multiplier,
  pickup core/hull/overdrive/shield, best score di localStorage.
- **Audio:** semua suara disintesis Web Audio (SFX + loop bass/arp 132 BPM),
  tanpa file audio.
- **File** (`~/workspace/makefun/best-game-01/`):
  `main.ts`, `serve.ts`, `LICENSE` (MIT, SPDX-License-Identifier: MIT),
  `README.md`, `shots.json`, `vendor/makefun-game.ts` (copy kit, tidak diubah),
  `game/index.html` + `game/src/` (config, random, input, audio, world,
  render, shots, main — 8 modul, masing-masing satu tugas jelas),
  `screenshots/` (4 JPG 1280×720, total ~221 KB), `out/` (hasil build
  `main.ts`: dossier.json + salinan game/screenshots).

## Hasil cek lokal (semua lolos)

- **Tes logika Node** (`/tmp/test-world.mjs`, 18 assertions): pilot
  autopilot bertahan 60 dtk (wave 5, 46 kill, skor 4.900), pilot diam
  mati di wave 1, boss wave 10 muncul + bisa dibunuh → victory, nova
  membersihkan peluru musuh, upgrade berbeda + teraplikasi + naik wave,
  seed yang sama = run yang sama. Dua bug ketemu & dibetulkan saat tes:
  `freshPlayer()` lupa `radius` (posisi jadi NaN) dan cek victory yang
  tertelan transisi wave.
- **Screenshot asli** (headless Chrome via CDP, `?shot=` + `__shotReady`,
  0 console error): 1-play (wave 3, combat + HUD + combo), 2-start
  (title + panel kontrol), 3-boss (MOTHERCORE + radial bullet + boss bar),
  4-end (game over + skor + tombol restart). Semua 1280×720, < 70 KB.
- **Live play-test** (CDP kirim Space + mouse + WASD sungguhan):
  game jalan, pemain menembak, kena hit ("Hit. 2 hull left."), skor
  naik 150, HUD update.
- **`main.ts` build:** `MAKEFUN_OUTPUT_DIR=out node main.ts` → dossier.json
  383.169 byte (cap 1,5 MB), teks 84.771 byte (cap 163.840), schema
  `makefun/dossier/v1`, 4 gambar, cover = 1-play.jpg.
- **`makefun check` (pre-submit lokal):** 4 passed (competition_open,
  snapshot, license_osi, entrypoint), 1 failed (transcripts_present —
  harus di-bundle top-level agent saat submit), 5 dicek saat submit
  (repo public/owner/created-after-open/commit pushed/duplicate).
- **Catatan lingkungan:** Chrome `/opt/meta-chromium` butuh policy
  WebGL (`--hatch-webgl-allowed-domains-file` + sha256; format file:
  baris 1 `hatch-webgl-allowed-domains-v1`, lalu 1 domain registrable
  per baris — file contoh di `/tmp/webgl-policy.txt`) dan memblokir
  navigasi ke localhost (LNA). Screenshot diambil lewat `file://`
  + `--allow-file-access-from-files` + CDP (`/tmp/cdp-shots.mjs`).
  Server lokal: `node serve.ts` → http://localhost:8080 (saat ini
  dimatikan; hidupkan lagi bila perlu).

## Yang masih kurang buat submit (butuh je / main agent)

1. **Akun make.fun + Solana keypair** — `makefun register/login`
   (butuh keputusan je; keypair TIDAK dibuat di sini).
2. **Repo GitHub publik baru** (dibuat setelah 2026-11-15 18:00 UTC),
   push semua file ini, commit SHA-nya yang di-submit. Boleh tambah
   `.makefun/owner.json` bila owner repo ≠ login GitHub akun.
3. **Transkrip** — `makefun bundle` HARUS dijalankan top-level agent
   setelah semua subagent selesai (supaya sesi parent + semua subagent
   masuk utuh), lalu `makefun submit --competition best-game-01`.
4. **Cek ulang sebelum submit:** `makefun check --kit <kit> --repo .
   --worktree --transcripts <bundle>` sampai `transcripts_present` pass.
5. **Batas submit:** maks 5/hari, 10 total; submit terakhir sebelum
   deadline yang dihitung.

**Tidak dilakukan:** submit, buat akun, push GitHub, sign wallet,
belanja/keluar uang apa pun.
