# Tab Trainer

A practice player for guitar tabs: loop, speed trainer, pitch shift, per-track mixer, and playback
synced to the original recording on YouTube.

Import songs saved from Songsterr, Guitar Pro files (.gp, .gp3, .gp4, .gp5, .gpx) or MusicXML
(.musicxml, .mxl, .xml). Your library stays in your browser; nothing is uploaded, and the app never
contacts Songsterr.

_Not affiliated with or endorsed by Songsterr._

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

## Add a song

Drop a Guitar Pro or MusicXML file onto the app, or click **Import**. Importing the same file
again updates the existing entry.

### Saving a song from Songsterr

1. Open the song on songsterr.com in Chrome or Edge.
2. Press F12, open the **Network** tab, tick **Disable cache**, reload the page.
3. Click through every track you want. Turn the video on if you want to play along with it.
4. Click the download arrow (**Export HAR**) and drop the `.har` file into the app.

Importing the same song again adds any newly captured tracks to the existing entry. Synced YouTube
playback is available for Songsterr songs whose video was captured.

## Keyboard

| Key   | Action                |
| ----- | --------------------- |
| Space | Play / pause          |
| ← / → | Previous / next bar   |
| L     | Loop on / off         |
| B     | Loop the current bar  |
| [ / ] | Slower / faster       |
| M     | Metronome             |
| C     | Count-in              |
| V     | Show / hide the video |

Drag across the tab to select a loop range.

## Architecture

```
src/
  songsterr/     Pure parsing: HAR → captured song → alphaTab Score (convert/ holds one builder per model level)
  library/       Song model, import pipeline (Songsterr captures, score files), IndexedDB persistence
  practice/      Per-song practice settings and their persistence
  player/
    engine/      PlayerEngine: owns alphaTab, exposes practice controls, state in a zustand store
    sync/        Playback order (repeats) and video sync points
    trainer/     Speed trainer rule
    youtube/     IFrame API loader and the alphaTab external-media adapter
  features/      Screens (library, player) built from ui/ primitives
  ui/            Design-system components (Knob, LedSwitch, Popover, Sheet, …)
  styles/        Design tokens and global styles
```

Rules of the road:

- `songsterr/`, `player/sync/` and `player/trainer/` are framework-free and unit tested.
- UI reads engine state through `useEngineState` / `useSetting` and changes it only through `PlayerEngine` methods.
- Colors live in `styles/tokens.css`; the score colors are read from the same tokens.

## Scripts

| Script           | Purpose                        |
| ---------------- | ------------------------------ |
| `npm run dev`    | Dev server                     |
| `npm run build`  | Typecheck and production build |
| `npm test`       | Unit tests                     |
| `npm run format` | Format with Prettier           |

Tests that use real tab data read `samples/*.har`, which is git-ignored and skipped when absent.
