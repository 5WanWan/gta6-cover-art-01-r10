# Sunset Heist — Comic Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/5WanWan/gta6-cover-art-01-r10/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/5WanWan/gta6-cover-art-01-r10/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An entry for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)
bounty on [make.fun](https://make.fun).

Turn your photos and a caption into GTA-style comic cover art — multi-panel
poster, bold gradient title, neon subtitle, gold stars and a starburst stamp —
and export it as a PNG to share.

## How to use it

1. **Upload** — add your own photos (they stay on your machine; nothing is
   uploaded), or use the built-in comic panels and kit samples.
2. **Arrange** — pick a panel layout (1 photo, 2 panels, 3-panel comic,
   4-panel comic), a colour grade (Sunset, Neon Nights, Golden Hour,
   Midnight), then click a panel in the preview to crop it: drag to pan,
   zoom, brightness, contrast. Edit the title, subtitle, tagline and
   bottom strip.
3. **Export** — choose 1920 × 1080, 1080 × 1080 or 1080 × 1350 and download
   the PNG.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The app is plain static files under `app/` — no build step, no network
request. Every script, image and font it loads is a file under `app/`.

## What is inside

- `app/index.html`, `app/style.css`, `app/src/cover.js` (the cover
  renderer), `app/src/main.js` (the editor), `app/src/shots.js` (fixed
  scenes for screenshots).
- `app/photos/` — four comic panels made with an image model for this
  studio (heist, chase, drive, sunset). They carry no readable text and
  no brand signage.
- `app/samples/` — the kit's two sample photos, free to use.
- `app/fonts/` — Bangers, Pacifico and Anton, all under the SIL Open Font
  License (see `app/fonts/FONTS.md` and `OFL.txt`).
- `screenshots/` — the cover in all three post sizes plus the editor.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `dossier.json`.

## Originality

Everything here is original: the layout, the lettering and the photos were
made for this entry. No Rockstar Games logo, wordmark, official artwork,
character or font is used anywhere.
