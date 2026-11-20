import { routes } from "@/app/useHashRoute";
import { formatRelative } from "@/lib/format";
import type { Song } from "@/library/song";
import { IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import styles from "./SongList.module.css";

interface SongListProps {
  songs: Song[];
  onRemove: (song: Song) => void;
}

function trackSummary(song: Song): string {
  const captured = song.catalog.filter((t) => t.captured).length;
  return captured === song.catalog.length ? `${captured} tracks` : `${captured} of ${song.catalog.length} tracks`;
}

export function SongList({ songs, onRemove }: SongListProps) {
  return (
    <ul className={styles.list}>
      {songs.map((song) => (
        <li key={song.id} className={styles.row}>
          <a className={styles.link} href={routes.song(song.id)}>
            <span className={styles.title}>{song.title}</span>
            <span className={styles.artist}>{song.artist}</span>
          </a>
          <span className={styles.meta}>{trackSummary(song)}</span>
          <span className={styles.meta} title={song.videos.length ? "Synced video available" : "No synced video"}>
            {song.videos.length > 0 && <Icon name="video" size={16} />}
          </span>
          <span className={styles.meta}>
            {song.lastPlayedAt ? `Played ${formatRelative(song.lastPlayedAt)}` : "Not played yet"}
          </span>
          <IconButton
            className={styles.remove}
            icon="trash"
            label={`Remove ${song.title}`}
            onClick={() => onRemove(song)}
          />
        </li>
      ))}
    </ul>
  );
}
