# Tab Trainer

A private practice player for Songsterr tabs: loop, speed trainer, pitch shift, per-track mixer,
and playback synced to the original recording on YouTube.

The app never contacts Songsterr. You save a song from your own browser session and import the file.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

## Add a song

1. Open the song on songsterr.com in Chrome or Edge.
2. Press F12, open the **Network** tab, tick **Disable cache**, reload the page.
3. Click through every track you want. Turn the video on if you want to play along with it.
4. Click the download arrow (**Export HAR**) and drop the `.har` file into the app.

Importing the same song again adds any newly captured tracks to the existing entry.

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
  library/       Song model, import pipeline, IndexedDB persistence, library store
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
