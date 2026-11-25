import type { Song } from "./song";

export type SongOrder = "recent" | "added" | "title" | "artist";

export const SONG_ORDERS: { id: SongOrder; label: string }[] = [
  { id: "recent", label: "Recently played" },
  { id: "added", label: "Recently added" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
];

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** "The Beatles" files under B, as in a record shop. */
const sortName = (name: string) => name.replace(/^the\s+/i, "");

const byTitle = (a: Song, b: Song) => collator.compare(sortName(a.title), sortName(b.title));
const byArtist = (a: Song, b: Song) => collator.compare(sortName(a.artist), sortName(b.artist));
const recency = (s: Song) => s.lastPlayedAt ?? s.importedAt;

const COMPARE: Record<SongOrder, (a: Song, b: Song) => number> = {
  // Songs never played count from when they were added, so a fresh import shows at the top.
  recent: (a, b) => recency(b) - recency(a),
  added: (a, b) => b.importedAt - a.importedAt,
  title: (a, b) => byTitle(a, b) || byArtist(a, b),
  artist: (a, b) => byArtist(a, b) || byTitle(a, b),
};

export function sortSongs(songs: Iterable<Song>, order: SongOrder): Song[] {
  return [...songs].sort(COMPARE[order]);
}
