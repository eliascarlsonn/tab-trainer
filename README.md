<p align="center"><img src="public/logo.svg" alt="" width="96" /></p>

# Tab Trainer

A practice player for guitar tabs: loop, speed trainer, pitch shift, per-track mixer, metronome and
count-in with a choice of click sounds, and playback synced to the original recording on YouTube.

Import Guitar Pro files (.gp, .gp3, .gp4, .gp5, .gpx), MusicXML (.musicxml, .mxl, .xml), or songs
saved from Songsterr. Your library stays in your browser and nothing is uploaded. The app itself never
contacts Songsterr; the optional bookmark only reads the song you're viewing there, when you click it.

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

The quickest way is the **Send to Tab Trainer** bookmark: drag the button from the library's
"Saving from Songsterr" guide to your bookmarks bar, open a song on songsterr.com and click it. The song
opens in Tab Trainer with all its tracks and synced videos. If the app isn't open or can't be reached,
the bookmark downloads the song as a `.har` file to drop in instead. (A bookmark made on one address,
such as `localhost:5173`, sends songs to that address.)

To capture a song by hand instead:

1. Open the song on songsterr.com.
2. Press F12, open the **Network** tab, tick **Disable cache**, reload the page.
3. Click the download arrow (**Export HAR**) and drop the `.har` file into the app.

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

Drag across the tab to select a loop range, then drag the handles on its start and end to adjust it.
While dragging either way, hold Shift to snap to whole bars, or move near the top or bottom edge to scroll.

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
