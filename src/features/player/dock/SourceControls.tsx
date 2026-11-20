import { useMemo } from "react";
import type { Song } from "@/library/song";
import { Icon } from "@/ui/Icon";
import { LedSwitch } from "@/ui/LedSwitch";
import { MenuHeading, MenuItem, Popover } from "@/ui/Popover";
import { useEngine, useSetting } from "../engineContext";
import { videoLabels } from "../labels";
import styles from "./dock.module.css";

const SYNTH_ONLY = "Only available with tab audio";

export function SourceControls({ song }: { song: Song }) {
  const engine = useEngine();
  const metronome = useSetting("metronome");
  const countIn = useSetting("countIn");
  const usesVideo = useSetting("source").kind === "video";

  return (
    <div className={styles.group}>
      <div className={styles.switchColumn}>
        <LedSwitch
          label="Count-in"
          on={countIn && !usesVideo}
          disabled={usesVideo}
          title={usesVideo ? SYNTH_ONLY : "Count one bar in before playing (C)"}
          onChange={(on) => engine.setCountIn(on)}
        />
        <LedSwitch
          label="Metronome"
          on={metronome && !usesVideo}
          disabled={usesVideo}
          title={usesVideo ? SYNTH_ONLY : "Click on every beat (M)"}
          onChange={(on) => engine.setMetronome(on)}
        />
      </div>
      <SourcePicker song={song} />
    </div>
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
            <MenuHeading>{song.videos.length ? "Synced videos" : "No synced videos were captured"}</MenuHeading>
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
