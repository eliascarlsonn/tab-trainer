import { useMemo } from "react";
import { formatPercent } from "@/lib/format";
import type { Song } from "@/library/song";
import { METRONOME_SOUNDS } from "@/player/metronome/clickSounds";
import { METRONOME_VOLUME_RANGE } from "@/player/metronome/metronomePrefs";
import { IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { LedSwitch } from "@/ui/LedSwitch";
import { MenuHeading, MenuItem, Popover } from "@/ui/Popover";
import { Stepper } from "@/ui/Stepper";
import { useEngine, useEngineState, useSetting } from "../engineContext";
import { videoLabels } from "../labels";
import styles from "./dock.module.css";

export function SourceControls({ song }: { song: Song }) {
  const engine = useEngine();
  const metronome = useSetting("metronome");
  const countIn = useSetting("countIn");

  return (
    <div className={styles.group}>
      <div className={styles.switchColumn}>
        <LedSwitch
          label="Count-in"
          on={countIn}
          title="Count one bar in before playing (C)"
          onChange={(on) => engine.setCountIn(on)}
        />
        <LedSwitch
          label="Metronome"
          on={metronome}
          title="Click on every beat (M)"
          onChange={(on) => engine.setMetronome(on)}
        />
      </div>
      <Popover
        placement="above"
        className={styles.trainerPanel}
        trigger={({ toggle }) => <IconButton icon="sliders" label="Metronome sound" onClick={toggle} />}
      >
        {() => <MetronomeSettingsPanel />}
      </Popover>
      <SourcePicker song={song} />
    </div>
  );
}

/** The click sound (previewed when picked) and its volume; used for count-ins too. */
function MetronomeSettingsPanel() {
  const engine = useEngine();
  const sound = useEngineState((s) => s.metronomeSound);
  const volume = useEngineState((s) => s.metronomeVolume);

  return (
    <>
      <MenuHeading>Metronome sound</MenuHeading>
      {METRONOME_SOUNDS.map((option) => (
        <MenuItem key={option.id} selected={sound === option.id} onSelect={() => engine.setMetronomeSound(option.id)}>
          {option.label}
        </MenuItem>
      ))}
      <Stepper
        label="Volume"
        value={volume}
        min={METRONOME_VOLUME_RANGE.min}
        max={METRONOME_VOLUME_RANGE.max}
        step={METRONOME_VOLUME_RANGE.step}
        format={formatPercent}
        onChange={(next) => engine.setMetronomeVolume(next)}
      />
    </>
  );
}

function SourcePicker({ song }: { song: Song }) {
  const engine = useEngine();
  const source = useSetting("source");
  const labels = useMemo(() => videoLabels(song.videos), [song.videos]);
  const currentLabel = source.kind === "video" ? (labels.get(source.videoId) ?? "Video") : "Tab audio";

  return (
    <Popover
      placement="above"
      align="end"
      trigger={({ toggle, open }) => (
        <button type="button" className={styles.sourceButton} onClick={toggle} aria-expanded={open}>
          <Icon name={source.kind === "video" ? "video" : "waveform"} size={18} />
          <span className={styles.stack}>
            <span className={styles.caption}>Play along with</span>
            <span className={styles.sourceName}>{currentLabel}</span>
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
      )}
    >
      {(close) => {
        const choose = (next: Parameters<typeof engine.setSource>[0]) => {
          engine.setSource(next);
          close();
        };
        return (
          <>
            <MenuItem
              selected={source.kind === "synth"}
              hint="Pitch, metronome"
              onSelect={() => choose({ kind: "synth" })}
            >
              Tab audio
            </MenuItem>
            <MenuHeading>
              {song.videos.length
                ? "Synced videos"
                : song.origin === "songsterr"
                  ? "No synced videos were captured"
                  : "No synced videos"}
            </MenuHeading>
            {song.videos.map((video) => (
              <MenuItem
                key={video.videoId}
                selected={source.kind === "video" && source.videoId === video.videoId}
                onSelect={() => choose({ kind: "video", videoId: video.videoId })}
              >
                {labels.get(video.videoId)}
              </MenuItem>
            ))}
          </>
        );
      }}
    </Popover>
  );
}
