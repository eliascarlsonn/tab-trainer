import { create } from "zustand";
import { allPracticeSettings, savePracticeSettings } from "@/practice/practiceSettings";
import { createBackup } from "./backup";
import { importSongs, type ImportOptions, type ImportOutcome } from "./importSongs";
import { normalizeSong, type Song } from "./song";
import { songRepository } from "./songRepository";

interface LibraryState {
  songs: Record<string, Song>;
  loaded: boolean;
  load(): Promise<void>;
  importFiles(files: readonly File[], options?: ImportOptions): Promise<ImportOutcome>;
  /** Removes a song; its practice settings are kept, so `restore` (undo) brings everything back. */
  remove(id: string): Promise<void>;
  restore(song: Song): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  markPlayed(id: string): Promise<void>;
  /** The whole library and its practice settings as a backup file's text. */
  backup(): Promise<string>;
}

const byId = (songs: Song[]) => Object.fromEntries(songs.map((s) => [s.id, s]));

/**
 * Asks the browser not to clear the library when disk space runs low. Chrome decides quietly;
 * Firefox may ask once. Either way the library still works if it says no.
 */
function keepStorage() {
  void navigator.storage?.persisted?.().then((persisted) => persisted || navigator.storage.persist());
}

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

    async importFiles(files, options) {
      const outcome = await importSongs(files, (id) => getState().songs[id], options);
      await Promise.all(Object.entries(outcome.practice).map(([id, settings]) => savePracticeSettings(id, settings)));
      await save(outcome.songs);
      if (outcome.songs.length > 0) keepStorage();
      return outcome;
    },

    async remove(id) {
      await songRepository.remove(id);
      setState((state) => {
        const { [id]: _removed, ...songs } = state.songs;
        return { songs };
      });
    },

    async restore(song) {
      await save([song]);
    },

    async setFavorite(id, favorite) {
      const song = getState().songs[id];
      if (song) await save([{ ...song, favorite }]);
    },

    async markPlayed(id) {
      const song = getState().songs[id];
      if (song) await save([{ ...song, lastPlayedAt: Date.now() }]);
    },

    async backup() {
      const songs = Object.values(getState().songs);
      const settings = await allPracticeSettings();
      // Settings of songs removed from the library stay in storage; they don't belong in a backup.
      const practice = Object.fromEntries(songs.flatMap((s) => (settings[s.id] ? [[s.id, settings[s.id]!]] : [])));
      return createBackup({ songs, practice });
    },
  };
});
