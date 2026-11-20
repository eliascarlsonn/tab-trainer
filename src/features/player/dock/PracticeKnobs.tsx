import { formatPercent, formatSemitones } from "@/lib/format";
import { PITCH_RANGE, SPEED_RANGE } from "@/practice/practiceSettings";
import { Knob } from "@/ui/Knob";
import { useEngine, useEngineState, useSetting } from "../engineContext";
import styles from "./dock.module.css";

export function PracticeKnobs() {
  const engine = useEngine();
  const speed = useSetting("speed");
  const pitch = useSetting("pitch");
  const usesVideo = useSetting("source").kind === "video";
  const speedOptions = useEngineState((s) => s.speedOptions);

  return (
    <div className={styles.group}>
      <Knob
        label="Speed"
        value={speed}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
        defaultValue={1}
        options={speedOptions}
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
        format={(v) => `${formatSemitones(v)} st`}
        onChange={(v) => engine.setPitch(v)}
        disabled={usesVideo}
        disabledNote="Tab audio only"
      />
    </div>
  );
}
