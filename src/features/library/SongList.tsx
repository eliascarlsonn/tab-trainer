import { routes } from "@/app/useHashRoute";
import { formatRelative } from "@/lib/format";
import type { SongOrder } from "@/library/librarySort";
import type { Song } from "@/library/song";
import { IconButton } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { cx } from "@/lib/cx";
import styles from "./SongList.module.css";

interface SongListProps {
  songs: Song[];
  /** The list's order; sorted by date added, the rows say when each song was added. */
  order: SongOrder;
  onFavorite: (song: Song, favorite: boolean) => void;
  onRemove: (song: Song) => void;
}

function trackSummary(song: Song): string {
  const captured = song.catalog.filter((t) => t.captured).length;
  const total = song.catalog.length;
  const noun = total === 1 ? "track" : "tracks";
  return captured === total ? `${total} ${noun}` : `${captured} of ${total} ${noun}`;
}

function dateNote(song: Song, order: SongOrder): string {
  if (order === "added") return `Added ${formatRelative(song.importedAt)}`;
  return song.lastPlayedAt ? `Played ${formatRelative(song.lastPlayedAt)}` : "Not played yet";
}

export function SongList({ songs, order, onFavorite, onRemove }: SongListProps) {
  return (
    <ul className={styles.list}>
      {songs.map((song) => (
        <li key={song.id} className={styles.row}>
          <IconButton
            className={cx(styles.star, song.favorite && styles.starred)}
            icon={song.favorite ? "starFilled" : "star"}
            label={song.favorite ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
            active={!!song.favorite}
            onClick={() => onFavorite(song, !song.favorite)}
          />
          <a className={styles.link} href={routes.song(song.id)}>
            <span className={styles.title}>{song.title}</span>
            <span className={styles.artist}>{song.artist}</span>
          </a>
          <span className={styles.meta}>{trackSummary(song)}</span>
          <span className={styles.meta} title={song.videos.length ? "Synced video available" : "No synced video"}>
            {song.videos.length > 0 && <Icon name="video" size={16} />}
          </span>
          <span className={styles.meta}>{dateNote(song, order)}</span>
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
