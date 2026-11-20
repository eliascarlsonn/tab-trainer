import { formatPercent, formatSemitones } from "@/lib/format";
import { PITCH_RANGE, SPEED_RANGE, VOLUME_RANGE } from "@/practice/practiceSettings";
import { Knob } from "@/ui/Knob";
import { useEngine, useSetting } from "../engineContext";
import styles from "./dock.module.css";

export function PracticeKnobs() {
  const engine = useEngine();
  const speed = useSetting("speed");
  const pitch = useSetting("pitch");
  const volume = useSetting("volume");
  const usesVideo = useSetting("source").kind === "video";

  return (
    <div className={styles.group}>
      <Knob
        label="Speed"
        value={speed}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
        defaultValue={1}
        format={formatPercent}
        onChange={(v) => engine.setSpeed(v)}
      />
      <Knob
        label="Pitch"
        value={pitch}
        min={PITCH_RANGE.min}
        max={PITCH_RANGE.max}
        step={PITCH_RANGE.step}
        defaultValue={0}
        origin={0}
        format={(v) => `${formatSemitones(v)} st`}
        onChange={(v) => engine.setPitch(v)}
        disabled={usesVideo}
        disabledNote="Tab audio only"
      />
      <Knob
        label="Volume"
        value={volume}
        min={VOLUME_RANGE.min}
        max={VOLUME_RANGE.max}
        step={VOLUME_RANGE.step}
        defaultValue={1}
        format={formatPercent}
        onChange={(v) => engine.setVolume(v)}
      />
    </div>
  );
}
