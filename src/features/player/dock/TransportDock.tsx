import type { Song } from "@/library/song";
import { LoopControls } from "./LoopControls";
import { PracticeKnobs } from "./PracticeKnobs";
import { SourceControls } from "./SourceControls";
import { TransportControls } from "./TransportControls";
import styles from "./dock.module.css";

/** The bottom control panel, laid out like an amplifier's front panel. */
export function TransportDock({ song }: { song: Song }) {
  return (
    <footer className={styles.dock} aria-label="Playback controls">
      <TransportControls />
      <div className={styles.divider} />
      <PracticeKnobs />
      <div className={styles.divider} />
      <LoopControls />
      <div className={styles.divider} />
      <SourceControls song={song} />
    </footer>
  );
}
