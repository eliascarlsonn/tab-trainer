import { formatClock } from "@/lib/format";
import { IconButton } from "@/ui/Button";
import { useEngine, useEngineState } from "../engineContext";
import styles from "./dock.module.css";

export function TransportControls() {
  const engine = useEngine();
  // A count-in is part of starting playback: it shows as playing, and pressing pause cancels it.
  const playing = useEngineState((s) => s.playing || s.countingIn);
  const canPlay = useEngineState((s) => s.canPlay);
  const time = useEngineState((s) => s.currentTimeMs);
  const end = useEngineState((s) => s.endTimeMs);
  const bar = useEngineState((s) => s.currentBar);
  const barCount = useEngineState((s) => s.barCount);
  const tempo = useEngineState((s) => s.tempo);

  return (
    <div className={styles.group}>
      <IconButton icon="skipBack" label="Previous bar (Left arrow)" onClick={() => engine.skipBars(-1)} />
      <IconButton
        icon={playing ? "pause" : "play"}
        label={playing ? "Pause (Space)" : "Play (Space)"}
        size="lg"
        disabled={!canPlay}
        onClick={() => engine.playPause()}
      />
      <IconButton icon="skipForward" label="Next bar (Right arrow)" onClick={() => engine.skipBars(1)} />
      <dl className={styles.readouts}>
        <div className={styles.timeReadout}>
          <dt>Time</dt>
          <dd>
            {formatClock(time)}
            <span className={styles.faint}> / {formatClock(end)}</span>
          </dd>
        </div>
        <div className={styles.barReadout}>
          <dt>Bar</dt>
          <dd>
            {bar + 1}
            <span className={styles.faint}> / {barCount}</span>
          </dd>
        </div>
        <div className={styles.tempoReadout}>
          <dt>Tempo</dt>
          <dd>{tempo ? Math.round(tempo) : "–"}</dd>
        </div>
      </dl>
    </div>
  );
}
