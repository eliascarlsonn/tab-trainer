import type { Song, TrackEntry } from "@/library/song";
import { cx } from "@/lib/cx";
import { formatPercent } from "@/lib/format";
import { BACKGROUND_TRACK_LEVEL, DEFAULT_TRACK_MIX, trackVolume } from "@/practice/practiceSettings";
import { Sheet } from "@/ui/Sheet";
import { useEngine, useEngineState, useSetting } from "./engineContext";
import { trackSubtitle, trackTitle } from "./labels";
import styles from "./MixerSheet.module.css";

interface MixerSheetProps {
  song: Song;
  open: boolean;
  onClose: () => void;
}

export function MixerSheet({ song, open, onClose }: MixerSheetProps) {
  const usesVideo = useSetting("source").kind === "video";

  return (
    <Sheet title="Mixer" open={open} onClose={onClose}>
      {usesVideo ? (
        <p className={styles.note}>The mixer controls tab audio. Switch to Tab audio to hear changes.</p>
      ) : (
        <p className={styles.note}>
          The track you&apos;re viewing plays at full volume and the others at {formatPercent(BACKGROUND_TRACK_LEVEL)}.
          Drag a slider to set a track&apos;s volume yourself; double-click it to go back to automatic.
        </p>
      )}
      <ul className={styles.list}>
        {song.catalog.map((entry) => (
          <MixerRow key={entry.partId} entry={entry} />
        ))}
      </ul>
    </Sheet>
  );
}

function MixerRow({ entry }: { entry: TrackEntry }) {
  const engine = useEngine();
  const mix = useEngineState((s) => s.settings.mixer[entry.partId]) ?? DEFAULT_TRACK_MIX;
  const shown = useSetting("partId") === entry.partId;
  const volume = trackVolume(mix, shown);
  const automatic = mix.volume === null;

  if (!entry.captured) {
    return (
      <li className={cx(styles.row, styles.missing)}>
        <div className={styles.name}>
          <span>{trackTitle(entry)}</span>
          <span className={styles.instrument}>Not captured</span>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <div className={styles.name}>
        <span className={cx(shown && styles.shown)}>{trackTitle(entry)}</span>
        <span className={styles.instrument}>{trackSubtitle(entry)}</span>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={cx(styles.toggle, mix.muted && styles.muteOn)}
          aria-pressed={mix.muted}
          title="Mute"
          onClick={() => engine.setTrackMix(entry.partId, { muted: !mix.muted })}
        >
          M
        </button>
        <button
          type="button"
          className={cx(styles.toggle, mix.solo && styles.soloOn)}
          aria-pressed={mix.solo}
          title="Solo"
          onClick={() => engine.setTrackMix(entry.partId, { solo: !mix.solo })}
        >
          S
        </button>
        <input
          className={styles.volume}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label={`${trackTitle(entry)} volume`}
          aria-valuetext={`${formatPercent(volume)}${automatic ? ", automatic" : ""}`}
          title={automatic ? "Automatic: full when viewing this track" : "Double-click to go back to automatic"}
          onChange={(e) => engine.setTrackMix(entry.partId, { volume: Number(e.target.value) })}
          onDoubleClick={() => engine.setTrackMix(entry.partId, { volume: null })}
        />
        <span className={styles.level}>
          {formatPercent(volume)}
          <span className={styles.levelMode}>{automatic ? "auto" : "set"}</span>
        </span>
      </div>
    </li>
  );
}
