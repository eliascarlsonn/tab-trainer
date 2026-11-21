import { create } from "zustand";
import { importSongs, type ImportOutcome } from "./importSongs";
import { normalizeSong, type Song } from "./song";
import { songRepository } from "./songRepository";

interface LibraryState {
  songs: Record<string, Song>;
  loaded: boolean;
  load(): Promise<void>;
  importFiles(files: readonly File[]): Promise<ImportOutcome>;
  remove(id: string): Promise<void>;
  markPlayed(id: string): Promise<void>;
}

const byId = (songs: Song[]) => Object.fromEntries(songs.map((s) => [s.id, s]));

export const useLibrary = create<LibraryState>()((setState, getState) => {
  const save = async (songs: Song[]) => {
    await Promise.all(songs.map((song) => songRepository.put(song.id, song)));
    setState((state) => ({ songs: { ...state.songs, ...byId(songs) } }));
  };

  return {
    songs: {},
    loaded: false,

    async load() {
      setState({ songs: byId((await songRepository.all()).map(normalizeSong)), loaded: true });
    },

    async importFiles(files) {
      const outcome = await importSongs(files, (id) => getState().songs[id]);
      await save(outcome.songs);
      return outcome;
    },

    async remove(id) {
      await songRepository.remove(id);
      setState((state) => {
        const { [id]: _removed, ...songs } = state.songs;
        return { songs };
      });
    },

    async markPlayed(id) {
      const song = getState().songs[id];
      if (song) await save([{ ...song, lastPlayedAt: Date.now() }]);
    },
  };
});

/** Songs ordered with the most recently used first. */
export function sortByRecent(songs: Record<string, Song>): Song[] {
  const recency = (s: Song) => s.lastPlayedAt ?? s.importedAt;
  return Object.values(songs).sort((a, b) => recency(b) - recency(a));
}
