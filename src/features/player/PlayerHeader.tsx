import { routes } from "@/app/useHashRoute";
import { formatPercent } from "@/lib/format";
import type { Song } from "@/library/song";
import { ZOOM_RANGE } from "@/practice/practiceSettings";
import { Button, IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { MenuHeading, MenuItem, Popover } from "@/ui/Popover";
import { useEngine, useSetting } from "./engineContext";
import { trackSubtitle, trackTitle } from "./labels";
import styles from "./PlayerHeader.module.css";

interface PlayerHeaderProps {
  song: Song;
  onOpenMixer: () => void;
}

export function PlayerHeader({ song, onOpenMixer }: PlayerHeaderProps) {
  const engine = useEngine();
  const source = useSetting("source");
  const videoVisible = useSetting("videoVisible");

  return (
    <header className={styles.header}>
      <a className={styles.back} href={routes.library()} aria-label="Back to your songs" title="Back to your songs">
        <Icon name="back" size={20} />
      </a>
      <div className={styles.titles}>
        <h1 className={styles.title}>{song.title}</h1>
        <span className={styles.artist}>{song.artist}</span>
      </div>
      <TrackPicker song={song} />
      <div className={styles.tools}>
        <ViewMenu />
        {source.kind === "video" && (
          <IconButton
            icon={videoVisible ? "eye" : "eyeOff"}
            label={videoVisible ? "Hide video" : "Show video"}
            onClick={() => engine.setVideoVisible(!videoVisible)}
          />
        )}
        <IconButton icon="sliders" label="Mixer" onClick={onOpenMixer} />
      </div>
    </header>
  );
}

function TrackPicker({ song }: { song: Song }) {
  const engine = useEngine();
  const partId = useSetting("partId");
  const current = song.catalog.find((t) => t.partId === partId);

  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button type="button" className={styles.trackButton} onClick={toggle} aria-expanded={open}>
          <span className={styles.trackName}>{current ? trackTitle(current) : "Choose a track"}</span>
          {current && <span className={styles.trackInstrument}>{current.instrument}</span>}
          <Icon name="chevronDown" size={16} />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuHeading>Show track</MenuHeading>
          {song.catalog.map((entry) => (
            <MenuItem
              key={entry.partId}
              selected={entry.partId === partId}
              disabled={!entry.captured}
              hint={entry.captured ? trackSubtitle(entry) : "Not captured"}
              onSelect={() => {
                engine.selectTrack(entry.partId);
                close();
              }}
            >
              {trackTitle(entry)}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function ViewMenu() {
  const engine = useEngine();
  const notation = useSetting("notation");
  const zoom = useSetting("zoom");

  return (
    <Popover
      align="end"
      trigger={({ toggle }) => (
        <Button variant="ghost" onClick={toggle}>
          View
        </Button>
      )}
    >
      {() => (
        <>
          <MenuHeading>Notation</MenuHeading>
          <MenuItem selected={notation === "tab"} onSelect={() => engine.setNotation("tab")}>
            Tab only
          </MenuItem>
          <MenuItem selected={notation === "tabAndScore"} onSelect={() => engine.setNotation("tabAndScore")}>
            Tab and standard notation
          </MenuItem>
          <MenuHeading>Zoom</MenuHeading>
          <div className={styles.zoom}>
            <IconButton
              icon="minus"
              label="Zoom out"
              disabled={zoom <= ZOOM_RANGE.min}
              onClick={() => engine.setZoom(zoom - ZOOM_RANGE.step)}
            />
            <span>{formatPercent(zoom)}</span>
            <IconButton
              icon="plus"
              label="Zoom in"
              disabled={zoom >= ZOOM_RANGE.max}
              onClick={() => engine.setZoom(zoom + ZOOM_RANGE.step)}
            />
          </div>
        </>
      )}
    </Popover>
  );
}
